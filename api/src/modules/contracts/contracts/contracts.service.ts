import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    ContractObligationStatus, ContractPartyType, ContractRelationKind, ContractRenewalDecisionType, ContractStatus, ContractTemplateStatus, ContractVersionStatus, ModuleKey, Prisma,
    SignatureRequestStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { CONTRACT_READ, MEMBER_SELECT, addDays, addMonths, resolveVariables, sectionsHash, stripConfidential, today } from '../shared/contracts.utils';
import {
    AmendContractDto, ContractQuery, CreateContractDto, LinkProjectDto, PartyDto, RenewContractDto, RenewalDecisionDto, RenewalsQuery, SetPartiesDto, TerminateContractDto, UpdateContractDto,
} from './dto/contract.dto';

export interface SectionSeed {
    key: string;
    title: string;
    body: string | null;
    clause_version_id?: string | null;
    is_appendix?: boolean;
    sort_order: number;
}

const DEFAULT_SECTIONS: SectionSeed[] = [
    { key: 'parties', title: 'Parties', body: 'This agreement is made between {{agency.name}} ("Agency") and {{customer.legal_name}} ("Customer").', sort_order: 0 },
    { key: 'scope', title: 'Scope of services', body: '', sort_order: 1 },
    { key: 'fees', title: 'Fees and payment', body: 'Payment terms: {{contract.payment_terms}}.', sort_order: 2 },
    { key: 'term', title: 'Term and termination', body: 'This agreement starts on {{contract.start_date}} and ends on {{contract.end_date}}.', sort_order: 3 },
    { key: 'confidentiality', title: 'Confidentiality', body: '', sort_order: 4 },
    { key: 'signatures', title: 'Signatures', body: 'Signed electronically by the authorised signatories of each party.', sort_order: 5 },
];

const LIST_INCLUDE = {
    type: { select: { id: true, name: true } },
    primary_company: { select: { id: true, name: true } },
    owner: { select: MEMBER_SELECT },
    current_version: { select: { id: true, label: true, version_number: true, status: true } },
    _count: { select: { obligations: true, signature_requests: true, children: true } },
} satisfies Prisma.ContractInclude;

const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (s: string | undefined | null) => (s ? new Date(s) : undefined);
const dec = (n: number | undefined) => (n === undefined ? undefined : new Prisma.Decimal(n));
const TERMINAL: ContractStatus[] = [ContractStatus.TERMINATED, ContractStatus.EXPIRED, ContractStatus.CANCELLED, ContractStatus.ARCHIVED, ContractStatus.SUPERSEDED];

/**
 * 04 Contracts — the contract record: CRUD, parties/signatories, project links, lineage (renew / amend),
 * termination, dashboard and renewals. Versions, review/approval and signatures live in their own services.
 * Every method filters by ctx.organization_id + the caller's scope; confidential terms are stripped per caller.
 */
