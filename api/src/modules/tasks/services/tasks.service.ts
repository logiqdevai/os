import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CalculationMode, ModuleKey, Prisma, RecordEntityType, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { addDays, compact, listPeople, MEMBER_SELECT, startOfDay, toDate } from '@/modules/projects/utils/projects.utils';
import { AssignTaskDto, BulkTaskDto, CreateTaskDto, MoveTaskDto, UpdateTaskDto } from '../dto/create-task.dto';
import { BoardQuery, TaskLookupQuery, TaskQuery, TaskWorkloadQuery } from '../dto/task-query.schema';
import { defaultStatus, ensureTaskStatuses, ensureTaskTypes } from '../utils/task-defaults.utils';
import { DEFAULT_TASK_KEY, nextTaskNumber, parseTaskIdentifier, rankBetween, taskIdentifier } from '../utils/task-number.utils';
import { serializeRef, serializeTask, TASK_LIST_INCLUDE, TASK_READ, TASK_REF_SELECT } from '../utils/task-serialize.utils';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED: TaskStatusCategory[] = [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED];
const TASK_DATES = ['start_date', 'due_date'] as const;
const NO_ID = '00000000-0000-0000-0000-000000000000';

type TaskWithStatus = Prisma.TaskGetPayload<{ include: { status: true; team: { select: { id: true; task_key: true } }; assignees: true; labels: true; project: { select: { id: true; name: true; branch_id: true; company_id: true; team_id: true; progress_mode: true } } } }>;

/**
 * 06 Task Management — the only Task entity (Linear-style). Identifier = `<Team.task_key>-<number>`.
 * Scope: organization-wide holders see all tasks; others see tasks of their teams / projects / branches / customers,
 * tasks they are assigned to, reported or watch, and tasks of projects they are a member of. Out of scope → 404.
 */
