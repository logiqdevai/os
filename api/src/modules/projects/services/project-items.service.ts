import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliverableStatus, ModuleKey, Prisma, ProjectChangeRequestStatus, ProjectItemStatus, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ProjectsService } from './projects.service';
import { compact, MEMBER_SELECT, riskSeverity, startOfDay, withDates } from '../utils/projects.utils';
import { DecideChangeRequestDto, ReviewDeliverableDto } from '../dto/project-items.dto';

/** Child resources of a project that share the same list / create / update / delete shape. */
export const PROJECT_CHILDREN = {
    milestones: { model: 'projectMilestone', permission: 'projects.milestones.manage', resource: 'project_milestone', label: 'milestone', dates: ['planned_date', 'actual_date'], order: [{ planned_date: { sort: 'asc', nulls: 'last' } }, { sort_order: 'asc' }], owner: 'owner_membership_id' },
    workstreams: { model: 'projectWorkstream', permission: 'projects.workstreams.manage', resource: 'project_workstream', label: 'workstream', dates: ['planned_start', 'planned_end'], order: [{ sort_order: 'asc' }, { created_at: 'asc' }], owner: 'owner_membership_id' },
    deliverables: { model: 'projectDeliverable', permission: 'projects.deliverables.manage', resource: 'project_deliverable', label: 'deliverable', dates: ['due_date'], order: [{ due_date: { sort: 'asc', nulls: 'last' } }, { sort_order: 'asc' }], owner: 'owner_membership_id' },
    risks: { model: 'projectRisk', permission: 'projects.risks.manage', resource: 'project_risk', label: 'risk', dates: ['due_date'], order: [{ created_at: 'desc' }], owner: 'owner_membership_id' },
    issues: { model: 'projectIssue', permission: 'projects.issues.manage', resource: 'project_issue', label: 'issue', dates: ['target_resolution'], order: [{ identified_at: 'desc' }], owner: 'owner_membership_id' },
    decisions: { model: 'projectDecision', permission: 'projects.issues.manage', resource: 'project_decision', label: 'decision', dates: ['decided_at'], order: [{ decided_at: 'desc' }], owner: 'decision_maker_membership_id' },
    dependencies: { model: 'projectDependency', permission: 'projects.dependencies.manage', resource: 'project_dependency', label: 'dependency', dates: ['expected_resolution'], order: [{ created_at: 'desc' }], owner: 'owner_membership_id' },
    'status-updates': { model: 'projectStatusUpdate', permission: 'projects.status_updates.publish', resource: 'project_status_update', label: 'status update', dates: ['period_start', 'period_end'], order: [{ created_at: 'desc' }], owner: 'author_membership_id' },
    'change-requests': { model: 'projectChangeRequest', permission: 'projects.change_requests.manage', resource: 'project_change_request', label: 'change request', dates: [], order: [{ number: 'desc' }], owner: 'requester_membership_id' },
    allocations: { model: 'projectAllocation', permission: 'projects.members.manage', resource: 'project_allocation', label: 'allocation', dates: ['start_date', 'end_date'], order: [{ start_date: { sort: 'asc', nulls: 'last' } }], owner: 'membership_id' },
} as const;

export type ProjectChildKind = keyof typeof PROJECT_CHILDREN;

interface Delegate {
    findMany(args: unknown): Promise<Record<string, any>[]>;
    findFirst(args: unknown): Promise<Record<string, any> | null>;
    create(args: unknown): Promise<Record<string, any>>;
    update(args: unknown): Promise<Record<string, any>>;
    delete(args: unknown): Promise<Record<string, any>>;
}

/**
 * Milestones, workstreams, deliverables, RAID (risks, issues, decisions, dependencies), status updates, change
 * requests and allocations of one project (05 §17–51). Reads need projects.projects.read + project access; writes
 * need the child's own permission key, evaluated against the project's scope. Every write is audited and published.
 */
