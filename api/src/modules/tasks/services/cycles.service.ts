import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CycleStatus, ModuleKey, Prisma, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { addDays, compact, startOfDay, toDate } from '@/modules/projects/utils/projects.utils';
import { CompleteCycleDto, CreateCycleDto, UpdateCycleDto } from '../dto/task-config.dto';
import { CycleQuery } from '../dto/task-query.schema';
import { serializeTask, TASK_LIST_INCLUDE } from '../utils/task-serialize.utils';
import { TasksService } from './tasks.service';

const OPEN: TaskStatusCategory[] = [TaskStatusCategory.BACKLOG, TaskStatusCategory.TODO, TaskStatusCategory.IN_PROGRESS, TaskStatusCategory.IN_REVIEW, TaskStatusCategory.BLOCKED];

/** Cycles / sprints per team or project with progress and burndown (06 §4). Changes need tasks.cycles.manage. */
@Injectable()
export class CyclesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly tasks: TasksService,
    ) { }

    async list(ctx: OrgContext, query: CycleQuery) {
        const where: Prisma.CycleWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.team_id && { team_id: query.team_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.cycle.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ starts_at: 'desc' }],
                include: { team: { select: { id: true, name: true, task_key: true } }, project: { select: { id: true, name: true } } },
            }),
            this.prisma.cycle.count({ where }),
        ]);
        const progress = await this.progressFor(ctx, items.map((c) => c.id));
        return paginate(items.map((c) => ({ ...c, progress: progress.get(c.id) ?? this.emptyProgress() })), total, query);
    }

    async get(ctx: OrgContext, id: string) {
        const cycle = await this.findCycle(ctx, id);
        const tasks = await this.prisma.task.findMany({
            where: { AND: [{ cycle_id: id, archived_at: null }, this.tasks.scopeWhere(ctx)] },
            include: TASK_LIST_INCLUDE,
            orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { created_at: 'asc' }],
        });
        const progress = (await this.progressFor(ctx, [id])).get(id) ?? this.emptyProgress();
        // Burndown: remaining open scope at the end of each day (06 §4); computed from completed_at, never stored.
        const start = startOfDay(cycle.starts_at);
        const end = startOfDay(cycle.ends_at);
        const today = startOfDay();
        const scoped = tasks.filter((t) => t.status?.category !== TaskStatusCategory.CANCELLED);
        const burndown: { date: Date; remaining: number; ideal: number }[] = [];
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
        for (let d = 0, day = start; day <= end; d++, day = addDays(day, 1)) {
            const dayEnd = addDays(day, 1);
            const remaining = day > today ? null : scoped.filter((t) => !t.completed_at || t.completed_at >= dayEnd).length;
            burndown.push({ date: day, remaining, ideal: Math.max(0, Math.round((scoped.length * (1 - d / days)) * 10) / 10) });
        }
        return { ...cycle, progress, burndown, tasks: tasks.map(serializeTask) };
    }

    async create(ctx: OrgContext, dto: CreateCycleDto) {
        const starts = toDate(dto.starts_at) as Date;
        const ends = toDate(dto.ends_at) as Date;
        if (ends < starts) throw new BadRequestException({ message: 'The cycle must end after it starts', code: 'cycle_dates_invalid' });
        if (dto.team_id && !(await this.prisma.team.count({ where: { id: dto.team_id, organization_id: ctx.organization_id } }))) throw new BadRequestException({ message: 'Team not found', code: 'team_not_found' });
        if (dto.project_id && !(await this.prisma.project.count({ where: { id: dto.project_id, organization_id: ctx.organization_id } }))) throw new BadRequestException({ message: 'Project not found', code: 'project_not_found' });
        let cycle;
        for (let attempt = 0; attempt < 3 && !cycle; attempt++) {
            try {
                cycle = await this.prisma.$transaction(async (tx) => {
                    const last = await tx.cycle.aggregate({ where: { organization_id: ctx.organization_id, team_id: dto.team_id ?? null }, _max: { number: true } });
                    const number = (last._max.number ?? 0) + 1;
                    return tx.cycle.create({
                        data: {
                            organization_id: ctx.organization_id, team_id: dto.team_id ?? null, project_id: dto.project_id ?? null, number,
                            name: dto.name || `Cycle ${number}`, goal: dto.goal, starts_at: starts, ends_at: ends,
                            status: starts <= startOfDay() && ends >= startOfDay() ? CycleStatus.ACTIVE : CycleStatus.PLANNED,
                        },
                    });
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') || attempt === 2) throw error;
            }
        }
        await this.audit.record(ctx, 'cycle.created', { resource_type: 'cycle', resource_id: cycle.id, metadata: { after: dto, number: cycle.number } });
        this.events.publish(ctx, { event_key: 'tasks.cycle.created', module: ModuleKey.TASKS, entity_kind: 'cycle', entity_id: cycle.id, payload: { name: cycle.name, team_id: cycle.team_id, starts_at: cycle.starts_at, ends_at: cycle.ends_at } });
        return cycle;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCycleDto) {
        const before = await this.findCycle(ctx, id);
        if (before.status === CycleStatus.COMPLETED) throw new ConflictException({ message: 'Completed cycles cannot be changed', code: 'cycle_completed' });
        const data = compact({ ...dto, starts_at: toDate(dto.starts_at) ?? undefined, ends_at: toDate(dto.ends_at) ?? undefined }) as Prisma.CycleUpdateInput;
        const starts = (data.starts_at as Date) ?? before.starts_at;
        const ends = (data.ends_at as Date) ?? before.ends_at;
        if (ends < starts) throw new BadRequestException({ message: 'The cycle must end after it starts', code: 'cycle_dates_invalid' });
        if (dto.status === CycleStatus.ACTIVE && before.status !== CycleStatus.ACTIVE) {
            const active = await this.prisma.cycle.findFirst({ where: { organization_id: ctx.organization_id, team_id: before.team_id, status: CycleStatus.ACTIVE, id: { not: id } }, select: { name: true } });
            if (active) throw new ConflictException({ message: `${active.name ?? 'Another cycle'} is already active for this team`, code: 'cycle_already_active' });
        }
        const cycle = await this.prisma.cycle.update({ where: { id }, data });
        await this.audit.record(ctx, dto.status === CycleStatus.ACTIVE && before.status !== CycleStatus.ACTIVE ? 'cycle.started' : 'cycle.updated', {
            resource_type: 'cycle', resource_id: id, metadata: { before: { name: before.name, status: before.status, starts_at: before.starts_at, ends_at: before.ends_at }, after: dto },
        });
        if (dto.status === CycleStatus.ACTIVE && before.status !== CycleStatus.ACTIVE) {
            this.events.publish(ctx, { event_key: 'tasks.cycle.started', module: ModuleKey.TASKS, entity_kind: 'cycle', entity_id: id, payload: { name: cycle.name, team_id: cycle.team_id } });
        }
        return cycle;
    }

    /** Complete a cycle and carry unfinished tasks to the next cycle or back to the backlog (one bulk update). */
    async complete(ctx: OrgContext, id: string, dto: CompleteCycleDto) {
        const cycle = await this.findCycle(ctx, id);
        if (cycle.status === CycleStatus.COMPLETED) throw new ConflictException({ message: 'This cycle is already completed', code: 'cycle_completed' });
        let next: { id: string; name: string | null } | null = null;
        if (dto.carry_over === 'next') {
            next = await this.prisma.cycle.findFirst({
                where: { organization_id: ctx.organization_id, team_id: cycle.team_id, id: { not: id }, status: { in: [CycleStatus.PLANNED, CycleStatus.ACTIVE] }, starts_at: { gte: cycle.starts_at } },
                orderBy: { starts_at: 'asc' },
                select: { id: true, name: true },
            });
            if (!next) throw new ConflictException({ message: 'There is no next cycle yet. Create one or move unfinished tasks to the backlog.', code: 'cycle_no_next' });
        }
        const unfinished = await this.prisma.task.findMany({ where: { cycle_id: id, archived_at: null, OR: [{ status_id: null }, { status: { category: { in: OPEN } } }] }, select: { id: true } });
        const updated = await this.prisma.$transaction(async (tx) => {
            if (unfinished.length) await tx.task.updateMany({ where: { id: { in: unfinished.map((t) => t.id) } }, data: { cycle_id: next?.id ?? null } });
            if (next) await tx.cycle.updateMany({ where: { id: next.id, status: CycleStatus.PLANNED, starts_at: { lte: addDays(startOfDay(), 1) } }, data: { status: CycleStatus.ACTIVE } });
            return tx.cycle.update({ where: { id }, data: { status: CycleStatus.COMPLETED, completed_at: new Date() } });
        });
        await this.audit.record(ctx, 'cycle.completed', { resource_type: 'cycle', resource_id: id, metadata: { carry_over: dto.carry_over, moved_task_ids: unfinished.map((t) => t.id), next_cycle_id: next?.id ?? null } });
        this.events.publish(ctx, {
            event_key: 'tasks.cycle.completed', module: ModuleKey.TASKS, entity_kind: 'cycle', entity_id: id,
            payload: { name: cycle.name, team_id: cycle.team_id, carried_over: unfinished.length, carry_over: dto.carry_over, next_cycle_id: next?.id ?? null },
        });
        return { ...updated, carried_over: unfinished.length, next_cycle: next };
    }

    private async findCycle(ctx: OrgContext, id: string) {
        const cycle = await this.prisma.cycle.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { team: { select: { id: true, name: true, task_key: true } }, project: { select: { id: true, name: true } } },
        });
        if (!cycle) throw new NotFoundException({ message: 'Cycle not found', code: 'cycle_not_found' });
        return cycle;
    }

    private emptyProgress() {
        return { total: 0, done: 0, in_progress: 0, cancelled: 0, points_total: 0, points_done: 0, percent: 0 };
    }

    /** Counts per cycle within the caller's task scope. */
    private async progressFor(ctx: OrgContext, cycleIds: string[]) {
        const out = new Map<string, ReturnType<CyclesService['emptyProgress']>>();
        if (!cycleIds.length) return out;
        const rows = await this.prisma.task.findMany({
            where: { AND: [{ cycle_id: { in: cycleIds }, archived_at: null }, this.tasks.scopeWhere(ctx)] },
            select: { cycle_id: true, estimate_points: true, status: { select: { category: true } } },
        });
        for (const r of rows) {
            const p = out.get(r.cycle_id!) ?? this.emptyProgress();
            const pts = r.estimate_points ? Number(r.estimate_points) : 0;
            const cat = r.status?.category;
            if (cat === TaskStatusCategory.CANCELLED) p.cancelled += 1;
            else {
                p.total += 1;
                p.points_total += pts;
                if (cat === TaskStatusCategory.DONE) {
                    p.done += 1;
                    p.points_done += pts;
                } else if (cat === TaskStatusCategory.IN_PROGRESS || cat === TaskStatusCategory.IN_REVIEW) p.in_progress += 1;
            }
            out.set(r.cycle_id!, p);
        }
        for (const p of out.values()) p.percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return out;
    }
}
