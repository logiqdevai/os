import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HandoverStatus, ModuleKey, Prisma, ProjectGateStatus, RecordEntityType, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TasksService } from '@/modules/tasks/services/tasks.service';
import { taskIdentifier } from '@/modules/tasks/utils/task-number.utils';
import { CreateTaskDto } from '@/modules/tasks/dto/create-task.dto';
import {
    AcceptHandoverInput,
    ChecklistItemInput,
    CreateChecklistInput,
    CreateGateInput,
    CreateHandoverInput,
    CreateReviewInput,
    DecideGateInput,
    ReviewAction,
    UpdateChecklistInput,
    UpdateChecklistItemInput,
    UpdateCloseoutInput,
    UpdateGateInput,
    UpdateHandoverInput,
    UpdateReviewInput,
} from '../dto/project-governance.schema';
import { compact, MEMBER_SELECT, toDate } from '../utils/projects.utils';
import { ProjectsService } from './projects.service';

const UPDATE = 'projects.projects.update';
const DECIDE = 'projects.gates.decide';
const COMPLETE = 'projects.projects.complete';
const ACCEPT_ON_BEHALF = 'projects.deliverables.accept_on_behalf';
const OPEN_HANDOVER: HandoverStatus[] = [HandoverStatus.PLANNED, HandoverStatus.IN_PROGRESS];
const TASK_REF = { id: true, number: true, title: true, team: { select: { task_key: true } }, status: { select: { name: true, category: true } } } satisfies Prisma.TaskSelect;

type Project = Awaited<ReturnType<ProjectsService['assertAccess']>> & { owner_membership_id: string | null };

/**
 * 05 §46–49, §71–74, §92–94, §102–103 — approval / quality gates, reviews and retrospectives, phase checklists,
 * handovers and the closeout record of one project. Reads need projects.projects.read + project scope; edits need
 * projects.projects.update; deciding gates needs projects.gates.decide (sensitive); closing needs projects.projects.complete.
 * Completion is refused while blocking gates or required checklist items are open (ProjectsService.completionBlockers).
 */
