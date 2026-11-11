import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { CreateApprovalRuleDto, CreateProposalTemplateDto, UpdateApprovalRuleDto, UpdateProposalTemplateDto } from './dto/proposal-template.dto';
import { ProposalTemplateQuery } from './dto/proposal-query.schema';
import { MEMBER_SELECT } from './proposals.service';

const CONTENT_KEYS = ['sections', 'defaults', 'variables', 'default_validity_days'] as const;

/** 03 "Reusable Templates" (versioned snapshots) and "Proposal Review" approval rules. */
@Injectable()
export class ProposalTemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Templates ----------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: ProposalTemplateQuery) {
        const where: Prisma.ProposalTemplateWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.work_type && { work_type: query.work_type }),
            ...(query.language && { language: query.language }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.proposalTemplate.findMany({ where, ...skipTake(query), orderBy: [{ is_default: 'desc' }, orderBy(query, ['name', 'updated_at', 'created_at'], 'name')], include: { _count: { select: { proposals: true } } } }),
            this.prisma.proposalTemplate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const t = await this.prisma.proposalTemplate.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { versions: { orderBy: { version_number: 'desc' }, take: 20, select: { id: true, version_number: true, change_summary: true, created_at: true, created_by_user_id: true } }, _count: { select: { proposals: true } } },
        });
        if (!t) throw new NotFoundException({ message: 'Template not found', code: 'proposal_template_not_found' });
        return t;
    }

    async create(ctx: OrgContext, dto: CreateProposalTemplateDto) {
        const t = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.proposalTemplate.updateMany({ where: { organization_id: ctx.organization_id, is_default: true }, data: { is_default: false } });
            const created = await tx.proposalTemplate.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name,
                    slug: await this.uniqueSlug(tx, ctx, dto.name),
                    description: dto.description ?? null,
                    work_type: dto.work_type ?? null,
                    language: dto.language ?? 'en',
                    sections: dto.sections as unknown as Prisma.InputJsonValue,
                    defaults: (dto.defaults ?? undefined) as Prisma.InputJsonValue | undefined,
                    variables: (dto.variables ?? undefined) as Prisma.InputJsonValue | undefined,
                    default_validity_days: dto.default_validity_days ?? 30,
                    is_default: dto.is_default ?? false,
                    created_by_user_id: ctx.user_id,
                },
            });
            await tx.proposalTemplateVersion.create({
                data: { template_id: created.id, version_number: 1, sections: created.sections as Prisma.InputJsonValue, defaults: created.defaults ?? undefined, variables: created.variables ?? undefined, default_validity_days: created.default_validity_days, change_summary: dto.change_summary ?? 'Created', created_by_user_id: ctx.user_id },
            });
            await this.audit.record(ctx, 'proposal_template.created', { resource_type: 'proposal_template', resource_id: created.id, metadata: { after: { name: dto.name, sections: dto.sections.length } } }, tx);
            return created;
        });
        this.events.publish(ctx, { event_key: 'proposals.template.created', module: ModuleKey.PROPOSALS, entity_kind: 'proposal_template', entity_id: t.id, payload: { name: t.name } });
        return t;
    }

    /** A save that changes content writes a new immutable ProposalTemplateVersion and bumps `version`. Existing proposals are never touched. */
    async update(ctx: OrgContext, id: string, dto: UpdateProposalTemplateDto) {
        const before = await this.findOne(ctx, id);
        const contentChanged = CONTENT_KEYS.some((k) => dto[k] !== undefined && JSON.stringify(dto[k]) !== JSON.stringify((before as Record<string, unknown>)[k]));
        const t = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.proposalTemplate.updateMany({ where: { organization_id: ctx.organization_id, is_default: true, id: { not: id } }, data: { is_default: false } });
            const updated = await tx.proposalTemplate.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined && { name: dto.name }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.work_type !== undefined && { work_type: dto.work_type }),
                    ...(dto.language !== undefined && { language: dto.language }),
                    ...(dto.sections !== undefined && { sections: dto.sections as unknown as Prisma.InputJsonValue }),
                    ...(dto.defaults !== undefined && { defaults: (dto.defaults ?? Prisma.JsonNull) as Prisma.InputJsonValue }),
                    ...(dto.variables !== undefined && { variables: dto.variables as Prisma.InputJsonValue }),
                    ...(dto.default_validity_days !== undefined && { default_validity_days: dto.default_validity_days }),
                    ...(dto.is_default !== undefined && { is_default: dto.is_default }),
                    ...(contentChanged && { version: { increment: 1 } }),
                },
            });
            if (contentChanged) {
                await tx.proposalTemplateVersion.create({
                    data: { template_id: id, version_number: updated.version, sections: updated.sections as Prisma.InputJsonValue, defaults: updated.defaults ?? undefined, variables: updated.variables ?? undefined, default_validity_days: updated.default_validity_days, change_summary: dto.change_summary ?? null, created_by_user_id: ctx.user_id },
                });
            }
            await this.audit.record(ctx, 'proposal_template.updated', { resource_type: 'proposal_template', resource_id: id, metadata: { version: updated.version, content_changed: contentChanged, fields: Object.keys(dto) } }, tx);
            return updated;
        });
        this.events.publish(ctx, { event_key: 'proposals.template.updated', module: ModuleKey.PROPOSALS, entity_kind: 'proposal_template', entity_id: id, payload: { name: t.name, version: t.version } });
        return t;
    }

    async duplicate(ctx: OrgContext, id: string) {
        const t = await this.findOne(ctx, id);
        return this.create(ctx, {
            name: `${t.name} (copy)`, description: t.description, work_type: t.work_type, language: t.language,
            sections: t.sections as unknown as CreateProposalTemplateDto['sections'], defaults: t.defaults as Record<string, unknown> | null,
            variables: (t.variables ?? undefined) as string[] | undefined, default_validity_days: t.default_validity_days, change_summary: `Duplicated from ${t.name}`,
        });
    }

    async archive(ctx: OrgContext, id: string, restore = false) {
        const t = await this.findOne(ctx, id);
        const updated = await this.prisma.proposalTemplate.update({ where: { id }, data: { archived_at: restore ? null : new Date(), ...(!restore && { is_default: false }) } });
        await this.audit.record(ctx, restore ? 'proposal_template.restored' : 'proposal_template.archived', { resource_type: 'proposal_template', resource_id: id, metadata: { name: t.name } });
        return updated;
    }

    private async uniqueSlug(tx: Prisma.TransactionClient, ctx: OrgContext, name: string) {
        const base = slugify(name) || 'template';
        let slug = base;
        for (let i = 2; await tx.proposalTemplate.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }

    // --- Approval rules ---------------------------------------------------------------------------------

    async rules(ctx: OrgContext) {
        const rules = await this.prisma.proposalApprovalRule.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ priority: 'asc' }, { created_at: 'asc' }] });
        const ids = [...new Set(rules.flatMap((r) => ((r.steps ?? []) as { approver_membership_id?: string }[]).map((s) => s.approver_membership_id).filter(Boolean)))] as string[];
        const members = await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: MEMBER_SELECT });
        return rules.map((r) => ({ ...r, approvers: members.filter((m) => ((r.steps ?? []) as { approver_membership_id?: string }[]).some((s) => s.approver_membership_id === m.id)) }));
    }

    async createRule(ctx: OrgContext, dto: CreateApprovalRuleDto) {
        await this.assertApprovers(ctx, dto.steps?.map((s) => s.approver_membership_id) ?? []);
        const rule = await this.prisma.proposalApprovalRule.create({
            data: { organization_id: ctx.organization_id, name: dto.name, conditions: dto.conditions as unknown as Prisma.InputJsonValue, steps: dto.steps as unknown as Prisma.InputJsonValue, priority: dto.priority ?? 100, enabled: dto.enabled ?? true },
        });
        await this.audit.record(ctx, 'proposal_approval_rule.created', { resource_type: 'proposal_approval_rule', resource_id: rule.id, metadata: { after: dto } });
        return rule;
    }

    async updateRule(ctx: OrgContext, id: string, dto: UpdateApprovalRuleDto) {
        const before = await this.prisma.proposalApprovalRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'proposal_approval_rule_not_found' });
        if (dto.steps) await this.assertApprovers(ctx, dto.steps.map((s) => s.approver_membership_id));
        const rule = await this.prisma.proposalApprovalRule.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.conditions && { conditions: dto.conditions as unknown as Prisma.InputJsonValue }),
                ...(dto.steps && { steps: dto.steps as unknown as Prisma.InputJsonValue }),
                ...(dto.priority !== undefined && { priority: dto.priority }),
                ...(dto.enabled !== undefined && { enabled: dto.enabled }),
            },
        });
        await this.audit.record(ctx, 'proposal_approval_rule.updated', { resource_type: 'proposal_approval_rule', resource_id: id, metadata: { before: { name: before.name, conditions: before.conditions, steps: before.steps, enabled: before.enabled }, after: dto } });
        return rule;
    }

    async deleteRule(ctx: OrgContext, id: string) {
        const before = await this.prisma.proposalApprovalRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Rule not found', code: 'proposal_approval_rule_not_found' });
        await this.prisma.proposalApprovalRule.delete({ where: { id } });
        await this.audit.record(ctx, 'proposal_approval_rule.deleted', { resource_type: 'proposal_approval_rule', resource_id: id, metadata: { before: { name: before.name } } });
        return { success: true };
    }

    private async assertApprovers(ctx: OrgContext, ids: string[]) {
        const unique = [...new Set(ids)];
        const found = await this.prisma.membership.count({ where: { id: { in: unique }, organization_id: ctx.organization_id } });
        if (found !== unique.length) throw new ConflictException({ message: 'An approver is not a member of this organization', code: 'approver_not_found' });
    }
}