@Injectable()
export class TasksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Scope & lookup helpers
    // ---------------------------------------------------------------------------------------------

    scopeWhere(ctx: OrgContext, key = TASK_READ): Prisma.TaskWhereInput {
        const scope = ctx.scopeOf(key);
        if (!scope) return { id: { in: [] } };
        if (scope.organization) return {};
        const me = ctx.membership_id ?? NO_ID;
        return {
            OR: [
                { team_id: { in: scope.team_ids } },
                { project_id: { in: scope.project_ids } },
                { project: { branch_id: { in: scope.branch_ids } } },
                { project: { team_id: { in: scope.team_ids } } },
                { project: { company_id: { in: scope.customer_ids } } },
                { assignee_membership_id: me },
                { reporter_membership_id: me },
                { assignees: { some: { membership_id: me } } },
                { watchers: { some: { membership_id: me } } },
                { project: { members: { some: { membership_id: me, is_active: true } } } },
                { project: { owner_membership_id: me } },
            ],
        };
    }

    /** Resolve a uuid or a `WEB-142` identifier to the task id (404 when unknown). */
    async resolveId(ctx: OrgContext, idOrKey: string): Promise<string> {
        if (UUID.test(idOrKey)) return idOrKey;
        const parsed = parseTaskIdentifier(idOrKey);
        if (!parsed) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
        // Numbers are per team: WEB-142 = team with task_key WEB, number 142. TASK-n = tasks without a team key.
        const teamWhere: Prisma.TaskWhereInput =
            parsed.key === DEFAULT_TASK_KEY ? { OR: [{ team_id: null }, { team: { task_key: null } }] } : { team: { task_key: parsed.key } };
        const task = await this.prisma.task.findFirst({
            where: { organization_id: ctx.organization_id, number: parsed.number, ...teamWhere },
            select: { id: true },
        });
        if (!task) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
        return task.id;
    }

    /** Load a task the caller may reach with `key` (404 otherwise). */
    private async load(ctx: OrgContext, idOrKey: string, key = TASK_READ): Promise<TaskWithStatus> {
        const id = await this.resolveId(ctx, idOrKey);
        const task = await this.prisma.task.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx, key) },
            include: {
                status: true,
                team: { select: { id: true, task_key: true } },
                assignees: true,
                labels: true,
                project: { select: { id: true, name: true, branch_id: true, company_id: true, team_id: true, progress_mode: true } },
            },
        });
        if (!task) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
        return task;
    }

    async assertAccess(ctx: OrgContext, idOrKey: string, key = TASK_READ) {
        const task = await this.load(ctx, idOrKey, key);
        return { id: task.id, number: task.number, title: task.title, team: task.team, project_id: task.project_id, customer_visible: task.customer_visible, identifier: taskIdentifier(task) };
    }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    private buildWhere(ctx: OrgContext, q: Partial<TaskQuery>): Prisma.TaskWhereInput {
        const me = ctx.membership_id ?? NO_ID;
        const who = (v: string) => (v === 'me' ? me : v === 'none' ? null : v);
        const idOrNull = (v: string) => (v === 'none' ? null : v);
        const today = startOfDay();
        const and: Prisma.TaskWhereInput[] = [
            { organization_id: ctx.organization_id, is_template: false },
            this.scopeWhere(ctx),
            q.archived ? { archived_at: { not: null } } : { archived_at: null },
        ];
        if (q.mine) and.push({ OR: [{ assignee_membership_id: me }, { assignees: { some: { membership_id: me } } }] });
        if (q.assignee) and.push({ assignee_membership_id: who(q.assignee) });
        if (q.reporter) and.push({ reporter_membership_id: who(q.reporter) });
        if (q.status_id?.length) and.push({ status_id: { in: q.status_id } });
        if (q.status_category?.length) and.push({ status: { category: { in: q.status_category } } });
        if (q.open) and.push({ OR: [{ status_id: null }, { status: { category: { notIn: CLOSED } } }] });
        if (q.label_id?.length) and.push({ labels: { some: { label_id: { in: q.label_id } } } });
        if (q.priority?.length) and.push({ priority: { in: q.priority } });
        if (q.type_id) and.push({ type_id: q.type_id });
        if (q.team_id) and.push({ team_id: idOrNull(q.team_id) });
        if (q.project_id) and.push({ project_id: idOrNull(q.project_id) });
        if (q.milestone_id) and.push({ milestone_id: q.milestone_id });
        if (q.cycle_id) and.push({ cycle_id: idOrNull(q.cycle_id) });
        if (q.release_id) and.push({ release_id: idOrNull(q.release_id) });
        if (q.parent_task_id) and.push({ parent_task_id: idOrNull(q.parent_task_id) });
        if (q.blocked !== undefined) and.push({ blocked: q.blocked });
        if (q.customer_visible !== undefined) and.push({ customer_visible: q.customer_visible });
        if (q.due === 'overdue') and.push({ due_date: { lt: today }, OR: [{ status_id: null }, { status: { category: { notIn: CLOSED } } }] });
        if (q.due === 'today') and.push({ due_date: today });
        if (q.due === 'week') and.push({ due_date: { gte: today, lte: addDays(today, 7) } });
        if (q.due === 'none') and.push({ due_date: null });
        if (q.due === 'any') and.push({ due_date: { not: null } });
        if (q.search) {
            const parsed = parseTaskIdentifier(q.search);
            const asNumber = /^\d+$/.test(q.search) ? Number(q.search) : parsed?.number;
            and.push({
                OR: [
                    { title: { contains: q.search, mode: 'insensitive' } },
                    { description: { contains: q.search, mode: 'insensitive' } },
                    ...(asNumber ? [{ number: asNumber }] : []),
                ],
            });
        }
        return { AND: and };
    }

    async findAll(ctx: OrgContext, query: TaskQuery) {
        const where = this.buildWhere(ctx, query);
        const sort = query.order_by === 'priority'
            ? [{ priority: query.order_direction }, { created_at: 'desc' as const }]
            : query.order_by === 'due_date'
                ? [{ due_date: { sort: query.order_direction, nulls: 'last' as const } }, { created_at: 'desc' as const }]
                : query.order_by === 'rank'
                    ? [{ rank: { sort: 'asc' as const, nulls: 'last' as const } }, { created_at: 'asc' as const }]
                    : [orderBy(query, ['created_at', 'updated_at', 'number', 'title', 'completed_at'], 'updated_at')];
        const [items, total] = await Promise.all([
            this.prisma.task.findMany({ where, ...skipTake(query), orderBy: sort as Prisma.TaskOrderByWithRelationInput[], include: TASK_LIST_INCLUDE }),
            this.prisma.task.count({ where }),
        ]);
        return paginate(items.map(serializeTask), total, query);
    }

    /** Kanban: one column per status of the team workflow (06 §4), cards ordered by rank. */
    async board(ctx: OrgContext, query: BoardQuery) {
        const teamId = query.team_id && query.team_id !== 'none' ? query.team_id : null;
        const team = teamId ? await this.prisma.team.findFirst({ where: { id: teamId, organization_id: ctx.organization_id }, select: { id: true, name: true, task_key: true } }) : null;
        if (teamId && !team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        const statuses = await ensureTaskStatuses(this.prisma, ctx.organization_id, teamId);
        const where = this.buildWhere(ctx, { ...query, team_id: teamId ?? 'none' });
        const tasks = await this.prisma.task.findMany({
            where,
            take: query.limit,
            orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { created_at: 'asc' }],
            include: TASK_LIST_INCLUDE,
        });
        return { team, statuses, tasks: tasks.map(serializeTask) };
    }

    people(ctx: OrgContext, search?: string) {
        return listPeople(this.prisma, ctx.organization_id, search);
    }

    async lookup(ctx: OrgContext, query: TaskLookupQuery) {
        const where = this.buildWhere(ctx, { search: query.search, project_id: query.project_id, open: query.open });
        const rows = await this.prisma.task.findMany({
            where,
            take: query.limit,
            orderBy: { updated_at: 'desc' },
            select: { id: true, number: true, title: true, project_id: true, team: { select: { task_key: true } }, status: { select: { name: true, category: true } }, project: { select: { id: true, name: true } } },
        });
        return rows.map((r) => ({ ...r, identifier: taskIdentifier(r) }));
    }

    async findOne(ctx: OrgContext, idOrKey: string) {
        const { id } = await this.load(ctx, idOrKey);
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: {
                ...TASK_LIST_INCLUDE,
                project: { select: { id: true, name: true, color: true, visibility: true, company: { select: { id: true, name: true } } } },
                workstream: { select: { id: true, name: true } },
                release: { select: { id: true, name: true, version: true } },
                reporter: { select: MEMBER_SELECT },
                parent: { select: TASK_REF_SELECT },
                subtasks: { where: { archived_at: null }, select: TASK_REF_SELECT, orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { created_at: 'asc' }] },
                assignees: { include: { membership: { select: MEMBER_SELECT } } },
                watchers: { include: { membership: { select: MEMBER_SELECT } } },
                checklist_items: { orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] },
                dependencies_from: { include: { target: { select: TASK_REF_SELECT } } },
                dependencies_to: { include: { source: { select: TASK_REF_SELECT } } },
                attachments: { include: { document: { select: { id: true, title: true, filename: true, mimetype: true, size: true, external_url: true, url: true, created_at: true } } }, orderBy: { created_at: 'desc' } },
                links: true,
            },
        });
        const statuses = await ensureTaskStatuses(this.prisma, ctx.organization_id, task.team_id);
        const allowed = task.status?.slug && (await this.prisma.taskStatus.findUnique({ where: { id: task.status_id }, select: { allowed_transitions: true } }))?.allowed_transitions;
        const me = ctx.membership_id;
        return {
            ...serializeTask(task),
            parent: serializeRef(task.parent),
            subtasks: task.subtasks.map(serializeRef),
            dependencies_from: task.dependencies_from.map((d) => ({ ...d, target: serializeRef(d.target) })),
            dependencies_to: task.dependencies_to.map((d) => ({ ...d, source: serializeRef(d.source) })),
            attachments: task.attachments.map((a) => ({ ...a, document: a.document ? { ...a.document, size: a.document.size !== null ? Number(a.document.size) : null } : null })),
            workflow_statuses: allowed?.length ? statuses.filter((s) => allowed.includes(s.slug) || s.id === task.status_id) : statuses,
            is_watching: !!me && task.watchers.some((w) => w.membership_id === me),
        };
    }

    /** Status history + audit trail of the task, newest first. */
    async activity(ctx: OrgContext, idOrKey: string) {
        const { id } = await this.load(ctx, idOrKey);
        const [history, audits] = await Promise.all([
            this.prisma.taskStatusHistory.findMany({
                where: { task_id: id },
                orderBy: { changed_at: 'desc' },
                take: 100,
                include: { from_status: { select: { id: true, name: true, category: true, color: true } }, to_status: { select: { id: true, name: true, category: true, color: true } } },
            }),
            this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_type: 'task', resource_id: id },
                orderBy: { created_at: 'desc' },
                take: 100,
                select: { id: true, event_type: true, created_at: true, actor_user_id: true, metadata: true, actor_type: true },
            }),
        ]);
        const memberIds = history.map((h) => h.changed_by_membership_id).filter(Boolean) as string[];
        const userIds = audits.map((a) => a.actor_user_id).filter(Boolean) as string[];
        const [members, users] = await Promise.all([
            this.prisma.membership.findMany({ where: { id: { in: memberIds } }, select: MEMBER_SELECT }),
            this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } }),
        ]);
        const memberBy = new Map(members.map((m) => [m.id, m]));
        const userBy = new Map(users.map((u) => [u.id, u]));
        return {
            status_history: history.map((h) => ({ ...h, changed_by: memberBy.get(h.changed_by_membership_id ?? '') ?? null })),
            events: audits.map((a) => {
                const meta = (a.metadata ?? {}) as Record<string, unknown>;
                return { id: a.id, event_type: a.event_type, created_at: a.created_at, actor_type: a.actor_type, actor: userBy.get(a.actor_user_id ?? '') ?? null, changes: meta.after ?? null, before: meta.before ?? null, channel: meta.channel ?? null };
            }),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateTaskDto) {
        const me = ctx.membership_id;
        if (dto.assignee_membership_id && dto.assignee_membership_id !== me && !ctx.can('tasks.tasks.assign')) {
            throw new ForbiddenException({ message: 'Assigning someone else needs tasks.tasks.assign', code: 'permission_denied' });
        }
        if (dto.assignee_ids?.some((id) => id !== me) && !ctx.can('tasks.tasks.assign')) {
            throw new ForbiddenException({ message: 'Assigning someone else needs tasks.tasks.assign', code: 'permission_denied' });
        }
        const refs = await this.resolveRefs(ctx, dto);
        const teamId = dto.team_id ?? refs.parent?.team_id ?? refs.project?.team_id ?? null;
        this.assertWriteScope(ctx, 'tasks.tasks.create', { team_id: teamId, project: refs.project });

        const statuses = await ensureTaskStatuses(this.prisma, ctx.organization_id, teamId);
        await ensureTaskTypes(this.prisma, ctx.organization_id);
        let status = dto.status_id ? statuses.find((s) => s.id === dto.status_id) : defaultStatus(statuses);
        if (dto.status_id && !status) {
            const other = await this.prisma.taskStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id } });
            if (!other) throw new BadRequestException({ message: 'Status not found', code: 'task_status_not_found' });
            throw new BadRequestException({ message: `"${other.name}" belongs to another team's workflow`, code: 'task_status_other_workflow' });
        }
        status = status ?? null;
        const type = dto.type_id
            ? await this.prisma.taskType.findFirst({ where: { id: dto.type_id, organization_id: ctx.organization_id } })
            : await this.prisma.taskType.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null } });
        if (dto.type_id && !type) throw new BadRequestException({ message: 'Task type not found', code: 'task_type_not_found' });
        const template = (type?.template ?? {}) as { priority?: string; checklist?: string[]; estimate_points?: number };

        const checklist = dto.checklist?.length ? dto.checklist : template.checklist ?? [];
        const assignee = dto.assignee_membership_id ?? null;
        const extraAssignees = [...new Set((dto.assignee_ids ?? []).filter((id) => id !== assignee))];
        const watchers = [...new Set([me, assignee, ...extraAssignees].filter(Boolean))] as string[];

        const task = await this.prisma.$transaction(async (tx) => {
            const number = await nextTaskNumber(tx, ctx.organization_id, teamId);
            const last = await tx.task.findFirst({ where: { organization_id: ctx.organization_id, team_id: teamId, status_id: status?.id ?? null, rank: { not: null } }, orderBy: { rank: 'desc' }, select: { rank: true } });
            const created = await tx.task.create({
                data: {
                    organization_id: ctx.organization_id,
                    number,
                    title: dto.title,
                    description: dto.description,
                    team_id: teamId,
                    project_id: dto.project_id ?? refs.parent?.project_id ?? null,
                    workstream_id: dto.workstream_id ?? null,
                    milestone_id: dto.milestone_id ?? null,
                    parent_task_id: dto.parent_task_id ?? null,
                    cycle_id: dto.cycle_id ?? null,
                    release_id: dto.release_id ?? null,
                    type_id: type?.id ?? null,
                    status_id: status?.id ?? null,
                    priority: dto.priority ?? ((template.priority as CreateTaskDto['priority']) || undefined),
                    assignee_membership_id: assignee,
                    reporter_membership_id: me,
                    estimate_points: dto.estimate_points ?? template.estimate_points ?? null,
                    estimate_hours: dto.estimate_hours ?? null,
                    start_date: toDate(dto.start_date) ?? null,
                    due_date: toDate(dto.due_date) ?? null,
                    customer_visible: dto.customer_visible ?? false,
                    blocked: dto.blocked ?? false,
                    blocked_reason: dto.blocked_reason,
                    rank: rankBetween(last?.rank ?? null, null),
                    created_by_user_id: ctx.user_id,
                    ...(status?.category === TaskStatusCategory.DONE && { completed_at: new Date() }),
                },
            });
            if (dto.label_ids?.length) await tx.taskLabelAssignment.createMany({ data: dto.label_ids.map((label_id) => ({ task_id: created.id, label_id })), skipDuplicates: true });
            if (extraAssignees.length) await tx.taskAssignee.createMany({ data: extraAssignees.map((membership_id) => ({ task_id: created.id, membership_id })), skipDuplicates: true });
            if (watchers.length) await tx.taskWatcher.createMany({ data: watchers.map((membership_id) => ({ task_id: created.id, membership_id })), skipDuplicates: true });
            if (checklist.length) await tx.taskChecklistItem.createMany({ data: checklist.map((title, i) => ({ task_id: created.id, title, sort_order: i })) });
            await tx.taskStatusHistory.create({ data: { task_id: created.id, from_status_id: null, to_status_id: status?.id ?? null, to_category: status?.category ?? null, changed_by_membership_id: me } });
            return created;
        });

        const identifier = `${refs.team?.task_key || DEFAULT_TASK_KEY}-${task.number}`;
        await this.audit.record(ctx, 'task.created', { resource_type: 'task', resource_id: task.id, branch_id: refs.project?.branch_id ?? null, metadata: { identifier, after: dto } });
        const assigneeIds = [assignee, ...extraAssignees].filter((id) => id && id !== me) as string[];
        this.events.publish(ctx, {
            event_key: 'tasks.task.created', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id,
            payload: {
                identifier, title: task.title, project_id: task.project_id, team_id: task.team_id, priority: task.priority, due_date: task.due_date,
                // Not `assignee_membership_ids`: the separate `tasks.task.assigned` event below notifies the assignees (one notification per person).
                initial_assignee_membership_ids: assigneeIds, mentioned_membership_ids: (dto.mentioned_membership_ids ?? []).filter((id) => id !== me),
            },
            activity: { summary: `created ${identifier} ${task.title}`, entity_label: `${identifier} ${task.title}`, project_id: task.project_id, company_id: refs.project?.company_id ?? null, customer_visible: task.customer_visible },
        });
        if (assigneeIds.length) {
            this.events.publish(ctx, { event_key: 'tasks.task.assigned', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id, payload: { identifier, title: task.title, assignee_membership_ids: assigneeIds } });
        }
        if (task.project_id) this.recomputeProjectProgress(task.project_id);
        return this.findOne(ctx, task.id);
    }

    async update(ctx: OrgContext, idOrKey: string, dto: UpdateTaskDto & { rank?: string }) {
        const before = await this.load(ctx, idOrKey, 'tasks.tasks.update');
        const me = ctx.membership_id;
        const assigneeChanged = dto.assignee_membership_id !== undefined && dto.assignee_membership_id !== before.assignee_membership_id;
        if (assigneeChanged && dto.assignee_membership_id !== me && !ctx.can('tasks.tasks.assign')) {
            throw new ForbiddenException({ message: 'Assigning someone else needs tasks.tasks.assign', code: 'permission_denied' });
        }
        if (dto.assignee_ids && !ctx.can('tasks.tasks.assign')) throw new ForbiddenException({ message: 'Changing assignees needs tasks.tasks.assign', code: 'permission_denied' });
        if (dto.parent_task_id && dto.parent_task_id === before.id) throw new BadRequestException({ message: 'A task cannot be its own parent', code: 'task_parent_cycle' });
        const refs = await this.resolveRefs(ctx, dto, before.id);

        const { label_ids, assignee_ids, mentioned_membership_ids, ...fields } = dto;
        const data: Prisma.TaskUncheckedUpdateInput = compact({
            ...fields,
            start_date: toDate(dto.start_date),
            due_date: toDate(dto.due_date),
        }) as Prisma.TaskUncheckedUpdateInput;

        // Team change: keep the status category inside the new team's workflow.
        const teamChanged = dto.team_id !== undefined && dto.team_id !== before.team_id;
        const teamId = teamChanged ? dto.team_id ?? null : before.team_id;
        let nextStatus = before.status;
        if (dto.status_id && dto.status_id !== before.status_id) {
            const target = await this.prisma.taskStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id, archived_at: null } });
            if (!target) throw new BadRequestException({ message: 'Status not found', code: 'task_status_not_found' });
            if (target.team_id !== teamId) throw new BadRequestException({ message: `"${target.name}" belongs to another team's workflow`, code: 'task_status_other_workflow' });
            if (before.status?.allowed_transitions?.length && !before.status.allowed_transitions.includes(target.slug)) {
                throw new ConflictException({ message: `A task in "${before.status.name}" cannot move to "${target.name}"`, code: 'task_status_transition_not_allowed' });
            }
            nextStatus = target;
        } else if (teamChanged) {
            const statuses = await ensureTaskStatuses(this.prisma, ctx.organization_id, teamId);
            nextStatus = statuses.find((s) => s.category === before.status?.category) ?? defaultStatus(statuses) ?? null;
        }
        const statusChanged = (nextStatus?.id ?? null) !== (before.status_id ?? null);
        if (statusChanged) {
            data.status_id = nextStatus?.id ?? null;
            Object.assign(data, this.lifecycle(before.status?.category ?? null, nextStatus?.category ?? null));
            if (dto.rank === undefined) {
                const last = await this.prisma.task.findFirst({ where: { organization_id: ctx.organization_id, team_id: teamId, status_id: nextStatus?.id ?? null, rank: { not: null }, id: { not: before.id } }, orderBy: { rank: 'desc' }, select: { rank: true } });
                data.rank = rankBetween(last?.rank ?? null, null);
            }
        }
        if (dto.project_id === undefined && refs.parent && before.project_id === null) data.project_id = refs.parent.project_id;

        await this.prisma.$transaction(async (tx) => {
            // Moving to another team gives the task that team's next number (WEB-12 → APP-4), like Linear.
            if (teamChanged) data.number = await nextTaskNumber(tx, ctx.organization_id, teamId);
            await tx.task.update({ where: { id: before.id }, data });
            if (label_ids) {
                await tx.taskLabelAssignment.deleteMany({ where: { task_id: before.id, label_id: { notIn: label_ids } } });
                await tx.taskLabelAssignment.createMany({ data: label_ids.map((label_id) => ({ task_id: before.id, label_id })), skipDuplicates: true });
            }
            if (assignee_ids) {
                await tx.taskAssignee.deleteMany({ where: { task_id: before.id, membership_id: { notIn: assignee_ids } } });
                await tx.taskAssignee.createMany({ data: assignee_ids.map((membership_id) => ({ task_id: before.id, membership_id })), skipDuplicates: true });
            }
            const newWatchers = [assigneeChanged ? dto.assignee_membership_id : null, ...(assignee_ids ?? [])].filter(Boolean) as string[];
            if (newWatchers.length) await tx.taskWatcher.createMany({ data: newWatchers.map((membership_id) => ({ task_id: before.id, membership_id })), skipDuplicates: true });
            if (statusChanged) {
                const lastChange = await tx.taskStatusHistory.findFirst({ where: { task_id: before.id }, orderBy: { changed_at: 'desc' }, select: { changed_at: true } });
                const since = lastChange?.changed_at ?? before.created_at;
                await tx.taskStatusHistory.create({
                    data: {
                        task_id: before.id, from_status_id: before.status_id, to_status_id: nextStatus?.id ?? null, to_category: nextStatus?.category ?? null,
                        changed_by_membership_id: me, seconds_in_previous: Math.max(0, Math.round((Date.now() - since.getTime()) / 1000)),
                    },
                });
            }
        });

        const identifier = taskIdentifier(teamChanged ? { number: before.number, team: refs.team } : before);
        const changedKeys = Object.keys(data).concat(label_ids ? ['label_ids'] : [], assignee_ids ? ['assignee_ids'] : []);
        await this.audit.record(ctx, 'task.updated', {
            resource_type: 'task', resource_id: before.id, branch_id: before.project?.branch_id ?? null,
            metadata: {
                identifier,
                before: Object.fromEntries(changedKeys.map((k) => [k, k === 'label_ids' ? before.labels.map((l) => l.label_id) : k === 'assignee_ids' ? before.assignees.map((a) => a.membership_id) : (before as Record<string, unknown>)[k]])),
                after: { ...dto, ...(statusChanged && { status_id: nextStatus?.id ?? null }) },
            },
        });
        const watchers = await this.watcherIds(before.id, me);
        this.events.publish(ctx, {
            event_key: 'tasks.task.updated', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: before.id,
            payload: { identifier, title: dto.title ?? before.title, watcher_membership_ids: watchers, mentioned_membership_ids: (mentioned_membership_ids ?? []).filter((id) => id !== me) },
            changes: dto as Record<string, unknown>,
        });
        if (statusChanged) {
            const done = nextStatus?.category === TaskStatusCategory.DONE;
            await this.audit.record(ctx, 'task.status_changed', { resource_type: 'task', resource_id: before.id, metadata: { identifier, before: before.status?.name ?? null, after: nextStatus?.name ?? null } });
            this.events.publish(ctx, {
                event_key: done ? 'tasks.task.completed' : 'tasks.task.status_changed', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: before.id,
                payload: { identifier, title: before.title, from: before.status?.name ?? null, to: nextStatus?.name ?? null, category: nextStatus?.category ?? null, watcher_membership_ids: watchers, project_id: before.project_id },
                activity: { summary: `moved ${identifier} to ${nextStatus?.name ?? 'no status'}`, entity_label: `${identifier} ${before.title}`, project_id: before.project_id, company_id: before.project?.company_id ?? null, customer_visible: before.customer_visible },
            });
        }
        if (assigneeChanged && dto.assignee_membership_id) {
            await this.audit.record(ctx, 'task.assigned', { resource_type: 'task', resource_id: before.id, metadata: { identifier, before: before.assignee_membership_id, after: dto.assignee_membership_id } });
            this.events.publish(ctx, {
                event_key: 'tasks.task.assigned', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: before.id,
                payload: { identifier, title: before.title, assignee_membership_ids: dto.assignee_membership_id !== me ? [dto.assignee_membership_id] : [], previous_assignee_membership_id: before.assignee_membership_id },
            });
        }
        const projects = new Set([before.project_id, data.project_id as string].filter(Boolean));
        if (statusChanged || dto.project_id !== undefined) projects.forEach((p) => this.recomputeProjectProgress(p));
        return this.findOne(ctx, before.id);
    }

    async assign(ctx: OrgContext, idOrKey: string, dto: AssignTaskDto) {
        return this.update(ctx, idOrKey, { assignee_membership_id: dto.assignee_membership_id });
    }

    /** Board drag & drop: change status and/or position between two neighbours. */
    async move(ctx: OrgContext, idOrKey: string, dto: MoveTaskDto) {
        const task = await this.load(ctx, idOrKey, 'tasks.tasks.update');
        const [after, before] = await Promise.all([
            dto.after_task_id ? this.prisma.task.findFirst({ where: { id: dto.after_task_id, organization_id: ctx.organization_id }, select: { rank: true } }) : null,
            dto.before_task_id ? this.prisma.task.findFirst({ where: { id: dto.before_task_id, organization_id: ctx.organization_id }, select: { rank: true } }) : null,
        ]);
        const rank = rankBetween(after?.rank ?? null, before?.rank ?? null);
        if (dto.status_id && dto.status_id !== task.status_id) return this.update(ctx, task.id, { status_id: dto.status_id, rank });
        await this.prisma.task.update({ where: { id: task.id }, data: { rank } });
        return { id: task.id, rank };
    }

    async archive(ctx: OrgContext, idOrKey: string, restore = false) {
        const task = await this.load(ctx, idOrKey, 'tasks.tasks.archive');
        await this.prisma.task.update({ where: { id: task.id }, data: { archived_at: restore ? null : new Date() } });
        const identifier = taskIdentifier(task);
        await this.audit.record(ctx, restore ? 'task.restored' : 'task.archived', { resource_type: 'task', resource_id: task.id, metadata: { identifier } });
        this.events.publish(ctx, { event_key: restore ? 'tasks.task.restored' : 'tasks.task.archived', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id, payload: { identifier, title: task.title } });
        if (task.project_id) this.recomputeProjectProgress(task.project_id);
        return { id: task.id, archived: !restore };
    }

    async remove(ctx: OrgContext, idOrKey: string) {
        const task = await this.load(ctx, idOrKey, 'tasks.tasks.delete');
        await this.prisma.task.delete({ where: { id: task.id } });
        const identifier = taskIdentifier(task);
        await this.audit.record(ctx, 'task.deleted', { resource_type: 'task', resource_id: task.id, metadata: { identifier, title: task.title, sensitive: true } });
        this.events.publish(ctx, { event_key: 'tasks.task.deleted', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, entity_id: task.id, payload: { identifier, title: task.title } });
        if (task.project_id) this.recomputeProjectProgress(task.project_id);
        return { success: true };
    }

    /** Bulk actions (06 §5): one audit event per task (through the normal paths) plus a summary event. */
    async bulk(ctx: OrgContext, dto: BulkTaskDto) {
        if (!dto.patch && !dto.action) throw new BadRequestException({ message: 'Send a patch or an action', code: 'bulk_nothing_to_do' });
        const ids = [...new Set(dto.task_ids)];
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const id of ids) {
            try {
                if (dto.action === 'delete') await this.remove(ctx, id);
                else if (dto.action === 'archive') await this.archive(ctx, id);
                else if (dto.action === 'add_labels' || dto.action === 'remove_labels') {
                    const task = await this.load(ctx, id, 'tasks.tasks.update');
                    const current = task.labels.map((l) => l.label_id);
                    const next = dto.action === 'add_labels' ? [...new Set([...current, ...(dto.label_ids ?? [])])] : current.filter((l) => !(dto.label_ids ?? []).includes(l));
                    await this.update(ctx, id, { label_ids: next });
                }
                if (dto.patch && Object.keys(dto.patch).length) await this.update(ctx, id, { ...dto.patch } as UpdateTaskDto);
                results.push({ id, ok: true });
            } catch (error) {
                results.push({ id, ok: false, error: (error as { message?: string }).message ?? 'failed' });
            }
        }
        const updated = results.filter((r) => r.ok).length;
        await this.audit.record(ctx, 'task.bulk_updated', { resource_type: 'task', metadata: { task_ids: ids, patch: dto.patch ?? null, action: dto.action ?? null, updated, failed: ids.length - updated } });
        return { updated, failed: results.filter((r) => !r.ok) };
    }

    // ---------------------------------------------------------------------------------------------
    // Workload
    // ---------------------------------------------------------------------------------------------

    /** Task distribution per person (06 §10): open, in progress, overdue, blocked, points, due this week. */
    async workload(ctx: OrgContext, query: TaskWorkloadQuery) {
        const where = this.buildWhere(ctx, { open: true, team_id: query.team_id, cycle_id: query.cycle_id, project_id: query.project_id });
        const tasks = await this.prisma.task.findMany({
            where,
            take: 5000,
            select: { assignee_membership_id: true, due_date: true, blocked: true, estimate_points: true, priority: true, status: { select: { category: true } } },
        });
        const today = startOfDay();
        const weekEnd = addDays(today, 7);
        const rows = new Map<string, { open: number; in_progress: number; overdue: number; blocked: number; points: number; due_this_week: number; urgent: number }>();
        for (const t of tasks) {
            const key = t.assignee_membership_id ?? 'unassigned';
            const r = rows.get(key) ?? { open: 0, in_progress: 0, overdue: 0, blocked: 0, points: 0, due_this_week: 0, urgent: 0 };
            r.open += 1;
            if (t.status?.category === TaskStatusCategory.IN_PROGRESS || t.status?.category === TaskStatusCategory.IN_REVIEW) r.in_progress += 1;
            if (t.due_date && t.due_date < today) r.overdue += 1;
            if (t.due_date && t.due_date >= today && t.due_date <= weekEnd) r.due_this_week += 1;
            if (t.blocked || t.status?.category === TaskStatusCategory.BLOCKED) r.blocked += 1;
            if (t.priority === 'URGENT' || t.priority === 'HIGH') r.urgent += 1;
            r.points += t.estimate_points ? Number(t.estimate_points) : 0;
            rows.set(key, r);
        }
        const memberIds = [...rows.keys()].filter((k) => k !== 'unassigned');
        const members = memberIds.length ? await this.prisma.membership.findMany({ where: { id: { in: memberIds } }, select: MEMBER_SELECT }) : [];
        const memberBy = new Map(members.map((m) => [m.id, m]));
        const people = memberIds
            .map((id) => ({ membership: memberBy.get(id) ?? null, ...rows.get(id)! }))
            .sort((a, b) => b.open - a.open)
            .map((r) => ({ ...r, flags: [r.overdue >= 3 ? 'overdue' : null, r.blocked >= 2 ? 'blocked' : null, r.open >= 15 ? 'overloaded' : null].filter(Boolean) }));
        return { people, unassigned: rows.get('unassigned') ?? { open: 0, in_progress: 0, overdue: 0, blocked: 0, points: 0, due_this_week: 0, urgent: 0 }, total_open: tasks.length };
    }

    // ---------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------

    private lifecycle(from: TaskStatusCategory | null, to: TaskStatusCategory | null): Prisma.TaskUncheckedUpdateInput {
        if (to === TaskStatusCategory.DONE) return { completed_at: new Date(), cancelled_at: null, blocked: false };
        if (to === TaskStatusCategory.CANCELLED) return { cancelled_at: new Date(), completed_at: null };
        if (from && CLOSED.includes(from)) return { completed_at: null, cancelled_at: null };
        return {};
    }

    async watcherIds(taskId: string, exclude?: string | null) {
        const rows = await this.prisma.taskWatcher.findMany({ where: { task_id: taskId }, select: { membership_id: true } });
        return rows.map((r) => r.membership_id).filter((id) => id !== exclude);
    }

    /** Callers outside organization scope may only create tasks in a team / project they reach. */
    private assertWriteScope(ctx: OrgContext, key: string, target: { team_id: string | null; project: { id: string; branch_id: string | null; company_id: string | null; team_id: string | null; is_member: boolean } | null }) {
        const scope = ctx.scopeOf(key);
        if (!scope || scope.organization) return;
        const ok =
            this.authorization.inScope(ctx, key, { team_id: target.team_id, project_id: target.project?.id, branch_id: target.project?.branch_id, customer_id: target.project?.company_id }) ||
            (!!target.project?.team_id && scope.team_ids.includes(target.project.team_id)) ||
            !!target.project?.is_member ||
            (!target.team_id && !target.project);
        if (!ok) throw new ForbiddenException({ message: 'You cannot create tasks in this team or project', code: 'out_of_scope' });
    }

    /** Validate every referenced id against the organization; returns the records the caller needs. */
    private async resolveRefs(ctx: OrgContext, dto: Partial<CreateTaskDto>, selfId?: string) {
        const org = ctx.organization_id;
        const me = ctx.membership_id ?? NO_ID;
        const [team, project, parent, milestone, cycle, release, workstream] = await Promise.all([
            dto.team_id ? this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: org }, select: { id: true, task_key: true } }) : null,
            dto.project_id
                ? this.prisma.project.findFirst({
                    where: { id: dto.project_id, organization_id: org },
                    select: { id: true, branch_id: true, company_id: true, team_id: true, members: { where: { membership_id: me, is_active: true }, select: { id: true } }, owner_membership_id: true },
                })
                : null,
            dto.parent_task_id ? this.prisma.task.findFirst({ where: { id: dto.parent_task_id, organization_id: org }, select: { id: true, team_id: true, project_id: true, parent_task_id: true } }) : null,
            dto.milestone_id ? this.prisma.projectMilestone.findFirst({ where: { id: dto.milestone_id, project: { organization_id: org } }, select: { id: true, project_id: true } }) : null,
            dto.cycle_id ? this.prisma.cycle.findFirst({ where: { id: dto.cycle_id, organization_id: org }, select: { id: true } }) : null,
            dto.release_id ? this.prisma.release.findFirst({ where: { id: dto.release_id, organization_id: org }, select: { id: true } }) : null,
            dto.workstream_id ? this.prisma.projectWorkstream.findFirst({ where: { id: dto.workstream_id, project: { organization_id: org } }, select: { id: true } }) : null,
        ]);
        const missing: string[] = [];
        if (dto.team_id && !team) missing.push('team');
        if (dto.project_id && !project) missing.push('project');
        if (dto.parent_task_id && !parent) missing.push('parent task');
        if (dto.milestone_id && !milestone) missing.push('milestone');
        if (dto.cycle_id && !cycle) missing.push('cycle');
        if (dto.release_id && !release) missing.push('release');
        if (dto.workstream_id && !workstream) missing.push('workstream');
        const people = [dto.assignee_membership_id, ...(dto.assignee_ids ?? [])].filter(Boolean) as string[];
        if (people.length) {
            const count = await this.prisma.membership.count({ where: { id: { in: people }, organization_id: org } });
            if (count !== new Set(people).size) missing.push('assignee');
        }
        if (dto.label_ids?.length) {
            const count = await this.prisma.taskLabel.count({ where: { id: { in: dto.label_ids }, organization_id: org } });
            if (count !== new Set(dto.label_ids).size) missing.push('label');
        }
        if (missing.length) throw new BadRequestException({ message: `Not found in this organization: ${missing.join(', ')}`, code: 'reference_not_found' });
        if (milestone && (dto.project_id ?? null) && milestone.project_id !== dto.project_id) {
            throw new BadRequestException({ message: 'The milestone belongs to another project', code: 'milestone_other_project' });
        }
        if (selfId && parent) {
            // Walk up the parent chain to refuse cycles.
            let cursor: string | null = parent.parent_task_id;
            for (let depth = 0; cursor && depth < 20; depth++) {
                if (cursor === selfId) throw new BadRequestException({ message: 'That would create a sub-task loop', code: 'task_parent_cycle' });
                cursor = (await this.prisma.task.findUnique({ where: { id: cursor }, select: { parent_task_id: true } }))?.parent_task_id ?? null;
            }
        }
        let resolvedTeam = team;
        if (!resolvedTeam) {
            const teamId = parent?.team_id ?? project?.team_id ?? null;
            resolvedTeam = teamId ? await this.prisma.team.findUnique({ where: { id: teamId }, select: { id: true, task_key: true } }) : null;
        }
        return {
            team: resolvedTeam,
            project: project ? { ...project, is_member: project.members.length > 0 || project.owner_membership_id === me } : null,
            parent,
        };
    }

    /** Projects in AUTOMATIC progress mode follow their tasks (done / total, cancelled excluded). */
    recomputeProjectProgress(projectId: string) {
        setImmediate(async () => {
            try {
                const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { progress_mode: true, completed_at: true } });
                if (!project || project.progress_mode !== CalculationMode.AUTOMATIC || project.completed_at) return;
                const [total, done] = await Promise.all([
                    this.prisma.task.count({ where: { project_id: projectId, archived_at: null, parent_task_id: null, OR: [{ status_id: null }, { status: { category: { not: TaskStatusCategory.CANCELLED } } }] } }),
                    this.prisma.task.count({ where: { project_id: projectId, archived_at: null, parent_task_id: null, status: { category: TaskStatusCategory.DONE } } }),
                ]);
                await this.prisma.project.update({ where: { id: projectId }, data: { progress_percent: total ? Math.round((done / total) * 100) : 0 } });
            } catch {
                /* progress is a convenience; never fails the request */
            }
        });
    }
}