@Injectable()
export class ProjectGovernanceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly projects: ProjectsService,
        private readonly tasks: TasksService,
    ) { }

    private async project(ctx: OrgContext, projectId: string, key?: string): Promise<Project> {
        const p = await this.projects.assertAccess(ctx, projectId, key);
        const extra = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { owner_membership_id: true } });
        return { ...p, ...extra };
    }

    private link(projectId: string, tab: string) {
        return `/projects/${projectId}?tab=${tab}`;
    }

    /** Every referenced person, team or milestone must belong to this organization / project. */
    private async assertRefs(ctx: OrgContext, projectId: string, refs: { members?: (string | null | undefined)[]; teams?: (string | null | undefined)[]; milestone_id?: string | null }) {
        const members = [...new Set((refs.members ?? []).filter(Boolean))] as string[];
        const teams = [...new Set((refs.teams ?? []).filter(Boolean))] as string[];
        const [m, t, ms] = await Promise.all([
            members.length ? this.prisma.membership.count({ where: { id: { in: members }, organization_id: ctx.organization_id } }) : 0,
            teams.length ? this.prisma.team.count({ where: { id: { in: teams }, organization_id: ctx.organization_id } }) : 0,
            refs.milestone_id ? this.prisma.projectMilestone.count({ where: { id: refs.milestone_id, project_id: projectId } }) : 1,
        ]);
        if (m !== members.length || t !== teams.length || !ms) throw new BadRequestException({ message: 'A referenced person, team or milestone was not found', code: 'reference_not_found' });
    }

    // ---------------------------------------------------------------------------------------------
    // Gates (05 §46, §93)
    // ---------------------------------------------------------------------------------------------

    async listGates(ctx: OrgContext, projectId: string) {
        await this.projects.assertAccess(ctx, projectId);
        return this.prisma.projectGate.findMany({
            where: { project_id: projectId },
            orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
            include: { milestone: { select: { id: true, name: true, planned_date: true } }, approver: { select: MEMBER_SELECT } },
        });
    }

    async createGate(ctx: OrgContext, projectId: string, dto: CreateGateInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        await this.assertRefs(ctx, projectId, { members: [dto.approver_membership_id], milestone_id: dto.milestone_id });
        const last = await this.prisma.projectGate.aggregate({ where: { project_id: projectId }, _max: { sort_order: true } });
        const gate = await this.prisma.projectGate.create({ data: { ...dto, project_id: projectId, sort_order: dto.sort_order ?? (last._max.sort_order ?? -1) + 1 } });
        await this.audit.record(ctx, 'project_gate.created', { resource_type: 'project_gate', resource_id: gate.id, branch_id: project.branch_id, metadata: { project_id: projectId, after: dto } });
        this.publishGate(ctx, project, gate, 'projects.gate.created', `added gate "${gate.name}" to ${project.name}`, gate.approver_membership_id);
        return gate;
    }

    async updateGate(ctx: OrgContext, projectId: string, id: string, dto: UpdateGateInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findGate(projectId, id);
        await this.assertRefs(ctx, projectId, { members: [dto.approver_membership_id], milestone_id: dto.milestone_id });
        const gate = await this.prisma.projectGate.update({ where: { id }, data: compact(dto) });
        await this.audit.record(ctx, 'project_gate.updated', {
            resource_type: 'project_gate', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, before: { name: before.name, approver_membership_id: before.approver_membership_id, blocks_completion: before.blocks_completion }, after: dto },
        });
        const newApprover = dto.approver_membership_id && dto.approver_membership_id !== before.approver_membership_id && gate.status === ProjectGateStatus.PENDING ? dto.approver_membership_id : null;
        this.publishGate(ctx, project, gate, newApprover ? 'projects.gate.approval_requested' : 'projects.gate.updated', null, newApprover);
        return gate;
    }

    async removeGate(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.project(ctx, projectId, UPDATE);
        const gate = await this.findGate(projectId, id);
        await this.prisma.projectGate.delete({ where: { id } });
        await this.audit.record(ctx, 'project_gate.deleted', { resource_type: 'project_gate', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { name: gate.name, status: gate.status } } });
        this.events.publish(ctx, { event_key: 'projects.gate.deleted', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId, payload: { project_id: projectId, gate_id: id, name: gate.name } });
        return { success: true };
    }

    /** Pass, fail or waive a gate. Failing and waiving need a reason. Sensitive: audited with the decision comment. */
    async decideGate(ctx: OrgContext, projectId: string, id: string, dto: DecideGateInput) {
        const project = await this.project(ctx, projectId, DECIDE);
        const before = await this.findGate(projectId, id);
        if (dto.decision !== ProjectGateStatus.PASSED && !dto.comment?.trim()) throw new BadRequestException({ message: 'Explain why the gate failed or is waived', code: 'gate_comment_required' });
        if (before.status === dto.decision) throw new ConflictException({ message: `This gate is already ${dto.decision.toLowerCase()}`, code: 'gate_already_decided' });
        const gate = await this.prisma.projectGate.update({ where: { id }, data: { status: dto.decision, decision_comment: dto.comment ?? null, decided_at: new Date() } });
        await this.audit.record(ctx, `project_gate.${dto.decision.toLowerCase()}`, {
            resource_type: 'project_gate', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, before: before.status, after: dto.decision, comment: dto.comment ?? null, blocks_completion: gate.blocks_completion, sensitive: true },
        });
        const verb = dto.decision === 'PASSED' ? 'passed' : dto.decision === 'FAILED' ? 'failed' : 'waived';
        this.events.publish(ctx, {
            event_key: 'projects.gate.decided', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: {
                project_id: projectId, project_name: project.name, gate_id: id, name: gate.name, kind: gate.kind, decision: dto.decision, comment: dto.comment ?? null, blocks_completion: gate.blocks_completion,
                watcher_membership_ids: project.owner_membership_id ? [project.owner_membership_id] : [], link: this.link(projectId, 'governance'),
            },
            activity: { summary: `${verb} gate "${gate.name}" on ${project.name}`, entity_label: gate.name, project_id: projectId, company_id: project.company_id },
        });
        return gate;
    }

    /** Put a decided gate back to PENDING (e.g. after a failed QA gate is fixed) and ask the approver again. */
    async reopenGate(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.project(ctx, projectId, DECIDE);
        const before = await this.findGate(projectId, id);
        if (before.status === ProjectGateStatus.PENDING) throw new ConflictException({ message: 'This gate is already pending', code: 'gate_pending' });
        const gate = await this.prisma.projectGate.update({ where: { id }, data: { status: ProjectGateStatus.PENDING, decision_comment: null, decided_at: null } });
        await this.audit.record(ctx, 'project_gate.reopened', { resource_type: 'project_gate', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: before.status, after: 'PENDING' } });
        this.publishGate(ctx, project, gate, 'projects.gate.approval_requested', `reopened gate "${gate.name}" on ${project.name}`, gate.approver_membership_id);
        return gate;
    }

    private publishGate(ctx: OrgContext, project: Project, gate: { id: string; name: string; status: ProjectGateStatus }, key: string, summary: string | null, approver: string | null) {
        this.events.publish(ctx, {
            event_key: key, module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: project.id,
            payload: {
                project_id: project.id, project_name: project.name, gate_id: gate.id, name: gate.name, status: gate.status,
                ...(approver && { approver_membership_ids: [approver], notification_title: `Gate "${gate.name}" on ${project.name} needs your decision` }),
                link: this.link(project.id, 'governance'), entity_label: gate.name,
            },
            ...(summary && { activity: { summary, entity_label: gate.name, project_id: project.id, company_id: project.company_id } }),
        });
    }

    private async findGate(projectId: string, id: string) {
        const gate = await this.prisma.projectGate.findFirst({ where: { id, project_id: projectId } });
        if (!gate) throw new NotFoundException({ message: 'Gate not found', code: 'project_gate_not_found' });
        return gate;
    }

    // ---------------------------------------------------------------------------------------------
    // Reviews & retrospectives (05 §48–49)
    // ---------------------------------------------------------------------------------------------

    async listReviews(ctx: OrgContext, projectId: string) {
        await this.projects.assertAccess(ctx, projectId);
        const rows = await this.prisma.projectReview.findMany({ where: { project_id: projectId }, orderBy: [{ held_at: { sort: 'desc', nulls: 'first' } }, { created_at: 'desc' }] });
        const people = await this.projects.membersById(rows.flatMap((r) => [r.facilitator_membership_id, ...r.participants, ...this.actions(r.actions).map((a) => a.owner_membership_id)]));
        const taskIds = rows.flatMap((r) => this.actions(r.actions).map((a) => a.task_id)).filter(Boolean) as string[];
        const tasks = taskIds.length ? await this.prisma.task.findMany({ where: { id: { in: taskIds }, organization_id: ctx.organization_id }, select: TASK_REF }) : [];
        const taskBy = new Map(tasks.map((t) => [t.id, { ...t, identifier: taskIdentifier(t) }]));
        return rows.map((r) => ({
            ...r,
            facilitator: people.get(r.facilitator_membership_id ?? '') ?? null,
            participant_people: r.participants.map((id) => people.get(id)).filter(Boolean),
            actions: this.actions(r.actions).map((a) => ({ ...a, owner: people.get(a.owner_membership_id ?? '') ?? null, task: a.task_id ? taskBy.get(a.task_id) ?? null : null })),
        }));
    }

    private actions(value: Prisma.JsonValue | null): ReviewAction[] {
        return Array.isArray(value) ? (value as unknown as ReviewAction[]) : [];
    }

    async createReview(ctx: OrgContext, projectId: string, dto: CreateReviewInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        await this.assertRefs(ctx, projectId, { members: [dto.facilitator_membership_id, ...(dto.participants ?? []), ...(dto.actions ?? []).map((a) => a.owner_membership_id)], milestone_id: dto.milestone_id });
        const review = await this.prisma.projectReview.create({
            data: { ...dto, project_id: projectId, held_at: toDate(dto.held_at) ?? null, participants: dto.participants ?? [], actions: (dto.actions ?? []) as Prisma.InputJsonValue },
        });
        await this.audit.record(ctx, 'project_review.created', { resource_type: 'project_review', resource_id: review.id, branch_id: project.branch_id, metadata: { project_id: projectId, type: review.type, title: review.title } });
        this.events.publish(ctx, {
            event_key: 'projects.review.created', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: {
                project_id: projectId, review_id: review.id, type: review.type, title: review.title,
                attendee_membership_ids: review.participants, assignee_membership_ids: [...new Set((dto.actions ?? []).map((a) => a.owner_membership_id).filter(Boolean))],
                link: this.link(projectId, 'governance'), entity_label: review.title,
            },
            activity: { summary: `recorded ${review.type.toLowerCase().replace('_', ' ')} review "${review.title}" on ${project.name}`, entity_label: review.title, project_id: projectId, company_id: project.company_id },
        });
        return review;
    }

    async updateReview(ctx: OrgContext, projectId: string, id: string, dto: UpdateReviewInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findReview(projectId, id);
        await this.assertRefs(ctx, projectId, { members: [dto.facilitator_membership_id, ...(dto.participants ?? []), ...(dto.actions ?? []).map((a) => a.owner_membership_id)], milestone_id: dto.milestone_id });
        const data: Prisma.ProjectReviewUncheckedUpdateInput = compact({ ...dto, held_at: toDate(dto.held_at), actions: dto.actions as Prisma.InputJsonValue | undefined });
        const review = await this.prisma.projectReview.update({ where: { id }, data });
        await this.audit.record(ctx, 'project_review.updated', { resource_type: 'project_review', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { title: before.title }, after: { ...dto, actions: dto.actions?.length } } });
        return review;
    }

    async removeReview(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.project(ctx, projectId, UPDATE);
        const review = await this.findReview(projectId, id);
        await this.prisma.projectReview.delete({ where: { id } });
        await this.audit.record(ctx, 'project_review.deleted', { resource_type: 'project_review', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { title: review.title, type: review.type } } });
        return { success: true };
    }

    /** Turn a review action into a Task (06) in this project; the action keeps the task id. */
    async createActionTask(ctx: OrgContext, projectId: string, id: string, index: number) {
        const project = await this.project(ctx, projectId);
        const review = await this.findReview(projectId, id);
        const actions = this.actions(review.actions);
        const action = actions[index];
        if (!action) throw new NotFoundException({ message: 'Action not found', code: 'review_action_not_found' });
        if (action.task_id) throw new ConflictException({ message: 'A task already exists for this action', code: 'review_action_has_task' });
        const task = await this.tasks.create(ctx, {
            title: action.title, project_id: projectId, description: `Action from ${review.type.toLowerCase().replace('_', ' ')} review "${review.title}".`,
            assignee_membership_id: action.owner_membership_id ?? undefined, due_date: action.due_date ?? undefined,
        } as CreateTaskDto);
        actions[index] = { ...action, task_id: task.id };
        await this.prisma.projectReview.update({ where: { id }, data: { actions: actions as Prisma.InputJsonValue } });
        await this.audit.record(ctx, 'project_review.action_task_created', { resource_type: 'project_review', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, index, task_id: task.id } });
        return { task_id: task.id, identifier: task.identifier };
    }

    private async findReview(projectId: string, id: string) {
        const review = await this.prisma.projectReview.findFirst({ where: { id, project_id: projectId } });
        if (!review) throw new NotFoundException({ message: 'Review not found', code: 'project_review_not_found' });
        return review;
    }

    // ---------------------------------------------------------------------------------------------
    // Checklists (05 §92) — required items block completion
    // ---------------------------------------------------------------------------------------------

    async listChecklists(ctx: OrgContext, projectId: string) {
        await this.projects.assertAccess(ctx, projectId);
        const rows = await this.prisma.projectChecklist.findMany({
            where: { project_id: projectId },
            orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
            include: { items: { orderBy: { sort_order: 'asc' }, include: { task: { select: TASK_REF } } } },
        });
        const people = await this.projects.membersById(rows.flatMap((c) => c.items.map((i) => i.completed_by_membership_id)));
        return rows.map((c) => ({
            ...c,
            progress: { total: c.items.length, done: c.items.filter((i) => i.is_completed).length, required_open: c.items.filter((i) => i.is_required && !i.is_completed).length },
            items: c.items.map((i) => ({ ...i, completed_by: people.get(i.completed_by_membership_id ?? '') ?? null, task: i.task ? { ...i.task, identifier: taskIdentifier(i.task) } : null })),
        }));
    }

    async createChecklist(ctx: OrgContext, projectId: string, dto: CreateChecklistInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const last = await this.prisma.projectChecklist.aggregate({ where: { project_id: projectId }, _max: { sort_order: true } });
        const checklist = await this.prisma.projectChecklist.create({
            data: {
                project_id: projectId, name: dto.name, phase: dto.phase ?? null, sort_order: (last._max.sort_order ?? -1) + 1,
                items: { create: (dto.items ?? []).map((it, i) => ({ title: it.title, is_required: !!it.is_required, sort_order: i })) },
            },
            include: { items: true },
        });
        await this.audit.record(ctx, 'project_checklist.created', { resource_type: 'project_checklist', resource_id: checklist.id, branch_id: project.branch_id, metadata: { project_id: projectId, name: dto.name, phase: dto.phase ?? null, items: dto.items?.length ?? 0 } });
        return checklist;
    }

    async updateChecklist(ctx: OrgContext, projectId: string, id: string, dto: UpdateChecklistInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findChecklist(projectId, id);
        const checklist = await this.prisma.projectChecklist.update({ where: { id }, data: compact(dto) });
        await this.audit.record(ctx, 'project_checklist.updated', { resource_type: 'project_checklist', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { name: before.name, phase: before.phase }, after: dto } });
        return checklist;
    }

    async removeChecklist(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findChecklist(projectId, id);
        await this.prisma.projectChecklist.delete({ where: { id } });
        await this.audit.record(ctx, 'project_checklist.deleted', { resource_type: 'project_checklist', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { name: before.name } } });
        return { success: true };
    }

    async addItem(ctx: OrgContext, projectId: string, checklistId: string, dto: ChecklistItemInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        await this.findChecklist(projectId, checklistId);
        const last = await this.prisma.projectChecklistItem.aggregate({ where: { checklist_id: checklistId }, _max: { sort_order: true } });
        const item = await this.prisma.projectChecklistItem.create({ data: { checklist_id: checklistId, title: dto.title, is_required: !!dto.is_required, sort_order: (last._max.sort_order ?? -1) + 1 } });
        await this.audit.record(ctx, 'project_checklist_item.created', { resource_type: 'project_checklist_item', resource_id: item.id, branch_id: project.branch_id, metadata: { project_id: projectId, checklist_id: checklistId, title: dto.title, is_required: !!dto.is_required } });
        return item;
    }

    async updateItem(ctx: OrgContext, projectId: string, checklistId: string, id: string, dto: UpdateChecklistItemInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findItem(projectId, checklistId, id);
        const data: Prisma.ProjectChecklistItemUncheckedUpdateInput = compact(dto);
        if (dto.is_completed === true && !before.is_completed) Object.assign(data, { completed_at: new Date(), completed_by_membership_id: ctx.membership_id });
        if (dto.is_completed === false && before.is_completed) Object.assign(data, { completed_at: null, completed_by_membership_id: null });
        const item = await this.prisma.projectChecklistItem.update({ where: { id }, data });
        const action = dto.is_completed === true && !before.is_completed ? 'completed' : dto.is_completed === false && before.is_completed ? 'reopened' : 'updated';
        await this.audit.record(ctx, `project_checklist_item.${action}`, {
            resource_type: 'project_checklist_item', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, checklist_id: checklistId, title: item.title, before: { is_completed: before.is_completed, is_required: before.is_required, title: before.title }, after: dto },
        });
        if (action !== 'updated') {
            this.events.publish(ctx, {
                event_key: `projects.checklist_item.${action}`, module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
                payload: { project_id: projectId, checklist_id: checklistId, item_id: id, title: item.title, is_required: item.is_required },
            });
        }
        return item;
    }

    async removeItem(ctx: OrgContext, projectId: string, checklistId: string, id: string) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findItem(projectId, checklistId, id);
        await this.prisma.projectChecklistItem.delete({ where: { id } });
        await this.audit.record(ctx, 'project_checklist_item.deleted', { resource_type: 'project_checklist_item', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, checklist_id: checklistId, before: { title: before.title, is_required: before.is_required } } });
        return { success: true };
    }

    /** Create a Task (06) from a checklist item and link it (ProjectChecklistItem.task_id). */
    async createItemTask(ctx: OrgContext, projectId: string, checklistId: string, id: string) {
        const project = await this.project(ctx, projectId);
        const item = await this.findItem(projectId, checklistId, id);
        if (item.task_id) throw new ConflictException({ message: 'A task already exists for this item', code: 'checklist_item_has_task' });
        const checklist = await this.findChecklist(projectId, checklistId);
        const task = await this.tasks.create(ctx, { title: item.title, project_id: projectId, description: `From the "${checklist.name}" checklist.` } as CreateTaskDto);
        await this.prisma.projectChecklistItem.update({ where: { id }, data: { task_id: task.id } });
        await this.audit.record(ctx, 'project_checklist_item.task_created', { resource_type: 'project_checklist_item', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, task_id: task.id } });
        return { task_id: task.id, identifier: task.identifier };
    }

    private async findChecklist(projectId: string, id: string) {
        const checklist = await this.prisma.projectChecklist.findFirst({ where: { id, project_id: projectId } });
        if (!checklist) throw new NotFoundException({ message: 'Checklist not found', code: 'project_checklist_not_found' });
        return checklist;
    }

    private async findItem(projectId: string, checklistId: string, id: string) {
        const item = await this.prisma.projectChecklistItem.findFirst({ where: { id, checklist_id: checklistId, checklist: { project_id: projectId } } });
        if (!item) throw new NotFoundException({ message: 'Checklist item not found', code: 'project_checklist_item_not_found' });
        return item;
    }

    // ---------------------------------------------------------------------------------------------
    // Handovers (05 §72, §102)
    // ---------------------------------------------------------------------------------------------

    async listHandovers(ctx: OrgContext, projectId: string) {
        await this.projects.assertAccess(ctx, projectId);
        const rows = await this.prisma.projectHandover.findMany({ where: { project_id: projectId }, orderBy: [{ created_at: 'desc' }] });
        const [people, teams] = await Promise.all([
            this.projects.membersById(rows.flatMap((h) => [h.new_owner_membership_id, h.accepted_by_membership_id])),
            this.prisma.team.findMany({ where: { organization_id: ctx.organization_id, id: { in: rows.flatMap((h) => [h.from_team_id, h.to_team_id]).filter(Boolean) as string[] } }, select: { id: true, name: true } }),
        ]);
        const teamBy = new Map(teams.map((t) => [t.id, t]));
        const mine = ctx.membership_id ? new Set((await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } })).map((t) => t.team_id)) : new Set<string>();
        return rows.map((h) => ({
            ...h,
            new_owner: people.get(h.new_owner_membership_id ?? '') ?? null,
            accepted_by: people.get(h.accepted_by_membership_id ?? '') ?? null,
            from_team: teamBy.get(h.from_team_id ?? '') ?? null,
            to_team: teamBy.get(h.to_team_id ?? '') ?? null,
            can_accept: OPEN_HANDOVER.includes(h.status) && (h.new_owner_membership_id === ctx.membership_id || (!!h.to_team_id && mine.has(h.to_team_id)) || ctx.can(UPDATE)),
        }));
    }

    async createHandover(ctx: OrgContext, projectId: string, dto: CreateHandoverInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        await this.assertRefs(ctx, projectId, { members: [dto.new_owner_membership_id], teams: [dto.from_team_id, dto.to_team_id] });
        const handover = await this.prisma.projectHandover.create({
            data: { ...dto, project_id: projectId, scheduled_at: toDate(dto.scheduled_at) ?? null, details: (dto.details ?? {}) as Prisma.InputJsonValue },
        });
        await this.audit.record(ctx, 'project_handover.created', { resource_type: 'project_handover', resource_id: handover.id, branch_id: project.branch_id, metadata: { project_id: projectId, after: { ...dto, details: undefined } } });
        const label = `${project.name} handover`;
        this.events.publish(ctx, {
            event_key: 'projects.handover.planned', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: {
                project_id: projectId, handover_id: handover.id, type: handover.type, to_team_id: handover.to_team_id, scheduled_at: handover.scheduled_at,
                ...(handover.new_owner_membership_id && { approver_membership_ids: [handover.new_owner_membership_id], notification_title: `Accept the handover of ${project.name}` }),
                link: this.link(projectId, 'closeout'), entity_label: label,
            },
            activity: { summary: `planned a ${handover.type.replace(/_/g, ' ')} handover for ${project.name}`, entity_label: label, project_id: projectId, company_id: project.company_id },
        });
        return handover;
    }

    async updateHandover(ctx: OrgContext, projectId: string, id: string, dto: UpdateHandoverInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findHandover(projectId, id);
        if (!OPEN_HANDOVER.includes(before.status)) throw new ConflictException({ message: 'Completed or cancelled handovers cannot be changed', code: 'handover_closed' });
        await this.assertRefs(ctx, projectId, { members: [dto.new_owner_membership_id], teams: [dto.from_team_id, dto.to_team_id] });
        const data: Prisma.ProjectHandoverUncheckedUpdateInput = compact({ ...dto, scheduled_at: toDate(dto.scheduled_at), details: dto.details as Prisma.InputJsonValue | undefined });
        const handover = await this.prisma.projectHandover.update({ where: { id }, data });
        await this.audit.record(ctx, dto.status === 'CANCELLED' ? 'project_handover.cancelled' : 'project_handover.updated', {
            resource_type: 'project_handover', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, before: { status: before.status, new_owner_membership_id: before.new_owner_membership_id, scheduled_at: before.scheduled_at }, after: { ...dto, details: undefined } },
        });
        if (dto.status && dto.status !== before.status) {
            this.events.publish(ctx, {
                event_key: `projects.handover.${dto.status.toLowerCase()}`, module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
                payload: { project_id: projectId, handover_id: id, status: dto.status, watcher_membership_ids: handover.new_owner_membership_id ? [handover.new_owner_membership_id] : [], link: this.link(projectId, 'closeout') },
                activity: { summary: `${dto.status === 'CANCELLED' ? 'cancelled' : 'started'} the ${handover.type.replace(/_/g, ' ')} handover of ${project.name}`, entity_label: project.name, project_id: projectId },
            });
        }
        return handover;
    }

    async removeHandover(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.project(ctx, projectId, UPDATE);
        const before = await this.findHandover(projectId, id);
        await this.prisma.projectHandover.delete({ where: { id } });
        await this.audit.record(ctx, 'project_handover.deleted', { resource_type: 'project_handover', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { type: before.type, status: before.status } } });
        return { success: true };
    }

    /**
     * The receiving side accepts the handover: the named new owner, a member of the receiving team, or someone who may
     * update the project. `transfer_ownership` also makes the new owner the project owner (projects.projects.update).
     */
    async acceptHandover(ctx: OrgContext, projectId: string, id: string, dto: AcceptHandoverInput) {
        const project = await this.project(ctx, projectId);
        const handover = await this.findHandover(projectId, id);
        if (!OPEN_HANDOVER.includes(handover.status)) throw new ConflictException({ message: 'This handover is already closed', code: 'handover_closed' });
        const me = ctx.membership_id;
        const inTeam = !!(handover.to_team_id && me && (await this.prisma.teamMembership.count({ where: { team_id: handover.to_team_id, membership_id: me, ended_at: null } })));
        const canUpdate = ctx.can(UPDATE) && !!(await this.projects.assertAccess(ctx, projectId, UPDATE).catch(() => null));
        if (handover.new_owner_membership_id !== me && !inTeam && !canUpdate) {
            throw new ForbiddenException({ message: 'Only the receiving owner or team can accept this handover', code: 'handover_not_recipient' });
        }
        if (dto.transfer_ownership && (!canUpdate || !handover.new_owner_membership_id)) {
            throw new ForbiddenException({ message: 'Transferring ownership needs projects.projects.update and a new owner on the handover', code: 'permission_denied' });
        }
        const accepted = await this.prisma.$transaction(async (tx) => {
            if (dto.transfer_ownership && handover.new_owner_membership_id) {
                await tx.project.update({ where: { id: projectId }, data: { owner_membership_id: handover.new_owner_membership_id } });
                await tx.projectMember.upsert({
                    where: { project_id_membership_id: { project_id: projectId, membership_id: handover.new_owner_membership_id } },
                    update: { is_active: true, left_at: null },
                    create: { project_id: projectId, membership_id: handover.new_owner_membership_id, role_label: 'Project manager' },
                });
            }
            const details = { ...((handover.details ?? {}) as Record<string, unknown>), ...(dto.comment && { acceptance_comment: dto.comment }) };
            return tx.projectHandover.update({
                where: { id },
                data: { status: HandoverStatus.COMPLETED, completed_at: new Date(), accepted_at: new Date(), accepted_by_membership_id: me, details: details as Prisma.InputJsonValue },
            });
        });
        await this.audit.record(ctx, 'project_handover.accepted', {
            resource_type: 'project_handover', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, comment: dto.comment ?? null, transfer_ownership: !!dto.transfer_ownership, before_owner: project.owner_membership_id, after_owner: dto.transfer_ownership ? handover.new_owner_membership_id : project.owner_membership_id },
        });
        this.events.publish(ctx, {
            event_key: 'projects.handover.accepted', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: {
                project_id: projectId, handover_id: id, type: handover.type, transfer_ownership: !!dto.transfer_ownership,
                watcher_membership_ids: project.owner_membership_id ? [project.owner_membership_id] : [], link: this.link(projectId, 'closeout'),
            },
            activity: { summary: `accepted the ${handover.type.replace(/_/g, ' ')} handover of ${project.name}`, entity_label: project.name, project_id: projectId, company_id: project.company_id },
        });
        return accepted;
    }

    private async findHandover(projectId: string, id: string) {
        const handover = await this.prisma.projectHandover.findFirst({ where: { id, project_id: projectId } });
        if (!handover) throw new NotFoundException({ message: 'Handover not found', code: 'project_handover_not_found' });
        return handover;
    }

    // ---------------------------------------------------------------------------------------------
    // Closeout (05 §71, §103)
    // ---------------------------------------------------------------------------------------------

    /** Closeout record plus the computed completion requirements (required ones block completion). */
    async closeout(ctx: OrgContext, projectId: string) {
        await this.projects.assertAccess(ctx, projectId);
        const [project, record, blockers, deliverables, openDeliverables, openTasks, openIssues, retros, handovers, openHandovers] = await Promise.all([
            this.prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, name: true, completed_at: true, archived_at: true, status: { select: { name: true, category: true } } } }),
            this.prisma.projectCloseout.findUnique({ where: { project_id: projectId } }),
            this.projects.completionBlockers(projectId),
            this.prisma.projectDeliverable.count({ where: { project_id: projectId } }),
            this.prisma.projectDeliverable.count({ where: { project_id: projectId, status: { notIn: ['ACCEPTED', 'CANCELLED'] } } }),
            this.prisma.task.count({ where: { project_id: projectId, archived_at: null, is_template: false, OR: [{ status_id: null }, { status: { category: { notIn: [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED] } } }] } }),
            this.prisma.projectIssue.count({ where: { project_id: projectId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
            this.prisma.projectReview.count({ where: { project_id: projectId, type: { in: ['RETROSPECTIVE', 'POST_PROJECT'] } } }),
            this.prisma.projectHandover.count({ where: { project_id: projectId, status: HandoverStatus.COMPLETED } }),
            this.prisma.projectHandover.count({ where: { project_id: projectId, status: { in: OPEN_HANDOVER } } }),
        ]);
        const requirements = [
            { key: 'gates', label: 'Blocking gates passed or waived', required: true, satisfied: !blockers.gates.length, detail: blockers.gates.length ? blockers.gates.map((g) => g.name).join(', ') : null },
            { key: 'required_checklist', label: 'Required checklist items done', required: true, satisfied: !blockers.checklist_items.length, detail: blockers.checklist_items.length ? `${blockers.checklist_items.length} open` : null },
            { key: 'deliverables', label: 'Deliverables accepted', required: false, satisfied: !openDeliverables, detail: deliverables ? `${deliverables - openDeliverables} of ${deliverables}` : 'No deliverables' },
            { key: 'customer_acceptance', label: 'Customer acceptance recorded', required: false, satisfied: !!record?.customer_acceptance_recorded_at, detail: null },
            { key: 'open_tasks', label: 'No open tasks', required: false, satisfied: !openTasks, detail: openTasks ? `${openTasks} open` : null },
            { key: 'open_issues', label: 'Issues and blockers resolved', required: false, satisfied: !openIssues, detail: openIssues ? `${openIssues} open` : null },
            { key: 'retrospective', label: 'Retrospective held', required: false, satisfied: retros > 0, detail: null },
            { key: 'handover', label: 'Handover completed', required: false, satisfied: !openHandovers && handovers > 0, detail: openHandovers ? `${openHandovers} in progress` : handovers ? null : 'None planned' },
        ];
        const people = await this.projects.membersById([record?.closed_by_membership_id]);
        return {
            project,
            closeout: record ? { ...record, closed_by: people.get(record.closed_by_membership_id ?? '') ?? null } : null,
            requirements,
            blockers,
            can_complete: !project.completed_at && requirements.every((r) => !r.required || r.satisfied),
        };
    }

    async updateCloseout(ctx: OrgContext, projectId: string, dto: UpdateCloseoutInput) {
        const project = await this.project(ctx, projectId, UPDATE);
        return this.saveCloseout(ctx, project, dto, 'project_closeout.updated');
    }

    private async saveCloseout(ctx: OrgContext, project: Project, dto: UpdateCloseoutInput, auditType: string, extra: Prisma.ProjectCloseoutUncheckedUpdateInput = {}) {
        if (dto.customer_acceptance_recorded !== undefined && !ctx.can(ACCEPT_ON_BEHALF)) {
            throw new ForbiddenException({ message: `Recording customer acceptance needs ${ACCEPT_ON_BEHALF}`, code: 'permission_denied', permission: ACCEPT_ON_BEHALF });
        }
        const before = await this.prisma.projectCloseout.findUnique({ where: { project_id: project.id } });
        const { customer_acceptance_recorded, ...fields } = dto;
        const acceptance = customer_acceptance_recorded === undefined ? undefined : customer_acceptance_recorded ? before?.customer_acceptance_recorded_at ?? new Date() : null;
        const snapshot = (await this.closeout(ctx, project.id)).requirements;
        const data = { ...compact(fields), ...(acceptance !== undefined && { customer_acceptance_recorded_at: acceptance }), completion_checklist: snapshot as Prisma.InputJsonValue, ...extra };
        const record = await this.prisma.projectCloseout.upsert({
            where: { project_id: project.id },
            update: data,
            create: { ...(data as Prisma.ProjectCloseoutUncheckedCreateInput), project_id: project.id },
        });
        await this.audit.record(ctx, auditType, {
            resource_type: 'project_closeout', resource_id: project.id, branch_id: project.branch_id,
            metadata: { project_id: project.id, after: { ...fields, customer_acceptance_recorded }, ...(customer_acceptance_recorded !== undefined && { sensitive: true }) },
        });
        if (customer_acceptance_recorded === true && !before?.customer_acceptance_recorded_at) {
            this.events.publish(ctx, {
                event_key: 'projects.closeout.customer_acceptance_recorded', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: project.id,
                payload: { project_id: project.id, name: project.name },
                activity: { summary: `recorded customer acceptance of ${project.name}`, entity_label: project.name, project_id: project.id, company_id: project.company_id },
            });
        }
        return record;
    }

    /** Save the closeout record and complete the project (refused while blocking gates or required checklist items are open). */
    async close(ctx: OrgContext, projectId: string, dto: UpdateCloseoutInput) {
        const project = await this.project(ctx, projectId, COMPLETE);
        if (project.completed_at) throw new ConflictException({ message: 'Project is already completed', code: 'project_already_completed' });
        await this.projects.complete(ctx, projectId);
        await this.saveCloseout(ctx, project, dto, 'project_closeout.closed', { closed_at: new Date(), closed_by_membership_id: ctx.membership_id });
        return this.closeout(ctx, projectId);
    }
}
