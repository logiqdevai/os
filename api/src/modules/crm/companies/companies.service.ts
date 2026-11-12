import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmDealStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { companyScopeWhere, dealScopeWhere, domainOf, ownerFilter, pick, PUBLIC_EMAIL_DOMAINS, redactCompany, toNumber } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { CsvExport, memberLabel, toCsv } from '../common/csv.utils';
import { CrmCustomFieldValuesService } from '../custom-fields/custom-field-values.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CompanyQuery, LookupQuery } from './dto/company-query.schema';

const READ = 'crm.companies.read';
const UPDATE = 'crm.companies.update';
const ASSIGN = 'crm.companies.assign';

const LIST_INCLUDE = {
    owner: { select: MEMBER_SELECT },
    lifecycle_stage: { select: { id: true, name: true, is_customer: true } },
    lead_source: { select: { id: true, name: true } },
    team: { select: { id: true, name: true } },
    _count: { select: { contacts: { where: { archived_at: null } }, deals: { where: { status: CrmDealStatus.OPEN, archived_at: null } } } },
} satisfies Prisma.CrmCompanyInclude;

/**
 * 02 §2 — companies (prospects, customers, partners, vendors). Also the customer lookup other modules use
 * (projects, proposals, billing): `search(ctx, q)` and `GET /crm/companies/lookup`.
 */
