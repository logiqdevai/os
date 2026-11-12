import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ProposalEventType, ProposalStatus, ProposalVersionStatus, ProposalSectionType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { CreateProposalDto, CreateVersionDto, MarkLostDto, SaveProposalContentDto, UpdateProposalDto } from './dto/proposal.dto';
import { LookupQuery, ProposalQuery } from './dto/proposal-query.schema';
import { computeLine, computeTotals, num, revokeAccessTokens } from './utils/proposal.utils';

export const PROPOSAL_READ = 'proposals.proposals.read';
export const INTERNAL_COMMENTS = 'proposals.comments.internal.read';

/** Statuses in which the customer currently holds a live sent version. */
export const LIVE_STATUSES: ProposalStatus[] = [ProposalStatus.SENT, ProposalStatus.VIEWED, ProposalStatus.CHANGES_REQUESTED];
/** Statuses that end the proposal lifecycle. */
export const CLOSED_STATUSES: ProposalStatus[] = [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED, ProposalStatus.CANCELLED];

export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} satisfies Prisma.MembershipSelect;

const LIST_INCLUDE = {
    company: { select: { id: true, name: true } },
    contact: { select: { id: true, first_name: true, last_name: true, email: true } },
    deal: { select: { id: true, name: true } },
    owner: { select: MEMBER_SELECT },
    current_version: { select: { id: true, version_number: true, status: true } },
    sent_version: { select: { id: true, version_number: true } },
} satisfies Prisma.ProposalInclude;

const DEFAULT_SECTIONS: { type: ProposalSectionType; title: string; body: string }[] = [
    { type: ProposalSectionType.COVER, title: 'Cover', body: '# {{proposal.title}}\n\nPrepared for {{contact.name}}, {{company.name}}.' },
    { type: ProposalSectionType.EXECUTIVE_SUMMARY, title: 'Executive summary', body: '' },
    { type: ProposalSectionType.SCOPE, title: 'Scope of work', body: '' },
    { type: ProposalSectionType.PRICING, title: 'Investment', body: '' },
    { type: ProposalSectionType.TERMS, title: 'Terms & conditions', body: '' },
];

type Tx = Prisma.TransactionClient;

/**
 * 03 Proposals — the proposal record, its versions and their content (sections, line items, payment schedule).
 * Totals are always computed here, never taken from the client. Sent versions are immutable.
 * REST (ProposalsController) and MCP (ProposalsMcp) call these same methods.
 */
