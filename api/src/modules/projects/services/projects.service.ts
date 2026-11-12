import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    ModuleKey,
    Prisma,
    ProjectGateStatus,
    ProjectHealth,
    ProjectItemStatus,
    ProjectStatusCategory,
    RecordEntityType,
    TaskPriority,
    TaskStatusCategory,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { defaultStatus, ensureTaskStatuses } from '@/modules/tasks/utils/task-defaults.utils';
import { nextTaskNumber, rankBetween } from '@/modules/tasks/utils/task-number.utils';
import { AddProjectMemberDto, CreateProjectDto, UpdateProjectDto, UpdateProjectMemberDto } from '../dto/create-project.dto';
import { LookupQuery, MilestoneQuery, ProjectQuery, RaidQuery, WorkloadQuery } from '../dto/project-query.schema';
import { ProjectSettingsService } from './project-settings.service';
import { addDays, CLOSED_PROJECT_CATEGORIES, compact, listPeople, MEMBER_SELECT, PROJECT_READ, startOfDay, toDate, withDates } from '../utils/projects.utils';

const PROJECT_DATES = ['planned_start', 'actual_start', 'target_completion', 'internal_deadline', 'customer_deadline', 'review_date'] as const;
const BUDGET_FIELDS = ['budget_hours', 'budget_amount', 'currency'] as const;
const FINANCE_READ = 'projects.finance.read';
const OPEN_MILESTONE: ProjectItemStatus[] = [ProjectItemStatus.PLANNED, ProjectItemStatus.IN_PROGRESS, ProjectItemStatus.AT_RISK];

interface TemplateStructure {
    milestones?: { key?: string; name: string; offset_days?: number; customer_visible?: boolean; is_billing_milestone?: boolean; description?: string }[];
    workstreams?: { name: string; description?: string }[];
    deliverables?: { name: string; milestone_key?: string; customer_visible?: boolean; description?: string }[];
    tasks?: { title: string; milestone_key?: string; priority?: string; estimate_points?: number; description?: string }[];
    checklists?: { name: string; phase?: string; items?: (string | { title: string; is_required?: boolean })[] }[];
}

/**
 * 05 Project Management — projects, lifecycle, members, favorites, portfolio, cross-project views.
 * Scope: organization-wide holders see every project; everyone else sees projects in their branch / team /
 * project / customer scope plus projects they own or are an active member of. Out-of-scope ids return 404.
 */
