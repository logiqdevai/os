import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, TimeEntrySource, TimeEntryStatus, TimesheetActionType, TimesheetStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, TimeAccessService } from '../common/time-access.service';
import { EDITABLE_STATUSES, EntryInput, TimeLedgerService } from '../common/time-ledger.service';
import { isoDate, toDateOnly, weekPeriod } from '../common/time-dates';
import { CreateTimeEntryDto, MarkInvoicedDto, UpdateTimeEntryDto, WeekGridDto } from './dto/time-entry.dto';
import { TimeEntryQuery } from './dto/time-entry-query.schema';

export const ENTRY_INCLUDE = {
    membership: { select: MEMBER_SELECT },
    project: { select: { id: true, name: true, code: true, color: true, company: { select: { id: true, name: true } } } },
    task: { select: { id: true, number: true, title: true, team: { select: { task_key: true } } } },
    activity_type: { select: { id: true, name: true, color: true } },
    timesheet: { select: { id: true, status: true, period_start: true, period_end: true } },
} satisfies Prisma.TimeEntryInclude;

/** Where an entry came from when it was not typed in by hand (internal callers only). */
export interface EntryOrigin {
    source: TimeEntrySource;
    calendar_event_id?: string | null;
    import_job_id?: string | null;
    external_ref?: string | null;
}

