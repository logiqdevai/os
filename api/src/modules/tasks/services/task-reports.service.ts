import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CycleStatus, Prisma, TaskPriority, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { addDays, MEMBER_SELECT, startOfDay } from '@/modules/projects/utils/projects.utils';
import { TaskReportQuery } from '../dto/task-reports.schema';
import { TasksService } from './tasks.service';

const DAY = 86_400_000;
const CLOSED: TaskStatusCategory[] = [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED];
const MAX_ROWS = 10_000;

const median = (values: number[]) => {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return Math.round((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) * 10) / 10;
};
const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);
const days = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / DAY);
/** Monday (UTC) of the week containing `d`. */
const weekStart = (d: Date) => {
    const day = startOfDay(d);
    return addDays(day, -((day.getUTCDay() + 6) % 7));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * 06 §11 — task flow reports for the tasks the caller can see (task scope applies to every number):
 * throughput (completed per week), created vs completed, lead time (created → completed), cycle time (first move to
 * In progress → completed, from TaskStatusHistory), breakdowns by assignee / label / priority, and a cycle burn-up.
 */
@Injectable()
export class TaskReportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tasks: TasksService,
    ) { }

    async report(ctx: OrgContext, q: TaskReportQuery) {
        const to = q.to ? new Date(`${q.to}T00:00:00Z`) : startOfDay();
        const from = q.from ? new Date(`${q.from}T00:00:00Z`) : addDays(weekStart(to), -7 * 7);
        if (from > to) throw new BadRequestException({ message: 'The start of the range must be before its end', code: 'report_range_invalid' });
        if (days(from, to) > 366) throw new BadRequestException({ message: 'Choose a range of one year or less', code: 'report_range_too_long' });
        const end = addDays(to, 1);

        const base: Prisma.TaskWhereInput[] = [
            { organization_id: ctx.organization_id, is_template: false },
            this.tasks.scopeWhere(ctx),
            ...(q.team_id ? [{ team_id: q.team_id }] : []),
            ...(q.project_id ? [{ project_id: q.project_id }] : []),
        ];
        const openWhere: Prisma.TaskWhereInput = { AND: [...base, { archived_at: null }, { OR: [{ status_id: null }, { status: { category: { notIn: CLOSED } } }] }] };
        const today = startOfDay();

        const [completed, created, openNow, overdueNow, blockedNow, openByAssignee, openByPriority, openByLabel] = await Promise.all([
            this.prisma.task.findMany({
                where: { AND: [...base, { completed_at: { gte: from, lt: end } }, { status: { category: TaskStatusCategory.DONE } }] },
                take: MAX_ROWS,
                select: {
                    id: true, created_at: true, completed_at: true, assignee_membership_id: true, priority: true,
                    labels: { select: { label_id: true } },
                    status_history: { where: { to_category: { in: [TaskStatusCategory.IN_PROGRESS, TaskStatusCategory.IN_REVIEW] } }, orderBy: { changed_at: 'asc' }, take: 1, select: { changed_at: true } },
                },
            }),
            this.prisma.task.findMany({ where: { AND: [...base, { created_at: { gte: from, lt: end } }] }, take: MAX_ROWS, select: { created_at: true } }),
            this.prisma.task.count({ where: openWhere }),
            this.prisma.task.count({ where: { AND: [openWhere, { due_date: { lt: today } }] } }),
            this.prisma.task.count({ where: { AND: [openWhere, { OR: [{ blocked: true }, { status: { category: TaskStatusCategory.BLOCKED } }] }] } }),
            this.prisma.task.groupBy({ by: ['assignee_membership_id'], where: openWhere, _count: { _all: true } }),
            this.prisma.task.groupBy({ by: ['priority'], where: openWhere, _count: { _all: true } }),
            this.prisma.taskLabelAssignment.groupBy({ by: ['label_id'], where: { task: openWhere }, _count: { _all: true } }),
        ]);

        // Weekly buckets (Monday-based) covering the range.
        const weeks: { start: Date; created: number; completed: number; cycle: number[]; lead: number[] }[] = [];
        for (let w = weekStart(from); w < end; w = addDays(w, 7)) weeks.push({ start: w, created: 0, completed: 0, cycle: [], lead: [] });
        const bucket = (d: Date) => weeks[Math.min(weeks.length - 1, Math.max(0, Math.floor((weekStart(d).getTime() - weeks[0].start.getTime()) / (7 * DAY))))];
        for (const t of created) bucket(t.created_at).created++;

        const leadAll: number[] = [];
        const cycleAll: number[] = [];
        const byAssignee = new Map<string, { completed: number; cycle: number[] }>();
        const byPriority = new Map<TaskPriority, number>();
        const byLabel = new Map<string, number>();
        for (const t of completed) {
            const done = t.completed_at as Date;
            const b = bucket(done);
            b.completed++;
            const lead = days(t.created_at, done);
            b.lead.push(lead);
            leadAll.push(lead);
            const started = t.status_history[0]?.changed_at;
            const cycle = started && started <= done ? days(started, done) : null;
            if (cycle !== null) {
                b.cycle.push(cycle);
                cycleAll.push(cycle);
            }
            const key = t.assignee_membership_id ?? 'none';
            const a = byAssignee.get(key) ?? { completed: 0, cycle: [] };
            a.completed++;
            if (cycle !== null) a.cycle.push(cycle);
            byAssignee.set(key, a);
            byPriority.set(t.priority, (byPriority.get(t.priority) ?? 0) + 1);
            for (const l of t.labels) byLabel.set(l.label_id, (byLabel.get(l.label_id) ?? 0) + 1);
        }

        const memberIds = [...new Set([...byAssignee.keys(), ...openByAssignee.map((r) => r.assignee_membership_id ?? 'none')])].filter((id) => id !== 'none');
        const labelIds = [...new Set([...byLabel.keys(), ...openByLabel.map((r) => r.label_id)])];
        const [members, labels, burnup] = await Promise.all([
            memberIds.length ? this.prisma.membership.findMany({ where: { id: { in: memberIds }, organization_id: ctx.organization_id }, select: MEMBER_SELECT }) : Promise.resolve([]),
            labelIds.length ? this.prisma.taskLabel.findMany({ where: { id: { in: labelIds }, organization_id: ctx.organization_id }, select: { id: true, name: true, color: true } }) : Promise.resolve([]),
            this.burnup(ctx, q, base),
        ]);
        const memberBy = new Map(members.map((m) => [m.id, m]));
        const openAssignee = new Map(openByAssignee.map((r) => [r.assignee_membership_id ?? 'none', r._count._all]));
        const openPriority = new Map(openByPriority.map((r) => [r.priority, r._count._all]));
        const openLabel = new Map(openByLabel.map((r) => [r.label_id, r._count._all]));

        const assigneeRows = [...new Set([...byAssignee.keys(), ...openAssignee.keys()])]
            .map((id) => ({
                membership: id === 'none' ? null : memberBy.get(id) ?? null,
                completed: byAssignee.get(id)?.completed ?? 0,
                open: openAssignee.get(id) ?? 0,
                median_cycle_days: median(byAssignee.get(id)?.cycle ?? []),
            }))
            .filter((r) => r.membership || r.completed || r.open)
            .sort((a, b) => b.completed - a.completed || b.open - a.open)
            .slice(0, 20);

        return {
            range: { from: iso(from), to: iso(to) },
            truncated: completed.length >= MAX_ROWS || created.length >= MAX_ROWS,
            totals: {
                created: created.length,
                completed: completed.length,
                open: openNow,
                overdue: overdueNow,
                blocked: blockedNow,
                median_lead_days: median(leadAll),
                median_cycle_days: median(cycleAll),
                avg_cycle_days: avg(cycleAll),
                throughput_per_week: weeks.length ? Math.round((completed.length / weeks.length) * 10) / 10 : 0,
            },
            weekly: weeks.map((w) => ({ week_start: iso(w.start), created: w.created, completed: w.completed, median_cycle_days: median(w.cycle), median_lead_days: median(w.lead) })),
            by_assignee: assigneeRows,
            by_priority: Object.values(TaskPriority).map((p) => ({ priority: p, completed: byPriority.get(p) ?? 0, open: openPriority.get(p) ?? 0 })),
            by_label: labels
                .map((l) => ({ label: l, completed: byLabel.get(l.id) ?? 0, open: openLabel.get(l.id) ?? 0 }))
                .sort((a, b) => b.completed + b.open - (a.completed + a.open))
                .slice(0, 20),
            burnup,
        };
    }

    /** Daily scope vs completed for one cycle (tasks and points). Scope = tasks of the cycle that existed that day. */
    private async burnup(ctx: OrgContext, q: TaskReportQuery, base: Prisma.TaskWhereInput[]) {
        const cycle = q.cycle_id
            ? await this.prisma.cycle.findFirst({ where: { id: q.cycle_id, organization_id: ctx.organization_id } })
            : q.team_id
                ? await this.prisma.cycle.findFirst({ where: { organization_id: ctx.organization_id, team_id: q.team_id, status: CycleStatus.ACTIVE }, orderBy: { starts_at: 'desc' } })
                : null;
        if (q.cycle_id && !cycle) throw new NotFoundException({ message: 'Cycle not found', code: 'cycle_not_found' });
        if (!cycle) return null;
        const tasks = await this.prisma.task.findMany({
            where: { AND: [...base, { cycle_id: cycle.id, archived_at: null }, { OR: [{ status_id: null }, { status: { category: { not: TaskStatusCategory.CANCELLED } } }] }] },
            select: { created_at: true, completed_at: true, estimate_points: true },
        });
        const today = startOfDay();
        const last = cycle.ends_at < today ? cycle.ends_at : today;
        const out: { date: string; scope: number; completed: number; scope_points: number; completed_points: number }[] = [];
        for (let day = startOfDay(cycle.starts_at); day <= last; day = addDays(day, 1)) {
            const dayEnd = addDays(day, 1);
            const inScope = tasks.filter((t) => t.created_at < dayEnd || t.created_at <= cycle.starts_at);
            const done = inScope.filter((t) => t.completed_at && t.completed_at < dayEnd);
            const pts = (rows: typeof tasks) => Math.round(rows.reduce((s, t) => s + Number(t.estimate_points ?? 0), 0) * 10) / 10;
            out.push({ date: iso(day), scope: inScope.length, completed: done.length, scope_points: pts(inScope), completed_points: pts(done) });
        }
        return {
            cycle: { id: cycle.id, number: cycle.number, name: cycle.name, status: cycle.status, starts_at: iso(cycle.starts_at), ends_at: iso(cycle.ends_at), team_id: cycle.team_id },
            days: out,
        };
    }
}