@Injectable()
export class ProjectItemsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly projects: ProjectsService,
    ) { }

    private delegate(kind: ProjectChildKind): Delegate {
        return this.prisma[PROJECT_CHILDREN[kind].model] as unknown as Delegate;
    }

    private include(kind: ProjectChildKind) {
        switch (kind) {
            case 'milestones':
                return { _count: { select: { tasks: true, deliverables: true } }, workstream: { select: { id: true, name: true } } };
            case 'deliverables':
                return { milestone: { select: { id: true, name: true } }, reviews: { orderBy: { decided_at: 'desc' }, take: 5, include: { reviewer: { select: MEMBER_SELECT } } } };
            case 'issues':
                return { task: { select: { id: true, number: true, title: true } } };
            case 'allocations':
                return { membership: { select: MEMBER_SELECT }, team: { select: { id: true, name: true } }, milestone: { select: { id: true, name: true } } };
            case 'status-updates':
                return { _count: { select: { comments: true } } };
            default:
                return undefined;
        }
    }

    async list(ctx: OrgContext, projectId: string, kind: ProjectChildKind, filters: Record<string, unknown> = {}) {
        await this.projects.assertAccess(ctx, projectId);
        const where: Record<string, unknown> = { project_id: projectId, ...compact(filters) };
        if (kind === 'workstreams') where.archived_at = null;
        // Drafts are visible to their author and to people who can publish (05 §39).
        if (kind === 'status-updates' && !ctx.can('projects.status_updates.publish')) where.published_at = { not: null };
        const rows = await this.delegate(kind).findMany({ where, orderBy: PROJECT_CHILDREN[kind].order, include: this.include(kind) });
        const ownerKey = PROJECT_CHILDREN[kind].owner;
        const people = await this.projects.membersById(rows.map((r) => r[ownerKey]));
        const today = startOfDay();
        return rows.map((r) => ({
            ...r,
            owner: people.get(r[ownerKey] ?? '') ?? null,
            ...(kind === 'milestones' && { overdue: [ProjectItemStatus.PLANNED, ProjectItemStatus.IN_PROGRESS, ProjectItemStatus.AT_RISK].includes(r.status) && !!r.planned_date && r.planned_date < today }),
        }));
    }

    async get(ctx: OrgContext, projectId: string, kind: ProjectChildKind, id: string) {
        await this.projects.assertAccess(ctx, projectId);
        const row = await this.delegate(kind).findFirst({ where: { id, project_id: projectId }, include: this.include(kind) });
        if (!row) throw new NotFoundException({ message: `${PROJECT_CHILDREN[kind].label} not found`, code: `${PROJECT_CHILDREN[kind].resource}_not_found` });
        return row;
    }

    async create(ctx: OrgContext, projectId: string, kind: ProjectChildKind, dto: Record<string, any>) {
        const cfg = PROJECT_CHILDREN[kind];
        const project = await this.projects.assertAccess(ctx, projectId, cfg.permission);
        await this.assertRefs(ctx, projectId, dto);
        const data: Record<string, any> = { ...withDates(dto, cfg.dates), project_id: projectId };
        await this.applyRules(ctx, kind, data, null, project);

        let row: Record<string, any>;
        if (kind === 'change-requests') {
            row = await this.createNumbered(projectId, data);
        } else {
            row = await this.delegate(kind).create({ data });
        }
        await this.audit.record(ctx, `${cfg.resource}.created`, { resource_type: cfg.resource, resource_id: row.id, branch_id: project.branch_id, metadata: { project_id: projectId, after: dto } });
        const title = row.name ?? row.title ?? row.summary?.slice(0, 80) ?? cfg.label;
        this.events.publish(ctx, {
            event_key: `projects.${cfg.resource.replace('project_', '')}.created`, module: ModuleKey.PROJECTS,
            entity_type: kind === 'milestones' ? RecordEntityType.PROJECT_MILESTONE : kind === 'change-requests' ? RecordEntityType.PROJECT_CHANGE_REQUEST : RecordEntityType.PROJECT,
            entity_id: kind === 'milestones' || kind === 'change-requests' ? row.id : projectId,
            payload: { project_id: projectId, project_name: project.name, id: row.id, title, assignee_membership_ids: row[cfg.owner] ? [row[cfg.owner]] : [] },
            activity: { summary: `added ${cfg.label} "${title}" to ${project.name}`, entity_label: title, project_id: projectId, company_id: project.company_id, customer_visible: kind !== 'status-updates' && !!row.customer_visible },
        });
        if (kind === 'status-updates' && row.published_at) await this.afterPublish(ctx, project, row);
        return row;
    }

    async update(ctx: OrgContext, projectId: string, kind: ProjectChildKind, id: string, dto: Record<string, any>) {
        const cfg = PROJECT_CHILDREN[kind];
        const project = await this.projects.assertAccess(ctx, projectId, cfg.permission);
        const before = await this.delegate(kind).findFirst({ where: { id, project_id: projectId } });
        if (!before) throw new NotFoundException({ message: `${cfg.label} not found`, code: `${cfg.resource}_not_found` });
        await this.assertRefs(ctx, projectId, dto);
        const data: Record<string, any> = compact(withDates(dto, cfg.dates));
        await this.applyRules(ctx, kind, data, before, project);
        const row = await this.delegate(kind).update({ where: { id }, data, include: this.include(kind) });
        const changed = Object.keys(data);
        await this.audit.record(ctx, `${cfg.resource}.updated`, {
            resource_type: cfg.resource, resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: dto },
        });
        const title = row.name ?? row.title ?? cfg.label;
        const statusChanged = 'status' in data && data.status !== before.status;
        this.events.publish(ctx, {
            event_key: statusChanged ? `projects.${cfg.resource.replace('project_', '')}.status_changed` : `projects.${cfg.resource.replace('project_', '')}.updated`,
            module: ModuleKey.PROJECTS,
            entity_type: kind === 'milestones' ? RecordEntityType.PROJECT_MILESTONE : RecordEntityType.PROJECT,
            entity_id: kind === 'milestones' ? id : projectId,
            payload: { project_id: projectId, project_name: project.name, id, title, from: before.status ?? null, to: row.status ?? null },
            changes: dto,
            ...(statusChanged && {
                activity: { summary: `moved ${cfg.label} "${title}" to ${String(row.status).toLowerCase().replace(/_/g, ' ')}`, entity_label: title, project_id: projectId, company_id: project.company_id, customer_visible: !!row.customer_visible },
            }),
        });
        if (kind === 'status-updates' && row.published_at && !before.published_at) await this.afterPublish(ctx, project, row);
        return row;
    }

    async remove(ctx: OrgContext, projectId: string, kind: ProjectChildKind, id: string) {
        const cfg = PROJECT_CHILDREN[kind];
        const project = await this.projects.assertAccess(ctx, projectId, cfg.permission);
        const before = await this.delegate(kind).findFirst({ where: { id, project_id: projectId } });
        if (!before) throw new NotFoundException({ message: `${cfg.label} not found`, code: `${cfg.resource}_not_found` });
        if (kind === 'workstreams') await this.delegate(kind).update({ where: { id }, data: { archived_at: new Date() } });
        else await this.delegate(kind).delete({ where: { id } });
        await this.audit.record(ctx, `${cfg.resource}.deleted`, { resource_type: cfg.resource, resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, before: { name: before.name ?? before.title ?? null } } });
        this.events.publish(ctx, { event_key: `projects.${cfg.resource.replace('project_', '')}.deleted`, module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId, payload: { project_id: projectId, id } });
        return { success: true };
    }

    // --- Special actions ---------------------------------------------------------------------------

    async completeMilestone(ctx: OrgContext, projectId: string, id: string) {
        const row = await this.update(ctx, projectId, 'milestones', id, { status: ProjectItemStatus.COMPLETED });
        if (row.is_billing_milestone) {
            this.events.publish(ctx, {
                event_key: 'projects.milestone.billing_completed', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT_MILESTONE, entity_id: id,
                payload: { project_id: projectId, milestone_id: id, name: row.name },
            });
        }
        return row;
    }

    /** Internal submit for review (customer sees it in the portal when customer_visible). */
    async submitDeliverable(ctx: OrgContext, projectId: string, id: string) {
        const project = await this.projects.assertAccess(ctx, projectId, 'projects.deliverables.manage');
        const d = await this.prisma.projectDeliverable.findFirst({ where: { id, project_id: projectId } });
        if (!d) throw new NotFoundException({ message: 'Deliverable not found', code: 'project_deliverable_not_found' });
        if (d.status === DeliverableStatus.ACCEPTED) throw new ConflictException({ message: 'Deliverable is already accepted', code: 'deliverable_already_accepted' });
        const row = await this.prisma.projectDeliverable.update({ where: { id }, data: { status: DeliverableStatus.SUBMITTED, submitted_at: new Date() } });
        await this.audit.record(ctx, 'project_deliverable.submitted', { resource_type: 'project_deliverable', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId } });
        this.events.publish(ctx, {
            event_key: 'projects.deliverable.submitted', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: { project_id: projectId, deliverable_id: id, name: row.name, customer_visible: row.customer_visible, company_id: project.company_id },
            activity: { summary: `submitted deliverable "${row.name}" for review`, entity_label: row.name, project_id: projectId, company_id: project.company_id, customer_visible: row.customer_visible },
        });
        return row;
    }

    /** Record a review decision. Accepting needs accept_on_behalf (the customer normally decides in the portal, 07 §7). */
    async reviewDeliverable(ctx: OrgContext, projectId: string, id: string, dto: ReviewDeliverableDto) {
        const project = await this.projects.assertAccess(ctx, projectId, 'projects.deliverables.manage');
        if (dto.decision === DeliverableStatus.ACCEPTED && !ctx.can('projects.deliverables.accept_on_behalf')) {
            throw new ForbiddenException({ message: 'Recording a customer acceptance needs projects.deliverables.accept_on_behalf', code: 'permission_denied' });
        }
        const d = await this.prisma.projectDeliverable.findFirst({ where: { id, project_id: projectId } });
        if (!d) throw new NotFoundException({ message: 'Deliverable not found', code: 'project_deliverable_not_found' });
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.projectDeliverableReview.create({
                data: { organization_id: ctx.organization_id, deliverable_id: id, decision: dto.decision, comment: dto.comment, reviewer_membership_id: ctx.membership_id },
            });
            return tx.projectDeliverable.update({
                where: { id },
                data: {
                    status: dto.decision,
                    ...(dto.decision === DeliverableStatus.ACCEPTED && {
                        accepted_at: new Date(),
                        acceptance_record: { on_behalf: true, recorded_by_membership_id: ctx.membership_id, contact_id: dto.on_behalf_of_contact_id ?? null, comment: dto.comment ?? null, at: new Date().toISOString() },
                    }),
                },
            });
        });
        await this.audit.record(ctx, `project_deliverable.${dto.decision.toLowerCase()}`, {
            resource_type: 'project_deliverable', resource_id: id, branch_id: project.branch_id,
            metadata: { project_id: projectId, decision: dto.decision, comment: dto.comment ?? null, on_behalf: dto.decision === DeliverableStatus.ACCEPTED, sensitive: dto.decision === DeliverableStatus.ACCEPTED },
        });
        this.events.publish(ctx, {
            event_key: `projects.deliverable.${dto.decision.toLowerCase()}`, module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId,
            payload: { project_id: projectId, deliverable_id: id, name: row.name, decision: dto.decision, owner_membership_id: row.owner_membership_id, assignee_membership_ids: row.owner_membership_id ? [row.owner_membership_id] : [] },
            activity: { summary: `${dto.decision === 'ACCEPTED' ? 'accepted' : dto.decision === 'REJECTED' ? 'rejected' : 'requested changes on'} deliverable "${row.name}"`, entity_label: row.name, project_id: projectId, company_id: project.company_id, customer_visible: row.customer_visible },
        });
        return row;
    }

    async publishStatusUpdate(ctx: OrgContext, projectId: string, id: string) {
        return this.update(ctx, projectId, 'status-updates', id, { publish: true });
    }

    async decideChangeRequest(ctx: OrgContext, projectId: string, id: string, dto: DecideChangeRequestDto) {
        const project = await this.projects.assertAccess(ctx, projectId, 'projects.change_requests.approve');
        const cr = await this.prisma.projectChangeRequest.findFirst({ where: { id, project_id: projectId } });
        if (!cr) throw new NotFoundException({ message: 'Change request not found', code: 'project_change_request_not_found' });
        if (cr.status === ProjectChangeRequestStatus.APPROVED || cr.status === ProjectChangeRequestStatus.REJECTED || cr.status === ProjectChangeRequestStatus.IMPLEMENTED) {
            throw new ConflictException({ message: 'This change request was already decided', code: 'change_request_already_decided' });
        }
        const approved = dto.decision === ProjectChangeRequestStatus.APPROVED;
        const row = await this.prisma.projectChangeRequest.update({
            where: { id },
            data: approved
                ? { status: ProjectChangeRequestStatus.APPROVED, approved_at: new Date(), approved_by_membership_id: ctx.membership_id }
                : { status: ProjectChangeRequestStatus.REJECTED, rejected_reason: dto.reason ?? null },
        });
        await this.audit.record(ctx, approved ? 'project_change_request.approved' : 'project_change_request.rejected', {
            resource_type: 'project_change_request', resource_id: id, branch_id: project.branch_id, metadata: { project_id: projectId, reason: dto.reason ?? null, sensitive: true },
        });
        this.events.publish(ctx, {
            event_key: approved ? 'projects.change_request.approved' : 'projects.change_request.rejected', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT_CHANGE_REQUEST, entity_id: id,
            payload: { project_id: projectId, number: row.number, title: row.title, cost_impact_amount: row.cost_impact_amount, timeline_impact_days: row.timeline_impact_days, assignee_membership_ids: row.requester_membership_id ? [row.requester_membership_id] : [] },
            activity: { summary: `${approved ? 'approved' : 'rejected'} change request CR-${row.number} "${row.title}"`, entity_label: row.title, project_id: projectId, company_id: project.company_id, customer_visible: row.customer_visible },
        });
        return row;
    }

    // --- Internals ----------------------------------------------------------------------------------

    /** Per-kind business rules applied to create and update payloads. */
    private async applyRules(ctx: OrgContext, kind: ProjectChildKind, data: Record<string, any>, before: Record<string, any> | null, project: { visibility: string }) {
        switch (kind) {
            case 'milestones':
                if (data.status === ProjectItemStatus.COMPLETED && before?.status !== ProjectItemStatus.COMPLETED) {
                    data.completed_at = new Date();
                    data.progress_percent = 100;
                    data.actual_date = data.actual_date ?? startOfDay();
                } else if (data.status && data.status !== ProjectItemStatus.COMPLETED && before?.status === ProjectItemStatus.COMPLETED) {
                    data.completed_at = null;
                }
                break;
            case 'risks': {
                const sev = riskSeverity(data.probability ?? before?.probability, data.impact ?? before?.impact);
                if (sev && (data.probability !== undefined || data.impact !== undefined)) data.severity = sev;
                if (data.status && ['RESOLVED', 'CLOSED', 'MITIGATED'].includes(data.status) && !before?.resolved_at) data.resolved_at = new Date();
                break;
            }
            case 'issues':
                if (data.status && ['RESOLVED', 'CLOSED'].includes(data.status) && !before?.resolved_at) data.resolved_at = new Date();
                if (data.status && ['OPEN', 'IN_PROGRESS'].includes(data.status)) data.resolved_at = null;
                break;
            case 'decisions':
                if (!before && !data.decision_maker_membership_id) data.decision_maker_membership_id = ctx.membership_id;
                if (data.decided_at === null) delete data.decided_at;
                break;
            case 'status-updates': {
                const publish = data.publish;
                delete data.publish;
                if (!before) data.author_membership_id = ctx.membership_id;
                if (data.customer_visible && project.visibility !== 'CUSTOMER_VISIBLE') {
                    throw new BadRequestException({ message: 'Make the project customer-visible before sharing updates with the customer', code: 'project_not_customer_visible' });
                }
                if (publish && !before?.published_at) {
                    data.published_at = new Date();
                    data.is_ai_generated = false;
                }
                break;
            }
            case 'change-requests':
                if (!before) data.requester_membership_id = ctx.membership_id;
                if (data.status === ProjectChangeRequestStatus.IMPLEMENTED && !before?.implemented_at) data.implemented_at = new Date();
                if (data.cost_impact_amount !== undefined && !ctx.can('projects.finance.read') && !ctx.can('projects.projects.manage_budgets')) {
                    throw new ForbiddenException({ message: 'Cost impact needs projects.projects.manage_budgets', code: 'permission_denied' });
                }
                break;
            case 'allocations':
                if (!before && !data.membership_id && !data.team_id) throw new BadRequestException({ message: 'Choose a person or a team', code: 'allocation_target_required' });
                break;
            default:
                break;
        }
    }

    /** A published status update moves the project's health / progress when given (05 §39). */
    private async afterPublish(ctx: OrgContext, project: { id: string; name: string; company_id: string | null }, row: Record<string, any>) {
        const data: Prisma.ProjectUpdateInput = {};
        if (row.health) data.health = row.health;
        if (row.progress_percent !== null && row.progress_percent !== undefined) data.progress_percent = row.progress_percent;
        if (Object.keys(data).length) await this.prisma.project.update({ where: { id: project.id }, data });
        await this.audit.record(ctx, 'project_status_update.published', { resource_type: 'project_status_update', resource_id: row.id, metadata: { project_id: project.id, health: row.health ?? null, customer_visible: row.customer_visible } });
        const members = await this.prisma.projectMember.findMany({ where: { project_id: project.id, is_active: true }, select: { membership_id: true } });
        this.events.publish(ctx, {
            event_key: 'projects.status_update.published', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: project.id,
            payload: { project_id: project.id, status_update_id: row.id, summary: row.summary, health: row.health ?? null, customer_visible: row.customer_visible, member_membership_ids: members.map((m) => m.membership_id).filter((id) => id !== ctx.membership_id) },
            activity: { summary: `posted a status update on ${project.name}`, entity_label: project.name, project_id: project.id, company_id: project.company_id, customer_visible: !!row.customer_visible },
        });
    }

    private async createNumbered(projectId: string, data: Record<string, any>) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const last = await tx.projectChangeRequest.aggregate({ where: { project_id: projectId }, _max: { number: true } });
                    return tx.projectChangeRequest.create({ data: { ...(data as Prisma.ProjectChangeRequestUncheckedCreateInput), number: (last._max.number ?? 0) + 1 } });
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') || attempt === 2) throw error;
            }
        }
        throw new ConflictException({ message: 'Could not number the change request, try again', code: 'change_request_number_conflict' });
    }

    /** Every referenced id must belong to this organization (and project-local refs to this project). */
    private async assertRefs(ctx: OrgContext, projectId: string, dto: Record<string, any>) {
        const memberKeys = ['owner_membership_id', 'decision_maker_membership_id', 'membership_id'];
        const memberIds = memberKeys.map((k) => dto[k]).filter(Boolean);
        const checks: Promise<boolean>[] = [];
        if (memberIds.length) checks.push(this.prisma.membership.count({ where: { id: { in: memberIds }, organization_id: ctx.organization_id } }).then((c) => c === new Set(memberIds).size));
        if (dto.milestone_id) checks.push(this.prisma.projectMilestone.count({ where: { id: dto.milestone_id, project_id: projectId } }).then(Boolean));
        if (dto.workstream_id) checks.push(this.prisma.projectWorkstream.count({ where: { id: dto.workstream_id, project_id: projectId } }).then(Boolean));
        if (dto.task_id) checks.push(this.prisma.task.count({ where: { id: dto.task_id, organization_id: ctx.organization_id } }).then(Boolean));
        if (dto.team_id) checks.push(this.prisma.team.count({ where: { id: dto.team_id, organization_id: ctx.organization_id } }).then(Boolean));
        if (dto.requester_contact_id) checks.push(this.prisma.crmContact.count({ where: { id: dto.requester_contact_id, organization_id: ctx.organization_id } }).then(Boolean));
        const ok = await Promise.all(checks);
        if (ok.includes(false)) throw new BadRequestException({ message: 'A referenced person, milestone, workstream, task or team was not found', code: 'reference_not_found' });
    }
}