@Injectable()
export class ProjectsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly settings: ProjectSettingsService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Scope
    // ---------------------------------------------------------------------------------------------

    /** Prisma filter of the projects the caller may reach with `key`. */
    scopeWhere(ctx: OrgContext, key = PROJECT_READ): Prisma.ProjectWhereInput {
        const scope = ctx.scopeOf(key);
        if (!scope) return { id: { in: [] } };
        if (scope.organization) return {};
        const or: Prisma.ProjectWhereInput[] = [
            { id: { in: scope.project_ids } },
            { branch_id: { in: scope.branch_ids } },
            { branches: { some: { branch_id: { in: scope.branch_ids } } } },
            { team_id: { in: scope.team_ids } },
            { company_id: { in: scope.customer_ids } },
        ];
        if (ctx.membership_id) {
            or.push({ owner_membership_id: ctx.membership_id }, { members: { some: { membership_id: ctx.membership_id, is_active: true } } });
        }
        return { OR: or };
    }

    /** Project ids the caller may read (null = all, for organization-wide scope). Used by other modules' queries. */
    async accessibleProjectIds(ctx: OrgContext, key = PROJECT_READ): Promise<string[] | null> {
        const scope = ctx.scopeOf(key);
        if (scope?.organization) return null;
        const rows = await this.prisma.project.findMany({ where: { organization_id: ctx.organization_id, ...this.scopeWhere(ctx, key) }, select: { id: true } });
        return rows.map((r) => r.id);
    }

    /** 404 when missing or out of scope for `key`. */
    async assertAccess(ctx: OrgContext, id: string, key = PROJECT_READ) {
        const project = await this.prisma.project.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx, key) },
            select: { id: true, name: true, branch_id: true, company_id: true, team_id: true, visibility: true, status_id: true, archived_at: true, completed_at: true, currency: true, planned_start: true },
        });
        if (!project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        return project;
    }

    private stripFinance<T extends { budget_amount?: unknown }>(ctx: OrgContext, project: T): T {
        if (ctx.can(FINANCE_READ)) return project;
        const { budget_amount: _hidden, ...rest } = project;
        return { ...rest, budget_amount: null } as T;
    }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: ProjectQuery) {
        await this.settings.ensureDefaults(ctx.organization_id);
        const me = ctx.membership_id;
        const resolve = (v?: string) => (v === 'me' ? me ?? '00000000-0000-0000-0000-000000000000' : v);
        const and: Prisma.ProjectWhereInput[] = [
            { organization_id: ctx.organization_id },
            this.scopeWhere(ctx),
            query.archived ? { archived_at: { not: null } } : { archived_at: null },
        ];
        if (query.status_id) and.push({ status_id: query.status_id });
        if (query.status_category?.length) and.push({ status: { category: { in: query.status_category } } });
        if (query.include_closed === false) and.push({ OR: [{ status_id: null }, { status: { category: { notIn: CLOSED_PROJECT_CATEGORIES } } }] });
        if (query.health?.length) and.push({ health: { in: query.health } });
        if (query.priority?.length) and.push({ priority: { in: query.priority } });
        if (query.type_id) and.push({ type_id: query.type_id });
        if (query.owner_id) and.push({ owner_membership_id: resolve(query.owner_id) });
        if (query.member_id) and.push({ members: { some: { membership_id: resolve(query.member_id), is_active: true } } });
        if (query.company_id) and.push({ company_id: query.company_id });
        if (query.team_id) and.push({ team_id: query.team_id });
        if (query.favorites) and.push({ favorites: { some: { membership_id: me ?? '' } } });
        if (query.search) {
            and.push({
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { code: { contains: query.search, mode: 'insensitive' } },
                    { company: { name: { contains: query.search, mode: 'insensitive' } } },
                ],
            });
        }
        const where: Prisma.ProjectWhereInput = { AND: and };
        const [items, total] = await Promise.all([
            this.prisma.project.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'target_completion', 'priority', 'health', 'progress_percent'], 'updated_at'),
                include: {
                    status: { select: { id: true, name: true, category: true, color: true } },
                    type: { select: { id: true, name: true } },
                    company: { select: { id: true, name: true } },
                    owner: { select: MEMBER_SELECT },
                    team: { select: { id: true, name: true, task_key: true } },
                    favorites: { where: { membership_id: me ?? '' }, select: { id: true } },
                    _count: { select: { members: { where: { is_active: true } } } },
                },
            }),
            this.prisma.project.count({ where }),
        ]);
        const ids = items.map((p) => p.id);
        const today = startOfDay();
        const [taskTotals, taskDone, nextMilestones] = ids.length
            ? await Promise.all([
                this.prisma.task.groupBy({ by: ['project_id'], where: { project_id: { in: ids }, archived_at: null }, _count: { _all: true } }),
                this.prisma.task.groupBy({ by: ['project_id'], where: { project_id: { in: ids }, archived_at: null, status: { category: TaskStatusCategory.DONE } }, _count: { _all: true } }),
                this.prisma.projectMilestone.findMany({
                    where: { project_id: { in: ids }, status: { in: OPEN_MILESTONE }, planned_date: { not: null } },
                    orderBy: { planned_date: 'asc' },
                    distinct: ['project_id'],
                    select: { id: true, project_id: true, name: true, planned_date: true },
                }),
            ])
            : [[], [], []];
        const totalBy = new Map(taskTotals.map((r) => [r.project_id, r._count._all]));
        const doneBy = new Map(taskDone.map((r) => [r.project_id, r._count._all]));
        const nextBy = new Map(nextMilestones.map((m) => [m.project_id, { ...m, overdue: !!m.planned_date && m.planned_date < today }]));
        const data = items.map(({ favorites, ...p }) =>
            this.stripFinance(ctx, {
                ...p,
                is_favorite: favorites.length > 0,
                task_counts: { total: totalBy.get(p.id) ?? 0, done: doneBy.get(p.id) ?? 0 },
                next_milestone: nextBy.get(p.id) ?? null,
            }),
        );
        return paginate(data, total, query);
    }

    /** Small picker list for other modules (time, billing, support, home). */
    async lookup(ctx: OrgContext, query: LookupQuery) {
        const and: Prisma.ProjectWhereInput[] = [{ organization_id: ctx.organization_id }, this.scopeWhere(ctx), { archived_at: null }];
        if (query.company_id) and.push({ company_id: query.company_id });
        if (query.search) and.push({ OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] });
        return this.prisma.project.findMany({
            where: { AND: and },
            take: query.limit,
            orderBy: [{ updated_at: 'desc' }],
            select: {
                id: true, name: true, code: true, color: true, health: true, company_id: true, team_id: true,
                company: { select: { id: true, name: true } },
                status: { select: { id: true, name: true, category: true } },
            },
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        await this.assertAccess(ctx, id);
        const me = ctx.membership_id ?? '';
        const today = startOfDay();
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: {
                status: true,
                type: { select: { id: true, name: true, enabled_sections: true } },
                company: { select: { id: true, name: true, website: true } },
                owner: { select: MEMBER_SELECT },
                team: { select: { id: true, name: true, task_key: true } },
                branch: { select: { id: true, name: true } },
                template: { select: { id: true, name: true } },
                template_version: { select: { id: true, version_number: true } },
                parent: { select: { id: true, name: true } },
                members: {
                    where: { is_active: true },
                    orderBy: { joined_at: 'asc' },
                    include: { membership: { select: MEMBER_SELECT }, role: { select: { id: true, name: true } } },
                },
                favorites: { where: { membership_id: me }, select: { id: true } },
            },
        });
        const [taskByCategory, overdueTasks, milestones, openRisks, openIssues, openBlockers, latestUpdate, logged, pendingChanges, statuses] = await Promise.all([
            this.prisma.task.groupBy({ by: ['status_id'], where: { project_id: id, archived_at: null }, _count: { _all: true } }),
            this.prisma.task.count({ where: { project_id: id, archived_at: null, due_date: { lt: today }, status: { category: { notIn: [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED] } } } }),
            this.prisma.projectMilestone.findMany({ where: { project_id: id }, orderBy: [{ planned_date: { sort: 'asc', nulls: 'last' } }, { sort_order: 'asc' }], select: { id: true, name: true, status: true, planned_date: true, completed_at: true, customer_visible: true, is_billing_milestone: true } }),
            this.prisma.projectRisk.count({ where: { project_id: id, status: { in: ['OPEN', 'MONITORING'] } } }),
            this.prisma.projectIssue.count({ where: { project_id: id, kind: 'ISSUE', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            this.prisma.projectIssue.count({ where: { project_id: id, kind: 'BLOCKER', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            this.prisma.projectStatusUpdate.findFirst({ where: { project_id: id, published_at: { not: null } }, orderBy: { published_at: 'desc' }, select: { id: true, summary: true, health: true, published_at: true, progress_percent: true } }),
            this.prisma.timeEntry.aggregate({ where: { project_id: id, deleted_at: null }, _sum: { duration_minutes: true } }),
            this.prisma.projectChangeRequest.count({ where: { project_id: id, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'ESTIMATING', 'AWAITING_APPROVAL'] } } }),
            this.prisma.projectStatus.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, orderBy: { sort_order: 'asc' }, select: { id: true, name: true, slug: true, category: true, color: true } }),
        ]);
        const statusIds = taskByCategory.map((r) => r.status_id).filter(Boolean) as string[];
        const taskStatuses = statusIds.length ? await this.prisma.taskStatus.findMany({ where: { id: { in: statusIds } }, select: { id: true, category: true } }) : [];
        const catOf = new Map(taskStatuses.map((s) => [s.id, s.category]));
        const tasks = { total: 0, done: 0, in_progress: 0, open: 0, overdue: overdueTasks };
        for (const row of taskByCategory) {
            const cat = catOf.get(row.status_id ?? '');
            tasks.total += row._count._all;
            if (cat === TaskStatusCategory.DONE) tasks.done += row._count._all;
            else if (cat === TaskStatusCategory.CANCELLED) tasks.total -= row._count._all;
            else {
                tasks.open += row._count._all;
                if (cat === TaskStatusCategory.IN_PROGRESS || cat === TaskStatusCategory.IN_REVIEW) tasks.in_progress += row._count._all;
            }
        }
        const nextMilestone = milestones.find((m) => OPEN_MILESTONE.includes(m.status) && m.planned_date) ?? null;
        const allowed = project.status?.allowed_transitions?.length ? statuses.filter((s) => project.status.allowed_transitions.includes(s.slug) || s.id === project.status_id) : statuses;
        const { favorites, ...rest } = project;
        return this.stripFinance(ctx, {
            ...rest,
            is_favorite: favorites.length > 0,
            allowed_statuses: allowed,
            summary: {
                tasks,
                milestones: {
                    total: milestones.length,
                    completed: milestones.filter((m) => m.status === ProjectItemStatus.COMPLETED).length,
                    overdue: milestones.filter((m) => OPEN_MILESTONE.includes(m.status) && m.planned_date && m.planned_date < today).length,
                    next: nextMilestone,
                },
                open_risks: openRisks,
                open_issues: openIssues,
                open_blockers: openBlockers,
                pending_change_requests: pendingChanges,
                logged_hours: Math.round(((logged._sum.duration_minutes ?? 0) / 60) * 10) / 10,
                latest_update: latestUpdate,
            },
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateProjectDto) {
        this.assertBudgetPermission(ctx, dto);
        if (dto.member_ids?.length && !ctx.can('projects.members.manage') && !ctx.can('projects.projects.manage_members')) {
            throw new ForbiddenException({ message: 'Adding members needs projects.members.manage', code: 'permission_denied' });
        }
        await this.settings.ensureDefaults(ctx.organization_id);
        await this.assertRefs(ctx, dto);

        const template = dto.template_id
            ? await this.prisma.projectTemplate.findFirst({ where: { id: dto.template_id, organization_id: ctx.organization_id, is_active: true }, include: { current_version: true } })
            : null;
        if (dto.template_id && !template) throw new BadRequestException({ message: 'Template not found', code: 'project_template_not_found' });

        const status = dto.status_id
            ? await this.prisma.projectStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id, archived_at: null } })
            : (await this.prisma.projectStatus.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null } })) ??
            (await this.prisma.projectStatus.findFirst({ where: { organization_id: ctx.organization_id, archived_at: null }, orderBy: { sort_order: 'asc' } }));
        if (dto.status_id && !status) throw new BadRequestException({ message: 'Status not found', code: 'project_status_not_found' });

        const owner = dto.owner_membership_id ?? ctx.membership_id ?? null;
        const memberIds = [...new Set([owner, ...(dto.member_ids ?? [])].filter(Boolean))] as string[];
        const slug = await this.uniqueSlug(ctx.organization_id, dto.name);
        const { member_ids: _m, template_id: _t, ...fields } = dto;
        const structure = (template?.current_version?.structure ?? null) as TemplateStructure | null;
        const taskStatuses = structure?.tasks?.length ? await ensureTaskStatuses(this.prisma, ctx.organization_id, dto.team_id ?? null) : [];

        let project;
        try {
            project = await this.prisma.$transaction(async (tx) => {
                const p = await tx.project.create({
                    data: {
                        ...withDates(fields, PROJECT_DATES),
                        organization_id: ctx.organization_id,
                        slug,
                        status_id: status?.id ?? null,
                        type_id: dto.type_id ?? template?.type_id ?? null,
                        owner_membership_id: owner,
                        template_id: template?.id ?? null,
                        template_version_id: template?.current_version_id ?? null,
                        created_by_user_id: ctx.user_id,
                        ...(status?.category === ProjectStatusCategory.IN_PROGRESS && !dto.actual_start ? { actual_start: startOfDay() } : {}),
                    },
                });
                if (memberIds.length) {
                    await tx.projectMember.createMany({
                        data: memberIds.map((membership_id) => ({ project_id: p.id, membership_id, role_label: membership_id === owner ? 'Project manager' : null })),
                        skipDuplicates: true,
                    });
                }
                if (structure) await this.instantiateTemplate(tx, ctx, p, structure, taskStatuses);
                return p;
            }, { timeout: 30_000 });
        } catch (error) {
            this.rethrowUnique(error);
        }

        await this.audit.record(ctx, 'project.created', {
            resource_type: 'project', resource_id: project.id, branch_id: project.branch_id,
            metadata: { after: { ...dto, budget_amount: undefined }, template_id: template?.id ?? null, template_version_id: template?.current_version_id ?? null },
        });
        this.events.publish(ctx, {
            event_key: 'projects.project.created', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: project.id,
            payload: { name: project.name, company_id: project.company_id, owner_membership_id: owner, member_membership_ids: memberIds, template_id: template?.id ?? null },
            activity: { summary: `created project ${project.name}`, entity_label: project.name, project_id: project.id, company_id: project.company_id, branch_id: project.branch_id },
        });
        return this.findOne(ctx, project.id);
    }

    /** Copy a template version's structure into a new project; dates shift from planned_start (05 §37). */
    private async instantiateTemplate(tx: Prisma.TransactionClient, ctx: OrgContext, project: { id: string; planned_start: Date | null; team_id: string | null; owner_membership_id: string | null }, s: TemplateStructure, taskStatuses: { id: string; is_default: boolean; category: TaskStatusCategory }[]) {
        const start = project.planned_start ?? startOfDay();
        const milestoneIds = new Map<string, string>();
        for (const [i, m] of (s.milestones ?? []).entries()) {
            const row = await tx.projectMilestone.create({
                data: {
                    project_id: project.id, name: m.name, description: m.description, sort_order: i,
                    planned_date: m.offset_days !== undefined ? addDays(start, m.offset_days) : null,
                    customer_visible: !!m.customer_visible, is_billing_milestone: !!m.is_billing_milestone,
                },
            });
            milestoneIds.set(m.key ?? m.name, row.id);
        }
        if (s.workstreams?.length) {
            await tx.projectWorkstream.createMany({ data: s.workstreams.map((w, i) => ({ project_id: project.id, name: w.name, description: w.description, sort_order: i })) });
        }
        if (s.deliverables?.length) {
            await tx.projectDeliverable.createMany({
                data: s.deliverables.map((d, i) => ({ project_id: project.id, name: d.name, description: d.description, sort_order: i, customer_visible: !!d.customer_visible, milestone_id: d.milestone_key ? milestoneIds.get(d.milestone_key) ?? null : null })),
            });
        }
        for (const [i, c] of (s.checklists ?? []).entries()) {
            await tx.projectChecklist.create({
                data: {
                    project_id: project.id, name: c.name, phase: c.phase, sort_order: i,
                    items: { create: (c.items ?? []).map((it, j) => (typeof it === 'string' ? { title: it, sort_order: j } : { title: it.title, is_required: !!it.is_required, sort_order: j })) },
                },
            });
        }
        if (s.tasks?.length) {
            const status = defaultStatus(taskStatuses);
            let rank: string | null = null;
            for (const t of s.tasks) {
                rank = rankBetween(rank, null);
                const number = await nextTaskNumber(tx, ctx.organization_id, project.team_id);
                await tx.task.create({
                    data: {
                        organization_id: ctx.organization_id, number, team_id: project.team_id, project_id: project.id, title: t.title, description: t.description,
                        milestone_id: t.milestone_key ? milestoneIds.get(t.milestone_key) ?? null : null,
                        priority: (Object.values(TaskPriority) as string[]).includes(t.priority ?? '') ? (t.priority as TaskPriority) : TaskPriority.NONE,
                        estimate_points: t.estimate_points ?? null, status_id: status?.id ?? null, rank,
                        reporter_membership_id: ctx.membership_id, created_by_user_id: ctx.user_id,
                    },
                });
            }
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateProjectDto) {
        await this.assertAccess(ctx, id, 'projects.projects.update');
        this.assertBudgetPermission(ctx, dto);
        await this.assertRefs(ctx, dto);
        const before = await this.prisma.project.findUniqueOrThrow({ where: { id }, include: { status: true } });
        const { member_ids: _m, template_id: _t, ...fields } = dto;
        const data: Prisma.ProjectUncheckedUpdateInput = compact(withDates(fields, PROJECT_DATES)) as Prisma.ProjectUncheckedUpdateInput;

        let statusChange: { from: string | null; to: string; category: ProjectStatusCategory } | null = null;
        if (dto.status_id && dto.status_id !== before.status_id) {
            const next = await this.prisma.projectStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id, archived_at: null } });
            if (!next) throw new BadRequestException({ message: 'Status not found', code: 'project_status_not_found' });
            if (before.status?.allowed_transitions?.length && !before.status.allowed_transitions.includes(next.slug)) {
                throw new ConflictException({ message: `A project in "${before.status.name}" cannot move to "${next.name}"`, code: 'project_status_transition_not_allowed' });
            }
            Object.assign(data, await this.lifecycleFields(ctx, id, before.status?.category ?? null, next.category));
            statusChange = { from: before.status?.name ?? null, to: next.name, category: next.category };
        }

        let project;
        try {
            project = await this.prisma.project.update({ where: { id }, data });
        } catch (error) {
            this.rethrowUnique(error);
        }
        const changed = Object.keys(data);
        const beforeSnapshot = Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]]));
        await this.audit.record(ctx, 'project.updated', { resource_type: 'project', resource_id: id, branch_id: project.branch_id, metadata: { before: beforeSnapshot, after: dto } });
        if (dto.health && dto.health !== before.health) {
            await this.audit.record(ctx, 'project.health_changed', { resource_type: 'project', resource_id: id, metadata: { before: before.health, after: dto.health, reason: dto.health_reason ?? null } });
            this.events.publish(ctx, {
                event_key: 'projects.project.health_changed', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id,
                payload: { name: project.name, from: before.health, to: dto.health, reason: dto.health_reason ?? null, owner_membership_id: project.owner_membership_id },
                activity: { summary: `changed health of ${project.name} to ${dto.health.replace('_', ' ').toLowerCase()}`, entity_label: project.name, project_id: id, company_id: project.company_id },
            });
        }
        if (statusChange) {
            await this.audit.record(ctx, 'project.status_changed', { resource_type: 'project', resource_id: id, metadata: { before: statusChange.from, after: statusChange.to } });
            this.events.publish(ctx, {
                event_key: statusChange.category === ProjectStatusCategory.COMPLETED ? 'projects.project.completed' : 'projects.project.status_changed',
                module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id,
                payload: { name: project.name, from: statusChange.from, to: statusChange.to, category: statusChange.category, owner_membership_id: project.owner_membership_id },
                activity: { summary: `moved ${project.name} to ${statusChange.to}`, entity_label: project.name, project_id: id, company_id: project.company_id, customer_visible: project.visibility === 'CUSTOMER_VISIBLE' },
            });
        }
        this.events.publish(ctx, { event_key: 'projects.project.updated', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { name: project.name }, changes: dto as Record<string, unknown> });
        return this.findOne(ctx, id);
    }

    /** Side effects of moving into a status category (completion needs permission + passed gates, reopening needs reopen). */
    private async lifecycleFields(ctx: OrgContext, id: string, from: ProjectStatusCategory | null, to: ProjectStatusCategory): Promise<Prisma.ProjectUncheckedUpdateInput> {
        const wasClosed = from === ProjectStatusCategory.COMPLETED || from === ProjectStatusCategory.CANCELLED;
        if (to === ProjectStatusCategory.COMPLETED) {
            if (!ctx.can('projects.projects.complete')) throw new ForbiddenException({ message: 'Completing a project needs projects.projects.complete', code: 'permission_denied' });
            await this.assertGatesPassed(id);
            return { completed_at: new Date(), actual_completion: startOfDay(), cancelled_at: null, progress_percent: 100 };
        }
        if (to === ProjectStatusCategory.CANCELLED) return { cancelled_at: new Date() };
        if (wasClosed) {
            if (!ctx.can('projects.projects.reopen')) throw new ForbiddenException({ message: 'Reopening a project needs projects.projects.reopen', code: 'permission_denied' });
            return { completed_at: null, cancelled_at: null, actual_completion: null, reopened_at: new Date() };
        }
        if (to === ProjectStatusCategory.IN_PROGRESS) {
            const p = await this.prisma.project.findUnique({ where: { id }, select: { actual_start: true } });
            if (!p?.actual_start) return { actual_start: startOfDay() };
        }
        return {};
    }

    /** What stops completion (05 §71): blocking gates not PASSED/WAIVED and required checklist items still open. */
    async completionBlockers(id: string) {
        const [gates, items] = await Promise.all([
            this.prisma.projectGate.findMany({
                where: { project_id: id, blocks_completion: true, status: { notIn: [ProjectGateStatus.PASSED, ProjectGateStatus.WAIVED] } },
                select: { id: true, name: true, status: true },
            }),
            this.prisma.projectChecklistItem.findMany({
                where: { checklist: { project_id: id }, is_required: true, is_completed: false },
                select: { id: true, title: true, checklist: { select: { id: true, name: true } } },
            }),
        ]);
        return { gates, checklist_items: items };
    }

    private async assertGatesPassed(id: string) {
        const { gates, checklist_items } = await this.completionBlockers(id);
        if (gates.length || checklist_items.length) {
            const parts = [
                gates.length ? `pass or waive these gates: ${gates.map((g) => g.name).join(', ')}` : null,
                checklist_items.length ? `complete ${checklist_items.length} required checklist item${checklist_items.length === 1 ? '' : 's'}` : null,
            ].filter(Boolean);
            throw new ConflictException({ message: `Cannot complete yet: ${parts.join('; ')}`, code: 'project_gates_pending', gates, checklist_items });
        }
    }

    async complete(ctx: OrgContext, id: string) {
        const project = await this.assertAccess(ctx, id, 'projects.projects.complete');
        if (project.completed_at) throw new ConflictException({ message: 'Project is already completed', code: 'project_already_completed' });
        const status = await this.prisma.projectStatus.findFirst({ where: { organization_id: ctx.organization_id, category: ProjectStatusCategory.COMPLETED, archived_at: null }, orderBy: { sort_order: 'asc' } });
        if (!status) throw new ConflictException({ message: 'Add a status with the Completed category first', code: 'project_status_missing' });
        await this.assertGatesPassed(id);
        const updated = await this.prisma.project.update({ where: { id }, data: { status_id: status.id, completed_at: new Date(), actual_completion: startOfDay(), progress_percent: 100, health: ProjectHealth.HEALTHY } });
        await this.audit.record(ctx, 'project.completed', { resource_type: 'project', resource_id: id, branch_id: updated.branch_id });
        this.events.publish(ctx, {
            event_key: 'projects.project.completed', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id,
            payload: { name: updated.name, company_id: updated.company_id, owner_membership_id: updated.owner_membership_id },
            activity: { summary: `completed project ${updated.name}`, entity_label: updated.name, project_id: id, company_id: updated.company_id, customer_visible: updated.visibility === 'CUSTOMER_VISIBLE' },
        });
        return this.findOne(ctx, id);
    }

    async reopen(ctx: OrgContext, id: string, reason?: string) {
        const project = await this.assertAccess(ctx, id, 'projects.projects.reopen');
        const current = project.status_id ? await this.prisma.projectStatus.findUnique({ where: { id: project.status_id } }) : null;
        if (!project.completed_at && current?.category !== ProjectStatusCategory.CANCELLED) throw new ConflictException({ message: 'Only completed or cancelled projects can be reopened', code: 'project_not_closed' });
        const status = await this.prisma.projectStatus.findFirst({ where: { organization_id: ctx.organization_id, category: ProjectStatusCategory.IN_PROGRESS, archived_at: null }, orderBy: { sort_order: 'asc' } });
        const updated = await this.prisma.project.update({ where: { id }, data: { status_id: status?.id ?? null, completed_at: null, cancelled_at: null, actual_completion: null, reopened_at: new Date() } });
        await this.audit.record(ctx, 'project.reopened', { resource_type: 'project', resource_id: id, branch_id: updated.branch_id, metadata: { reason: reason ?? null } });
        this.events.publish(ctx, {
            event_key: 'projects.project.reopened', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { name: updated.name, reason: reason ?? null },
            activity: { summary: `reopened project ${updated.name}`, entity_label: updated.name, project_id: id, company_id: updated.company_id },
        });
        return this.findOne(ctx, id);
    }

    async archive(ctx: OrgContext, id: string) {
        await this.assertAccess(ctx, id, 'projects.projects.archive');
        const updated = await this.prisma.project.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'project.archived', { resource_type: 'project', resource_id: id, branch_id: updated.branch_id });
        this.events.publish(ctx, { event_key: 'projects.project.archived', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { name: updated.name } });
        return updated;
    }

    async restore(ctx: OrgContext, id: string) {
        await this.assertAccess(ctx, id, 'projects.projects.archive');
        const updated = await this.prisma.project.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'project.restored', { resource_type: 'project', resource_id: id, branch_id: updated.branch_id });
        this.events.publish(ctx, { event_key: 'projects.project.restored', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { name: updated.name } });
        return updated;
    }

    async remove(ctx: OrgContext, id: string) {
        const project = await this.assertAccess(ctx, id, 'projects.projects.delete');
        await this.prisma.project.delete({ where: { id } });
        await this.audit.record(ctx, 'project.deleted', { resource_type: 'project', resource_id: id, branch_id: project.branch_id, metadata: { name: project.name } });
        this.events.publish(ctx, { event_key: 'projects.project.deleted', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { name: project.name } });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Members & favorites
    // ---------------------------------------------------------------------------------------------

    async listMembers(ctx: OrgContext, id: string) {
        await this.assertAccess(ctx, id);
        return this.prisma.projectMember.findMany({
            where: { project_id: id, is_active: true },
            orderBy: { joined_at: 'asc' },
            include: { membership: { select: MEMBER_SELECT }, role: { select: { id: true, name: true } } },
        });
    }

    private memberKey(ctx: OrgContext) {
        return ctx.can('projects.members.manage') ? 'projects.members.manage' : 'projects.projects.manage_members';
    }

    async addMember(ctx: OrgContext, id: string, dto: AddProjectMemberDto) {
        const project = await this.assertAccess(ctx, id, this.memberKey(ctx));
        await this.assertMembership(ctx, dto.membership_id);
        if (dto.role_id) await this.assertProjectRole(ctx, dto.role_id);
        const row = await this.prisma.projectMember.upsert({
            where: { project_id_membership_id: { project_id: id, membership_id: dto.membership_id } },
            update: { is_active: true, left_at: null, role_label: dto.role_label, role_id: dto.role_id, allocation_percent: dto.allocation_percent },
            create: { project_id: id, membership_id: dto.membership_id, role_label: dto.role_label, role_id: dto.role_id, allocation_percent: dto.allocation_percent },
            include: { membership: { select: MEMBER_SELECT }, role: { select: { id: true, name: true } } },
        });
        await this.audit.record(ctx, 'project.member_added', { resource_type: 'project', resource_id: id, branch_id: project.branch_id, metadata: { membership_id: dto.membership_id, role_label: dto.role_label ?? null } });
        this.events.publish(ctx, {
            event_key: 'projects.member.added', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id,
            payload: { project_name: project.name, membership_id: dto.membership_id, assignee_membership_ids: [dto.membership_id] },
            activity: { summary: `added a member to ${project.name}`, entity_label: project.name, project_id: id },
        });
        return row;
    }

    async updateMember(ctx: OrgContext, id: string, membershipId: string, dto: UpdateProjectMemberDto) {
        const project = await this.assertAccess(ctx, id, this.memberKey(ctx));
        if (dto.role_id) await this.assertProjectRole(ctx, dto.role_id);
        const existing = await this.prisma.projectMember.findUnique({ where: { project_id_membership_id: { project_id: id, membership_id: membershipId } } });
        if (!existing) throw new NotFoundException({ message: 'Not a member of this project', code: 'project_member_not_found' });
        const row = await this.prisma.projectMember.update({
            where: { id: existing.id },
            data: { ...dto, ...(dto.is_active === false ? { left_at: new Date() } : dto.is_active ? { left_at: null } : {}) },
            include: { membership: { select: MEMBER_SELECT }, role: { select: { id: true, name: true } } },
        });
        await this.audit.record(ctx, 'project.member_updated', { resource_type: 'project', resource_id: id, branch_id: project.branch_id, metadata: { membership_id: membershipId, before: { role_label: existing.role_label, allocation_percent: existing.allocation_percent }, after: dto } });
        return row;
    }

    async removeMember(ctx: OrgContext, id: string, membershipId: string) {
        const project = await this.assertAccess(ctx, id, this.memberKey(ctx));
        const res = await this.prisma.projectMember.updateMany({ where: { project_id: id, membership_id: membershipId, is_active: true }, data: { is_active: false, left_at: new Date() } });
        if (!res.count) throw new NotFoundException({ message: 'Not a member of this project', code: 'project_member_not_found' });
        await this.audit.record(ctx, 'project.member_removed', { resource_type: 'project', resource_id: id, branch_id: project.branch_id, metadata: { membership_id: membershipId } });
        this.events.publish(ctx, { event_key: 'projects.member.removed', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: id, payload: { project_name: project.name, membership_id: membershipId } });
        return { success: true };
    }

    async setFavorite(ctx: OrgContext, id: string, favorite: boolean) {
        await this.assertAccess(ctx, id);
        if (!ctx.membership_id) throw new BadRequestException({ message: 'Favorites belong to a member', code: 'favorites_need_member' });
        if (favorite) {
            await this.prisma.projectFavorite.upsert({ where: { project_id_membership_id: { project_id: id, membership_id: ctx.membership_id } }, update: {}, create: { project_id: id, membership_id: ctx.membership_id } });
        } else {
            await this.prisma.projectFavorite.deleteMany({ where: { project_id: id, membership_id: ctx.membership_id } });
        }
        await this.audit.record(ctx, favorite ? 'project.favorited' : 'project.unfavorited', { resource_type: 'project', resource_id: id });
        return { is_favorite: favorite };
    }

    people(ctx: OrgContext, search?: string) {
        return listPeople(this.prisma, ctx.organization_id, search);
    }

    async favorites(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        return this.prisma.project.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, favorites: { some: { membership_id: ctx.membership_id } }, ...this.scopeWhere(ctx) },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, color: true, health: true },
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Portfolio & cross-project views
    // ---------------------------------------------------------------------------------------------

    async portfolio(ctx: OrgContext) {
        await this.settings.ensureDefaults(ctx.organization_id);
        const today = startOfDay();
        const in14 = addDays(today, 14);
        const projectWhere: Prisma.ProjectWhereInput = { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx) };
        const projects = await this.prisma.project.findMany({
            where: projectWhere,
            select: {
                id: true, name: true, color: true, health: true, health_reason: true, progress_percent: true, target_completion: true, budget_hours: true, budget_amount: true, currency: true,
                status: { select: { name: true, category: true } }, company: { select: { id: true, name: true } }, owner: { select: MEMBER_SELECT },
            },
        });
        const active = projects.filter((p) => !p.status || !CLOSED_PROJECT_CATEGORIES.includes(p.status.category));
        const ids = projects.map((p) => p.id);
        const activeIds = active.map((p) => p.id);
        const [upcoming, overdueMilestones, overdueTasks, hours, openBlockers] = await Promise.all([
            this.prisma.projectMilestone.findMany({
                where: { project_id: { in: activeIds }, status: { in: OPEN_MILESTONE }, planned_date: { gte: today, lte: in14 } },
                orderBy: { planned_date: 'asc' }, take: 10,
                select: { id: true, name: true, planned_date: true, status: true, is_billing_milestone: true, project: { select: { id: true, name: true, color: true } } },
            }),
            this.prisma.projectMilestone.findMany({
                where: { project_id: { in: activeIds }, status: { in: OPEN_MILESTONE }, planned_date: { lt: today } },
                orderBy: { planned_date: 'asc' }, take: 10,
                select: { id: true, name: true, planned_date: true, status: true, project: { select: { id: true, name: true, color: true } } },
            }),
            this.prisma.task.count({ where: { project_id: { in: activeIds }, archived_at: null, due_date: { lt: today }, status: { category: { notIn: [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED] } } } }),
            ids.length ? this.prisma.timeEntry.groupBy({ by: ['project_id'], where: { project_id: { in: ids }, deleted_at: null }, _sum: { duration_minutes: true } }) : Promise.resolve([]),
            this.prisma.projectIssue.count({ where: { project_id: { in: activeIds }, kind: 'BLOCKER', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ]);
        const byCategory: Record<string, number> = {};
        for (const p of projects) byCategory[p.status?.category ?? 'NONE'] = (byCategory[p.status?.category ?? 'NONE'] ?? 0) + 1;
        const byHealth: Record<string, number> = {};
        for (const p of active) byHealth[p.health] = (byHealth[p.health] ?? 0) + 1;
        const hoursBy = new Map(hours.map((h) => [h.project_id, (h._sum.duration_minutes ?? 0) / 60]));
        const showMoney = ctx.can(FINANCE_READ);
        const budget = active
            .filter((p) => p.budget_hours)
            .map((p) => ({
                project: { id: p.id, name: p.name, color: p.color },
                budget_hours: Number(p.budget_hours),
                logged_hours: Math.round((hoursBy.get(p.id) ?? 0) * 10) / 10,
                burn_percent: Math.round(((hoursBy.get(p.id) ?? 0) / Number(p.budget_hours)) * 100),
                budget_amount: showMoney ? p.budget_amount : null,
                currency: p.currency,
            }))
            .sort((a, b) => b.burn_percent - a.burn_percent)
            .slice(0, 8);
        const atRisk = active
            .filter((p) => p.health === ProjectHealth.AT_RISK || p.health === ProjectHealth.BLOCKED || p.health === ProjectHealth.CRITICAL)
            .slice(0, 10)
            .map((p) => ({ ...p, budget_amount: showMoney ? p.budget_amount : null }));
        return {
            totals: {
                projects: projects.length,
                active: active.length,
                on_track: byHealth[ProjectHealth.HEALTHY] ?? 0,
                at_risk: (byHealth[ProjectHealth.AT_RISK] ?? 0),
                critical: (byHealth[ProjectHealth.CRITICAL] ?? 0) + (byHealth[ProjectHealth.BLOCKED] ?? 0),
                unknown_health: byHealth[ProjectHealth.UNKNOWN] ?? 0,
                completed: byCategory[ProjectStatusCategory.COMPLETED] ?? 0,
                overdue_milestones: overdueMilestones.length,
                overdue_tasks: overdueTasks,
                open_blockers: openBlockers,
                budget_hours: active.reduce((s, p) => s + Number(p.budget_hours ?? 0), 0),
                logged_hours: Math.round(active.reduce((s, p) => s + (hoursBy.get(p.id) ?? 0), 0) * 10) / 10,
            },
            by_status_category: byCategory,
            by_health: byHealth,
            at_risk: atRisk,
            upcoming_milestones: upcoming,
            overdue_milestones: overdueMilestones,
            budget,
        };
    }

    async milestones(ctx: OrgContext, query: MilestoneQuery) {
        const today = startOfDay();
        const and: Prisma.ProjectMilestoneWhereInput[] = [{ project: { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx) } }];
        if (query.project_id) and.push({ project_id: query.project_id });
        if (query.status?.length) and.push({ status: { in: query.status } });
        if (query.billing !== undefined) and.push({ is_billing_milestone: query.billing });
        if (query.customer_visible !== undefined) and.push({ customer_visible: query.customer_visible });
        if (query.overdue) and.push({ status: { in: OPEN_MILESTONE }, planned_date: { lt: today } });
        if (query.from) and.push({ planned_date: { gte: toDate(query.from) as Date } });
        if (query.to) and.push({ planned_date: { lte: toDate(query.to) as Date } });
        if (query.search) and.push({ OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { project: { name: { contains: query.search, mode: 'insensitive' } } }] });
        const where: Prisma.ProjectMilestoneWhereInput = { AND: and };
        const [items, total] = await Promise.all([
            this.prisma.projectMilestone.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ planned_date: { sort: query.order_direction === 'desc' ? 'desc' : 'asc', nulls: 'last' } }, { sort_order: 'asc' }],
                include: {
                    project: { select: { id: true, name: true, color: true, company: { select: { id: true, name: true } } } },
                    _count: { select: { tasks: true, deliverables: true } },
                },
            }),
            this.prisma.projectMilestone.count({ where }),
        ]);
        const owners = await this.membersById(items.map((m) => m.owner_membership_id));
        return paginate(items.map((m) => ({ ...m, owner: owners.get(m.owner_membership_id ?? '') ?? null, overdue: OPEN_MILESTONE.includes(m.status) && !!m.planned_date && m.planned_date < today })), total, query);
    }

    async raid(ctx: OrgContext, query: RaidQuery) {
        const me = ctx.membership_id ?? '';
        const owner = query.owner_id === 'me' ? me : query.owner_id;
        const projectWhere = { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx) };
        const projectSelect = { select: { id: true, name: true, color: true } };
        const search = query.search;
        let items: { owner_membership_id?: string | null; decision_maker_membership_id?: string | null }[] = [];
        let total = 0;
        if (query.kind === 'risks') {
            const where: Prisma.ProjectRiskWhereInput = {
                project: projectWhere,
                ...(query.project_id && { project_id: query.project_id }),
                ...(query.severity?.length && { severity: { in: query.severity } }),
                ...(query.risk_status?.length ? { status: { in: query.risk_status } } : query.open ? { status: { in: ['OPEN', 'MONITORING'] } } : {}),
                ...(owner && { owner_membership_id: owner }),
                ...(search && { title: { contains: search, mode: 'insensitive' } }),
            };
            [items, total] = await Promise.all([
                this.prisma.projectRisk.findMany({ where, ...skipTake(query), orderBy: [{ severity: 'desc' }, { created_at: 'desc' }], include: { project: projectSelect } }),
                this.prisma.projectRisk.count({ where }),
            ]);
        } else if (query.kind === 'issues') {
            const where: Prisma.ProjectIssueWhereInput = {
                project: projectWhere,
                ...(query.project_id && { project_id: query.project_id }),
                ...(query.issue_kind && { kind: query.issue_kind }),
                ...(query.severity?.length && { severity: { in: query.severity } }),
                ...(query.open && { status: { in: ['OPEN', 'IN_PROGRESS'] } }),
                ...(owner && { owner_membership_id: owner }),
                ...(search && { title: { contains: search, mode: 'insensitive' } }),
            };
            [items, total] = await Promise.all([
                this.prisma.projectIssue.findMany({ where, ...skipTake(query), orderBy: [{ severity: 'desc' }, { identified_at: 'desc' }], include: { project: projectSelect, task: { select: { id: true, number: true, title: true } } } }),
                this.prisma.projectIssue.count({ where }),
            ]);
        } else if (query.kind === 'decisions') {
            const where: Prisma.ProjectDecisionWhereInput = {
                project: projectWhere,
                ...(query.project_id && { project_id: query.project_id }),
                ...(search && { title: { contains: search, mode: 'insensitive' } }),
            };
            [items, total] = await Promise.all([
                this.prisma.projectDecision.findMany({ where, ...skipTake(query), orderBy: { decided_at: 'desc' }, include: { project: projectSelect } }),
                this.prisma.projectDecision.count({ where }),
            ]);
        } else {
            const where: Prisma.ProjectDependencyWhereInput = {
                project: projectWhere,
                ...(query.project_id && { project_id: query.project_id }),
                ...(query.open && { status: 'OPEN' }),
                ...(owner && { owner_membership_id: owner }),
            };
            [items, total] = await Promise.all([
                this.prisma.projectDependency.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' }, include: { project: projectSelect } }),
                this.prisma.projectDependency.count({ where }),
            ]);
        }
        const people = await this.membersById(items.map((i) => i.owner_membership_id ?? i.decision_maker_membership_id));
        return paginate(items.map((i) => ({ ...i, owner: people.get(i.owner_membership_id ?? i.decision_maker_membership_id ?? '') ?? null })), total, query);
    }

    /** Planned allocation per person (05 §51): ProjectAllocation rows overlapping the period, plus active project members. */
    async workload(ctx: OrgContext, query: WorkloadQuery) {
        const from = (toDate(query.from) as Date) ?? startOfDay();
        const to = (toDate(query.to) as Date) ?? addDays(from, 27);
        const projectWhere: Prisma.ProjectWhereInput = { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx), ...(query.project_id && { id: query.project_id }) };
        const [allocations, members] = await Promise.all([
            this.prisma.projectAllocation.findMany({
                where: {
                    project: projectWhere,
                    membership_id: { not: null },
                    ...(query.team_id && { membership: { teams: { some: { team_id: query.team_id, ended_at: null } } } }),
                    AND: [{ OR: [{ start_date: null }, { start_date: { lte: to } }] }, { OR: [{ end_date: null }, { end_date: { gte: from } }] }],
                },
                include: { project: { select: { id: true, name: true, color: true } }, membership: { select: MEMBER_SELECT } },
            }),
            this.prisma.projectMember.findMany({
                where: { is_active: true, project: { ...projectWhere, completed_at: null }, ...(query.team_id && { membership: { teams: { some: { team_id: query.team_id, ended_at: null } } } }) },
                include: { project: { select: { id: true, name: true, color: true } }, membership: { select: MEMBER_SELECT } },
            }),
        ]);
        const people = new Map<string, { membership: (typeof members)[number]['membership']; total_percent: number; total_hours: number; projects: { project: { id: string; name: string; color: string | null }; allocation_percent: number | null; planned_hours: number | null; role_label: string | null; start_date: Date | null; end_date: Date | null; source: 'allocation' | 'member' }[] }>();
        const entry = (m: (typeof members)[number]['membership']) => {
            if (!people.has(m.id)) people.set(m.id, { membership: m, total_percent: 0, total_hours: 0, projects: [] });
            return people.get(m.id)!;
        };
        const allocated = new Set<string>();
        for (const a of allocations) {
            const e = entry(a.membership!);
            allocated.add(`${a.membership_id}:${a.project_id}`);
            e.projects.push({ project: a.project, allocation_percent: a.allocation_percent, planned_hours: a.planned_hours ? Number(a.planned_hours) : null, role_label: a.role_label, start_date: a.start_date, end_date: a.end_date, source: 'allocation' });
            e.total_percent += a.allocation_percent ?? 0;
            e.total_hours += a.planned_hours ? Number(a.planned_hours) : 0;
        }
        for (const m of members) {
            if (allocated.has(`${m.membership_id}:${m.project_id}`)) continue;
            const e = entry(m.membership);
            e.projects.push({ project: m.project, allocation_percent: m.allocation_percent, planned_hours: null, role_label: m.role_label, start_date: null, end_date: null, source: 'member' });
            e.total_percent += m.allocation_percent ?? 0;
        }
        const ids = [...people.keys()];
        const openTasks = ids.length
            ? await this.prisma.task.groupBy({
                by: ['assignee_membership_id'],
                where: { organization_id: ctx.organization_id, assignee_membership_id: { in: ids }, archived_at: null, status: { category: { notIn: [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED] } } },
                _count: { _all: true },
            })
            : [];
        const tasksBy = new Map(openTasks.map((t) => [t.assignee_membership_id, t._count._all]));
        const rows = [...people.values()]
            .map((p) => ({ ...p, open_tasks: tasksBy.get(p.membership.id) ?? 0, over_allocated: p.total_percent > 100 }))
            .sort((a, b) => b.total_percent - a.total_percent);
        return { from, to, people: rows };
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    async membersById(ids: (string | null | undefined)[]) {
        const unique = [...new Set(ids.filter(Boolean))] as string[];
        if (!unique.length) return new Map<string, Prisma.MembershipGetPayload<{ select: typeof MEMBER_SELECT }>>();
        const rows = await this.prisma.membership.findMany({ where: { id: { in: unique } }, select: MEMBER_SELECT });
        return new Map(rows.map((r) => [r.id, r]));
    }

    async assertMembership(ctx: OrgContext, membershipId: string) {
        const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organization_id: ctx.organization_id }, select: { id: true } });
        if (!m) throw new BadRequestException({ message: 'Member not found in this organization', code: 'membership_not_found' });
    }

    private async assertProjectRole(ctx: OrgContext, roleId: string) {
        const role = await this.prisma.role.findFirst({ where: { id: roleId, OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] }, select: { id: true } });
        if (!role) throw new BadRequestException({ message: 'Role not found', code: 'role_not_found' });
    }

    private assertBudgetPermission(ctx: OrgContext, dto: Partial<Record<(typeof BUDGET_FIELDS)[number], unknown>>) {
        if (BUDGET_FIELDS.some((k) => dto[k] !== undefined) && !ctx.can('projects.projects.manage_budgets')) {
            throw new ForbiddenException({ message: 'Budget fields need projects.projects.manage_budgets', code: 'permission_denied' });
        }
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateProjectDto) {
        const org = ctx.organization_id;
        const checks: [string, Promise<unknown>][] = [];
        if (dto.type_id) checks.push(['type', this.prisma.projectType.findFirst({ where: { id: dto.type_id, organization_id: org } })]);
        if (dto.company_id) checks.push(['customer', this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: org }, select: { id: true } })]);
        if (dto.owner_membership_id) checks.push(['owner', this.prisma.membership.findFirst({ where: { id: dto.owner_membership_id, organization_id: org }, select: { id: true } })]);
        if (dto.team_id) checks.push(['team', this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: org }, select: { id: true } })]);
        if (dto.branch_id) checks.push(['branch', this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: org }, select: { id: true } })]);
        const results = await Promise.all(checks.map(([, p]) => p));
        const missing = checks.filter((_, i) => !results[i]).map(([name]) => name);
        if (dto.member_ids?.length) {
            const count = await this.prisma.membership.count({ where: { id: { in: dto.member_ids }, organization_id: org } });
            if (count !== new Set(dto.member_ids).size) missing.push('members');
        }
        if (missing.length) throw new BadRequestException({ message: `Not found in this organization: ${missing.join(', ')}`, code: 'reference_not_found' });
    }

    private async uniqueSlug(organizationId: string, name: string) {
        const base = slugify(name);
        let slug = base;
        for (let i = 2; await this.prisma.project.findFirst({ where: { organization_id: organizationId, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'A project with this code already exists', code: 'project_code_taken' });
        }
        throw error;
    }
}