/** 18 §3 — time entries: scoped reads (own / team / all), validated writes, soft delete, single approvals, unlock. */
@Injectable()
export class TimeEntriesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
        private readonly ledger: TimeLedgerService,
    ) { }

    async findAll(ctx: OrgContext, query: TimeEntryQuery) {
        const scope = this.access.effectiveScope(ctx, query.scope);
        const ids = await this.access.memberIds(ctx, scope);
        const where: Prisma.TimeEntryWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            ...(ids && { membership_id: { in: ids } }),
            ...(query.membership_id && { AND: [{ membership_id: query.membership_id }] }),
            ...((query.from || query.to) && { date: { ...(query.from && { gte: toDateOnly(query.from) }), ...(query.to && { lte: toDateOnly(query.to) }) } }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.no_project && { project_id: null }),
            ...(query.task_id && { task_id: query.task_id }),
            ...(query.activity_type_id && { activity_type_id: query.activity_type_id }),
            ...(query.timesheet_id && { timesheet_id: query.timesheet_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.source && { source: query.source }),
            ...(query.billable !== undefined && { is_billable: query.billable }),
            ...(query.invoiced !== undefined && { invoice_id: query.invoiced ? { not: null } : null }),
            ...(query.search && { description: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total, sums] = await Promise.all([
            this.prisma.timeEntry.findMany({ where, ...skipTake(query), orderBy: [orderBy(query, ['date', 'duration_minutes', 'created_at'], 'date'), { created_at: 'desc' }], include: ENTRY_INCLUDE }),
            this.prisma.timeEntry.count({ where }),
            this.prisma.timeEntry.aggregate({ where, _sum: { duration_minutes: true, billable_minutes: true } }),
        ]);
        return {
            ...paginate(items.map((e) => this.access.stripAmounts(ctx, e)), total, query),
            scope,
            totals: { duration_minutes: sums._sum.duration_minutes ?? 0, billable_minutes: sums._sum.billable_minutes ?? 0 },
        };
    }

    async findOne(ctx: OrgContext, id: string) {
        const entry = await this.prisma.timeEntry.findFirst({
            where: { id, organization_id: ctx.organization_id, deleted_at: null },
            include: {
                ...ENTRY_INCLUDE,
                approved_by: { select: MEMBER_SELECT },
                rejected_by: { select: MEMBER_SELECT },
                adjustments: { orderBy: { created_at: 'desc' } },
                invoice: { select: { id: true, number: true } },
            },
        });
        if (!entry || !(await this.visible(ctx, entry.membership_id))) throw new NotFoundException({ message: 'Time entry not found', code: 'time_entry_not_found' });
        return this.access.stripAmounts(ctx, entry);
    }

    /**
     * `origin` is set by internal callers only (accepted suggestions, imports): the entry source and its link to the
     * calendar event / import job / source row. REST and MCP never pass it.
     */
    async create(ctx: OrgContext, dto: CreateTimeEntryDto, origin?: EntryOrigin) {
        const membershipId = await this.actorFor(ctx, dto.membership_id, 'create');
        const settings = await this.access.settings(ctx.organization_id);
        const data = await this.ledger.prepare(ctx, { ...dto, membership_id: membershipId, source: origin?.source }, { settings });
        const employeeId = await this.access.employeeIdOf(membershipId);
        const entry = await this.prisma.$transaction(async (tx) => {
            const sheet = await this.ledger.openTimesheet(tx, ctx, membershipId, data.date, settings);
            const row = await tx.timeEntry.create({
                data: {
                    ...data, organization_id: ctx.organization_id, employee_id: employeeId, timesheet_id: sheet.id, status: TimeEntryStatus.DRAFT, created_by_user_id: ctx.user_id,
                    calendar_event_id: origin?.calendar_event_id ?? null, import_job_id: origin?.import_job_id ?? null, external_ref: origin?.external_ref ?? null,
                },
                include: ENTRY_INCLUDE,
            });
            await this.ledger.recompute(tx, sheet.id);
            return row;
        });
        await this.audit.record(ctx, 'time.entry.created', { resource_type: 'time_entry', resource_id: entry.id, branch_id: entry.branch_id, metadata: { after: { ...dto, duration_minutes: entry.duration_minutes, entered_minutes: dto.duration_minutes }, ...(origin && { source: origin.source, import_job_id: origin.import_job_id, suggestion: origin.calendar_event_id }) } });
        this.events.publish(ctx, {
            event_key: 'time.entry.created', module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: entry.id,
            payload: { owner_membership_id: membershipId, project_id: entry.project_id, task_id: entry.task_id, date: isoDate(entry.date), duration_minutes: entry.duration_minutes, is_billable: entry.is_billable },
        });
        return this.access.stripAmounts(ctx, entry);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateTimeEntryDto) {
        const before = await this.prisma.timeEntry.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null } });
        if (!before || !(await this.visible(ctx, before.membership_id))) throw new NotFoundException({ message: 'Time entry not found', code: 'time_entry_not_found' });
        await this.assertCanEdit(ctx, before.membership_id);
        this.ledger.assertEditable(before);
        if (dto.membership_id && dto.membership_id !== before.membership_id) throw new BadRequestException({ message: 'An entry cannot be moved to another member', code: 'membership_immutable' });

        const settings = await this.access.settings(ctx.organization_id);
        const input: EntryInput = {
            membership_id: before.membership_id,
            date: dto.date ?? before.date,
            start_at: dto.start_at !== undefined ? dto.start_at : dto.duration_minutes !== undefined ? null : before.start_at,
            end_at: dto.end_at !== undefined ? dto.end_at : dto.duration_minutes !== undefined ? null : before.end_at,
            duration_minutes: dto.duration_minutes ?? before.duration_minutes,
            project_id: dto.project_id !== undefined ? dto.project_id : before.project_id,
            task_id: dto.task_id !== undefined ? dto.task_id : before.task_id,
            activity_type_id: dto.activity_type_id !== undefined ? dto.activity_type_id : before.activity_type_id,
            description: dto.description !== undefined ? dto.description : before.description,
            is_billable: dto.is_billable ?? (before.billable_overridden ? before.is_billable : undefined),
            billable_override_reason: dto.billable_override_reason ?? before.billable_override_reason,
            non_billable_category: dto.non_billable_category !== undefined ? dto.non_billable_category : before.non_billable_category,
            source: before.source,
        };
        const data = await this.ledger.prepare(ctx, input, { excludeEntryId: id, settings });
        const entry = await this.prisma.$transaction(async (tx) => {
            const sheet = await this.ledger.openTimesheet(tx, ctx, before.membership_id, data.date, settings);
            const row = await tx.timeEntry.update({
                where: { id },
                data: { ...data, source: before.source, timesheet_id: sheet.id, status: TimeEntryStatus.DRAFT, rejection_reason: null },
                include: ENTRY_INCLUDE,
            });
            await this.ledger.recompute(tx, sheet.id);
            if (before.timesheet_id && before.timesheet_id !== sheet.id) await this.ledger.recompute(tx, before.timesheet_id);
            return row;
        });
        await this.audit.record(ctx, 'time.entry.updated', {
            resource_type: 'time_entry', resource_id: id, branch_id: entry.branch_id,
            metadata: { before: { date: isoDate(before.date), duration_minutes: before.duration_minutes, project_id: before.project_id, task_id: before.task_id, is_billable: before.is_billable, description: before.description }, after: dto },
        });
        this.events.publish(ctx, {
            event_key: 'time.entry.updated', module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: id,
            payload: { owner_membership_id: before.membership_id, project_id: entry.project_id }, changes: dto as Record<string, unknown>,
        });
        return this.access.stripAmounts(ctx, entry);
    }

    async remove(ctx: OrgContext, id: string) {
        const entry = await this.prisma.timeEntry.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null } });
        if (!entry || !(await this.visible(ctx, entry.membership_id))) throw new NotFoundException({ message: 'Time entry not found', code: 'time_entry_not_found' });
        const own = entry.membership_id === ctx.membership_id;
        if (own ? !ctx.can('time.entries.delete_own') : !(await this.access.canActOnMember(ctx, entry.membership_id, 'time.entries.update_team'))) {
            throw new ForbiddenException({ message: 'You cannot delete this entry', code: 'permission_denied' });
        }
        this.ledger.assertEditable(entry);
        await this.prisma.$transaction(async (tx) => {
            await tx.timeEntry.update({ where: { id }, data: { deleted_at: new Date() } });
            if (entry.timer_id) await tx.timeEntry.update({ where: { id }, data: { timer_id: null } });
            await this.ledger.recompute(tx, entry.timesheet_id);
        });
        await this.audit.record(ctx, 'time.entry.deleted', { resource_type: 'time_entry', resource_id: id, branch_id: entry.branch_id, metadata: { before: { date: isoDate(entry.date), duration_minutes: entry.duration_minutes, project_id: entry.project_id } } });
        this.events.publish(ctx, { event_key: 'time.entry.deleted', module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: id, payload: { owner_membership_id: entry.membership_id } });
        return { success: true };
    }

    /** Single-entry approval (outside a timesheet flow, e.g. corrections). */
    async decide(ctx: OrgContext, id: string, approve: boolean, reason?: string) {
        const entry = await this.prisma.timeEntry.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null } });
        if (!entry || !(await this.visible(ctx, entry.membership_id))) throw new NotFoundException({ message: 'Time entry not found', code: 'time_entry_not_found' });
        const settings = await this.access.settings(ctx.organization_id);
        if (entry.membership_id === ctx.membership_id && !settings.allow_self_approval) throw new ForbiddenException({ message: 'You cannot approve or reject your own time', code: 'self_approval_blocked' });
        if (entry.status !== TimeEntryStatus.SUBMITTED && entry.status !== TimeEntryStatus.DRAFT) throw new ConflictException({ message: `This entry is already ${entry.status.toLowerCase()}`, code: 'entry_already_decided' });
        if (!approve && !reason?.trim()) throw new BadRequestException({ message: 'A reason is required to reject', code: 'reason_required' });
        const now = new Date();
        const row = await this.prisma.timeEntry.update({
            where: { id },
            data: approve
                ? { status: TimeEntryStatus.APPROVED, approved_at: now, approved_by_membership_id: ctx.membership_id, ...(settings.lock_on_approval && { is_locked: true, locked_at: now, locked_by_membership_id: ctx.membership_id }) }
                : { status: TimeEntryStatus.REJECTED, rejected_at: now, rejected_by_membership_id: ctx.membership_id, rejection_reason: reason },
            include: ENTRY_INCLUDE,
        });
        const key = approve ? 'time.entry.approved' : 'time.entry.rejected';
        await this.audit.record(ctx, key, { resource_type: 'time_entry', resource_id: id, metadata: { reason } });
        this.events.publish(ctx, { event_key: key, module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: id, payload: { owner_membership_id: entry.membership_id, reason } });
        return this.access.stripAmounts(ctx, row);
    }

    async unlock(ctx: OrgContext, id: string, reason: string) {
        const entry = await this.prisma.timeEntry.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null } });
        if (!entry || !(await this.visible(ctx, entry.membership_id))) throw new NotFoundException({ message: 'Time entry not found', code: 'time_entry_not_found' });
        if (entry.invoice_id) throw new ConflictException({ message: 'Invoiced entries cannot be unlocked; use an adjustment in Billing', code: 'entry_invoiced' });
        if (!entry.is_locked && EDITABLE_STATUSES.includes(entry.status)) throw new ConflictException({ message: 'This entry is not locked', code: 'entry_not_locked' });
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.timeEntry.update({
                where: { id },
                data: { is_locked: false, status: TimeEntryStatus.DRAFT, unlocked_at: now, unlocked_by_membership_id: ctx.membership_id, unlock_reason: reason, approved_at: null, approved_by_membership_id: null },
                include: ENTRY_INCLUDE,
            });
            if (entry.timesheet_id) {
                const sheet = await tx.timesheet.findUnique({ where: { id: entry.timesheet_id } });
                if (sheet && sheet.status !== TimesheetStatus.OPEN) {
                    await tx.timesheet.update({ where: { id: sheet.id }, data: { status: TimesheetStatus.OPEN, unlocked_at: now, unlocked_by_membership_id: ctx.membership_id, unlock_reason: reason } });
                    await tx.timesheetAction.create({ data: { timesheet_id: sheet.id, action: TimesheetActionType.UNLOCKED, actor_membership_id: ctx.membership_id, comment: reason, from_status: sheet.status, to_status: TimesheetStatus.OPEN } });
                }
            }
            return updated;
        });
        await this.audit.record(ctx, 'time.entry.unlocked', { resource_type: 'time_entry', resource_id: id, metadata: { reason } });
        this.events.publish(ctx, { event_key: 'time.entry.unlocked', module: ModuleKey.TIME_TRACKING, entity_type: 'TIME_ENTRY', entity_id: id, payload: { owner_membership_id: entry.membership_id, reason } });
        return this.access.stripAmounts(ctx, row);
    }

    /**
     * Week grid save (PUT /time/entries/bulk). One grid row = project + task + activity + billable; each non-empty cell
     * is one manual TimeEntry. Cells holding several entries (timer, imports) are read-only and reported as skipped.
     */
    async saveWeek(ctx: OrgContext, dto: WeekGridDto) {
        const membershipId = await this.actorFor(ctx, dto.membership_id, 'create');
        if (membershipId !== ctx.membership_id && !(await this.access.canActOnMember(ctx, membershipId, 'time.entries.update_team'))) {
            throw new ForbiddenException({ message: 'You cannot edit this member\'s week', code: 'permission_denied' });
        }
        if (membershipId === ctx.membership_id && !ctx.can('time.entries.update_own')) throw new ForbiddenException({ message: 'You cannot edit your time', code: 'permission_denied' });
        const settings = await this.access.settings(ctx.organization_id);
        const { period_start, period_end } = weekPeriod(toDateOnly(dto.period_start), settings.week_start);
        const existing = await this.prisma.timeEntry.findMany({ where: { membership_id: membershipId, organization_id: ctx.organization_id, deleted_at: null, date: { gte: period_start, lte: period_end } } });
        const result = { created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: [] as { date: string; reason: string }[], errors: [] as { date: string; message: string }[] };

        for (const row of dto.rows) {
            for (const [day, rawMinutes] of Object.entries(row.days)) {
                const date = toDateOnly(day);
                if (date < period_start || date > period_end) {
                    result.skipped.push({ date: day, reason: 'outside_period' });
                    continue;
                }
                const minutes = Math.max(0, Math.round(Number(rawMinutes) || 0));
                const cell = existing.filter((e) => isoDate(e.date) === day && (e.project_id ?? null) === (row.project_id ?? null) && (e.task_id ?? null) === (row.task_id ?? null) && (e.activity_type_id ?? null) === (row.activity_type_id ?? null) && e.is_billable === row.is_billable);
                const current = cell.reduce((s, e) => s + e.duration_minutes, 0);
                if (current === minutes) {
                    result.unchanged++;
                    continue;
                }
                if (cell.length > 1) {
                    result.skipped.push({ date: day, reason: 'multiple_entries' });
                    continue;
                }
                try {
                    if (cell.length === 1) {
                        if (minutes === 0) await this.remove(ctx, cell[0].id);
                        else await this.update(ctx, cell[0].id, { duration_minutes: minutes, ...(row.description !== undefined && { description: row.description }) });
                        result[minutes === 0 ? 'deleted' : 'updated']++;
                    } else if (minutes > 0) {
                        await this.create(ctx, {
                            date: day, duration_minutes: minutes, project_id: row.project_id ?? null, task_id: row.task_id ?? null, activity_type_id: row.activity_type_id ?? null,
                            description: row.description ?? null, is_billable: row.is_billable, billable_override_reason: 'Set in the week grid', membership_id: membershipId,
                        });
                        result.created++;
                    }
                } catch (error) {
                    const res = (error as { getResponse?: () => unknown }).getResponse?.() as { message?: string } | undefined;
                    result.errors.push({ date: day, message: res?.message ?? (error as Error).message });
                }
            }
        }
        return { ...result, period_start: isoDate(period_start), period_end: isoDate(period_end) };
    }

    /** Called by 08 Billing (service account) when approved time is put on an invoice. */
    async markInvoiced(ctx: OrgContext, dto: MarkInvoicedDto) {
        const invoice = await this.prisma.invoice.findFirst({ where: { id: dto.invoice_id, organization_id: ctx.organization_id }, select: { id: true } });
        if (!invoice) throw new NotFoundException({ message: 'Invoice not found', code: 'invoice_not_found' });
        const entries = await this.prisma.timeEntry.findMany({ where: { id: { in: dto.entry_ids }, organization_id: ctx.organization_id, deleted_at: null }, select: { id: true, status: true, invoice_id: true, is_billable: true } });
        const bad = entries.filter((e) => e.invoice_id || !e.is_billable || !([TimeEntryStatus.APPROVED, TimeEntryStatus.LOCKED] as TimeEntryStatus[]).includes(e.status));
        if (bad.length || entries.length !== dto.entry_ids.length) {
            throw new ConflictException({ message: 'Only approved, billable, uninvoiced entries can be invoiced', code: 'entries_not_invoiceable', entry_ids: bad.map((e) => e.id) });
        }
        const now = new Date();
        await this.prisma.timeEntry.updateMany({
            where: { id: { in: dto.entry_ids } },
            data: { status: TimeEntryStatus.INVOICED, invoice_id: dto.invoice_id, invoice_line_item_id: dto.invoice_line_item_id ?? null, invoiced_at: now, is_locked: true, locked_at: now },
        });
        await this.audit.record(ctx, 'time.entries.invoiced', { resource_type: 'invoice', resource_id: dto.invoice_id, metadata: { entry_ids: dto.entry_ids, invoice_line_item_id: dto.invoice_line_item_id } });
        this.events.publish(ctx, { event_key: 'time.entries.invoiced', module: ModuleKey.TIME_TRACKING, entity_kind: 'invoice', entity_id: dto.invoice_id, payload: { entry_count: dto.entry_ids.length } });
        return { success: true, count: dto.entry_ids.length };
    }

    // --- helpers ---------------------------------------------------------------------------

    private async visible(ctx: OrgContext, membershipId: string) {
        const ids = await this.access.memberIds(ctx, this.access.maxScope(ctx) ?? 'mine');
        return ids === null || ids.includes(membershipId);
    }

    /** Member the entry is written for: self needs `<action>_own`, someone else `<action>_team` in team scope. */
    private async actorFor(ctx: OrgContext, requested: string | undefined, action: 'create' | 'update') {
        if (!requested || requested === ctx.membership_id) {
            const self = this.access.requireMembership(ctx);
            if (!ctx.can(`time.entries.${action}_own`)) throw new ForbiddenException({ message: 'You cannot log time', code: 'permission_denied' });
            return self;
        }
        const member = await this.prisma.membership.findFirst({ where: { id: requested, organization_id: ctx.organization_id }, select: { id: true } });
        if (!member) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        if (!(await this.access.canActOnMember(ctx, requested, `time.entries.${action}_team`))) {
            throw new ForbiddenException({ message: 'You cannot log time for this member', code: 'permission_denied' });
        }
        return requested;
    }

    private async assertCanEdit(ctx: OrgContext, ownerId: string) {
        if (ownerId === ctx.membership_id) {
            if (!ctx.can('time.entries.update_own')) throw new ForbiddenException({ message: 'You cannot edit your time', code: 'permission_denied' });
            return;
        }
        if (!(await this.access.canActOnMember(ctx, ownerId, 'time.entries.update_team'))) throw new ForbiddenException({ message: 'You cannot edit this member\'s time', code: 'permission_denied' });
    }
}
