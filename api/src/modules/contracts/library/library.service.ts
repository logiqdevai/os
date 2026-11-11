import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractClauseStatus, ContractTemplateStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import {
    ClauseVersionDto, CreateApprovalRuleDto, CreateContractClauseDto, CreateContractTemplateDto, CreateContractTypeDto, LibraryQuery,
    TemplateVersionDto, UpdateApprovalRuleDto, UpdateContractClauseDto, UpdateContractTemplateDto, UpdateContractTypeDto,
} from './dto/library.dto';

const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

/** 04 §2, §8–12, §28 — contract types, template and clause library, approval rules. */
@Injectable()
export class ContractLibraryService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Types ---------------------------------------------------------------------------

    async listTypes(ctx: OrgContext, query: LibraryQuery) {
        const where: Prisma.ContractTypeWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.contractType.findMany({
                where, ...skipTake(query), orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
                include: { default_template: { select: { id: true, name: true } }, _count: { select: { contracts: true, templates: true } } },
            }),
            this.prisma.contractType.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async getType(ctx: OrgContext, id: string) {
        const row = await this.prisma.contractType.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { default_template: { select: { id: true, name: true } } } });
        if (!row) throw new NotFoundException({ message: 'Contract type not found', code: 'contract_type_not_found' });
        return row;
    }

    async createType(ctx: OrgContext, dto: CreateContractTypeDto) {
        if (dto.default_template_id) await this.getTemplate(ctx, dto.default_template_id);
        const row = await this.prisma.contractType.create({
            data: {
                ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug('contractType', ctx, dto.name),
                required_metadata: json(dto.required_metadata), approval_workflow: json(dto.approval_workflow), signature_requirements: json(dto.signature_requirements),
            },
        });
        await this.audit.record(ctx, 'contract_type.created', { resource_type: 'contract_type', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'contracts.type.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract_type', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updateType(ctx: OrgContext, id: string, dto: UpdateContractTypeDto) {
        const before = await this.getType(ctx, id);
        if (dto.default_template_id) await this.getTemplate(ctx, dto.default_template_id);
        const row = await this.prisma.contractType.update({
            where: { id },
            data: { ...dto, required_metadata: json(dto.required_metadata), approval_workflow: json(dto.approval_workflow), signature_requirements: json(dto.signature_requirements) },
        });
        await this.audit.record(ctx, 'contract_type.updated', { resource_type: 'contract_type', resource_id: id, metadata: { before: { name: before.name }, after: dto } });
        return row;
    }

    async archiveType(ctx: OrgContext, id: string, archived = true) {
        await this.getType(ctx, id);
        const row = await this.prisma.contractType.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'contract_type.archived' : 'contract_type.restored', { resource_type: 'contract_type', resource_id: id });
        return row;
    }

    // --- Templates -----------------------------------------------------------------------

    async listTemplates(ctx: OrgContext, query: LibraryQuery) {
        const where: Prisma.ContractTemplateWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status as ContractTemplateStatus }),
            ...(query.type_id && { type_id: query.type_id }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.contractTemplate.findMany({
                where, ...skipTake(query), orderBy: orderBy(query, ['name', 'created_at', 'updated_at'], 'updated_at'),
                include: {
                    type: { select: { id: true, name: true } },
                    current_version: { select: { id: true, version_number: true, published_at: true } },
                    _count: { select: { versions: true, contracts: true } },
                },
            }),
            this.prisma.contractTemplate.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async getTemplate(ctx: OrgContext, id: string) {
        const row = await this.prisma.contractTemplate.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                type: { select: { id: true, name: true } },
                current_version: true,
                versions: { orderBy: { version_number: 'desc' }, select: { id: true, version_number: true, change_summary: true, published_at: true, created_at: true, sections: true, variables: true, signature_blocks: true, required_fields: true, conditional_rules: true } },
            },
        });
        if (!row) throw new NotFoundException({ message: 'Template not found', code: 'contract_template_not_found' });
        return row;
    }

    async createTemplate(ctx: OrgContext, dto: CreateContractTemplateDto) {
        if (dto.type_id) await this.getType(ctx, dto.type_id);
        await this.assertClauseKeys(ctx, dto.sections.map((s) => s.clause_key));
        const slug = await this.uniqueSlug('contractTemplate', ctx, dto.name);
        const template = await this.prisma.$transaction(async (tx) => {
            const t = await tx.contractTemplate.create({
                data: {
                    organization_id: ctx.organization_id, name: dto.name, slug, description: dto.description, type_id: dto.type_id, language: dto.language ?? 'en',
                    owner_membership_id: ctx.membership_id, status: dto.publish ? ContractTemplateStatus.PUBLISHED : ContractTemplateStatus.DRAFT,
                    effective_date: dto.publish ? new Date() : null,
                },
            });
            const v = await tx.contractTemplateVersion.create({ data: this.versionData(t.id, 1, dto, ctx, !!dto.publish) });
            return tx.contractTemplate.update({ where: { id: t.id }, data: { current_version_id: v.id } });
        });
        await this.audit.record(ctx, 'contract_template.created', { resource_type: 'contract_template', resource_id: template.id, metadata: { after: { name: dto.name, sections: dto.sections.length, published: !!dto.publish } } });
        this.events.publish(ctx, { event_key: 'contracts.template.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract_template', entity_id: template.id, payload: { name: template.name, owner_membership_id: ctx.membership_id } });
        return this.getTemplate(ctx, template.id);
    }

    async updateTemplate(ctx: OrgContext, id: string, dto: UpdateContractTemplateDto) {
        const before = await this.getTemplate(ctx, id);
        if (dto.type_id) await this.getType(ctx, dto.type_id);
        await this.prisma.contractTemplate.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'contract_template.updated', { resource_type: 'contract_template', resource_id: id, metadata: { before: { name: before.name, type_id: before.type_id }, after: dto } });
        return this.getTemplate(ctx, id);
    }

    /** New immutable version (04 §8). Not current until published; existing contracts keep their template version. */
    async addTemplateVersion(ctx: OrgContext, id: string, dto: TemplateVersionDto) {
        const template = await this.getTemplate(ctx, id);
        await this.assertClauseKeys(ctx, dto.sections.map((s) => s.clause_key));
        const next = (template.versions[0]?.version_number ?? 0) + 1;
        const v = await this.prisma.contractTemplateVersion.create({ data: this.versionData(id, next, dto, ctx, false) });
        await this.audit.record(ctx, 'contract_template.version_created', { resource_type: 'contract_template', resource_id: id, metadata: { version_number: next, change_summary: dto.change_summary } });
        return v;
    }

    async publishTemplateVersion(ctx: OrgContext, id: string, versionId: string) {
        await this.getTemplate(ctx, id);
        const v = await this.prisma.contractTemplateVersion.findFirst({ where: { id: versionId, template_id: id } });
        if (!v) throw new NotFoundException({ message: 'Template version not found', code: 'contract_template_version_not_found' });
        await this.prisma.$transaction([
            this.prisma.contractTemplateVersion.update({ where: { id: versionId }, data: { published_at: v.published_at ?? new Date() } }),
            this.prisma.contractTemplate.update({ where: { id }, data: { current_version_id: versionId, status: ContractTemplateStatus.PUBLISHED, deprecated_at: null, effective_date: new Date() } }),
        ]);
        await this.audit.record(ctx, 'contract_template.published', { resource_type: 'contract_template', resource_id: id, metadata: { version_id: versionId, version_number: v.version_number } });
        this.events.publish(ctx, { event_key: 'contracts.template.published', module: ModuleKey.CONTRACTS, entity_kind: 'contract_template', entity_id: id, payload: { version_number: v.version_number } });
        return this.getTemplate(ctx, id);
    }

    async deprecateTemplate(ctx: OrgContext, id: string) {
        await this.getTemplate(ctx, id);
        await this.prisma.contractTemplate.update({ where: { id }, data: { status: ContractTemplateStatus.DEPRECATED, deprecated_at: new Date() } });
        await this.audit.record(ctx, 'contract_template.deprecated', { resource_type: 'contract_template', resource_id: id });
        return this.getTemplate(ctx, id);
    }

    private versionData(templateId: string, n: number, dto: TemplateVersionDto, ctx: OrgContext, published: boolean): Prisma.ContractTemplateVersionUncheckedCreateInput {
        const sections = dto.sections.map((s, i) => ({ ...s, sort_order: s.sort_order ?? i }));
        const keys = new Set<string>();
        for (const s of sections) {
            if (keys.has(s.key)) throw new BadRequestException({ message: `Duplicate section key "${s.key}"`, code: 'duplicate_section_key' });
            keys.add(s.key);
        }
        return {
            template_id: templateId, version_number: n, change_summary: dto.change_summary, sections: sections as unknown as Prisma.InputJsonValue,
            variables: json(dto.variables), conditional_rules: json(dto.conditional_rules), signature_blocks: json(dto.signature_blocks),
            required_fields: dto.required_fields ?? [], published_at: published ? new Date() : null, created_by_user_id: ctx.user_id,
        };
    }

    private async assertClauseKeys(ctx: OrgContext, keys: (string | undefined)[]) {
        const wanted = [...new Set(keys.filter(Boolean) as string[])];
        if (!wanted.length) return;
        const found = await this.prisma.contractClause.findMany({ where: { organization_id: ctx.organization_id, key: { in: wanted } }, select: { key: true } });
        const missing = wanted.filter((k) => !found.some((f) => f.key === k));
        if (missing.length) throw new BadRequestException({ message: `Unknown clause key(s): ${missing.join(', ')}`, code: 'clause_not_found' });
    }

    // --- Clauses ---------------------------------------------------------------------------

    async listClauses(ctx: OrgContext, query: LibraryQuery) {
        const where: Prisma.ContractClauseWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status as ContractClauseStatus }),
            ...(query.category && { category: query.category }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { key: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.contractClause.findMany({
                where, ...skipTake(query), orderBy: orderBy(query, ['name', 'key', 'category', 'updated_at'], 'name'),
                include: { current_version: { select: { id: true, version_number: true, text: true, effective_date: true } }, _count: { select: { versions: true } } },
            }),
            this.prisma.contractClause.count({ where }),
        ]);
        return paginate(items, total, { ...query, limit: query.limit });
    }

    async getClause(ctx: OrgContext, id: string) {
        const row = await this.prisma.contractClause.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { current_version: true, versions: { orderBy: { version_number: 'desc' } } },
        });
        if (!row) throw new NotFoundException({ message: 'Clause not found', code: 'contract_clause_not_found' });
        return row;
    }

    async createClause(ctx: OrgContext, dto: CreateContractClauseDto) {
        try {
            const clause = await this.prisma.$transaction(async (tx) => {
                const c = await tx.contractClause.create({
                    data: {
                        organization_id: ctx.organization_id, key: dto.key, name: dto.name, category: dto.category, description: dto.description,
                        status: dto.status ?? ContractClauseStatus.ACTIVE, usage_restrictions: json(dto.usage_restrictions), owner_membership_id: ctx.membership_id, effective_date: new Date(),
                    },
                });
                const v = await tx.contractClauseVersion.create({ data: { clause_id: c.id, version_number: 1, text: dto.text, change_summary: 'Initial version', effective_date: new Date(), created_by_user_id: ctx.user_id } });
                return tx.contractClause.update({ where: { id: c.id }, data: { current_version_id: v.id } });
            });
            await this.audit.record(ctx, 'contract_clause.created', { resource_type: 'contract_clause', resource_id: clause.id, metadata: { after: { key: dto.key, name: dto.name, category: dto.category } } });
            this.events.publish(ctx, { event_key: 'contracts.clause.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract_clause', entity_id: clause.id, payload: { key: clause.key } });
            return this.getClause(ctx, clause.id);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'A clause with this key already exists', code: 'clause_key_taken' });
            throw error;
        }
    }

    async updateClause(ctx: OrgContext, id: string, dto: UpdateContractClauseDto) {
        const before = await this.getClause(ctx, id);
        await this.prisma.contractClause.update({
            where: { id },
            data: { ...dto, usage_restrictions: json(dto.usage_restrictions), ...(dto.status === ContractClauseStatus.DEPRECATED ? { deprecated_at: new Date() } : dto.status ? { deprecated_at: null } : {}) },
        });
        await this.audit.record(ctx, 'contract_clause.updated', { resource_type: 'contract_clause', resource_id: id, metadata: { before: { name: before.name, status: before.status }, after: dto } });
        return this.getClause(ctx, id);
    }

    /** 04 §12 — new text = new version; contracts keep the exact clause version they embedded. */
    async addClauseVersion(ctx: OrgContext, id: string, dto: ClauseVersionDto) {
        const clause = await this.getClause(ctx, id);
        const next = (clause.versions[0]?.version_number ?? 0) + 1;
        await this.prisma.$transaction(async (tx) => {
            const v = await tx.contractClauseVersion.create({
                data: { clause_id: id, version_number: next, text: dto.text, change_summary: dto.change_summary, effective_date: dto.effective_date ? new Date(dto.effective_date) : new Date(), created_by_user_id: ctx.user_id },
            });
            await tx.contractClause.update({ where: { id }, data: { current_version_id: v.id } });
        });
        await this.audit.record(ctx, 'contract_clause.version_created', { resource_type: 'contract_clause', resource_id: id, metadata: { version_number: next, change_summary: dto.change_summary } });
        return this.getClause(ctx, id);
    }

    async clauseUsage(ctx: OrgContext, id: string) {
        const clause = await this.getClause(ctx, id);
        const sections = await this.prisma.contractSection.findMany({
            where: { clause_version: { clause_id: clause.id }, version: { contract: { organization_id: ctx.organization_id } } },
            select: {
                id: true, title: true, clause_version: { select: { version_number: true } },
                version: { select: { id: true, label: true, status: true, contract: { select: { id: true, number: true, title: true, status: true } } } },
            },
            take: 200,
        });
        return { clause_id: id, count: sections.length, sections };
    }

    // --- Approval rules ---------------------------------------------------------------------

    listRules(ctx: OrgContext) {
        return this.prisma.contractApprovalRule.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ priority: 'asc' }, { name: 'asc' }] });
    }

    async getRule(ctx: OrgContext, id: string) {
        const row = await this.prisma.contractApprovalRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Approval rule not found', code: 'contract_approval_rule_not_found' });
        return row;
    }

    async createRule(ctx: OrgContext, dto: CreateApprovalRuleDto) {
        await this.assertApprovers(ctx, dto.steps);
        const row = await this.prisma.contractApprovalRule.create({
            data: { organization_id: ctx.organization_id, name: dto.name, conditions: json(dto.conditions) ?? [], steps: json(dto.steps) ?? [], priority: dto.priority ?? 0, enabled: dto.enabled ?? true },
        });
        await this.audit.record(ctx, 'contract_approval_rule.created', { resource_type: 'contract_approval_rule', resource_id: row.id, metadata: { after: dto } });
        return row;
    }

    async updateRule(ctx: OrgContext, id: string, dto: UpdateApprovalRuleDto) {
        const before = await this.getRule(ctx, id);
        if (dto.steps) await this.assertApprovers(ctx, dto.steps);
        const row = await this.prisma.contractApprovalRule.update({ where: { id }, data: { ...dto, conditions: json(dto.conditions), steps: json(dto.steps) } });
        await this.audit.record(ctx, 'contract_approval_rule.updated', { resource_type: 'contract_approval_rule', resource_id: id, metadata: { before, after: dto } });
        return row;
    }

    async deleteRule(ctx: OrgContext, id: string) {
        await this.getRule(ctx, id);
        await this.prisma.contractApprovalRule.delete({ where: { id } });
        await this.audit.record(ctx, 'contract_approval_rule.deleted', { resource_type: 'contract_approval_rule', resource_id: id });
        return { success: true };
    }

    private async assertApprovers(ctx: OrgContext, steps: { approver: { membership_id?: string; team_id?: string } }[]) {
        for (const s of steps) {
            if (s.approver?.membership_id) {
                const m = await this.prisma.membership.findFirst({ where: { id: s.approver.membership_id, organization_id: ctx.organization_id } });
                if (!m) throw new BadRequestException({ message: 'Approver is not a member of this organization', code: 'approver_not_found' });
            } else if (s.approver?.team_id) {
                const t = await this.prisma.team.findFirst({ where: { id: s.approver.team_id, organization_id: ctx.organization_id } });
                if (!t) throw new BadRequestException({ message: 'Approver team not found', code: 'approver_not_found' });
            } else {
                throw new BadRequestException({ message: 'Each step needs an approver membership_id or team_id', code: 'approver_required' });
            }
        }
    }

    private async uniqueSlug(model: 'contractType' | 'contractTemplate', ctx: OrgContext, name: string) {
        const base = slugify(name) || 'item';
        let slug = base;
        const exists = (s: string) =>
            model === 'contractType'
                ? this.prisma.contractType.findFirst({ where: { organization_id: ctx.organization_id, slug: s }, select: { id: true } })
                : this.prisma.contractTemplate.findFirst({ where: { organization_id: ctx.organization_id, slug: s }, select: { id: true } });
        for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
        return slug;
    }
}
