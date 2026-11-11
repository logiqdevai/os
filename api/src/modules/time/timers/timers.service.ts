import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Timer, TimeEntrySource, TimeEntryStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TimeAccessService } from '../common/time-access.service';
import { TimeLedgerService } from '../common/time-ledger.service';
import { isoDate, toDateOnly } from '../common/time-dates';
import { ENTRY_INCLUDE } from '../entries/time-entries.service';
import { StartTimerDto, UpdateTimerDto } from './dto/timer.dto';

const TIMER_INCLUDE = {
    project: { select: { id: true, name: true, code: true, color: true } },
    task: { select: { id: true, number: true, title: true, team: { select: { task_key: true } } } },
    activity_type: { select: { id: true, name: true, color: true } },
} as const;

/** 18 §2, §4 — the running timer. At most one per member (stopped_at and discarded_at both null). */
@Injectable()
export class TimersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
        private readonly ledger: TimeLedgerService,
    ) { }

    /** Elapsed working minutes: now − started_at − paused time − discarded idle time. */
    static elapsedMinutes(t: Pick<Timer, 'started_at' | 'paused_at' | 'paused_minutes' | 'idle_discarded_minutes'>, now = new Date()) {
        const pausedNow = t.paused_at ? (now.getTime() - t.paused_at.getTime()) / 60000 : 0;
        return Math.max(0, (now.getTime() - t.started_at.getTime()) / 60000 - t.paused_minutes - pausedNow - t.idle_discarded_minutes);
    }

    private decorate(t: Timer & Record<string, unknown>) {
        return { ...t, elapsed_seconds: Math.round(TimersService.elapsedMinutes(t) * 60), is_paused: !!t.paused_at };
    }

    async current(ctx: OrgContext) {
        const membershipId = this.access.requireMembership(ctx);
        const timer = await this.prisma.timer.findFirst({ where: { membership_id: membershipId, organization_id: ctx.organization_id, stopped_at: null, discarded_at: null }, include: TIMER_INCLUDE, orderBy: { started_at: 'desc' } });
        return { timer: timer ? this.decorate(timer) : null };
    }

    async start(ctx: OrgContext, dto: StartTimerDto) {
        const membershipId = this.access.requireMembership(ctx);
        const running = await this.prisma.timer.findFirst({ where: { membership_id: membershipId, organization_id: ctx.organization_id, stopped_at: null, discarded_at: null }, include: TIMER_INCLUDE });
        if (running) {
            if (!dto.stop_current) throw new ConflictException({ message: 'A timer is already running. Stop it first.', code: 'timer_running', timer: this.decorate(running) });
            await this.stop(ctx, running.id);
        }
        let projectId = dto.project_id ?? null;
        if (dto.task_id) {
            const task = await this.prisma.task.findFirst({ where: { id: dto.task_id, organization_id: ctx.organization_id }, select: { project_id: true } });
            if (!task) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
            projectId = task.project_id ?? projectId;
        }
        if (projectId && !(await this.prisma.project.findFirst({ where: { id: projectId, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        }
        const timer = await this.prisma.timer.create({
            data: {
                organization_id: ctx.organization_id, membership_id: membershipId, project_id: projectId, task_id: dto.task_id ?? null, activity_type_id: dto.activity_type_id ?? null,
                description: dto.description ?? null, is_billable: dto.is_billable ?? null, device: dto.device ?? ctx.channel, last_heartbeat_at: new Date(),
            },
            include: TIMER_INCLUDE,
        });
        await this.audit.record(ctx, 'time.timer.started', { resource_type: 'timer', resource_id: timer.id, metadata: { project_id: projectId, task_id: dto.task_id } });
        this.events.publish(ctx, { event_key: 'time.timer.started', module: ModuleKey.TIME_TRACKING, entity_kind: 'timer', entity_id: timer.id, payload: { owner_membership_id: membershipId, project_id: projectId, task_id: dto.task_id ?? null } });
        return this.decorate(timer);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTimerDto) {
        await this.own(ctx, id);
        const timer = await this.prisma.timer.update({ where: { id }, data: dto, include: TIMER_INCLUDE });
        return this.decorate(timer);
    }

    async pause(ctx: OrgContext, id: string) {
        const t = await this.own(ctx, id);
        if (t.paused_at) return this.decorate(t);
        const timer = await this.prisma.timer.update({ where: { id }, data: { paused_at: new Date() }, include: TIMER_INCLUDE });
        return this.decorate(timer);
    }

    async resume(ctx: OrgContext, id: string) {
        const t = await this.own(ctx, id);
        if (!t.paused_at) return this.decorate(t);
        const extra = Math.round((Date.now() - t.paused_at.getTime()) / 60000);
        const timer = await this.prisma.timer.update({ where: { id }, data: { paused_at: null, paused_minutes: t.paused_minutes + extra, last_heartbeat_at: new Date() }, include: TIMER_INCLUDE });
        return this.decorate(timer);
    }

    async discard(ctx: OrgContext, id: string) {
        const t = await this.own(ctx, id);
        await this.prisma.timer.update({ where: { id }, data: { discarded_at: new Date(), stopped_at: new Date() } });
        await this.audit.record(ctx, 'time.timer.discarded', { resource_type: 'timer', resource_id: id, metadata: { elapsed_minutes: Math.round(TimersService.elapsedMinutes(t)) } });
        this.events.publish(ctx, { event_key: 'time.timer.discarded', module: ModuleKey.TIME_TRACKING, entity_kind: 'timer', entity_id: id, payload: { owner_membership_id: t.membership_id } });
        return { success: true };
    }

    /** Stop → one TimeEntry (source TIMER) through the same validation as manual entries. On failure the timer keeps running. */
    async stop(ctx: OrgContext, id: string) {
        const t = await this.own(ctx, id);
        const now = new Date();
        const minutes = Math.max(1, Math.round(TimersService.elapsedMinutes(t, now)));
        const settings = await this.access.settings(ctx.organization_id);
        const date = toDateOnly(t.started_at);
        const data = await this.ledger.prepare(ctx, {
            membership_id: t.membership_id, date, duration_minutes: minutes, project_id: t.project_id, task_id: t.task_id, activity_type_id: t.activity_type_id,
            description: t.description, is_billable: t.is_billable ?? undefined, source: TimeEntrySource.TIMER,
        }, { settings });
        const employeeId = await this.access.employeeIdOf(t.membership_id);
        const entry = await this.prisma.$transaction(async (tx) => {
            const sheet = await this.ledger.openTimesheet(tx, ctx, t.membership_id, date, settings);
            await tx.timer.update({ where: { id }, data: { stopped_at: now, ...(t.paused_at && { paused_minutes: t.paused_minutes + Math.round((now.getTime() - t.paused_at.getTime()) / 60000), paused_at: null }) } });
            const row = await tx.timeEntry.create({
                data: { ...data, start_at: t.started_at, end_at: now, organization_id: ctx.organization_id, employee_id: employeeId, timesheet_id: sheet.id, timer_id: id, status: TimeEntryStatus.DRAFT, created_by_user_id: ctx.user_id },
                include: ENTRY_INCLUDE,
            });
            await this.ledger.recompute(tx, sheet.id);
            return row;
        });
        await this.audit.record(ctx, 'time.timer.stopped', { resource_type: 'timer', resource_id: id, metadata: { time_entry_id: entry.id, elapsed_minutes: minutes, saved_minutes: entry.duration_minutes } });
        await this.audit.record(ctx, 'time.entry.created', { resource_type: 'time_entry', resource_id: entry.id, branch_id: entry.branch_id, metadata: { source: 'TIMER', timer_id: id } });
        this.events.publish(ctx, {
            event_key: 'time.entry.created', module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: entry.id,
            payload: { owner_membership_id: t.membership_id, project_id: entry.project_id, task_id: entry.task_id, date: isoDate(entry.date), duration_minutes: entry.duration_minutes, source: 'TIMER' },
        });
        return { entry: this.access.stripAmounts(ctx, entry) };
    }

    private async own(ctx: OrgContext, id: string) {
        const membershipId = this.access.requireMembership(ctx);
        const t = await this.prisma.timer.findFirst({ where: { id, organization_id: ctx.organization_id, membership_id: membershipId, stopped_at: null, discarded_at: null }, include: TIMER_INCLUDE });
        if (!t) throw new NotFoundException({ message: 'No running timer with this id', code: 'timer_not_found' });
        return t;
    }
}
