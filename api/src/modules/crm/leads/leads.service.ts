import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { COMPANY_REF_SELECT, CONTACT_REF_SELECT, CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { leadScopeWhere, ownerFilter, pick, redactLead } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CsvExport, memberLabel, toCsv } from '../common/csv.utils';
import { CrmCompaniesService } from '../companies/companies.service';
import { CrmContactsService } from '../contacts/contacts.service';
import { CrmPipelinesService } from '../pipelines/pipelines.service';
import { CrmCustomFieldValuesService } from '../custom-fields/custom-field-values.service';
import { CrmLeadRulesService } from '../rules/lead-rules.service';
import { ConvertLeadDto, CreateLeadDto, LeadQuery, LeadStatusDto, UpdateLeadDto } from './dto/lead.dto';

const READ = 'crm.leads.read';

const LIST_INCLUDE = {
    status: { select: { id: true, name: true, color: true, is_converted: true, is_lost: true } },
    lead_source: { select: { id: true, name: true } },
    owner: { select: MEMBER_SELECT },
    company: { select: COMPANY_REF_SELECT },
    contact: { select: CONTACT_REF_SELECT },
} satisfies Prisma.CrmLeadInclude;

const splitName = (full?: string | null) => {
    const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
    return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') || undefined };
};

/** 02 §4–7 — leads, statuses, qualification and conversion to company / contact / deal. */
@Injectable()
export class CrmLeadsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
        private readonly defaults: CrmDefaultsService,
        private readonly companies: CrmCompaniesService,
        private readonly contacts: CrmContactsService,
        private readonly pipelines: CrmPipelinesService,
        private readonly cf: CrmCustomFieldValuesService,
        private readonly leadRules: CrmLeadRulesService,
    ) { }

    private where(ctx: OrgContext, query: LeadQuery, ids?: string[]): Prisma.CrmLeadWhereInput {
        const state: Prisma.CrmLeadWhereInput =
            query.state === 'converted' ? { converted_at: { not: null } }
                : query.state === 'lost' ? { status: { is_lost: true } }
                    : query.state === 'all' ? {}
                        : { converted_at: null, OR: [{ status_id: null }, { status: { is_lost: false } }] };
        return {
            organization_id: ctx.organization_id,
            merged_into_id: null,
            AND: [
                leadScopeWhere(ctx, READ),
                state,
                query.search
                    ? {
                        OR: [
                            { name: { contains: query.search, mode: 'insensitive' } },
                            { company_name: { contains: query.search, mode: 'insensitive' } },
                            { contact_name: { contains: query.search, mode: 'insensitive' } },
                            { email: { contains: query.search, mode: 'insensitive' } },
                        ],
                    }
                    : {},
            ],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status_id && { status_id: query.status_id }),
            ...(query.lead_source_id && { lead_source_id: query.lead_source_id }),
            ...(query.branch_id && { branch_id: query.branch_id }),
            ...ownerFilter(ctx, query.owner),
            ...(ids && { id: { in: ids } }),
        };
    }

    async findAll(ctx: OrgContext, query: LeadQuery) {
        await this.defaults.ensure(ctx.organization_id);
        const tagged = await this.cf.restrictIds(ctx.organization_id, RecordEntityType.CRM_LEAD, query, await this.refs.idsWithTag(RecordEntityType.CRM_LEAD, query.tag_id));
        const where = this.where(ctx, query, tagged);
        const [items, total] = await Promise.all([
            this.prisma.crmLead.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['name', 'created_at', 'lead_score', 'manual_score', 'next_follow_up_at', 'last_activity_at'], 'created_at'), include: LIST_INCLUDE }),
            this.prisma.crmLead.count({ where }),
        ]);
        const withTags = await this.refs.withTags(RecordEntityType.CRM_LEAD, items);
        return paginate(withTags.map((l) => redactLead(ctx, l)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const lead = await this.prisma.crmLead.findFirst({
            where: { id, organization_id: ctx.organization_id, ...leadScopeWhere(ctx, READ) },
            include: {
                ...LIST_INCLUDE,
                branch: { select: { id: true, name: true } },
                loss_reason: { select: { id: true, name: true } },
                converted_company: { select: { id: true, name: true } },
                converted_contact: { select: { id: true, first_name: true, last_name: true } },
                converted_deal: { select: { id: true, name: true } },
            },
        });
        if (!lead) throw new NotFoundException({ message: 'Lead not found', code: 'lead_not_found' });
        const [tags, custom] = await Promise.all([this.refs.tagsFor(RecordEntityType.CRM_LEAD, [id]), this.cf.valuesFor(ctx.organization_id, RecordEntityType.CRM_LEAD, [id])]);
        return redactLead(ctx, { ...lead, tags: tags.get(id) ?? [], custom_fields: custom.get(id) ?? {} });
    }

    async findDuplicates(ctx: OrgContext, input: { email?: string; exclude_id?: string }) {
        if (!input.email) return [];
        return this.prisma.crmLead.findMany({
            where: { organization_id: ctx.organization_id, merged_into_id: null, email: { equals: input.email.trim(), mode: 'insensitive' }, ...(input.exclude_id && { id: { not: input.exclude_id } }) },
            select: { id: true, name: true, email: true, converted_at: true, archived_at: true },
            take: 5,
        });
    }

    async create(ctx: OrgContext, dto: CreateLeadDto) {
        await this.defaults.ensure(ctx.organization_id);
        const { allow_duplicate, custom_fields, ...data } = dto;
        await this.refs.assert(ctx, { membership: data.owner_membership_id, company: data.company_id, contact: data.contact_id, lead_status: data.status_id, lead_source: data.lead_source_id, branch: data.branch_id });
        this.refs.assertCanAssign(ctx, 'crm.leads.assign', !!data.owner_membership_id && data.owner_membership_id !== ctx.membership_id);
        if (!allow_duplicate) {
            const duplicates = await this.findDuplicates(ctx, data);
            if (duplicates.length) throw new ConflictException({ message: 'A lead with this email already exists', code: 'possible_duplicates', duplicates });
        }
        const customValues = await this.cf.prepare(ctx, RecordEntityType.CRM_LEAD, custom_fields, { creating: true });
        if (!ctx.can(CRM_FINANCIALS)) delete data.estimated_value;
        const status_id = data.status_id ?? (await this.prisma.crmLeadStatus.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null }, select: { id: true } }))?.id;
        const lead = await this.prisma.$transaction(async (tx) => {
            const l = await tx.crmLead.create({
                data: {
                    ...data,
                    email: data.email?.toLowerCase(),
                    status_id,
                    currency: data.currency?.toUpperCase() ?? (data.estimated_value !== undefined ? await this.refs.orgCurrency(ctx) : undefined),
                    qualification: data.qualification as Prisma.InputJsonValue,
                    next_follow_up_at: data.next_follow_up_at ? new Date(data.next_follow_up_at) : undefined,
                    owner_membership_id: data.owner_membership_id ?? ctx.membership_id,
                    organization_id: ctx.organization_id,
                    created_by_user_id: ctx.user_id,
                },
            });
            await this.cf.write(tx, RecordEntityType.CRM_LEAD, l.id, customValues);
            // 02 §5–6: assignment rules pick the owner when none was chosen; scoring rules set lead_score.
            const applied = await this.leadRules.applyOnCreate(tx, ctx, l.id, { assign: !data.owner_membership_id, fallbackOwner: ctx.membership_id });
            await this.audit.record(ctx, 'crm.lead.created', { resource_type: 'crm_lead', resource_id: l.id, branch_id: l.branch_id, metadata: { after: { name: l.name, email: l.email, owner_membership_id: applied.lead.owner_membership_id, assignment_rule: applied.rule?.name, lead_score: applied.score } } }, tx);
            return applied.lead;
        });
        this.events.publish(ctx, {
            event_key: 'crm.lead.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: lead.id,
            payload: { name: lead.name, lead_source_id: lead.lead_source_id, owner_membership_id: lead.owner_membership_id, assignee_membership_ids: lead.owner_membership_id ? [lead.owner_membership_id] : [] },
            activity: { summary: `created lead ${lead.name}`, entity_label: lead.name, branch_id: lead.branch_id },
        });
        return redactLead(ctx, lead);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateLeadDto) {
        const before = await this.getForWrite(ctx, id, 'crm.leads.update');
        const { allow_duplicate: _a, custom_fields, ...data } = dto;
        await this.refs.assert(ctx, { membership: data.owner_membership_id, company: data.company_id, contact: data.contact_id, lead_status: data.status_id, lead_source: data.lead_source_id, branch: data.branch_id });
        this.refs.assertCanAssign(ctx, 'crm.leads.assign', data.owner_membership_id !== undefined && data.owner_membership_id !== before.owner_membership_id);
        if (data.status_id && data.status_id !== before.status_id) {
            const status = await this.prisma.crmLeadStatus.findUnique({ where: { id: data.status_id } });
            if (status?.is_converted) throw new BadRequestException({ message: 'Use Convert to mark a lead as converted', code: 'use_convert' });
            if (status?.is_lost) throw new BadRequestException({ message: 'Use the status action with a lost reason', code: 'lost_reason_required' });
        }
        const customValues = await this.cf.prepare(ctx, RecordEntityType.CRM_LEAD, custom_fields, { creating: false });
        if (!ctx.can(CRM_FINANCIALS)) delete data.estimated_value;
        const lead = await this.prisma.$transaction(async (tx) => {
            const l = await tx.crmLead.update({
                where: { id },
                data: {
                    ...data,
                    ...(data.email && { email: data.email.toLowerCase() }),
                    ...(data.currency && { currency: data.currency.toUpperCase() }),
                    qualification: data.qualification as Prisma.InputJsonValue | undefined,
                    ...(data.next_follow_up_at !== undefined && { next_follow_up_at: data.next_follow_up_at ? new Date(data.next_follow_up_at) : null }),
                },
            });
            await this.cf.write(tx, RecordEntityType.CRM_LEAD, id, customValues);
            await this.leadRules.rescore(tx, ctx.organization_id, id);
            await this.audit.record(ctx, 'crm.lead.updated', { resource_type: 'crm_lead', resource_id: id, branch_id: l.branch_id, metadata: { before: pick(before, Object.keys(data)), after: { ...data, ...(custom_fields && { custom_fields }) } } }, tx);
            return l;
        });
        this.events.publish(ctx, { event_key: 'crm.lead.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: id, payload: { name: lead.name, owner_membership_id: lead.owner_membership_id }, changes: data as Record<string, unknown> });
        if (data.owner_membership_id && data.owner_membership_id !== before.owner_membership_id) this.publishAssigned(ctx, lead);
        return redactLead(ctx, lead);
    }

    async setStatus(ctx: OrgContext, id: string, dto: LeadStatusDto) {
        const before = await this.getForWrite(ctx, id, 'crm.leads.update');
        const status = await this.prisma.crmLeadStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id } });
        if (!status) throw new NotFoundException({ message: 'Lead status not found', code: 'reference_not_found' });
        if (status.is_converted) throw new BadRequestException({ message: 'Use Convert to mark a lead as converted', code: 'use_convert' });
        if (status.is_lost) {
            if (!dto.lost_reason_id) throw new BadRequestException({ message: 'Pick a reason for losing the lead', code: 'lost_reason_required' });
            await this.refs.assert(ctx, { loss_reason: dto.lost_reason_id });
        }
        const lead = await this.prisma.crmLead.update({
            where: { id },
            data: { status_id: status.id, ...(status.is_lost ? { lost_reason_id: dto.lost_reason_id, lost_reason: dto.lost_reason ?? null } : { lost_reason_id: null, lost_reason: null }) },
        });
        await this.audit.record(ctx, status.is_lost ? 'crm.lead.lost' : 'crm.lead.status_changed', { resource_type: 'crm_lead', resource_id: id, branch_id: lead.branch_id, metadata: { before: { status_id: before.status_id }, after: { status_id: status.id, lost_reason_id: dto.lost_reason_id } } });
        this.events.publish(ctx, {
            event_key: status.is_lost ? 'crm.lead.lost' : 'crm.lead.status_changed', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: id,
            payload: { name: lead.name, status_id: status.id, status: status.name, owner_membership_id: lead.owner_membership_id },
            activity: { summary: `set lead ${lead.name} to ${status.name}`, entity_label: lead.name, branch_id: lead.branch_id },
        });
        return this.findOne(ctx, id);
    }

    async assign(ctx: OrgContext, id: string, owner_membership_id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.leads.assign');
        await this.refs.assert(ctx, { membership: owner_membership_id });
        const lead = await this.prisma.crmLead.update({ where: { id }, data: { owner_membership_id } });
        await this.audit.record(ctx, 'crm.lead.assigned', { resource_type: 'crm_lead', resource_id: id, branch_id: lead.branch_id, metadata: { before: { owner_membership_id: before.owner_membership_id }, after: { owner_membership_id } } });
        this.publishAssigned(ctx, lead);
        return redactLead(ctx, lead);
    }

    private publishAssigned(ctx: OrgContext, lead: { id: string; name: string; owner_membership_id: string | null; branch_id: string | null }) {
        this.events.publish(ctx, {
            event_key: 'crm.lead.assigned', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: lead.id,
            payload: { name: lead.name, owner_membership_id: lead.owner_membership_id, assignee_membership_ids: lead.owner_membership_id ? [lead.owner_membership_id] : [] },
            activity: { summary: `assigned lead ${lead.name}`, entity_label: lead.name, branch_id: lead.branch_id },
        });
    }

    /** Duplicate candidates and defaults for the conversion wizard (02 §7). */
    async convertPreview(ctx: OrgContext, id: string) {
        const lead = await this.findOne(ctx, id);
        if (lead.converted_at) throw new ConflictException({ message: 'This lead was already converted', code: 'lead_converted' });
        const contactName = splitName(lead.contact_name);
        const [companies, contacts, pipeline] = await Promise.all([
            lead.company ? Promise.resolve([{ ...lead.company, match: 'linked' }]) : this.companies.findDuplicates(ctx, { name: lead.company_name ?? undefined, website: lead.website ?? undefined, email: lead.email ?? undefined }),
            lead.contact ? Promise.resolve([{ ...lead.contact, match: 'linked' }]) : this.contacts.findDuplicates(ctx, { email: lead.email ?? undefined, ...contactName }),
            ctx.can('crm.deals.create') ? this.pipelines.resolve(ctx) : null,
        ]);
        return {
            lead,
            company_matches: companies,
            contact_matches: contacts,
            defaults: {
                company: { name: lead.company_name ?? lead.company?.name ?? '', website: lead.website, industry: lead.industry, company_size: lead.estimated_company_size },
                contact: { ...contactName, email: lead.email, phone: lead.phone },
                deal: {
                    name: lead.name,
                    value: lead.estimated_value,
                    currency: lead.currency ?? pipeline?.currency,
                    pipeline_id: pipeline?.id,
                    stage_id: pipeline?.stages.find((s) => !s.is_won && !s.is_lost)?.id,
                    owner_membership_id: lead.owner_membership_id,
                },
            },
            allowed: { company: ctx.can('crm.companies.create'), contact: ctx.can('crm.contacts.create'), deal: ctx.can('crm.deals.create'), financials: ctx.can(CRM_FINANCIALS) },
        };
    }

    /**
     * Convert a lead (02 §7): link or create the company and contact, optionally create a deal, keep history
     * (lead activities and notes are re-linked) and mark the lead converted. One transaction.
     */
    async convert(ctx: OrgContext, id: string, dto: ConvertLeadDto) {
        const lead = await this.getForWrite(ctx, id, 'crm.leads.convert');
        if (lead.converted_at) throw new ConflictException({ message: 'This lead was already converted', code: 'lead_converted' });
        const need = (key: string, when: unknown) => {
            if (when && !ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
        };
        need('crm.companies.create', dto.company?.new);
        need('crm.contacts.create', dto.contact?.new);
        need('crm.deals.create', dto.deal);
        await this.refs.assert(ctx, {
            company: dto.company?.existing_id, contact: dto.contact?.existing_id,
            membership: [dto.company?.new?.owner_membership_id, dto.contact?.new?.owner_membership_id, dto.deal?.owner_membership_id],
            pipeline: dto.deal?.pipeline_id,
        });
        const companyCustom = dto.company?.new ? await this.cf.prepare(ctx, RecordEntityType.CRM_COMPANY, dto.company.new.custom_fields, { creating: true }) : null;
        const contactCustom = dto.contact?.new ? await this.cf.prepare(ctx, RecordEntityType.CRM_CONTACT, dto.contact.new.custom_fields, { creating: true }) : null;
        const pipeline = dto.deal ? await this.pipelines.resolve(ctx, dto.deal.pipeline_id) : null;
        const stage = pipeline && (dto.deal?.stage_id ? pipeline.stages.find((s) => s.id === dto.deal!.stage_id) : pipeline.stages.find((s) => !s.is_won && !s.is_lost));
        if (pipeline && !stage) throw new BadRequestException({ message: 'The stage does not belong to the pipeline', code: 'stage_not_in_pipeline' });
        const convertedStatus = await this.prisma.crmLeadStatus.findFirst({ where: { organization_id: ctx.organization_id, is_converted: true, archived_at: null } });
        const money = ctx.can(CRM_FINANCIALS);
        const currency = dto.deal?.currency ?? lead.currency ?? pipeline?.currency ?? (await this.refs.orgCurrency(ctx));

        const result = await this.prisma.$transaction(async (tx) => {
            let company_id = dto.company?.existing_id ?? lead.company_id ?? null;
            if (dto.company?.new) {
                const { allow_duplicate: _d, branch_id, custom_fields: _cf, ...c } = dto.company.new;
                if (!money) { delete c.annual_revenue; delete c.partner_commission_percent; }
                const created = await tx.crmCompany.create({
                    data: {
                        ...c, address: c.address as Prisma.InputJsonValue, organization_id: ctx.organization_id, created_by_user_id: ctx.user_id,
                        owner_membership_id: c.owner_membership_id ?? lead.owner_membership_id ?? ctx.membership_id, lead_source_id: c.lead_source_id ?? lead.lead_source_id,
                        ...(branch_id && { branches: { create: { branch_id, relation_type: 'OWNER', is_primary: true } } }),
                    },
                });
                company_id = created.id;
                if (companyCustom) await this.cf.write(tx, RecordEntityType.CRM_COMPANY, created.id, companyCustom);
                await this.cf.carryOver(tx, ctx.organization_id, id, RecordEntityType.CRM_COMPANY, created.id);
            }
            let contact_id = dto.contact?.existing_id ?? lead.contact_id ?? null;
            if (dto.contact?.new) {
                const { allow_duplicate: _d, custom_fields: _cf, ...c } = dto.contact.new;
                const created = await tx.crmContact.create({
                    data: {
                        ...c, email: c.email?.toLowerCase(), address: c.address as Prisma.InputJsonValue, consent: c.consent as Prisma.InputJsonValue,
                        company_id: c.company_id ?? company_id, organization_id: ctx.organization_id, created_by_user_id: ctx.user_id,
                        owner_membership_id: c.owner_membership_id ?? lead.owner_membership_id ?? ctx.membership_id, lead_source_id: c.lead_source_id ?? lead.lead_source_id,
                    },
                });
                contact_id = created.id;
                if (contactCustom) await this.cf.write(tx, RecordEntityType.CRM_CONTACT, created.id, contactCustom);
                await this.cf.carryOver(tx, ctx.organization_id, id, RecordEntityType.CRM_CONTACT, created.id);
            } else if (contact_id && company_id) {
                await tx.crmContact.updateMany({ where: { id: contact_id, company_id: null }, data: { company_id } });
            }
            let deal_id: string | null = null;
            if (dto.deal && pipeline && stage) {
                const value = money ? dto.deal.value ?? (lead.estimated_value ? Number(lead.estimated_value) : 0) : 0;
                const deal = await tx.crmDeal.create({
                    data: {
                        organization_id: ctx.organization_id, pipeline_id: pipeline.id, stage_id: stage.id, name: dto.deal.name,
                        company_id, primary_contact_id: contact_id, owner_membership_id: dto.deal.owner_membership_id ?? lead.owner_membership_id ?? ctx.membership_id,
                        branch_id: lead.branch_id, value, one_time_value: value, currency: currency.toUpperCase(), probability: stage.probability,
                        forecast_category: stage.forecast_category, lead_source_id: lead.lead_source_id, referring_partner_company_id: lead.referring_partner_company_id,
                        expected_close_date: dto.deal.expected_close_date ? new Date(`${dto.deal.expected_close_date.slice(0, 10)}T00:00:00.000Z`) : undefined,
                        team_id: pipeline.team?.id, created_by_user_id: ctx.user_id,
                    },
                });
                await tx.crmDealStageHistory.create({ data: { deal_id: deal.id, to_stage_id: stage.id, changed_by_user_id: ctx.user_id } });
                deal_id = deal.id;
                await this.cf.carryOver(tx, ctx.organization_id, id, RecordEntityType.CRM_DEAL, deal.id);
            }
            // Keep the history: the lead's activities and notes follow the new records.
            await tx.crmActivity.updateMany({ where: { lead_id: id }, data: { ...(company_id && { company_id }), ...(contact_id && { contact_id }), ...(deal_id && { deal_id }) } });
            if (deal_id || company_id) {
                const notes = await tx.crmNote.findMany({ where: { organization_id: ctx.organization_id, entity_type: RecordEntityType.CRM_LEAD, entity_id: id } });
                const target = deal_id ? { entity_type: RecordEntityType.CRM_DEAL, entity_id: deal_id } : { entity_type: RecordEntityType.CRM_COMPANY, entity_id: company_id! };
                if (notes.length) {
                    await tx.crmNote.createMany({ data: notes.map(({ id: _id, created_at, updated_at: _u, edit_history, ...n }) => ({ ...n, ...target, created_at, edit_history: edit_history ?? undefined })) as Prisma.CrmNoteCreateManyInput[] });
                }
            }
            const updated = await tx.crmLead.update({
                where: { id },
                data: {
                    converted_at: new Date(), converted_company_id: company_id, converted_contact_id: contact_id, converted_deal_id: deal_id,
                    company_id, contact_id, ...(convertedStatus && { status_id: convertedStatus.id }),
                },
            });
            await this.audit.record(ctx, 'crm.lead.converted', { resource_type: 'crm_lead', resource_id: id, branch_id: lead.branch_id, metadata: { after: { company_id, contact_id, deal_id } } }, tx);
            return { lead: updated, company_id, contact_id, deal_id };
        });

        this.events.publish(ctx, {
            event_key: 'crm.lead.converted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: id,
            payload: { name: lead.name, company_id: result.company_id, contact_id: result.contact_id, deal_id: result.deal_id, owner_membership_id: lead.owner_membership_id },
            activity: { summary: `converted lead ${lead.name}`, entity_label: lead.name, company_id: result.company_id, branch_id: lead.branch_id },
        });
        if (dto.company?.new && result.company_id) this.events.publish(ctx, { event_key: 'crm.company.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: result.company_id, payload: { name: dto.company.new.name, from_lead_id: id } });
        if (dto.contact?.new && result.contact_id) this.events.publish(ctx, { event_key: 'crm.contact.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_CONTACT, entity_id: result.contact_id, payload: { from_lead_id: id } });
        if (result.deal_id) {
            this.events.publish(ctx, { event_key: 'crm.deal.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, entity_id: result.deal_id, payload: { name: dto.deal!.name, from_lead_id: id, owner_membership_id: dto.deal!.owner_membership_id ?? lead.owner_membership_id } });
        }
        return { company_id: result.company_id, contact_id: result.contact_id, deal_id: result.deal_id, lead_id: id };
    }

    async archive(ctx: OrgContext, id: string, archived = true) {
        const lead = await this.getForWrite(ctx, id, 'crm.leads.archive');
        const updated = await this.prisma.crmLead.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'crm.lead.archived' : 'crm.lead.restored', { resource_type: 'crm_lead', resource_id: id, branch_id: lead.branch_id });
        if (archived) this.events.publish(ctx, { event_key: 'crm.lead.archived', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: id, payload: { name: lead.name } });
        return redactLead(ctx, updated);
    }

    async remove(ctx: OrgContext, id: string) {
        const lead = await this.getForWrite(ctx, id, 'crm.leads.delete');
        await this.prisma.$transaction(async (tx) => {
            await tx.tagging.deleteMany({ where: { entity_type: RecordEntityType.CRM_LEAD, entity_id: id } });
            await tx.crmNote.deleteMany({ where: { entity_type: RecordEntityType.CRM_LEAD, entity_id: id, organization_id: ctx.organization_id } });
            await tx.crmLead.delete({ where: { id } });
            await this.audit.record(ctx, 'crm.lead.deleted', { resource_type: 'crm_lead', resource_id: id, branch_id: lead.branch_id, metadata: { before: { name: lead.name, email: lead.email } } }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.lead.deleted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_LEAD, entity_id: id, payload: { name: lead.name } });
        return { success: true };
    }

    async export(ctx: OrgContext, query: LeadQuery): Promise<CsvExport> {
        const tagged = await this.cf.restrictIds(ctx.organization_id, RecordEntityType.CRM_LEAD, query, await this.refs.idsWithTag(RecordEntityType.CRM_LEAD, query.tag_id));
        const rows = await this.prisma.crmLead.findMany({ where: this.where(ctx, query, tagged), include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, take: 10000 });
        const money = ctx.can(CRM_FINANCIALS);
        const extra = await this.cf.exportColumns(ctx.organization_id, RecordEntityType.CRM_LEAD, rows.map((r) => r.id));
        const content = toCsv(
            ['id', 'name', 'company', 'contact', 'email', 'phone', 'status', 'source', 'owner', 'score', ...(money ? ['estimated_value', 'currency'] : []), 'created_at', 'converted_at', ...extra.headers],
            rows.map((l) => [l.id, l.name, l.company?.name ?? l.company_name, l.contact_name, l.email, l.phone, l.status?.name, l.lead_source?.name, memberLabel(l.owner), l.manual_score ?? l.lead_score, ...(money ? [l.estimated_value?.toString(), l.currency] : []), l.created_at, l.converted_at, ...extra.row(l.id)]),
        );
        await this.audit.record(ctx, 'crm.records.exported', { resource_type: 'crm_lead', metadata: { entity: 'leads', count: rows.length, filters: query } });
        this.events.publish(ctx, { event_key: 'crm.records.exported', module: ModuleKey.CRM, payload: { entity: 'leads', count: rows.length } });
        return { filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`, content, count: rows.length };
    }

    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const lead = await this.prisma.crmLead.findFirst({ where: { id, organization_id: ctx.organization_id, ...leadScopeWhere(ctx, key) } });
        if (!lead) throw new NotFoundException({ message: 'Lead not found', code: 'lead_not_found' });
        return lead;
    }
}