@Injectable()
export class CrmCompaniesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
        private readonly defaults: CrmDefaultsService,
        private readonly cf: CrmCustomFieldValuesService,
    ) { }

    private where(ctx: OrgContext, query: CompanyQuery, extraIds?: string[]): Prisma.CrmCompanyWhereInput {
        return {
            organization_id: ctx.organization_id,
            merged_into_id: null,
            AND: [
                companyScopeWhere(ctx, READ),
                query.search
                    ? {
                        OR: [
                            { name: { contains: query.search, mode: 'insensitive' } },
                            { legal_name: { contains: query.search, mode: 'insensitive' } },
                            { website: { contains: query.search, mode: 'insensitive' } },
                            { email: { contains: query.search, mode: 'insensitive' } },
                        ],
                    }
                    : {},
            ],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.type?.length && { type: { in: query.type } }),
            ...(query.lifecycle_stage_id && { lifecycle_stage_id: query.lifecycle_stage_id }),
            ...ownerFilter(ctx, query.owner),
            ...(query.team_id && { team_id: query.team_id }),
            ...(query.branch_id && { branches: { some: { branch_id: query.branch_id } } }),
            ...(query.country && { country: query.country.toUpperCase() }),
            ...(extraIds && { id: { in: extraIds } }),
        };
    }

    async findAll(ctx: OrgContext, query: CompanyQuery) {
        const tagged = await this.cf.restrictIds(ctx.organization_id, RecordEntityType.CRM_COMPANY, query, await this.refs.idsWithTag(RecordEntityType.CRM_COMPANY, query.tag_id));
        const where = this.where(ctx, query, tagged);
        const [items, total] = await Promise.all([
            this.prisma.crmCompany.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'last_activity_at'], 'name'), include: LIST_INCLUDE }),
            this.prisma.crmCompany.count({ where }),
        ]);
        const ids = items.map((i) => i.id);
        const openValues = ctx.can(CRM_FINANCIALS) && ids.length
            ? await this.prisma.crmDeal.groupBy({ by: ['company_id'], where: { company_id: { in: ids }, status: CrmDealStatus.OPEN, archived_at: null }, _sum: { value: true } })
            : [];
        const valueBy = new Map(openValues.map((v) => [v.company_id, toNumber(v._sum.value)]));
        const withTags = await this.refs.withTags(RecordEntityType.CRM_COMPANY, items);
        return paginate(withTags.map((c) => ({ ...redactCompany(ctx, c), open_deals_value: ctx.can(CRM_FINANCIALS) ? valueBy.get(c.id) ?? 0 : null })), total, query);
    }

    /** Lightweight picker search for every module that links a customer (projects, proposals, billing…). */
    async search(ctx: OrgContext, query: LookupQuery) {
        return this.prisma.crmCompany.findMany({
            where: {
                organization_id: ctx.organization_id,
                archived_at: null,
                merged_into_id: null,
                ...companyScopeWhere(ctx, READ),
                ...(query.type?.length && { type: { in: query.type } }),
                ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { website: { contains: query.search, mode: 'insensitive' } }] }),
            },
            select: { id: true, name: true, type: true, website: true, country: true, currency: true },
            orderBy: { name: 'asc' },
            take: query.limit,
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        const company = await this.prisma.crmCompany.findFirst({
            where: { id, organization_id: ctx.organization_id, ...companyScopeWhere(ctx, READ) },
            include: {
                ...LIST_INCLUDE,
                account_manager: { select: MEMBER_SELECT },
                parent: { select: { id: true, name: true } },
                children: { where: { archived_at: null }, select: { id: true, name: true, type: true } },
                branches: { include: { branch: { select: { id: true, name: true } } } },
                merged_into: { select: { id: true, name: true } },
            },
        });
        if (!company) throw new NotFoundException({ message: 'Company not found', code: 'company_not_found' });
        const [tags, summary, custom] = await Promise.all([this.refs.tagsFor(RecordEntityType.CRM_COMPANY, [id]), this.summary(ctx, id), this.cf.valuesFor(ctx.organization_id, RecordEntityType.CRM_COMPANY, [id])]);
        return { ...redactCompany(ctx, company), tags: tags.get(id) ?? [], custom_fields: custom.get(id) ?? {}, summary };
    }

    /** Customer 360 numbers (02 §18): deal counts and values (money only with crm.financials.read). */
    async summary(ctx: OrgContext, id: string) {
        const dealWhere = { company_id: id, archived_at: null, ...(ctx.can('crm.deals.read') ? dealScopeWhere(ctx, 'crm.deals.read') : { id: { in: [] } }) };
        const [byStatus, contacts, openActivities, lastActivity] = await Promise.all([
            this.prisma.crmDeal.groupBy({ by: ['status'], where: dealWhere, _count: { _all: true }, _sum: { value: true } }),
            this.prisma.crmContact.count({ where: { company_id: id, archived_at: null } }),
            this.prisma.crmActivity.count({ where: { company_id: id, status: 'PLANNED' } }),
            this.prisma.crmActivity.findFirst({ where: { company_id: id, status: 'COMPLETED' }, orderBy: { completed_at: 'desc' }, select: { completed_at: true, title: true, type: true } }),
        ]);
        const get = (s: CrmDealStatus) => byStatus.find((b) => b.status === s);
        const money = ctx.can(CRM_FINANCIALS);
        return {
            contacts,
            open_activities: openActivities,
            last_activity: lastActivity,
            open_deals: get('OPEN')?._count._all ?? 0,
            won_deals: get('WON')?._count._all ?? 0,
            lost_deals: get('LOST')?._count._all ?? 0,
            open_value: money ? toNumber(get('OPEN')?._sum.value) : null,
            won_value: money ? toNumber(get('WON')?._sum.value) : null,
        };
    }

    /** Possible duplicates by name, website domain or email domain (02 §22). */
    async findDuplicates(ctx: OrgContext, input: { name?: string; website?: string; email?: string; exclude_id?: string }) {
        const domain = domainOf(input.website) ?? domainOf(input.email);
        const ors: Prisma.CrmCompanyWhereInput[] = [];
        if (input.name?.trim()) ors.push({ name: { equals: input.name.trim(), mode: 'insensitive' } });
        if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) {
            ors.push({ website: { contains: domain, mode: 'insensitive' } }, { email: { endsWith: `@${domain}`, mode: 'insensitive' } });
        }
        if (!ors.length) return [];
        const rows = await this.prisma.crmCompany.findMany({
            where: { organization_id: ctx.organization_id, merged_into_id: null, OR: ors, ...(input.exclude_id && { id: { not: input.exclude_id } }) },
            select: { id: true, name: true, website: true, email: true, type: true, archived_at: true },
            take: 5,
        });
        return rows.map((r) => ({
            ...r,
            match: input.name && r.name.toLowerCase() === input.name.trim().toLowerCase() ? 'name' : 'domain',
        }));
    }

    async create(ctx: OrgContext, dto: CreateCompanyDto) {
        await this.defaults.ensure(ctx.organization_id);
        const { allow_duplicate, branch_id, custom_fields, ...data } = dto;
        await this.refs.assert(ctx, {
            membership: [data.owner_membership_id, data.account_manager_membership_id],
            team: data.team_id, branch: branch_id, company: data.parent_company_id,
            lifecycle_stage: data.lifecycle_stage_id, lead_source: data.lead_source_id,
        });
        if (!allow_duplicate) {
            const duplicates = await this.findDuplicates(ctx, { name: data.name, website: data.website, email: data.email });
            if (duplicates.length) throw new ConflictException({ message: 'A company with this name or domain already exists', code: 'possible_duplicates', duplicates });
        }
        if (!ctx.can(CRM_FINANCIALS)) { delete data.annual_revenue; delete data.partner_commission_percent; }
        const customValues = await this.cf.prepare(ctx, RecordEntityType.CRM_COMPANY, custom_fields, { creating: true });
        const lifecycle_stage_id = data.lifecycle_stage_id ?? (await this.prisma.crmLifecycleStage.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null }, select: { id: true } }))?.id;
        const company = await this.prisma.$transaction(async (tx) => {
            const c = await tx.crmCompany.create({
                data: {
                    ...data,
                    country: data.country?.toUpperCase(),
                    lifecycle_stage_id,
                    owner_membership_id: data.owner_membership_id ?? ctx.membership_id,
                    organization_id: ctx.organization_id,
                    created_by_user_id: ctx.user_id,
                    address: data.address as Prisma.InputJsonValue,
                    ...(data.type === 'CUSTOMER' && { customer_since: new Date() }),
                    ...(branch_id && { branches: { create: { branch_id, relation_type: 'OWNER', is_primary: true } } }),
                },
            });
            if (lifecycle_stage_id) await tx.crmLifecycleHistory.create({ data: { company_id: c.id, stage_id: lifecycle_stage_id, changed_by_user_id: ctx.user_id } });
            await this.cf.write(tx, RecordEntityType.CRM_COMPANY, c.id, customValues);
            await this.audit.record(ctx, 'crm.company.created', { resource_type: 'crm_company', resource_id: c.id, branch_id, metadata: { after: { name: c.name, type: c.type } } }, tx);
            return c;
        });
        this.events.publish(ctx, {
            event_key: 'crm.company.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: company.id,
            payload: { name: company.name, type: company.type, owner_membership_id: company.owner_membership_id },
            activity: { summary: `created company ${company.name}`, entity_label: company.name, company_id: company.id },
        });
        return company;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCompanyDto) {
        const before = await this.getForWrite(ctx, id, UPDATE);
        const { allow_duplicate: _a, branch_id, custom_fields, ...data } = dto;
        await this.refs.assert(ctx, {
            membership: [data.owner_membership_id, data.account_manager_membership_id],
            team: data.team_id, branch: branch_id, company: data.parent_company_id,
            lifecycle_stage: data.lifecycle_stage_id, lead_source: data.lead_source_id,
        });
        this.refs.assertCanAssign(ctx, ASSIGN,
            (data.owner_membership_id !== undefined && data.owner_membership_id !== before.owner_membership_id) ||
            (data.account_manager_membership_id !== undefined && data.account_manager_membership_id !== before.account_manager_membership_id));
        const customValues = await this.cf.prepare(ctx, RecordEntityType.CRM_COMPANY, custom_fields, { creating: false });
        if (data.parent_company_id === id) throw new ConflictException({ message: 'A company cannot be its own parent', code: 'company_cycle' });
        if (!ctx.can(CRM_FINANCIALS)) { delete data.annual_revenue; delete data.partner_commission_percent; }
        const lifecycleChanged = !!data.lifecycle_stage_id && data.lifecycle_stage_id !== before.lifecycle_stage_id;
        const becameCustomer = data.type === 'CUSTOMER' && before.type !== 'CUSTOMER' && !before.customer_since;
        const company = await this.prisma.$transaction(async (tx) => {
            const c = await tx.crmCompany.update({
                where: { id },
                data: {
                    ...data,
                    ...(data.country && { country: data.country.toUpperCase() }),
                    address: data.address as Prisma.InputJsonValue | undefined,
                    ...(becameCustomer && { customer_since: new Date() }),
                },
            });
            if (lifecycleChanged) await tx.crmLifecycleHistory.create({ data: { company_id: id, stage_id: data.lifecycle_stage_id!, changed_by_user_id: ctx.user_id } });
            await this.cf.write(tx, RecordEntityType.CRM_COMPANY, id, customValues);
            if (branch_id) {
                await tx.crmCompanyBranch.upsert({
                    where: { company_id_branch_id_relation_type: { company_id: id, branch_id, relation_type: 'OWNER' } },
                    update: { is_primary: true },
                    create: { company_id: id, branch_id, relation_type: 'OWNER', is_primary: true },
                });
            }
            await this.audit.record(ctx, 'crm.company.updated', {
                resource_type: 'crm_company', resource_id: id,
                metadata: { before: pick(before, Object.keys(data)), after: { ...data, ...(custom_fields && { custom_fields }) } },
            }, tx);
            return c;
        });
        this.events.publish(ctx, {
            event_key: 'crm.company.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: id,
            payload: { name: company.name, owner_membership_id: company.owner_membership_id }, changes: data as Record<string, unknown>,
        });
        if (lifecycleChanged) {
            this.events.publish(ctx, { event_key: 'crm.company.lifecycle_changed', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: id, payload: { name: company.name, lifecycle_stage_id: data.lifecycle_stage_id, owner_membership_id: company.owner_membership_id } });
        }
        if (data.owner_membership_id && data.owner_membership_id !== before.owner_membership_id) this.publishAssigned(ctx, company);
        return redactCompany(ctx, company);
    }

    async assign(ctx: OrgContext, id: string, owner_membership_id: string) {
        const before = await this.getForWrite(ctx, id, ASSIGN);
        await this.refs.assert(ctx, { membership: owner_membership_id });
        const company = await this.prisma.crmCompany.update({ where: { id }, data: { owner_membership_id } });
        await this.audit.record(ctx, 'crm.company.assigned', { resource_type: 'crm_company', resource_id: id, metadata: { before: { owner_membership_id: before.owner_membership_id }, after: { owner_membership_id } } });
        this.publishAssigned(ctx, company);
        return redactCompany(ctx, company);
    }

    private publishAssigned(ctx: OrgContext, company: { id: string; name: string; owner_membership_id: string | null }) {
        this.events.publish(ctx, {
            event_key: 'crm.company.assigned', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: company.id,
            payload: { name: company.name, owner_membership_id: company.owner_membership_id, assignee_membership_ids: company.owner_membership_id ? [company.owner_membership_id] : [] },
            activity: { summary: `assigned company ${company.name}`, entity_label: company.name, company_id: company.id },
        });
    }

    async archive(ctx: OrgContext, id: string) {
        await this.getForWrite(ctx, id, 'crm.companies.archive');
        const company = await this.prisma.crmCompany.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'crm.company.archived', { resource_type: 'crm_company', resource_id: id });
        this.events.publish(ctx, { event_key: 'crm.company.archived', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: id, payload: { name: company.name } });
        return company;
    }

    async restore(ctx: OrgContext, id: string) {
        await this.getForWrite(ctx, id, 'crm.companies.archive');
        const company = await this.prisma.crmCompany.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'crm.company.restored', { resource_type: 'crm_company', resource_id: id });
        return company;
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.companies.delete');
        const links = await this.prisma.crmDeal.count({ where: { company_id: id } });
        if (links) throw new ConflictException({ message: 'This company has deals. Archive it instead, or delete the deals first.', code: 'company_has_deals' });
        await this.prisma.$transaction(async (tx) => {
            await tx.tagging.deleteMany({ where: { entity_type: RecordEntityType.CRM_COMPANY, entity_id: id } });
            await tx.crmNote.deleteMany({ where: { entity_type: RecordEntityType.CRM_COMPANY, entity_id: id, organization_id: ctx.organization_id } });
            await tx.crmCompany.delete({ where: { id } });
            await this.audit.record(ctx, 'crm.company.deleted', { resource_type: 'crm_company', resource_id: id, metadata: { before: { name: before.name } } }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.company.deleted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_COMPANY, entity_id: id, payload: { name: before.name } });
        return { success: true };
    }

    /** CSV export (sensitive, audited). Applies the same filters and scope as the list. */
    async export(ctx: OrgContext, query: CompanyQuery): Promise<CsvExport> {
        const tagged = await this.cf.restrictIds(ctx.organization_id, RecordEntityType.CRM_COMPANY, query, await this.refs.idsWithTag(RecordEntityType.CRM_COMPANY, query.tag_id));
        const rows = await this.prisma.crmCompany.findMany({ where: this.where(ctx, query, tagged), include: LIST_INCLUDE, orderBy: { name: 'asc' }, take: 10000 });
        const money = ctx.can(CRM_FINANCIALS);
        const extra = await this.cf.exportColumns(ctx.organization_id, RecordEntityType.CRM_COMPANY, rows.map((r) => r.id));
        const headers = ['id', 'name', 'legal_name', 'type', 'lifecycle_stage', 'industry', 'website', 'email', 'phone', 'country', 'vat_number', 'owner', 'contacts', 'open_deals', ...(money ? ['annual_revenue', 'currency'] : []), 'created_at', ...extra.headers];
        const content = toCsv(headers, rows.map((c) => [
            c.id, c.name, c.legal_name, c.type, c.lifecycle_stage?.name, c.industry, c.website, c.email, c.phone, c.country, c.vat_number, memberLabel(c.owner),
            c._count.contacts, c._count.deals, ...(money ? [c.annual_revenue?.toString(), c.currency] : []), c.created_at, ...extra.row(c.id),
        ]));
        await this.audit.record(ctx, 'crm.records.exported', { resource_type: 'crm_company', metadata: { entity: 'companies', count: rows.length, filters: query } });
        this.events.publish(ctx, { event_key: 'crm.records.exported', module: ModuleKey.CRM, payload: { entity: 'companies', count: rows.length } });
        return { filename: `companies-${new Date().toISOString().slice(0, 10)}.csv`, content, count: rows.length };
    }

    /** Load a record the caller may write with `key` (scope of the write key) or 404. */
    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const company = await this.prisma.crmCompany.findFirst({ where: { id, organization_id: ctx.organization_id, ...companyScopeWhere(ctx, key) } });
        if (!company) throw new NotFoundException({ message: 'Company not found', code: 'company_not_found' });
        return company;
    }
}