@Injectable()
export class ContractsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
    ) { }

    /** Scope: organization-wide, or contracts in my branches / customers / projects / explicit resources, or owned by me. */
    scopeWhere(ctx: OrgContext, key = CONTRACT_READ): Prisma.ContractWhereInput {
        const scope = ctx.scopeOf(key);
        if (!scope || scope.organization) return {};
        const or: Prisma.ContractWhereInput[] = [];
        if (scope.branch_ids.length) or.push({ branch_id: { in: scope.branch_ids } });
        if (scope.customer_ids.length) or.push({ primary_company_id: { in: scope.customer_ids } });
        if (scope.resource_ids.length) or.push({ id: { in: scope.resource_ids } });
        if (scope.project_ids.length) or.push({ projects: { some: { project_id: { in: scope.project_ids } } } });
        if (ctx.membership_id) or.push({ owner_membership_id: ctx.membership_id });
        return or.length ? { OR: or } : { id: '00000000-0000-0000-0000-000000000000' };
    }

    /** Loads a contract the caller may see (404 otherwise, so ids do not leak). */
    async assertContract(ctx: OrgContext, id: string) {
        const c = await this.prisma.contract.findFirst({ where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx) } });
        if (!c) throw new NotFoundException({ message: 'Contract not found', code: 'contract_not_found' });
        return c;
    }

    async findAll(ctx: OrgContext, query: ContractQuery) {
        const where: Prisma.ContractWhereInput = {
            organization_id: ctx.organization_id,
            ...this.scopeWhere(ctx),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.type_id && { type_id: query.type_id }),
            ...(query.primary_company_id && { primary_company_id: query.primary_company_id }),
            ...(query.owner_membership_id && { owner_membership_id: query.owner_membership_id }),
            ...(query.relation_kind && { relation_kind: query.relation_kind }),
            ...(query.parent_contract_id && { parent_contract_id: query.parent_contract_id }),
            ...(query.proposal_id && { proposal_id: query.proposal_id }),
            ...(query.expiring_within_days && { end_date: { gte: today(), lte: addDays(today(), query.expiring_within_days) } }),
            ...(query.search && {
                OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { number: { contains: query.search, mode: 'insensitive' } },
                    { primary_company: { name: { contains: query.search, mode: 'insensitive' } } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.contract.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['created_at', 'updated_at', 'title', 'number', 'end_date', 'total_value', 'status'], 'created_at'), include: LIST_INCLUDE }),
            this.prisma.contract.count({ where }),
        ]);
        return paginate(items.map((c) => stripConfidential(ctx, c)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        await this.assertContract(ctx, id);
        const c = await this.prisma.contract.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                ...LIST_INCLUDE,
                branch: { select: { id: true, name: true } },
                template: { select: { id: true, name: true } },
                proposal: { select: { id: true, number: true, title: true } },
                parent: { select: { id: true, number: true, title: true, status: true } },
                children: { select: { id: true, number: true, title: true, status: true, relation_kind: true, relation_sequence: true, created_at: true }, orderBy: { created_at: 'asc' } },
                superseded_by: { select: { id: true, number: true, title: true } },
                parties: { orderBy: { sort_order: 'asc' }, include: { company: { select: { id: true, name: true } }, signatories: { orderBy: { sort_order: 'asc' } } } },
                projects: { include: { project: { select: { id: true, name: true, code: true } } } },
                versions: {
                    orderBy: { version_number: 'desc' },
                    select: { id: true, label: true, version_number: true, status: true, change_summary: true, content_hash: true, locked_at: true, approved_at: true, signed_at: true, created_at: true, customer_visible: true },
                },
                termination: true,
                renewal_decisions: { orderBy: { decided_at: 'desc' }, take: 5 },
            },
        });
        return stripConfidential(ctx, c!);
    }

    async create(ctx: OrgContext, dto: CreateContractDto, lineage?: { relation_kind: ContractRelationKind; parent_contract_id: string; relation_sequence?: number; sections?: SectionSeed[]; parties?: PartyDto[] }) {
        await this.assertRefs(ctx, dto);
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { legal_name: true, display_name: true, default_currency: true } });
        const company = dto.primary_company_id ? await this.prisma.crmCompany.findFirst({ where: { id: dto.primary_company_id, organization_id: ctx.organization_id }, select: { id: true, name: true, legal_name: true, currency: true } }) : null;
        const type = dto.type_id ? await this.prisma.contractType.findFirst({ where: { id: dto.type_id, organization_id: ctx.organization_id } }) : null;

        // Template version: explicit, else the template's current (published), else the type's default template.
        const templateId = dto.template_id ?? type?.default_template_id ?? undefined;
        let templateVersion: { id: string; sections: Prisma.JsonValue; template_id: string } | null = null;
        if (templateId) {
            const template = await this.prisma.contractTemplate.findFirst({ where: { id: templateId, organization_id: ctx.organization_id } });
            if (!template) throw new NotFoundException({ message: 'Template not found', code: 'contract_template_not_found' });
            if (template.status === ContractTemplateStatus.DEPRECATED && dto.template_id) throw new BadRequestException({ message: 'This template is deprecated', code: 'template_deprecated' });
            const vid = dto.template_version_id ?? template.current_version_id;
            if (vid) templateVersion = await this.prisma.contractTemplateVersion.findFirst({ where: { id: vid, template_id: template.id }, select: { id: true, sections: true, template_id: true } });
        }

        let seeds: SectionSeed[] = lineage?.sections ?? (templateVersion ? await this.sectionsFromTemplate(ctx, templateVersion.sections) : await this.sectionsFromProposal(ctx, dto.proposal_version_id)) ?? DEFAULT_SECTIONS;
        if (!seeds.length) seeds = DEFAULT_SECTIONS;

        const parties: PartyDto[] = lineage?.parties ?? dto.parties ?? [
            { party_type: ContractPartyType.AGENCY, legal_name: org.legal_name },
            ...(company ? [{ party_type: ContractPartyType.CUSTOMER, company_id: company.id, legal_name: company.legal_name || company.name }] : []),
        ];

        const contract = await this.prisma.$transaction(async (tx) => {
            const number = await this.numbering.next(tx, ctx.organization_id, 'contract');
            const c = await tx.contract.create({
                data: {
                    organization_id: ctx.organization_id,
                    number,
                    title: dto.title,
                    type_id: dto.type_id,
                    template_id: templateVersion?.template_id ?? null,
                    branch_id: dto.branch_id,
                    owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                    primary_company_id: dto.primary_company_id,
                    proposal_id: dto.proposal_id,
                    proposal_version_id: dto.proposal_version_id,
                    currency: dto.currency ?? company?.currency ?? org.default_currency,
                    language: dto.language ?? 'en',
                    draft_date: today(),
                    effective_date: toDate(dto.effective_date), start_date: toDate(dto.start_date), end_date: toDate(dto.end_date),
                    expiration_date: toDate(dto.expiration_date), renewal_date: toDate(dto.renewal_date), notice_deadline: toDate(dto.notice_deadline) ?? this.noticeDeadline(dto.end_date, dto.notice_days ?? type?.default_notice_days ?? undefined),
                    renewal_type: dto.renewal_type ?? type?.default_renewal_type,
                    renewal_term_months: dto.renewal_term_months,
                    notice_days: dto.notice_days ?? type?.default_notice_days,
                    total_value: dec(dto.total_value), one_time_value: dec(dto.one_time_value), recurring_value: dec(dto.recurring_value),
                    billing_frequency: dto.billing_frequency, payment_terms: dto.payment_terms,
                    customer_visible: dto.customer_visible ?? false,
                    processes_personal_data: dto.processes_personal_data ?? false,
                    relation_kind: lineage?.relation_kind ?? ContractRelationKind.STANDALONE,
                    parent_contract_id: lineage?.parent_contract_id,
                    relation_sequence: lineage?.relation_sequence,
                    created_by_user_id: ctx.user_id,
                },
            });
            await this.writeParties(tx, c.id, parties);
            if (dto.project_ids?.length) await tx.contractProject.createMany({ data: dto.project_ids.map((p, i) => ({ contract_id: c.id, project_id: p, role: i === 0 ? 'primary' : 'related' })) });

            const vars: Record<string, string | null | undefined> = {
                'contract.title': c.title, 'contract.number': c.number, 'contract.currency': c.currency,
                'contract.start_date': fmtDate(c.start_date), 'contract.end_date': fmtDate(c.end_date), 'contract.effective_date': fmtDate(c.effective_date),
                'contract.payment_terms': c.payment_terms, 'contract.total_value': c.total_value?.toString(),
                'agency.name': org.display_name, 'agency.legal_name': org.legal_name,
                'customer.name': company?.name, 'customer.legal_name': company?.legal_name || company?.name,
                ...(dto.variables ?? {}),
            };
            const sections = seeds.map((s) => ({ ...s, body: resolveVariables(s.body, vars) }));
            const v = await tx.contractVersion.create({
                data: {
                    contract_id: c.id, version_number: 1, label: lineage?.relation_kind && lineage.relation_kind !== ContractRelationKind.STANDALONE ? 'v0.1' : 'v0.1',
                    status: ContractVersionStatus.DRAFT, template_version_id: templateVersion?.id, variables: vars as Prisma.InputJsonValue,
                    content_hash: sectionsHash(sections), created_by_user_id: ctx.user_id, change_summary: lineage ? `Created as ${lineage.relation_kind.toLowerCase().replace('_', ' ')}` : 'Initial draft',
                    sections: { create: sections.map((s) => ({ key: s.key, title: s.title, body: s.body, clause_version_id: s.clause_version_id ?? null, is_appendix: s.is_appendix ?? false, sort_order: s.sort_order })) },
                },
            });
            return tx.contract.update({ where: { id: c.id }, data: { current_version_id: v.id } });
        });

        await this.audit.record(ctx, 'contract.created', {
            resource_type: 'contract', resource_id: contract.id, branch_id: contract.branch_id,
            metadata: { after: { number: contract.number, title: contract.title, relation_kind: contract.relation_kind, template_version_id: templateVersion?.id, source: lineage ? lineage.relation_kind : dto.proposal_id ? 'proposal' : templateVersion ? 'template' : 'blank' } },
        });
        this.events.publish(ctx, {
            event_key: 'contracts.contract.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contract.id,
            payload: { number: contract.number, title: contract.title, owner_membership_id: contract.owner_membership_id, relation_kind: contract.relation_kind, company_id: contract.primary_company_id },
            activity: { summary: `Contract ${contract.number} created`, entity_label: contract.title, company_id: contract.primary_company_id, branch_id: contract.branch_id },
        });
        return this.findOne(ctx, contract.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateContractDto) {
        const before = await this.assertContract(ctx, id);
        if (TERMINAL.includes(before.status)) throw new ConflictException({ message: `A ${before.status.toLowerCase()} contract cannot be edited`, code: 'contract_closed' });
        await this.assertRefs(ctx, dto);
        const confidentialTouched = ['total_value', 'one_time_value', 'recurring_value', 'payment_terms'].some((k) => k in dto);
        if (confidentialTouched && !ctx.can('contracts.confidential_terms.read')) {
            throw new BadRequestException({ message: 'You cannot change confidential commercial terms', code: 'confidential_terms_forbidden' });
        }
        const data: Prisma.ContractUncheckedUpdateInput = {
            ...dto,
            effective_date: toDate(dto.effective_date), start_date: toDate(dto.start_date), end_date: toDate(dto.end_date),
            expiration_date: toDate(dto.expiration_date), renewal_date: toDate(dto.renewal_date),
            notice_deadline: toDate(dto.notice_deadline) ?? (dto.end_date || dto.notice_days !== undefined ? this.noticeDeadline(dto.end_date ?? fmtDate(before.end_date) ?? undefined, dto.notice_days ?? before.notice_days ?? undefined) : undefined),
            total_value: dec(dto.total_value), one_time_value: dec(dto.one_time_value), recurring_value: dec(dto.recurring_value),
        };
        const c = await this.prisma.contract.update({ where: { id }, data });
        const changed = Object.keys(dto);
        await this.audit.record(ctx, 'contract.updated', {
            resource_type: 'contract', resource_id: id, branch_id: c.branch_id,
            metadata: { before: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])), after: dto },
        });
        this.events.publish(ctx, { event_key: 'contracts.contract.updated', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, owner_membership_id: c.owner_membership_id }, changes: dto as Record<string, unknown> });
        if (dto.owner_membership_id && dto.owner_membership_id !== before.owner_membership_id) {
            this.events.publish(ctx, { event_key: 'contracts.contract.owner_changed', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, title: c.title, owner_membership_id: c.owner_membership_id } });
        }
        return this.findOne(ctx, id);
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        const before = await this.assertContract(ctx, id);
        const c = await this.prisma.contract.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'contract.archived' : 'contract.restored', { resource_type: 'contract', resource_id: id, branch_id: before.branch_id });
        this.events.publish(ctx, { event_key: archived ? 'contracts.contract.archived' : 'contracts.contract.restored', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, owner_membership_id: c.owner_membership_id } });
        return c;
    }

    /** Only unsigned drafts without signature history may be deleted (legal record otherwise). */
    async remove(ctx: OrgContext, id: string) {
        const c = await this.assertContract(ctx, id);
        const requests = await this.prisma.signatureRequest.count({ where: { contract_id: id } });
        if (c.status !== ContractStatus.DRAFT || requests) throw new ConflictException({ message: 'Only drafts that were never sent for signature can be deleted. Archive it instead.', code: 'contract_not_deletable' });
        await this.prisma.$transaction([
            this.prisma.contract.update({ where: { id }, data: { current_version_id: null, signed_version_id: null } }),
            this.prisma.contract.delete({ where: { id } }),
        ]);
        await this.audit.record(ctx, 'contract.deleted', { resource_type: 'contract', resource_id: id, branch_id: c.branch_id, metadata: { before: { number: c.number, title: c.title } } });
        this.events.publish(ctx, { event_key: 'contracts.contract.deleted', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, owner_membership_id: c.owner_membership_id } });
        return { success: true };
    }

    async setParties(ctx: OrgContext, id: string, dto: SetPartiesDto) {
        const c = await this.assertContract(ctx, id);
        const locked = await this.prisma.signatureRequest.count({ where: { contract_id: id, status: { in: [SignatureRequestStatus.SENT, SignatureRequestStatus.DELIVERED, SignatureRequestStatus.VIEWED, SignatureRequestStatus.PARTIALLY_SIGNED] } } });
        if (locked || TERMINAL.includes(c.status) || c.status === ContractStatus.FULLY_SIGNED || c.status === ContractStatus.ACTIVE) {
            throw new ConflictException({ message: 'Parties cannot change while signing is in progress or after signature. Create an amendment instead.', code: 'parties_locked' });
        }
        await this.assertPartyRefs(ctx, dto.parties);
        await this.prisma.$transaction(async (tx) => {
            await tx.contractParty.deleteMany({ where: { contract_id: id } });
            await this.writeParties(tx, id, dto.parties);
        });
        await this.audit.record(ctx, 'contract.parties_updated', { resource_type: 'contract', resource_id: id, metadata: { after: dto.parties.map((p) => ({ party_type: p.party_type, legal_name: p.legal_name, signatories: p.signatories?.length ?? 0 })) } });
        this.events.publish(ctx, { event_key: 'contracts.contract.parties_updated', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, owner_membership_id: c.owner_membership_id } });
        return this.findOne(ctx, id);
    }

    async linkProject(ctx: OrgContext, id: string, dto: LinkProjectDto) {
        const c = await this.assertContract(ctx, id);
        const project = await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: ctx.organization_id }, select: { id: true, name: true } });
        if (!project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        await this.prisma.contractProject.upsert({
            where: { contract_id_project_id: { contract_id: id, project_id: dto.project_id } },
            update: { role: dto.role ?? 'related' },
            create: { contract_id: id, project_id: dto.project_id, role: dto.role ?? 'related' },
        });
        await this.audit.record(ctx, 'contract.project_linked', { resource_type: 'contract', resource_id: id, metadata: { project_id: dto.project_id, role: dto.role } });
        this.events.publish(ctx, { event_key: 'contracts.contract.project_linked', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, project_id: project.id, owner_membership_id: c.owner_membership_id } });
        return { success: true };
    }

    async unlinkProject(ctx: OrgContext, id: string, projectId: string) {
        await this.assertContract(ctx, id);
        const res = await this.prisma.contractProject.deleteMany({ where: { contract_id: id, project_id: projectId } });
        if (!res.count) throw new NotFoundException({ message: 'Project is not linked', code: 'project_link_not_found' });
        await this.audit.record(ctx, 'contract.project_unlinked', { resource_type: 'contract', resource_id: id, metadata: { project_id: projectId } });
        return { success: true };
    }

    /** Lifecycle history for the "History" tab: audit events of the contract + its signature events. */
    async history(ctx: OrgContext, id: string) {
        await this.assertContract(ctx, id);
        const [audit, signature] = await Promise.all([
            this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_type: 'contract', resource_id: id },
                orderBy: { created_at: 'desc' }, take: 200,
                select: { id: true, event_type: true, created_at: true, actor_type: true, actor_user_id: true, metadata: true },
            }),
            this.prisma.signatureEvent.findMany({
                where: { request: { contract_id: id, organization_id: ctx.organization_id } },
                orderBy: { occurred_at: 'desc' }, take: 200,
                select: { id: true, type: true, occurred_at: true, request_id: true, signer: { select: { name: true, email: true } } },
            }),
        ]);
        const userIds = [...new Set(audit.map((a) => a.actor_user_id).filter(Boolean) as string[])];
        const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, display_name: true, first_name: true, last_name: true } }) : [];
        const items = [
            ...audit.map((a) => {
                const u = users.find((x) => x.id === a.actor_user_id);
                return { id: a.id, kind: 'audit' as const, type: a.event_type, at: a.created_at, actor: u ? u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : a.actor_type === 'SYSTEM' ? 'System' : null, metadata: a.metadata };
            }),
            ...signature.map((s) => ({ id: s.id, kind: 'signature' as const, type: `signature.${s.type.toLowerCase()}`, at: s.occurred_at, actor: s.signer ? `${s.signer.name}` : 'System', metadata: { request_id: s.request_id } })),
        ].sort((a, b) => b.at.getTime() - a.at.getTime());
        return { data: items };
    }

    // --- Dashboard & renewals ------------------------------------------------------------

    async dashboard(ctx: OrgContext) {
        const base: Prisma.ContractWhereInput = { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx) };
        const now = today();
        const live: Prisma.ContractWhereInput = { ...base, status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING, ContractStatus.FULLY_SIGNED] } };
        const window = (days: number) => this.prisma.contract.count({ where: { ...live, end_date: { gte: now, lte: addDays(now, days) } } });
        const [byStatus, exp30, exp60, exp90, pendingSignature, overdueObligations, openObligations, value, recent, noticeSoon] = await Promise.all([
            this.prisma.contract.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
            window(30), window(60), window(90),
            this.prisma.signatureRequest.count({ where: { organization_id: ctx.organization_id, contract: base, status: { in: [SignatureRequestStatus.SENT, SignatureRequestStatus.DELIVERED, SignatureRequestStatus.VIEWED, SignatureRequestStatus.PARTIALLY_SIGNED] } } }),
            this.prisma.contractObligation.count({ where: { contract: base, status: { in: [ContractObligationStatus.OPEN, ContractObligationStatus.IN_PROGRESS, ContractObligationStatus.OVERDUE] }, due_date: { lt: now } } }),
            this.prisma.contractObligation.count({ where: { contract: base, status: { in: [ContractObligationStatus.OPEN, ContractObligationStatus.IN_PROGRESS] } } }),
            this.prisma.contract.aggregate({ where: live, _sum: { total_value: true, recurring_value: true } }),
            this.prisma.contract.findMany({ where: base, orderBy: { updated_at: 'desc' }, take: 8, include: LIST_INCLUDE }),
            this.prisma.contract.findMany({ where: { ...live, notice_deadline: { gte: now, lte: addDays(now, 45) } }, orderBy: { notice_deadline: 'asc' }, take: 8, include: LIST_INCLUDE }),
        ]);
        const confidential = ctx.can('contracts.confidential_terms.read');
        return {
            by_status: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
            total: byStatus.reduce((a, s) => a + s._count._all, 0),
            expiring: { within_30: exp30, within_60: exp60, within_90: exp90 },
            pending_signature: pendingSignature,
            obligations: { open: openObligations, overdue: overdueObligations },
            value: confidential ? { active_total: value._sum.total_value ?? 0, active_recurring: value._sum.recurring_value ?? 0 } : null,
            recent: recent.map((c) => stripConfidential(ctx, c)),
            notice_deadlines: noticeSoon.map((c) => stripConfidential(ctx, c)),
        };
    }

    async renewals(ctx: OrgContext, query: RenewalsQuery) {
        const now = today();
        const until = addDays(now, query.within_days);
        const inWindow = { gte: addDays(now, -30), lte: until };
        const where: Prisma.ContractWhereInput = {
            organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx),
            status: { in: [ContractStatus.ACTIVE, ContractStatus.EXPIRING, ContractStatus.FULLY_SIGNED] },
            OR: [{ end_date: inWindow }, { renewal_date: inWindow }, { notice_deadline: inWindow }, { expiration_date: inWindow }],
            ...(query.type_id && { type_id: query.type_id }),
            ...(query.renewal_type && { renewal_type: query.renewal_type }),
            ...(query.owner_membership_id && { owner_membership_id: query.owner_membership_id }),
            ...(query.search && { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { number: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.contract.findMany({
                where, ...skipTake(query), orderBy: [{ notice_deadline: 'asc' }, { end_date: 'asc' }],
                include: { ...LIST_INCLUDE, renewal_decisions: { orderBy: { decided_at: 'desc' }, take: 1 } },
            }),
            this.prisma.contract.count({ where }),
        ]);
        return paginate(items.map((c) => {
            const end = c.end_date ?? c.expiration_date;
            return { ...stripConfidential(ctx, c), days_to_end: end ? Math.round((end.getTime() - now.getTime()) / 86_400_000) : null, latest_decision: c.renewal_decisions[0] ?? null };
        }), total, query);
    }

    async renewalDecision(ctx: OrgContext, id: string, dto: RenewalDecisionDto) {
        const c = await this.assertContract(ctx, id);
        const row = await this.prisma.contractRenewalDecision.create({ data: { contract_id: id, decision: dto.decision, reason: dto.reason, decided_by_user_id: ctx.user_id } });
        await this.audit.record(ctx, 'contract.renewal_decided', { resource_type: 'contract', resource_id: id, metadata: { decision: dto.decision, reason: dto.reason } });
        this.events.publish(ctx, { event_key: 'contracts.contract.renewal_decided', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: c.number, decision: dto.decision, owner_membership_id: c.owner_membership_id } });
        return row;
    }

    /** 04 §46 — renewal contract (RENEWAL child) copying parties and the signed (or current) text. */
    async renew(ctx: OrgContext, id: string, dto: RenewContractDto) {
        const parent = await this.findOne(ctx, id);
        if (!([ContractStatus.ACTIVE, ContractStatus.EXPIRING, ContractStatus.FULLY_SIGNED, ContractStatus.EXPIRED] as ContractStatus[]).includes(parent.status)) {
            throw new ConflictException({ message: 'Only signed, active or expiring contracts can be renewed', code: 'contract_not_renewable' });
        }
        const term = dto.term_months ?? parent.renewal_term_months ?? 12;
        const start = dto.effective_date ? new Date(dto.effective_date) : parent.end_date ? addDays(parent.end_date, 1) : today();
        const end = addDays(addMonths(start, term), -1);
        const raw = await this.prisma.contract.findUniqueOrThrow({ where: { id } });
        const value = raw.total_value ? Number(raw.total_value) : undefined;
        const newValue = value === undefined ? undefined : dto.value_change_type === 'percent' ? value * (1 + (dto.value_change ?? 0) / 100) : dto.value_change_type === 'amount' ? value + (dto.value_change ?? 0) : value;
        const child = await this.create(ctx, {
            title: dto.title ?? `${parent.title} — renewal`,
            type_id: parent.type_id ?? undefined, primary_company_id: parent.primary_company_id ?? undefined, owner_membership_id: parent.owner_membership_id ?? undefined,
            branch_id: parent.branch_id ?? undefined, currency: parent.currency ?? undefined, language: parent.language,
            start_date: start.toISOString(), effective_date: start.toISOString(), end_date: end.toISOString(),
            renewal_type: parent.renewal_type, renewal_term_months: term, notice_days: parent.notice_days ?? undefined,
            total_value: newValue !== undefined ? Math.round(newValue * 100) / 100 : undefined,
            recurring_value: raw.recurring_value ? Number(raw.recurring_value) : undefined, billing_frequency: raw.billing_frequency ?? undefined, payment_terms: raw.payment_terms ?? undefined,
            project_ids: parent.projects.map((p) => p.project_id),
        }, {
            relation_kind: ContractRelationKind.RENEWAL, parent_contract_id: id,
            sections: await this.copySections(raw.signed_version_id ?? raw.current_version_id),
            parties: this.partiesToDto(parent.parties),
        });
        await this.prisma.contractRenewalDecision.create({ data: { contract_id: id, decision: ContractRenewalDecisionType.RENEW, reason: 'Renewal contract created', decided_by_user_id: ctx.user_id, resulting_contract_id: child.id } });
        await this.audit.record(ctx, 'contract.renewed', { resource_type: 'contract', resource_id: id, metadata: { renewal_contract_id: child.id, term_months: term } });
        this.events.publish(ctx, { event_key: 'contracts.contract.renewal_created', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: parent.number, renewal_contract_id: child.id, owner_membership_id: parent.owner_membership_id } });
        return child;
    }

    /** 04 §43–45 — amendment / change order / SOW child contract with the requested section changes applied. */
    async amend(ctx: OrgContext, id: string, dto: AmendContractDto) {
        const parent = await this.findOne(ctx, id);
        if (!([ContractStatus.ACTIVE, ContractStatus.EXPIRING, ContractStatus.FULLY_SIGNED] as ContractStatus[]).includes(parent.status)) {
            throw new ConflictException({ message: 'Only signed or active contracts can be amended. Edit the draft instead.', code: 'contract_not_amendable' });
        }
        const raw = await this.prisma.contract.findUniqueOrThrow({ where: { id } });
        let sections = await this.copySections(raw.signed_version_id ?? raw.current_version_id);
        for (const ch of dto.changes ?? []) {
            const idx = sections.findIndex((s) => s.key === ch.section_key);
            if (ch.action === 'remove') { if (idx >= 0) sections.splice(idx, 1); continue; }
            if (ch.action === 'replace' && idx >= 0) { sections[idx] = { ...sections[idx], title: ch.title ?? sections[idx].title, body: ch.text ?? '', clause_version_id: null }; continue; }
            sections.push({ key: ch.section_key, title: ch.title ?? ch.section_key, body: ch.text ?? '', sort_order: sections.length });
        }
        sections = sections.map((s, i) => ({ ...s, sort_order: i }));
        const seq = (await this.prisma.contract.count({ where: { parent_contract_id: id, relation_kind: dto.kind } })) + 1;
        const label = dto.kind === ContractRelationKind.AMENDMENT ? 'Amendment' : dto.kind === ContractRelationKind.CHANGE_ORDER ? 'Change order' : 'SOW';
        const child = await this.create(ctx, {
            title: dto.title ?? `${parent.title} — ${label} ${seq}`,
            type_id: parent.type_id ?? undefined, primary_company_id: parent.primary_company_id ?? undefined, owner_membership_id: parent.owner_membership_id ?? undefined,
            branch_id: parent.branch_id ?? undefined, currency: parent.currency ?? undefined, language: parent.language,
            effective_date: dto.effective_date, start_date: dto.effective_date, end_date: parent.end_date?.toISOString(),
            total_value: dto.value_delta !== undefined ? Math.max(0, dto.value_delta) : undefined,
            project_ids: parent.projects.map((p) => p.project_id),
        }, { relation_kind: dto.kind, parent_contract_id: id, relation_sequence: seq, sections, parties: this.partiesToDto(parent.parties) });
        await this.audit.record(ctx, 'contract.amended', { resource_type: 'contract', resource_id: id, metadata: { child_contract_id: child.id, kind: dto.kind, reason: dto.reason, changes: dto.changes?.length ?? 0, value_delta: dto.value_delta } });
        this.events.publish(ctx, { event_key: 'contracts.contract.amendment_created', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id, payload: { number: parent.number, child_contract_id: child.id, kind: dto.kind, owner_membership_id: parent.owner_membership_id } });
        return child;
    }

    /** 04 §53 — termination record; never alters the signed document. */
    async terminate(ctx: OrgContext, id: string, dto: TerminateContractDto) {
        const c = await this.assertContract(ctx, id);
        if (TERMINAL.includes(c.status)) throw new ConflictException({ message: 'This contract is already closed', code: 'contract_closed' });
        const existing = await this.prisma.contractTermination.findUnique({ where: { contract_id: id } });
        if (existing) throw new ConflictException({ message: 'A termination is already recorded', code: 'termination_exists' });
        if (dto.requesting_party_id) {
            const p = await this.prisma.contractParty.findFirst({ where: { id: dto.requesting_party_id, contract_id: id } });
            if (!p) throw new BadRequestException({ message: 'Requesting party is not a party of this contract', code: 'party_not_found' });
        }
        const effective = new Date(dto.effective_date);
        const immediate = effective.getTime() <= today().getTime();
        const close = dto.close_obligations ?? 'keep';
        await this.prisma.$transaction(async (tx) => {
            await tx.contractTermination.create({
                data: {
                    contract_id: id, type: dto.type, reason: dto.reason, requesting_party_id: dto.requesting_party_id, notice_date: toDate(dto.notice_date), effective_date: effective,
                    notes: dto.notes, approved_by_user_id: ctx.user_id, approved_at: new Date(), created_by_user_id: ctx.user_id, impact: { obligations: close } as Prisma.InputJsonValue,
                },
            });
            await tx.contract.update({ where: { id }, data: { termination_date: effective, ...(immediate ? { status: ContractStatus.TERMINATED, closed_at: new Date() } : {}) } });
            if (close !== 'keep') {
                await tx.contractObligation.updateMany({
                    where: { contract_id: id, status: { in: [ContractObligationStatus.OPEN, ContractObligationStatus.IN_PROGRESS, ContractObligationStatus.OVERDUE] } },
                    data: { status: close === 'waive' ? ContractObligationStatus.WAIVED : ContractObligationStatus.CANCELLED },
                });
            }
            // Cancel any signing still in progress.
            await tx.signatureRequest.updateMany({
                where: { contract_id: id, status: { in: [SignatureRequestStatus.NOT_SENT, SignatureRequestStatus.SENT, SignatureRequestStatus.DELIVERED, SignatureRequestStatus.VIEWED, SignatureRequestStatus.PARTIALLY_SIGNED] } },
                data: { status: SignatureRequestStatus.CANCELLED, cancelled_at: new Date(), cancel_reason: 'Contract terminated' },
            });
        });
        await this.audit.record(ctx, 'contract.terminated', { resource_type: 'contract', resource_id: id, branch_id: c.branch_id, metadata: { type: dto.type, effective_date: dto.effective_date, reason: dto.reason, close_obligations: close } });
        this.events.publish(ctx, {
            event_key: 'contracts.contract.terminated', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: id,
            payload: { number: c.number, title: c.title, type: dto.type, effective_date: dto.effective_date, owner_membership_id: c.owner_membership_id },
            activity: { summary: `Contract ${c.number} terminated`, entity_label: c.title, company_id: c.primary_company_id, branch_id: c.branch_id },
        });
        return this.findOne(ctx, id);
    }

    // --- Pickers (minimal fields only; used by contract forms) ------------------------------

    async lookup(ctx: OrgContext, kind: 'members' | 'companies' | 'contacts' | 'projects', search?: string, companyId?: string) {
        const org = ctx.organization_id;
        const q = search?.trim();
        const take = 20;
        if (kind === 'members') {
            const rows = await this.prisma.membership.findMany({
                where: {
                    organization_id: org, status: 'ACTIVE',
                    ...(q && { user: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { display_name: { contains: q, mode: 'insensitive' } }, { first_name: { contains: q, mode: 'insensitive' } }, { last_name: { contains: q, mode: 'insensitive' } }] } }),
                },
                take, select: MEMBER_SELECT, orderBy: { joined_at: 'asc' },
            });
            return { data: rows.map((m) => ({ id: m.id, label: m.user ? m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email : 'Member', email: m.user?.email ?? null, sub: m.job_title })) };
        }
        if (kind === 'companies') {
            const rows = await this.prisma.crmCompany.findMany({ where: { organization_id: org, archived_at: null, ...(q && { name: { contains: q, mode: 'insensitive' } }) }, take, orderBy: { name: 'asc' }, select: { id: true, name: true, legal_name: true, currency: true } });
            return { data: rows.map((c) => ({ id: c.id, label: c.name, sub: c.legal_name, currency: c.currency })) };
        }
        if (kind === 'contacts') {
            const rows = await this.prisma.crmContact.findMany({
                where: { organization_id: org, archived_at: null, ...(companyId && { company_id: companyId }), ...(q && { OR: [{ first_name: { contains: q, mode: 'insensitive' } }, { last_name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }) },
                take, orderBy: { first_name: 'asc' }, select: { id: true, first_name: true, last_name: true, email: true, company_id: true },
            });
            return { data: rows.map((c) => ({ id: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(' '), email: c.email, company_id: c.company_id })) };
        }
        const rows = await this.prisma.project.findMany({ where: { organization_id: org, archived_at: null, ...(q && { name: { contains: q, mode: 'insensitive' } }) }, take, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } });
        return { data: rows.map((p) => ({ id: p.id, label: p.name, sub: p.code })) };
    }

    // --- Helpers --------------------------------------------------------------------------

    async copySections(versionId: string | null): Promise<SectionSeed[]> {
        if (!versionId) return DEFAULT_SECTIONS;
        const rows = await this.prisma.contractSection.findMany({ where: { version_id: versionId }, orderBy: { sort_order: 'asc' } });
        return rows.map((s) => ({ key: s.key, title: s.title, body: s.body, clause_version_id: s.clause_version_id, is_appendix: s.is_appendix, sort_order: s.sort_order }));
    }

    private partiesToDto(parties: { party_type: ContractPartyType; company_id: string | null; legal_name: string; address: Prisma.JsonValue; registration_number: string | null; vat_number: string | null; signatories: { membership_id: string | null; contact_id: string | null; name: string; title: string | null; email: string; phone: string | null; is_required: boolean }[] }[]): PartyDto[] {
        return parties.map((p) => ({
            party_type: p.party_type, company_id: p.company_id ?? undefined, legal_name: p.legal_name, address: (p.address as Record<string, unknown>) ?? undefined,
            registration_number: p.registration_number ?? undefined, vat_number: p.vat_number ?? undefined,
            signatories: p.signatories.map((s) => ({ membership_id: s.membership_id ?? undefined, contact_id: s.contact_id ?? undefined, name: s.name, title: s.title ?? undefined, email: s.email, phone: s.phone ?? undefined, is_required: s.is_required })),
        }));
    }

    private async sectionsFromTemplate(ctx: OrgContext, raw: Prisma.JsonValue): Promise<SectionSeed[]> {
        const list = (Array.isArray(raw) ? raw : []) as { key: string; title: string; body?: string; clause_key?: string; is_appendix?: boolean; sort_order?: number }[];
        const keys = list.map((s) => s.clause_key).filter(Boolean) as string[];
        const clauses = keys.length
            ? await this.prisma.contractClause.findMany({ where: { organization_id: ctx.organization_id, key: { in: keys } }, include: { current_version: true } })
            : [];
        return list.map((s, i) => {
            const clause = s.clause_key ? clauses.find((c) => c.key === s.clause_key) : undefined;
            return {
                key: s.key, title: s.title,
                body: s.body && s.body.trim() ? s.body : clause?.current_version?.text ?? '',
                clause_version_id: clause?.current_version?.id ?? null,
                is_appendix: !!s.is_appendix, sort_order: s.sort_order ?? i,
            };
        });
    }

    /** Contract text from an accepted proposal version (03 → 04): customer-visible sections only. */
    private async sectionsFromProposal(ctx: OrgContext, proposalVersionId?: string): Promise<SectionSeed[] | null> {
        if (!proposalVersionId) return null;
        const v = await this.prisma.proposalVersion.findFirst({
            where: { id: proposalVersionId, proposal: { organization_id: ctx.organization_id } },
            include: { sections: { where: { is_internal: false }, orderBy: { sort_order: 'asc' } } },
        });
        if (!v) throw new NotFoundException({ message: 'Proposal version not found', code: 'proposal_version_not_found' });
        const fromProposal = v.sections
            .filter((s) => !['COVER', 'SIGNATURE', 'PRICING', 'PAYMENT_SCHEDULE'].includes(s.type))
            .map((s, i) => ({ key: `${s.type.toLowerCase()}_${i}`, title: s.title, body: s.body, sort_order: i + 1 }));
        return [
            DEFAULT_SECTIONS[0],
            ...fromProposal,
            { key: 'fees', title: 'Fees and payment', body: `Total ${v.gross_total.toString()} as accepted in the proposal. ${v.payment_terms ?? ''}`.trim(), sort_order: fromProposal.length + 1 },
            { ...DEFAULT_SECTIONS[3], sort_order: fromProposal.length + 2 },
            { ...DEFAULT_SECTIONS[5], sort_order: fromProposal.length + 3 },
        ];
    }

    private async writeParties(tx: Prisma.TransactionClient, contractId: string, parties: PartyDto[]) {
        for (const [i, p] of parties.entries()) {
            await tx.contractParty.create({
                data: {
                    contract_id: contractId, party_type: p.party_type, company_id: p.company_id, legal_name: p.legal_name, address: p.address as Prisma.InputJsonValue,
                    registration_number: p.registration_number, vat_number: p.vat_number, sort_order: i,
                    signatories: { create: (p.signatories ?? []).map((s, j) => ({ membership_id: s.membership_id, contact_id: s.contact_id, name: s.name, title: s.title, email: s.email.toLowerCase(), phone: s.phone, is_required: s.is_required ?? true, sort_order: j })) },
                },
            });
        }
    }

    private noticeDeadline(endDate: string | undefined, noticeDays: number | undefined) {
        if (!endDate || noticeDays === undefined || noticeDays === null) return undefined;
        return addDays(new Date(endDate), -noticeDays);
    }

    private async assertPartyRefs(ctx: OrgContext, parties: PartyDto[]) {
        const companyIds = parties.map((p) => p.company_id).filter(Boolean) as string[];
        const memberIds = parties.flatMap((p) => p.signatories ?? []).map((s) => s.membership_id).filter(Boolean) as string[];
        const contactIds = parties.flatMap((p) => p.signatories ?? []).map((s) => s.contact_id).filter(Boolean) as string[];
        const [companies, members, contacts] = await Promise.all([
            companyIds.length ? this.prisma.crmCompany.count({ where: { id: { in: companyIds }, organization_id: ctx.organization_id } }) : 0,
            memberIds.length ? this.prisma.membership.count({ where: { id: { in: memberIds }, organization_id: ctx.organization_id } }) : 0,
            contactIds.length ? this.prisma.crmContact.count({ where: { id: { in: contactIds }, organization_id: ctx.organization_id } }) : 0,
        ]);
        if (companies !== new Set(companyIds).size || members !== new Set(memberIds).size || contacts !== new Set(contactIds).size) {
            throw new NotFoundException({ message: 'A party company, member or contact was not found', code: 'reference_not_found' });
        }
    }

    private async assertRefs(ctx: OrgContext, dto: Partial<CreateContractDto>) {
        const org = ctx.organization_id;
        const checks: [string, Promise<unknown>][] = [];
        if (dto.type_id) checks.push(['contract type', this.prisma.contractType.findFirst({ where: { id: dto.type_id, organization_id: org } })]);
        if (dto.primary_company_id) checks.push(['company', this.prisma.crmCompany.findFirst({ where: { id: dto.primary_company_id, organization_id: org } })]);
        if (dto.owner_membership_id) checks.push(['owner', this.prisma.membership.findFirst({ where: { id: dto.owner_membership_id, organization_id: org } })]);
        if (dto.branch_id) checks.push(['branch', this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: org } })]);
        if (dto.proposal_id) checks.push(['proposal', this.prisma.proposal.findFirst({ where: { id: dto.proposal_id, organization_id: org } })]);
        for (const p of dto.project_ids ?? []) checks.push(['project', this.prisma.project.findFirst({ where: { id: p, organization_id: org } })]);
        const results = await Promise.all(checks.map((c) => c[1]));
        const missing = checks.filter((_, i) => !results[i]).map((c) => c[0]);
        if (missing.length) throw new NotFoundException({ message: `Not found: ${[...new Set(missing)].join(', ')}`, code: 'reference_not_found' });
        if (dto.parties) await this.assertPartyRefs(ctx, dto.parties);
    }
}