@Injectable()
export class ProposalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly numbering: NumberingService,
    ) { }

    // --- Scope ---------------------------------------------------------------------------------

    /** Organization-wide sees all; otherwise own proposals plus the caller's branches, customers, projects and explicit resources. */
    scopeWhere(ctx: OrgContext, key = PROPOSAL_READ): Prisma.ProposalWhereInput {
        const scope = ctx.scopeOf(key);
        if (!scope || scope.organization) return {};
        const or: Prisma.ProposalWhereInput[] = [];
        if (ctx.membership_id) or.push({ owner_membership_id: ctx.membership_id });
        if (scope.branch_ids.length) or.push({ branch_id: { in: scope.branch_ids } });
        if (scope.customer_ids.length) or.push({ company_id: { in: scope.customer_ids } });
        if (scope.project_ids.length) or.push({ project_id: { in: scope.project_ids } });
        if (scope.resource_ids.length) or.push({ id: { in: scope.resource_ids } });
        return or.length ? { OR: or } : { id: '00000000-0000-0000-0000-000000000000' };
    }

    /** One proposal inside the caller's scope for `key`; 404 when outside (never leak existence). */
    async getRecord(ctx: OrgContext, id: string, key = PROPOSAL_READ) {
        const p = await this.prisma.proposal.findFirst({ where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx, key) } });
        if (!p) throw new NotFoundException({ message: 'Proposal not found', code: 'proposal_not_found' });
        return p;
    }

    async getVersion(proposalId: string, versionId: string) {
        const v = await this.prisma.proposalVersion.findFirst({ where: { id: versionId, proposal_id: proposalId } });
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });
        return v;
    }

    // --- Reads ---------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: ProposalQuery) {
        await this.expireOverdue(ctx.organization_id);
        const now = new Date();
        const where: Prisma.ProposalWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.scopeWhere(ctx)],
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.owner === 'me' && { owner_membership_id: ctx.membership_id ?? '—' }),
            ...(query.owner_membership_id && { owner_membership_id: query.owner_membership_id }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.deal_id && { deal_id: query.deal_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.expiring_within_days && {
                status: { in: LIVE_STATUSES },
                valid_until: { gte: now, lte: new Date(now.getTime() + query.expiring_within_days * 86_400_000) },
            }),
            ...(query.search && {
                OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { number: { contains: query.search, mode: 'insensitive' } },
                    { company: { name: { contains: query.search, mode: 'insensitive' } } },
                    { contact: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }] } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.proposal.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'updated_at', 'number', 'title', 'gross_total', 'valid_until', 'sent_at', 'status'], 'created_at'),
                include: LIST_INCLUDE,
            }),
            this.prisma.proposal.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    /** KPI strip for the list (scoped like the list). */
    async summary(ctx: OrgContext) {
        await this.expireOverdue(ctx.organization_id);
        const base: Prisma.ProposalWhereInput = { organization_id: ctx.organization_id, archived_at: null, ...this.scopeWhere(ctx) };
        const now = new Date();
        const d90 = new Date(now.getTime() - 90 * 86_400_000);
        const [open, accepted90, decided, awaiting, expiring, drafts] = await Promise.all([
            this.prisma.proposal.aggregate({ where: { ...base, status: { in: LIVE_STATUSES } }, _sum: { gross_total: true }, _count: true }),
            this.prisma.proposal.aggregate({ where: { ...base, status: ProposalStatus.ACCEPTED, accepted_at: { gte: d90 } }, _sum: { gross_total: true }, _count: true }),
            this.prisma.proposal.groupBy({ by: ['status'], where: { ...base, status: { in: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.EXPIRED] } }, _count: true }),
            this.prisma.proposal.count({ where: { ...base, status: ProposalStatus.PENDING_APPROVAL } }),
            this.prisma.proposal.count({ where: { ...base, status: { in: LIVE_STATUSES }, valid_until: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } } }),
            this.prisma.proposal.count({ where: { ...base, status: ProposalStatus.DRAFT } }),
        ]);
        const acceptedCount = decided.find((d) => d.status === ProposalStatus.ACCEPTED)?._count ?? 0;
        const decidedCount = decided.reduce((a, d) => a + d._count, 0);
        return {
            open_value: num(open._sum.gross_total),
            open_count: open._count,
            accepted_90d_value: num(accepted90._sum.gross_total),
            accepted_90d_count: accepted90._count,
            win_rate: decidedCount ? Math.round((acceptedCount / decidedCount) * 1000) / 10 : null,
            awaiting_approval: awaiting,
            expiring_7d: expiring,
            drafts,
        };
    }

    async findOne(ctx: OrgContext, id: string, versionId?: string) {
        await this.getRecord(ctx, id);
        const canInternal = ctx.can(INTERNAL_COMMENTS);
        const proposal = await this.prisma.proposal.findUniqueOrThrow({
            where: { id },
            include: {
                ...LIST_INCLUDE,
                branch: { select: { id: true, name: true } },
                template: { select: { id: true, name: true, version: true } },
                versions: {
                    orderBy: { version_number: 'desc' },
                    select: { id: true, version_number: true, status: true, change_summary: true, gross_total: true, created_at: true, sent_at: true, locked_at: true, content_hash: true, created_by_user_id: true, is_ai_generated: true },
                },
            },
        });
        const vid = versionId ?? proposal.current_version_id;
        const version = vid
            ? await this.prisma.proposalVersion.findFirst({
                where: { id: vid, proposal_id: id },
                include: {
                    sections: { where: canInternal ? {} : { is_internal: false }, orderBy: { sort_order: 'asc' } },
                    line_items: { orderBy: { sort_order: 'asc' } },
                    payment_schedule: { orderBy: { sort_order: 'asc' } },
                    approvals: { orderBy: [{ step: 'asc' }, { requested_at: 'asc' }], include: { approver: { select: MEMBER_SELECT } } },
                },
            })
            : null;
        if (versionId && !version) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });
        const optional_total = version ? computeTotals(version.line_items.map((l) => ({ is_optional: l.is_optional, is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, selected_by_customer: l.selected_by_customer, quantity: num(l.quantity), unit_price: num(l.unit_price), discount_percent: num(l.discount_percent), discount_amount: num(l.discount_amount), tax_percent: num(l.tax_percent) }))).optional_total : 0;
        return { ...proposal, version: version ? { ...version, optional_total, editable: version.status === ProposalVersionStatus.DRAFT } : null };
    }

    /** ProposalEvent + ProposalDelivery timeline. Customer IP / user agent are personal data: only returned to readers of the proposal. */
    async activity(ctx: OrgContext, id: string) {
        await this.getRecord(ctx, id);
        const [events, deliveries] = await Promise.all([
            this.prisma.proposalEvent.findMany({ where: { proposal_id: id }, orderBy: { created_at: 'desc' }, take: 200, include: { version: { select: { version_number: true } } } }),
            this.prisma.proposalDelivery.findMany({ where: { proposal_id: id }, orderBy: { created_at: 'desc' }, include: { version: { select: { version_number: true } }, recipient: { select: { id: true, first_name: true, last_name: true } } } }),
        ]);
        return { events, deliveries };
    }

    /** Section / line / schedule / totals diff between two versions of the same proposal. */
    async compare(ctx: OrgContext, id: string, fromId: string, toId: string) {
        await this.getRecord(ctx, id);
        const canInternal = ctx.can(INTERNAL_COMMENTS);
        const load = (vid: string) => this.prisma.proposalVersion.findFirst({
            where: { id: vid, proposal_id: id },
            include: { sections: { where: canInternal ? {} : { is_internal: false }, orderBy: { sort_order: 'asc' } }, line_items: { orderBy: { sort_order: 'asc' } }, payment_schedule: { orderBy: { sort_order: 'asc' } } },
        });
        const [from, to] = await Promise.all([load(fromId), load(toId)]);
        if (!from || !to) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });

        const key = (s: { type: string; title: string }) => `${s.type}:${s.title.trim().toLowerCase()}`;
        const fromSections = new Map(from.sections.map((s) => [key(s), s]));
        const toSections = new Map(to.sections.map((s) => [key(s), s]));
        const sections = [
            ...to.sections.map((s) => {
                const before = fromSections.get(key(s));
                return { type: s.type, title: s.title, status: !before ? 'added' : (before.body ?? '') === (s.body ?? '') ? 'same' : 'changed', from: before?.body ?? null, to: s.body };
            }),
            ...from.sections.filter((s) => !toSections.has(key(s))).map((s) => ({ type: s.type, title: s.title, status: 'removed', from: s.body, to: null })),
        ];
        const lineKey = (l: { name: string }) => l.name.trim().toLowerCase();
        const fromLines = new Map(from.line_items.map((l) => [lineKey(l), l]));
        const toLines = new Map(to.line_items.map((l) => [lineKey(l), l]));
        const lineSig = (l: (typeof from.line_items)[number]) => [num(l.quantity), num(l.unit_price), num(l.discount_percent), num(l.discount_amount), num(l.tax_percent), l.is_optional, l.is_recurring].join('|');
        const line_items = [
            ...to.line_items.map((l) => {
                const before = fromLines.get(lineKey(l));
                return { name: l.name, status: !before ? 'added' : lineSig(before) === lineSig(l) ? 'same' : 'changed', from: before ? { quantity: before.quantity, unit_price: before.unit_price, net_amount: before.net_amount } : null, to: { quantity: l.quantity, unit_price: l.unit_price, net_amount: l.net_amount } };
            }),
            ...from.line_items.filter((l) => !toLines.has(lineKey(l))).map((l) => ({ name: l.name, status: 'removed', from: { quantity: l.quantity, unit_price: l.unit_price, net_amount: l.net_amount }, to: null })),
        ];
        const totals = (v: typeof from) => ({ net_total: v.net_total, discount_total: v.discount_total, tax_total: v.tax_total, gross_total: v.gross_total, recurring_monthly: v.recurring_monthly });
        return {
            from: { id: from.id, version_number: from.version_number, status: from.status },
            to: { id: to.id, version_number: to.version_number, status: to.status },
            sections,
            line_items,
            payment_schedule: { from: from.payment_schedule, to: to.payment_schedule },
            payment_terms: { from: from.payment_terms, to: to.payment_terms },
            totals: { from: totals(from), to: totals(to) },
        };
    }

    // --- Writes --------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateProposalDto, source: 'blank' | 'template' | 'duplicate' | 'deal' = 'blank') {
        const refs = await this.assertRefs(ctx, dto);
        const template = dto.template_id
            ? await this.prisma.proposalTemplate.findFirst({ where: { id: dto.template_id, organization_id: ctx.organization_id, archived_at: null } })
            : null;
        if (dto.template_id && !template) throw new NotFoundException({ message: 'Template not found', code: 'proposal_template_not_found' });

        const defaults = (template?.defaults ?? {}) as { payment_terms?: string; line_items?: unknown[]; payment_schedule?: unknown[] };
        const content: SaveProposalContentDto = {
            payment_terms: defaults.payment_terms ?? null,
            validity_days: template?.default_validity_days ?? 30,
            ...(template
                ? {
                    sections: ((template.sections ?? []) as { type: ProposalSectionType; title: string; body_template?: string }[]).map((s) => ({ type: s.type, title: s.title, body: s.body_template ?? '' })),
                    line_items: (defaults.line_items ?? []) as SaveProposalContentDto['line_items'],
                    payment_schedule: (defaults.payment_schedule ?? []) as SaveProposalContentDto['payment_schedule'],
                }
                : { sections: DEFAULT_SECTIONS }),
            ...(dto.content ?? {}),
        };
        const currency = (dto.currency ?? refs.dealCurrency ?? refs.companyCurrency ?? 'EUR').toUpperCase();
        const effectiveSource = template ? 'template' : dto.deal_id && source === 'blank' ? 'deal' : source;

        const proposal = await this.prisma.$transaction(async (tx) => {
            const number = await this.numbering.next(tx, ctx.organization_id, 'proposal');
            const p = await tx.proposal.create({
                data: {
                    organization_id: ctx.organization_id,
                    number,
                    title: dto.title,
                    currency,
                    language: dto.language ?? template?.language ?? 'en',
                    company_id: dto.company_id ?? refs.dealCompanyId ?? null,
                    contact_id: dto.contact_id ?? null,
                    deal_id: dto.deal_id ?? null,
                    project_id: dto.project_id ?? null,
                    owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                    branch_id: dto.branch_id ?? null,
                    template_id: template?.id ?? null,
                    requires_contract: dto.requires_contract ?? false,
                    created_by_user_id: ctx.user_id,
                },
            });
            const v = await tx.proposalVersion.create({
                data: { proposal_id: p.id, version_number: 1, template_version: template?.version ?? null, created_by_user_id: ctx.user_id, change_summary: 'First draft' },
            });
            await this.writeContent(tx, p.id, v.id, content, true);
            await tx.proposal.update({ where: { id: p.id }, data: { current_version_id: v.id } });
            await tx.proposalEvent.createMany({
                data: [
                    { proposal_id: p.id, version_id: v.id, type: ProposalEventType.CREATED, actor_user_id: ctx.user_id, metadata: { source: effectiveSource } },
                    { proposal_id: p.id, version_id: v.id, type: ProposalEventType.VERSION_CREATED, actor_user_id: ctx.user_id, metadata: { version_number: 1 } },
                ],
            });
            await this.audit.record(ctx, 'proposal.created', { resource_type: 'proposal', resource_id: p.id, branch_id: p.branch_id, metadata: { after: { number, title: dto.title, source: effectiveSource, template_id: template?.id ?? null } } }, tx);
            return tx.proposal.findUniqueOrThrow({ where: { id: p.id } });
        });
        this.events.publish(ctx, {
            event_key: 'proposals.proposal.created',
            module: ModuleKey.PROPOSALS,
            entity_kind: 'proposal',
            entity_id: proposal.id,
            payload: { number: proposal.number, title: proposal.title, owner_membership_id: proposal.owner_membership_id, company_id: proposal.company_id, deal_id: proposal.deal_id },
            activity: { summary: `Proposal ${proposal.number} created`, entity_label: proposal.title, company_id: proposal.company_id, branch_id: proposal.branch_id, project_id: proposal.project_id },
        });
        return proposal;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateProposalDto) {
        const before = await this.getRecord(ctx, id, 'proposals.proposals.update');
        if (CLOSED_STATUSES.includes(before.status)) throw new ConflictException({ message: `A ${before.status.toLowerCase()} proposal cannot be edited`, code: 'proposal_closed' });
        await this.assertRefs(ctx, dto);
        const { content: _content, template_id: _template, ...fields } = dto;
        void _content; void _template;
        const data: Prisma.ProposalUncheckedUpdateInput = {
            ...fields,
            ...(fields.currency && { currency: fields.currency.toUpperCase() }),
            ...(dto.valid_until !== undefined && { valid_until: dto.valid_until ? new Date(dto.valid_until) : null }),
        };
        if (fields.currency && before.sent_version_id && fields.currency.toUpperCase() !== before.currency) {
            throw new ConflictException({ message: 'The currency of a sent proposal cannot change; create a new proposal', code: 'proposal_currency_locked' });
        }
        const p = await this.prisma.proposal.update({ where: { id }, data });
        await this.audit.record(ctx, 'proposal.updated', {
            resource_type: 'proposal', resource_id: id, branch_id: p.branch_id,
            metadata: { before: Object.fromEntries(Object.keys(fields).map((k) => [k, (before as Record<string, unknown>)[k]])), after: fields },
        });
        this.events.publish(ctx, { event_key: 'proposals.proposal.updated', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: p.number, owner_membership_id: p.owner_membership_id }, changes: fields as Record<string, unknown> });
        return p;
    }

    /** Replace the content of a DRAFT version and recompute totals. */
    async saveContent(ctx: OrgContext, id: string, versionId: string, dto: SaveProposalContentDto) {
        const proposal = await this.getRecord(ctx, id, 'proposals.proposals.update');
        if (CLOSED_STATUSES.includes(proposal.status)) throw new ConflictException({ message: 'This proposal is closed', code: 'proposal_closed' });
        const version = await this.getVersion(id, versionId);
        if (version.status !== ProposalVersionStatus.DRAFT) {
            throw new ConflictException({ message: `Version ${version.version_number} is ${version.status.toLowerCase().replace('_', ' ')} and cannot be edited. Create a new version.`, code: 'proposal_version_locked' });
        }
        const totals = await this.prisma.$transaction(async (tx) => {
            const t = await this.writeContent(tx, id, versionId, dto, false);
            await this.audit.record(ctx, 'proposal.version.updated', {
                resource_type: 'proposal', resource_id: id,
                metadata: { version_id: versionId, version_number: version.version_number, parts: Object.keys(dto), gross_total: t?.gross_total },
            }, tx);
            return t;
        });
        this.events.publish(ctx, { event_key: 'proposals.proposal.content_updated', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { version_id: versionId, owner_membership_id: proposal.owner_membership_id, gross_total: totals?.gross_total } });
        return this.findOne(ctx, id, versionId);
    }

    /**
     * Writes sections / line items / schedule of a version (each part only when provided) and refreshes the
     * version totals plus the proposal snapshot when it is the current version.
     */
    async writeContent(tx: Tx, proposalId: string, versionId: string, dto: SaveProposalContentDto, fresh: boolean) {
        if (dto.sections) {
            const existing = fresh ? [] : await tx.proposalSection.findMany({ where: { version_id: versionId }, select: { id: true } });
            const existingIds = new Set(existing.map((s) => s.id));
            const keep = dto.sections.filter((s) => s.id && existingIds.has(s.id)).map((s) => s.id as string);
            await tx.proposalSection.deleteMany({ where: { version_id: versionId, id: { notIn: keep } } });
            for (const [i, s] of dto.sections.entries()) {
                const data = { type: s.type, title: s.title, body: s.body ?? null, is_internal: s.is_internal ?? false, is_ai_generated: s.is_ai_generated ?? false, sort_order: i };
                if (s.id && existingIds.has(s.id)) await tx.proposalSection.update({ where: { id: s.id }, data });
                else await tx.proposalSection.create({ data: { ...data, version_id: versionId } });
            }
        }
        if (dto.line_items) {
            await tx.proposalLineItem.deleteMany({ where: { version_id: versionId } });
            if (dto.line_items.length) {
                await tx.proposalLineItem.createMany({
                    data: dto.line_items.map((l, i) => {
                        const a = computeLine(l);
                        return {
                            version_id: versionId,
                            product_id: l.product_id ?? null,
                            group_name: l.group_name || null,
                            name: l.name,
                            description: l.description ?? null,
                            quantity: l.quantity,
                            unit: l.unit ?? null,
                            unit_price: l.unit_price,
                            discount_percent: l.discount_percent ?? null,
                            discount_amount: a.discount_amount,
                            tax_percent: l.tax_percent ?? null,
                            net_amount: a.net_amount,
                            tax_amount: a.tax_amount,
                            gross_amount: a.gross_amount,
                            is_recurring: l.is_recurring ?? false,
                            billing_frequency: l.is_recurring ? (l.billing_frequency ?? 'monthly') : null,
                            is_optional: l.is_optional ?? false,
                            sort_order: i,
                        };
                    }),
                });
            }
        }
        if (dto.payment_schedule) {
            for (const p of dto.payment_schedule) {
                if (p.percentage != null && p.amount != null) throw new BadRequestException({ message: `Payment "${p.name}": use a percentage or a fixed amount, not both`, code: 'payment_share_ambiguous' });
            }
            await tx.proposalPaymentScheduleItem.deleteMany({ where: { version_id: versionId } });
            if (dto.payment_schedule.length) {
                await tx.proposalPaymentScheduleItem.createMany({
                    data: dto.payment_schedule.map((p, i) => ({
                        version_id: versionId, name: p.name, trigger: p.trigger, percentage: p.percentage ?? null, amount: p.amount ?? null,
                        due_date: p.due_date ? new Date(p.due_date) : null, milestone_name: p.milestone_name ?? null, frequency: p.frequency ?? null, sort_order: i,
                    })),
                });
            }
        }
        const versionData: Prisma.ProposalVersionUpdateInput = {};
        if (dto.payment_terms !== undefined) versionData.payment_terms = dto.payment_terms;
        if (dto.validity_days !== undefined) versionData.validity_days = dto.validity_days;
        if (dto.change_summary !== undefined) versionData.change_summary = dto.change_summary;
        if (Object.keys(versionData).length) await tx.proposalVersion.update({ where: { id: versionId }, data: versionData });
        return this.refreshTotals(tx, proposalId, versionId);
    }

    /** Recompute version totals from its line items; mirror on the proposal when it is the current/sent version. */
    async refreshTotals(tx: Tx, proposalId: string, versionId: string) {
        const lines = await tx.proposalLineItem.findMany({ where: { version_id: versionId } });
        const t = computeTotals(lines.map((l) => ({ is_optional: l.is_optional, is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, selected_by_customer: l.selected_by_customer, quantity: num(l.quantity), unit_price: num(l.unit_price), discount_percent: num(l.discount_percent), discount_amount: num(l.discount_amount), tax_percent: num(l.tax_percent) })));
        const { optional_total: _o, ...stored } = t;
        void _o;
        await tx.proposalVersion.update({ where: { id: versionId }, data: stored });
        const p = await tx.proposal.findUniqueOrThrow({ where: { id: proposalId }, select: { current_version_id: true, sent_version_id: true, status: true } });
        // The list snapshot follows the version the customer sees while the proposal is live, otherwise the working version.
        const mirror = LIVE_STATUSES.includes(p.status) || p.status === ProposalStatus.ACCEPTED ? p.sent_version_id : p.current_version_id;
        if (mirror === versionId) await tx.proposal.update({ where: { id: proposalId }, data: stored });
        return t;
    }

    /** New DRAFT version copied from `from_version_id` (restore) or the current version. Older unsent working versions are superseded. */
    async createVersion(ctx: OrgContext, id: string, dto: CreateVersionDto) {
        const proposal = await this.getRecord(ctx, id, 'proposals.proposals.update');
        if (CLOSED_STATUSES.includes(proposal.status)) throw new ConflictException({ message: 'This proposal is closed', code: 'proposal_closed' });
        const sourceId = dto.from_version_id ?? proposal.current_version_id;
        if (!sourceId) throw new BadRequestException({ message: 'Nothing to copy', code: 'proposal_no_version' });
        const source = await this.prisma.proposalVersion.findFirst({
            where: { id: sourceId, proposal_id: id },
            include: { sections: { orderBy: { sort_order: 'asc' } }, line_items: { orderBy: { sort_order: 'asc' } }, payment_schedule: { orderBy: { sort_order: 'asc' } } },
        });
        if (!source) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });

        const version = await this.prisma.$transaction(async (tx) => {
            const last = await tx.proposalVersion.aggregate({ where: { proposal_id: id }, _max: { version_number: true } });
            const n = (last._max.version_number ?? 0) + 1;
            await tx.proposalVersion.updateMany({
                where: { proposal_id: id, status: { in: [ProposalVersionStatus.DRAFT, ProposalVersionStatus.IN_REVIEW, ProposalVersionStatus.APPROVED] } },
                data: { status: ProposalVersionStatus.SUPERSEDED },
            });
            await tx.proposalApproval.updateMany({ where: { version: { proposal_id: id }, decision: 'PENDING' }, data: { decision: 'REJECTED', comment: 'Superseded by a newer version', decided_at: new Date() } });
            const v = await tx.proposalVersion.create({
                data: {
                    proposal_id: id, version_number: n, parent_version_id: source.id, template_version: source.template_version,
                    change_summary: dto.change_summary ?? (dto.from_version_id ? `Restored from v${source.version_number}` : `Revision of v${source.version_number}`),
                    payment_terms: source.payment_terms, validity_days: source.validity_days, milestones: source.milestones ?? undefined, timeline: source.timeline ?? undefined,
                    created_by_user_id: ctx.user_id,
                },
            });
            await this.writeContent(tx, id, v.id, {
                sections: source.sections.map((s) => ({ type: s.type, title: s.title, body: s.body, is_internal: s.is_internal, is_ai_generated: s.is_ai_generated })),
                line_items: source.line_items.map((l) => ({
                    product_id: l.product_id, group_name: l.group_name, name: l.name, description: l.description, quantity: num(l.quantity), unit: l.unit, unit_price: num(l.unit_price),
                    discount_percent: l.discount_percent === null ? null : num(l.discount_percent), discount_amount: l.discount_percent === null ? num(l.discount_amount) : null,
                    tax_percent: l.tax_percent === null ? null : num(l.tax_percent), is_recurring: l.is_recurring, billing_frequency: l.billing_frequency as 'monthly' | null, is_optional: l.is_optional,
                })),
                payment_schedule: source.payment_schedule.map((p) => ({
                    name: p.name, trigger: p.trigger, percentage: p.percentage === null ? null : num(p.percentage), amount: p.amount === null ? null : num(p.amount),
                    due_date: p.due_date ? p.due_date.toISOString().slice(0, 10) : null, milestone_name: p.milestone_name, frequency: p.frequency,
                })),
            }, true);
            const live = LIVE_STATUSES.includes(proposal.status);
            await tx.proposal.update({ where: { id }, data: { current_version_id: v.id, ...(!live && { status: ProposalStatus.DRAFT }) } });
            if (!live) await this.refreshTotals(tx, id, v.id);
            await tx.proposalEvent.create({ data: { proposal_id: id, version_id: v.id, type: ProposalEventType.VERSION_CREATED, actor_user_id: ctx.user_id, metadata: { version_number: n, from_version: source.version_number } } });
            await this.audit.record(ctx, 'proposal.version.created', { resource_type: 'proposal', resource_id: id, metadata: { version_id: v.id, version_number: n, from_version_id: source.id } }, tx);
            return v;
        });
        this.events.publish(ctx, { event_key: 'proposals.proposal.version_created', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: proposal.number, version_id: version.id, version_number: version.version_number, owner_membership_id: proposal.owner_membership_id } });
        return version;
    }

    async duplicate(ctx: OrgContext, id: string) {
        const src = await this.findOne(ctx, id);
        const v = src.version;
        return this.create(ctx, {
            title: `${src.title} (copy)`,
            currency: src.currency,
            language: src.language,
            company_id: src.company_id,
            contact_id: src.contact_id,
            deal_id: src.deal_id,
            project_id: src.project_id,
            branch_id: src.branch_id,
            requires_contract: src.requires_contract,
            content: v
                ? {
                    payment_terms: v.payment_terms,
                    validity_days: v.validity_days,
                    sections: v.sections.map((s) => ({ type: s.type, title: s.title, body: s.body, is_internal: s.is_internal })),
                    line_items: v.line_items.map((l) => ({
                        product_id: l.product_id, group_name: l.group_name, name: l.name, description: l.description, quantity: num(l.quantity), unit: l.unit, unit_price: num(l.unit_price),
                        discount_percent: l.discount_percent === null ? null : num(l.discount_percent), discount_amount: l.discount_percent === null ? num(l.discount_amount) : null,
                        tax_percent: l.tax_percent === null ? null : num(l.tax_percent), is_recurring: l.is_recurring, billing_frequency: l.billing_frequency as 'monthly' | null, is_optional: l.is_optional,
                    })),
                    payment_schedule: v.payment_schedule.map((p) => ({ name: p.name, trigger: p.trigger, percentage: p.percentage === null ? null : num(p.percentage), amount: p.amount === null ? null : num(p.amount), milestone_name: p.milestone_name, frequency: p.frequency })),
                }
                : undefined,
        }, 'duplicate');
    }

    async cancel(ctx: OrgContext, id: string) {
        const p = await this.getRecord(ctx, id, 'proposals.proposals.cancel');
        if (CLOSED_STATUSES.includes(p.status)) throw new ConflictException({ message: `The proposal is already ${p.status.toLowerCase()}`, code: 'proposal_closed' });
        const updated = await this.prisma.$transaction(async (tx) => {
            const u = await tx.proposal.update({ where: { id }, data: { status: ProposalStatus.CANCELLED, cancelled_at: new Date() } });
            await revokeAccessTokens(tx, id);
            await tx.proposalApproval.updateMany({ where: { version: { proposal_id: id }, decision: 'PENDING' }, data: { decision: 'REJECTED', comment: 'Proposal cancelled', decided_at: new Date() } });
            await tx.proposalEvent.create({ data: { proposal_id: id, type: ProposalEventType.CANCELLED, actor_user_id: ctx.user_id } });
            await this.audit.record(ctx, 'proposal.cancelled', { resource_type: 'proposal', resource_id: id, branch_id: p.branch_id, metadata: { before: { status: p.status } } }, tx);
            return u;
        });
        this.events.publish(ctx, { event_key: 'proposals.proposal.cancelled', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: p.number, owner_membership_id: p.owner_membership_id }, activity: { summary: `Proposal ${p.number} cancelled`, entity_label: p.title, company_id: p.company_id } });
        return updated;
    }

    /** Staff records that the deal was lost (REJECTED + reason) when the customer did not decline through the link. */
    async markLost(ctx: OrgContext, id: string, dto: MarkLostDto) {
        const p = await this.getRecord(ctx, id, 'proposals.proposals.update');
        if (p.status === ProposalStatus.ACCEPTED || p.status === ProposalStatus.CANCELLED) throw new ConflictException({ message: `A ${p.status.toLowerCase()} proposal cannot be marked lost`, code: 'proposal_closed' });
        const updated = await this.prisma.proposal.update({
            where: { id },
            data: { lost_reason: dto.lost_reason, ...(p.status !== ProposalStatus.EXPIRED && { status: ProposalStatus.REJECTED, rejected_at: new Date() }) },
        });
        await revokeAccessTokens(this.prisma, id);
        await this.prisma.proposalEvent.create({ data: { proposal_id: id, type: ProposalEventType.REJECTED, actor_user_id: ctx.user_id, metadata: { lost_reason: dto.lost_reason, note: dto.note ?? null, recorded_by: 'staff' } } });
        await this.audit.record(ctx, 'proposal.marked_lost', { resource_type: 'proposal', resource_id: id, metadata: { lost_reason: dto.lost_reason, before: { status: p.status } } });
        this.events.publish(ctx, { event_key: 'proposals.proposal.lost', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: p.number, lost_reason: dto.lost_reason, owner_membership_id: p.owner_membership_id, deal_id: p.deal_id } });
        return updated;
    }

    async archive(ctx: OrgContext, id: string, restore = false) {
        const p = await this.getRecord(ctx, id, 'proposals.proposals.archive');
        const updated = await this.prisma.proposal.update({ where: { id }, data: { archived_at: restore ? null : new Date() } });
        await this.audit.record(ctx, restore ? 'proposal.restored' : 'proposal.archived', { resource_type: 'proposal', resource_id: id, branch_id: p.branch_id });
        this.events.publish(ctx, { event_key: restore ? 'proposals.proposal.restored' : 'proposals.proposal.archived', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: p.number, owner_membership_id: p.owner_membership_id } });
        return updated;
    }

    /** Hard delete is only allowed for proposals that never reached a customer. */
    async remove(ctx: OrgContext, id: string) {
        const p = await this.getRecord(ctx, id, 'proposals.proposals.delete');
        if (p.sent_version_id || p.contract_id) throw new ConflictException({ message: 'A proposal that was sent cannot be deleted. Cancel or archive it instead.', code: 'proposal_was_sent' });
        await this.prisma.proposal.delete({ where: { id } });
        await this.audit.record(ctx, 'proposal.deleted', { resource_type: 'proposal', resource_id: id, branch_id: p.branch_id, metadata: { before: { number: p.number, title: p.title, status: p.status } } });
        this.events.publish(ctx, { event_key: 'proposals.proposal.deleted', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: id, payload: { number: p.number, owner_membership_id: p.owner_membership_id } });
        return { success: true };
    }

    // --- Lookups for pickers (read-only queries on other modules' tables, ids + labels only) -----

    async lookups(ctx: OrgContext, q: LookupQuery) {
        const org = ctx.organization_id;
        const contains = q.search ? { contains: q.search, mode: 'insensitive' as const } : undefined;
        switch (q.kind) {
            case 'companies':
                return this.prisma.crmCompany.findMany({ where: { organization_id: org, archived_at: null, ...(contains && { name: contains }) }, select: { id: true, name: true, currency: true, email: true }, orderBy: { name: 'asc' }, take: q.limit });
            case 'contacts':
                return this.prisma.crmContact.findMany({
                    where: { organization_id: org, archived_at: null, ...(q.company_id && { company_id: q.company_id }), ...(contains && { OR: [{ first_name: contains }, { last_name: contains }, { email: contains }] }) },
                    select: { id: true, first_name: true, last_name: true, email: true, company_id: true }, orderBy: { first_name: 'asc' }, take: q.limit,
                });
            case 'deals':
                return this.prisma.crmDeal.findMany({
                    where: { organization_id: org, archived_at: null, ...(q.company_id && { company_id: q.company_id }), ...(contains && { name: contains }) },
                    select: { id: true, name: true, value: true, currency: true, company_id: true, status: true }, orderBy: { updated_at: 'desc' }, take: q.limit,
                });
            case 'projects':
                return this.prisma.project.findMany({
                    where: { organization_id: org, archived_at: null, ...(q.company_id && { company_id: q.company_id }), ...(contains && { name: contains }) },
                    select: { id: true, name: true, code: true, company_id: true }, orderBy: { name: 'asc' }, take: q.limit,
                });
            case 'members':
                return this.prisma.membership.findMany({
                    where: { organization_id: org, status: 'ACTIVE', ...(contains && { user: { OR: [{ display_name: contains }, { first_name: contains }, { last_name: contains }, { email: contains }] } }) },
                    select: MEMBER_SELECT, take: q.limit,
                });
        }
    }

    // --- Lifecycle housekeeping -------------------------------------------------------------------

    /** SENT/VIEWED/CHANGES_REQUESTED proposals whose valid_until passed become EXPIRED (also run hourly by ProposalsJobs). */
    async expireOverdue(organizationId?: string) {
        const today = new Date(new Date().toISOString().slice(0, 10));
        const due = await this.prisma.proposal.findMany({
            where: { ...(organizationId && { organization_id: organizationId }), status: { in: LIVE_STATUSES }, valid_until: { lt: today } },
            select: { id: true },
            take: 500,
        });
        if (!due.length) return 0;
        const ids = due.map((d) => d.id);
        await this.prisma.$transaction([
            this.prisma.proposal.updateMany({ where: { id: { in: ids } }, data: { status: ProposalStatus.EXPIRED, expired_at: new Date() } }),
            this.prisma.proposalEvent.createMany({ data: ids.map((id) => ({ proposal_id: id, type: ProposalEventType.EXPIRED, metadata: { by: 'system' } })) }),
        ]);
        return ids.length;
    }

    // --- Helpers --------------------------------------------------------------------------------

    private async assertRefs(ctx: OrgContext, dto: Partial<CreateProposalDto>) {
        const org = ctx.organization_id;
        const [company, contact, deal, project, owner, branch] = await Promise.all([
            dto.company_id ? this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: org }, select: { id: true, currency: true } }) : null,
            dto.contact_id ? this.prisma.crmContact.findFirst({ where: { id: dto.contact_id, organization_id: org }, select: { id: true, company_id: true } }) : null,
            dto.deal_id ? this.prisma.crmDeal.findFirst({ where: { id: dto.deal_id, organization_id: org }, select: { id: true, company_id: true, currency: true } }) : null,
            dto.project_id ? this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: org }, select: { id: true } }) : null,
            dto.owner_membership_id ? this.prisma.membership.findFirst({ where: { id: dto.owner_membership_id, organization_id: org }, select: { id: true } }) : null,
            dto.branch_id ? this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: org }, select: { id: true } }) : null,
        ]);
        const missing = [
            dto.company_id && !company && 'company',
            dto.contact_id && !contact && 'contact',
            dto.deal_id && !deal && 'deal',
            dto.project_id && !project && 'project',
            dto.owner_membership_id && !owner && 'owner',
            dto.branch_id && !branch && 'branch',
        ].filter(Boolean);
        if (missing.length) throw new NotFoundException({ message: `Not found: ${missing.join(', ')}`, code: 'reference_not_found' });
        if (dto.owner_membership_id && dto.owner_membership_id !== ctx.membership_id && !ctx.can('proposals.proposals.update')) {
            throw new BadRequestException({ message: 'Assigning another owner needs proposals.proposals.update', code: 'owner_assignment_denied' });
        }
        return { companyCurrency: company?.currency ?? null, dealCurrency: deal?.currency ?? null, dealCompanyId: deal?.company_id ?? null };
    }
}
