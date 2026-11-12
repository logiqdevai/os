import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TasksService } from '@/modules/tasks/services/tasks.service';
import { taskIdentifier } from '@/modules/tasks/utils/task-number.utils';
import { PortfolioTimelineQuery, ProjectTimelineQuery } from '../dto/project-timeline.schema';
import { CLOSED_PROJECT_CATEGORIES, MEMBER_SELECT } from '../utils/projects.utils';
import { ProjectsService } from './projects.service';

const CLOSED_TASK: TaskStatusCategory[] = [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED];
const MILESTONE_SELECT = { id: true, project_id: true, workstream_id: true, name: true, planned_date: true, actual_date: true, status: true, progress_percent: true, is_billing_milestone: true, customer_visible: true } satisfies Prisma.ProjectMilestoneSelect;
const WORKSTREAM_SELECT = { id: true, project_id: true, name: true, planned_start: true, planned_end: true, actual_start: true, actual_end: true, status: true, progress_percent: true, color: true, sort_order: true } satisfies Prisma.ProjectWorkstreamSelect;
const DEPENDENCY_SELECT = { id: true, project_id: true, source_type: true, source_id: true, target_type: true, target_id: true, type: true, status: true, lag_days: true } satisfies Prisma.ProjectDependencySelect;

/**
 * Timeline / Gantt reads (05 §24–26, §76). Read-only: dates are changed through the owning endpoints
 * (PATCH /projects/:id, /projects/:id/milestones/:mid, /projects/:id/workstreams/:wid, /tasks/:id), which keep
 * their own permission keys, audit and events. Dates are never guessed: undated items come back as "unscheduled".
 */
@Injectable()
export class ProjectTimelineService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly projects: ProjectsService,
        private readonly tasks: TasksService,
    ) { }

    /** Portfolio: every project in scope with its milestones, workstreams and dependencies. */
    async portfolio(ctx: OrgContext, query: PortfolioTimelineQuery) {
        const and: Prisma.ProjectWhereInput[] = [{ organization_id: ctx.organization_id, archived_at: null }, this.projects.scopeWhere(ctx)];
        if (!query.include_closed) and.push({ OR: [{ status_id: null }, { status: { category: { notIn: CLOSED_PROJECT_CATEGORIES } } }] });
        if (query.company_id) and.push({ company_id: query.company_id });
        if (query.owner_id) and.push({ owner_membership_id: query.owner_id === 'me' ? ctx.membership_id ?? '00000000-0000-0000-0000-000000000000' : query.owner_id });
        if (query.search) and.push({ OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] });
        const projects = await this.prisma.project.findMany({
            where: { AND: and },
            orderBy: [{ planned_start: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
            take: 300,
            select: {
                id: true, name: true, code: true, color: true, health: true, progress_percent: true,
                planned_start: true, target_completion: true, actual_start: true, actual_completion: true,
                status: { select: { id: true, name: true, category: true } },
                company: { select: { id: true, name: true } },
                owner: { select: MEMBER_SELECT },
            },
        });
        const ids = projects.map((p) => p.id);
        const [milestones, workstreams, dependencies] = ids.length
            ? await Promise.all([
                this.prisma.projectMilestone.findMany({ where: { project_id: { in: ids } }, orderBy: [{ planned_date: { sort: 'asc', nulls: 'last' } }, { sort_order: 'asc' }], select: MILESTONE_SELECT }),
                this.prisma.projectWorkstream.findMany({ where: { project_id: { in: ids }, archived_at: null }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }], select: WORKSTREAM_SELECT }),
                this.prisma.projectDependency.findMany({ where: { project_id: { in: ids }, status: { not: 'CANCELLED' } }, select: DEPENDENCY_SELECT }),
            ])
            : [[], [], []];
        return { projects, milestones, workstreams, dependencies };
    }

    /** One project: workstreams, milestones, dated tasks (task scope applies), dependencies and the unscheduled tray. */
    async project(ctx: OrgContext, projectId: string, query: ProjectTimelineQuery) {
        await this.projects.assertAccess(ctx, projectId);
        const project = await this.prisma.project.findUniqueOrThrow({
            where: { id: projectId },
            select: { id: true, name: true, code: true, color: true, health: true, progress_percent: true, planned_start: true, target_completion: true, actual_start: true, actual_completion: true, status: { select: { id: true, name: true, category: true } } },
        });
        const canReadTasks = ctx.can('tasks.tasks.read');
        const taskBase: Prisma.TaskWhereInput[] = [
            { organization_id: ctx.organization_id, project_id: projectId, archived_at: null, is_template: false },
            this.tasks.scopeWhere(ctx),
            ...(query.include_done ? [] : [{ OR: [{ status_id: null }, { status: { category: { notIn: CLOSED_TASK } } }] }]),
        ];
        const taskSelect = {
            id: true, number: true, title: true, start_date: true, due_date: true, workstream_id: true, milestone_id: true, priority: true, completed_at: true,
            team: { select: { task_key: true } },
            status: { select: { id: true, name: true, category: true } },
            assignee: { select: MEMBER_SELECT },
        } satisfies Prisma.TaskSelect;
        const [milestones, workstreams, dependencies, dated, unscheduled] = await Promise.all([
            this.prisma.projectMilestone.findMany({ where: { project_id: projectId }, orderBy: [{ planned_date: { sort: 'asc', nulls: 'last' } }, { sort_order: 'asc' }], select: MILESTONE_SELECT }),
            this.prisma.projectWorkstream.findMany({ where: { project_id: projectId, archived_at: null }, orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }], select: WORKSTREAM_SELECT }),
            this.prisma.projectDependency.findMany({ where: { project_id: projectId, status: { not: 'CANCELLED' } }, select: DEPENDENCY_SELECT }),
            canReadTasks
                ? this.prisma.task.findMany({ where: { AND: [...taskBase, { OR: [{ start_date: { not: null } }, { due_date: { not: null } }] }] }, orderBy: [{ start_date: { sort: 'asc', nulls: 'last' } }, { due_date: { sort: 'asc', nulls: 'last' } }], take: 500, select: taskSelect })
                : Promise.resolve([]),
            canReadTasks
                ? this.prisma.task.findMany({ where: { AND: [...taskBase, { start_date: null, due_date: null }] }, orderBy: [{ priority: 'desc' }, { created_at: 'asc' }], take: 100, select: taskSelect })
                : Promise.resolve([]),
        ]);
        const ids = dated.map((t) => t.id);
        const taskDependencies = ids.length
            ? await this.prisma.taskDependency.findMany({
                where: { type: 'BLOCKS', source_task_id: { in: ids }, target_task_id: { in: ids } },
                select: { id: true, source_task_id: true, target_task_id: true, type: true },
            })
            : [];
        const serialize = <T extends { number: number; team: { task_key: string | null } | null }>(t: T) => ({ ...t, identifier: taskIdentifier(t) });
        return {
            project,
            milestones,
            workstreams,
            dependencies,
            tasks: dated.map(serialize),
            task_dependencies: taskDependencies,
            unscheduled_tasks: unscheduled.map(serialize),
            tasks_visible: canReadTasks,
        };
    }
}
