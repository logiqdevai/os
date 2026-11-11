import { BadRequestException, Injectable } from '@nestjs/common';
import { LeaveRequestStatus, Prisma, ProjectItemStatus, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ProjectsService } from '@/modules/projects/services/projects.service';
import { TasksService } from '@/modules/tasks/services/tasks.service';
import { PeopleAccessService } from '@/modules/people/common/people-access.service';
import { P as PEOPLE, personName } from '@/modules/people/common/people.utils';
import { taskIdentifier } from '@/modules/tasks/utils/task-number.utils';
import { ProjectedQuery, PROJECTED_MODULES, ProjectedModule } from './dto/projected.dto';

const MAX_RANGE_DAYS = 120;
const CAP = 500;
const day = (d: Date) => d.toISOString().slice(0, 10);

export interface ProjectedItem {
    key: string;
    module: ProjectedModule;
    kind: 'milestone' | 'task_due' | 'leave';
    title: string;
    /** Inclusive dates (YYYY-MM-DD); projected items are all-day. */
    start_date: string;
    end_date: string;
    /** Token color name (info, success, warning, danger, violet, neutral). */
    color: string;
    link: string;
    done: boolean;
    detail: string | null;
}

/**
 * 19 §5 — read-only overlay of dates owned by other modules: project milestones (05), task due dates (06) and approved
 * leave (10). Rows are read with the owning module's own scope helpers (ProjectsService / TasksService / PeopleAccessService)
 * and only for modules whose read key the caller holds, so nobody sees a date they could not open in its module.
 */
@Injectable()
export class CalendarProjectedService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly projects: ProjectsService,
        private readonly tasks: TasksService,
        private readonly people: PeopleAccessService,
    ) { }

    /** Modules the caller may overlay at all (used by the UI to show the toggles). */
    available(ctx: OrgContext): ProjectedModule[] {
        return PROJECTED_MODULES.filter((m) =>
            m === 'projects' ? ctx.can('projects.projects.read')
                : m === 'tasks' ? ctx.can('tasks.tasks.read')
                    : ctx.can(PEOPLE.leaveReadAll) || ctx.can(PEOPLE.leaveReadOwn));
    }

    async list(ctx: OrgContext, query: ProjectedQuery) {
        const from = new Date(query.from);
        const to = new Date(query.to);
        if (!(to > from)) throw new BadRequestException({ message: '`to` must be after `from`', code: 'invalid_range' });
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw new BadRequestException({ message: `The range may span at most ${MAX_RANGE_DAYS} days`, code: 'range_too_large' });
        const allowed = this.available(ctx);
        const wanted = (query.modules?.length ? query.modules : allowed).filter((m) => allowed.includes(m));
        // @db.Date columns: compare on whole UTC days.
        const fromDay = new Date(`${day(from)}T00:00:00.000Z`);
        const toDay = new Date(`${day(to)}T00:00:00.000Z`);
        const [milestones, tasks, leave] = await Promise.all([
            wanted.includes('projects') ? this.milestones(ctx, fromDay, toDay) : [],
            wanted.includes('tasks') ? this.taskDue(ctx, fromDay, toDay, query.tasks ?? 'mine') : [],
            wanted.includes('leave') ? this.leave(ctx, fromDay, toDay) : [],
        ]);
        return { data: [...milestones, ...tasks, ...leave].sort((a, b) => a.start_date.localeCompare(b.start_date)), modules: wanted, available: allowed };
    }

    private async milestones(ctx: OrgContext, from: Date, to: Date): Promise<ProjectedItem[]> {
        const rows = await this.prisma.projectMilestone.findMany({
            where: {
                planned_date: { gte: from, lte: to },
                status: { not: ProjectItemStatus.CANCELLED },
                project: { organization_id: ctx.organization_id, archived_at: null, ...this.projects.scopeWhere(ctx) },
            },
            select: { id: true, name: true, planned_date: true, status: true, project: { select: { id: true, name: true } } },
            orderBy: { planned_date: 'asc' },
            take: CAP,
        });
        return rows.map((m) => ({
            key: `milestone:${m.id}`, module: 'projects', kind: 'milestone', title: m.name,
            start_date: day(m.planned_date as Date), end_date: day(m.planned_date as Date),
            color: m.status === ProjectItemStatus.AT_RISK ? 'warning' : m.status === ProjectItemStatus.COMPLETED ? 'success' : 'violet',
            link: `/projects/${m.project.id}`, done: m.status === ProjectItemStatus.COMPLETED, detail: m.project.name,
        }));
    }

    private async taskDue(ctx: OrgContext, from: Date, to: Date, which: 'mine' | 'all'): Promise<ProjectedItem[]> {
        const me = ctx.membership_id;
        const mine: Prisma.TaskWhereInput = me ? { OR: [{ assignee_membership_id: me }, { assignees: { some: { membership_id: me } } }] } : { id: { in: [] } };
        const rows = await this.prisma.task.findMany({
            where: {
                AND: [
                    { organization_id: ctx.organization_id, archived_at: null, due_date: { gte: from, lte: to } },
                    this.tasks.scopeWhere(ctx),
                    ...(which === 'mine' ? [mine] : []),
                    { OR: [{ status_id: null }, { status: { category: { not: TaskStatusCategory.CANCELLED } } }] },
                ],
            },
            select: { id: true, number: true, title: true, due_date: true, completed_at: true, team: { select: { task_key: true } }, project: { select: { name: true } } },
            orderBy: { due_date: 'asc' },
            take: CAP,
        });
        return rows.map((t) => {
            const ident = taskIdentifier(t);
            return {
                key: `task:${t.id}`, module: 'tasks', kind: 'task_due', title: `${ident} ${t.title}`,
                start_date: day(t.due_date as Date), end_date: day(t.due_date as Date),
                color: t.completed_at ? 'success' : 'danger', link: `/tasks/${ident}`, done: !!t.completed_at, detail: t.project?.name ?? null,
            } satisfies ProjectedItem;
        });
    }

    private async leave(ctx: OrgContext, from: Date, to: Date): Promise<ProjectedItem[]> {
        const rows = await this.prisma.leaveRequest.findMany({
            where: {
                status: LeaveRequestStatus.APPROVED,
                start_date: { lte: to },
                end_date: { gte: from },
                employee: { organization_id: ctx.organization_id, ...this.people.readWhere(ctx, PEOPLE.leaveReadAll, PEOPLE.leaveReadOwn) },
            },
            select: {
                id: true, start_date: true, end_date: true, start_day_part: true, end_day_part: true,
                leave_type: { select: { name: true } },
                employee: { select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } },
            },
            orderBy: { start_date: 'asc' },
            take: CAP,
        });
        return rows.map((r) => ({
            key: `leave:${r.id}`, module: 'leave', kind: 'leave', title: `${personName(r.employee)} · ${r.leave_type.name}`,
            start_date: day(r.start_date), end_date: day(r.end_date), color: 'neutral', link: `/people/leave/calendar`, done: false,
            detail: r.start_day_part !== 'FULL_DAY' || r.end_day_part !== 'FULL_DAY' ? 'Half day' : null,
        }));
    }
}
