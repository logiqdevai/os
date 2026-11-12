import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AutomationApprovalPolicy, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ApprovalPolicyQuery, CreateApprovalPolicyInput, UpdateApprovalPolicyInput } from './dto/approval-policy.dto';

const PERSON = { select: { id: true, user: { select: { id: true, display_name: true, first_name: true, last_name: true, email: true, profile_photo_url: true } } } } as const;

/**
 * 20 §4, §6 — reusable approval policies ("any finance lead, escalate to the CFO after 24 h, skip people on leave").
 * Workflow approval steps reference one with `policy_id`; the engine resolves the approvers with `resolveApprovers`
 * when the step is reached. First decision wins.
 */
@Injectable()
export class ApprovalPoliciesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, query: ApprovalPolicyQuery) {
        const where: Prisma.AutomationApprovalPolicyWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: query.archived ? { not: null } : null,
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' as const } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.automationApprovalPolicy.findMany({ where, ...skipTake(query), orderBy: { name: 'asc' }, include: { _count: { select: { approvals: true } } } }),
            this.prisma.automationApprovalPolicy.count({ where }),
        ]);
        return paginate(await this.present(ctx, items), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const policy = await this.prisma.automationApprovalPolicy.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { _count: { select: { approvals: true } } } });
        if (!policy) throw new NotFoundException({ message: 'Approval policy not found', code: 'approval_policy_not_found' });
        const [presented] = await this.present(ctx, [policy]);
        const usedBy = await this.prisma.automationRule.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, actions: { array_contains: [{ inputs: { policy_id: id } }] } },
            select: { id: true, name: true, status: true },
            take: 50,
        }).catch(() => []);
        return { ...presented, used_by_rules: usedBy };
    }

    async create(ctx: OrgContext, dto: CreateApprovalPolicyInput) {
        await this.validate(ctx, dto);
        try {
            const policy = await this.prisma.automationApprovalPolicy.create({
                data: { ...dto, description: dto.description ?? null, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id ?? null },
            });
            await this.audit.record(ctx, 'automation.approval_policy.created', { resource_type: 'automation_approval_policy', resource_id: policy.id, metadata: { after: dto } });
            this.emit(ctx, 'automation.approval_policy.created', policy);
            return this.findOne(ctx, policy.id);
        } catch (error) {
            throw this.uniqueName(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateApprovalPolicyInput) {
        const before = await this.findOne(ctx, id);
        await this.validate(ctx, dto);
        try {
            const policy = await this.prisma.automationApprovalPolicy.update({ where: { id }, data: dto });
            await this.audit.record(ctx, 'automation.approval_policy.updated', { resource_type: 'automation_approval_policy', resource_id: id, metadata: { before: { name: before.name, approver_membership_ids: before.approver_membership_ids }, after: dto } });
            this.emit(ctx, 'automation.approval_policy.updated', policy);
            return this.findOne(ctx, id);
        } catch (error) {
            throw this.uniqueName(error);
        }
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const policy = await this.prisma.automationApprovalPolicy.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'automation.approval_policy.archived' : 'automation.approval_policy.restored', { resource_type: 'automation_approval_policy', resource_id: id });
        this.emit(ctx, archived ? 'automation.approval_policy.archived' : 'automation.approval_policy.restored', policy);
        return this.findOne(ctx, id);
    }

    /**
     * Approvers of a policy at this moment: listed members ∪ active team members ∪ holders of the listed roles,
     * only ACTIVE members of the organization; the rule owner only when allowed; people on approved leave today are
     * skipped when `delegate_when_out_of_office` (unless that leaves nobody). Order: listed members first.
     */
    async resolveApprovers(organizationId: string, policy: AutomationApprovalPolicy, ruleOwnerId: string | null): Promise<string[]> {
        const [teamMembers, roleHolders] = await Promise.all([
            policy.approver_team_ids.length
                ? this.prisma.teamMembership.findMany({ where: { team_id: { in: policy.approver_team_ids }, ended_at: null, team: { organization_id: organizationId } }, select: { membership_id: true } })
                : [],
            policy.approver_role_ids.length
                ? this.prisma.roleAssignment.findMany({ where: { role_id: { in: policy.approver_role_ids }, revoked_at: null, membership_id: { not: null } }, select: { membership_id: true } })
                : [],
        ]);
        const ordered = [...new Set([...policy.approver_membership_ids, ...teamMembers.map((t) => t.membership_id), ...roleHolders.map((r) => r.membership_id as string)])];
        const active = await this.prisma.membership.findMany({ where: { id: { in: ordered }, organization_id: organizationId, status: 'ACTIVE' }, select: { id: true } });
        const activeSet = new Set(active.map((m) => m.id));
        let approvers = ordered.filter((id) => activeSet.has(id) && (policy.allow_rule_owner || id !== ruleOwnerId));
        if (policy.delegate_when_out_of_office && approvers.length > 1) {
            const today = new Date(new Date().toISOString().slice(0, 10));
            const away = await this.prisma.leaveRequest.findMany({
                where: { status: 'APPROVED', start_date: { lte: today }, end_date: { gte: today }, employee: { membership_id: { in: approvers } } },
                select: { employee: { select: { membership_id: true } } },
            });
            const awaySet = new Set(away.map((a) => a.employee.membership_id));
            const present = approvers.filter((id) => !awaySet.has(id));
            if (present.length) approvers = present;
        }
        return approvers;
    }

    /** Policy lookup for the engine (organization-checked, not archived). */
    findForEngine(organizationId: string, id: string) {
        return this.prisma.automationApprovalPolicy.findFirst({ where: { id, organization_id: organizationId, archived_at: null } });
    }

    private async validate(ctx: OrgContext, dto: UpdateApprovalPolicyInput) {
        const memberIds = [...(dto.approver_membership_ids ?? []), ...(dto.escalate_to_membership_id ? [dto.escalate_to_membership_id] : [])];
        const [members, teams, roles] = await Promise.all([
            memberIds.length ? this.prisma.membership.count({ where: { id: { in: memberIds }, organization_id: ctx.organization_id } }) : 0,
            dto.approver_team_ids?.length ? this.prisma.team.count({ where: { id: { in: dto.approver_team_ids }, organization_id: ctx.organization_id } }) : 0,
            dto.approver_role_ids?.length ? this.prisma.role.count({ where: { id: { in: dto.approver_role_ids }, OR: [{ organization_id: ctx.organization_id }, { organization_id: null }] } }) : 0,
        ]);
        if (members !== new Set(memberIds).size) throw new BadRequestException({ message: 'An approver is not a member of this organization', code: 'approver_not_found' });
        if ((dto.approver_team_ids?.length ?? 0) !== teams) throw new BadRequestException({ message: 'A team is not part of this organization', code: 'team_not_found' });
        if ((dto.approver_role_ids?.length ?? 0) !== roles) throw new BadRequestException({ message: 'A role is not available in this organization', code: 'role_not_found' });
        const total = (dto.approver_membership_ids?.length ?? 0) + (dto.approver_team_ids?.length ?? 0) + (dto.approver_role_ids?.length ?? 0);
        if (dto.approver_membership_ids !== undefined && dto.approver_team_ids !== undefined && dto.approver_role_ids !== undefined && total === 0) {
            throw new BadRequestException({ message: 'Add at least one approver, team or role', code: 'approvers_required' });
        }
        if (dto.escalate_after_hours && !dto.escalate_to_membership_id) throw new BadRequestException({ message: 'Choose who the request escalates to', code: 'escalation_target_required' });
    }

    private async present<T extends AutomationApprovalPolicy & { _count: { approvals: number } }>(ctx: OrgContext, items: T[]) {
        const memberIds = [...new Set(items.flatMap((p) => [...p.approver_membership_ids, ...(p.escalate_to_membership_id ? [p.escalate_to_membership_id] : [])]))];
        const teamIds = [...new Set(items.flatMap((p) => p.approver_team_ids))];
        const roleIds = [...new Set(items.flatMap((p) => p.approver_role_ids))];
        const [members, teams, roles] = await Promise.all([
            memberIds.length ? this.prisma.membership.findMany({ where: { id: { in: memberIds }, organization_id: ctx.organization_id }, ...PERSON }) : [],
            teamIds.length ? this.prisma.team.findMany({ where: { id: { in: teamIds }, organization_id: ctx.organization_id }, select: { id: true, name: true } }) : [],
            roleIds.length ? this.prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } }) : [],
        ]);
        const m = new Map(members.map((x) => [x.id, x] as const));
        const t = new Map(teams.map((x) => [x.id, x] as const));
        const r = new Map(roles.map((x) => [x.id, x] as const));
        return items.map(({ _count, ...p }) => ({
            ...p,
            approval_count: _count.approvals,
            approvers: p.approver_membership_ids.map((id) => m.get(id)).filter(Boolean),
            teams: p.approver_team_ids.map((id) => t.get(id)).filter(Boolean),
            roles: p.approver_role_ids.map((id) => r.get(id)).filter(Boolean),
            escalate_to: p.escalate_to_membership_id ? m.get(p.escalate_to_membership_id) ?? null : null,
        }));
    }

    private uniqueName(error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return new ConflictException({ message: 'A policy with this name already exists', code: 'approval_policy_name_taken' });
        return error;
    }

    private emit(ctx: OrgContext, key: string, policy: AutomationApprovalPolicy) {
        this.events.publish(ctx, { event_key: key, module: ModuleKey.AUTOMATION, entity_kind: 'automation_approval_policy', entity_id: policy.id, payload: { name: policy.name } });
    }
}
