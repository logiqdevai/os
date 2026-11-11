import { BadRequestException, Injectable } from '@nestjs/common';
import { CampaignAudienceMode, CommChannel, CommRecipientKind, Prisma, SegmentEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { normalizeAddress } from '../common/comm.utils';
import { CONTACT_FIELDS, MEMBERSHIP_FIELDS, SegmentNode, SegmentRule } from './segment-definition';

export interface AudienceCandidate {
    kind: CommRecipientKind;
    address: string | null;
    name: string | null;
    contact_id: string | null;
    membership_id: string | null;
    language: string | null;
    /** Personalization values ({{first_name}} …). */
    context: Record<string, unknown>;
    /** Segment with require_consent contributed this candidate. */
    consent_required?: boolean;
}

export interface ExcludedRecipient {
    address: string | null;
    name: string | null;
    contact_id: string | null;
    reason: 'invalid_address' | 'suppressed' | 'no_consent' | 'excluded_by_audience' | 'duplicate' | 'topic_unsubscribed';
}

export interface ResolvedAudience {
    included: (AudienceCandidate & { address: string })[];
    excluded: ExcludedRecipient[];
    counts: { total: number; included: number; excluded: number; by_reason: Record<string, number> };
}

const CONTACT_SELECT = {
    id: true, first_name: true, last_name: true, email: true, mobile: true, phone: true, job_title: true, language: true,
    company: { select: { name: true } },
} satisfies Prisma.CrmContactSelect;

type ContactRow = Prisma.CrmContactGetPayload<{ select: typeof CONTACT_SELECT }>;

const day = 24 * 3600 * 1000;
const asArray = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(String);

/**
 * Audience resolution for module 11: evaluates Segment definitions (read-only queries on 02 CRM tables), expands
 * recipient lists, applies include/exclude, and enforces suppression + consent + topic subscription.
 */
@Injectable()
export class AudienceService {
    constructor(private readonly prisma: PrismaService) { }

    // ---------------------------------------------------------------- segment → prisma where

    private async contactWhere(orgId: string, node: SegmentNode | null | undefined, prefixCompany = false): Promise<Prisma.CrmContactWhereInput> {
        if (!node || typeof node !== 'object') return {};
        if ('and' in node || 'or' in node) {
            const g = node as { and?: SegmentNode[]; or?: SegmentNode[] };
            const out: Prisma.CrmContactWhereInput = {};
            if (g.and?.length) out.AND = await Promise.all(g.and.map((n) => this.contactWhere(orgId, n, prefixCompany)));
            if (g.or?.length) out.OR = await Promise.all(g.or.map((n) => this.contactWhere(orgId, n, prefixCompany)));
            return out;
        }
        const rule = node as SegmentRule;
        const field = prefixCompany && !rule.field.startsWith('company.') && !rule.field.startsWith('consent.') && rule.field !== 'tag' ? `company.${rule.field}` : rule.field;
        const spec = CONTACT_FIELDS.find((f) => f.key === field);
        if (!spec) throw new BadRequestException({ message: `Unknown segment field "${rule.field}"`, code: 'segment_field_unknown' });
        if (!spec.ops.includes(rule.op)) throw new BadRequestException({ message: `Operator "${rule.op}" is not allowed on "${spec.label}"`, code: 'segment_op_invalid' });

        if (spec.type === 'tag') {
            const values = asArray(rule.value);
            const tags = await this.prisma.tag.findMany({ where: { organization_id: orgId, OR: [{ id: { in: values.filter((v) => /^[0-9a-f-]{36}$/i.test(v)) } }, { slug: { in: values } }, { name: { in: values } }] }, select: { id: true } });
            const tagged = await this.prisma.tagging.findMany({ where: { tag_id: { in: tags.map((t) => t.id) }, entity_type: 'CRM_CONTACT' }, select: { entity_id: true } });
            const ids = [...new Set(tagged.map((t) => t.entity_id))];
            return rule.op === 'has' ? { id: { in: ids } } : { id: { notIn: ids } };
        }
        if (spec.type === 'consent') {
            const channel = field.split('.')[1] as CommChannel;
            const status = String(rule.value ?? 'OPTED_IN') as Prisma.EnumCommConsentStatusFilter['equals'];
            const has: Prisma.CrmContactWhereInput = { comm_consents: { some: { channel, status } } };
            if (status === 'UNKNOWN') {
                const unknown: Prisma.CrmContactWhereInput = { OR: [has, { comm_consents: { none: { channel } } }] };
                return rule.op === 'eq' ? unknown : { NOT: unknown };
            }
            return rule.op === 'eq' ? has : { NOT: has };
        }
        if (field.startsWith('company.')) {
            const inner = this.scalarCondition(spec.type, rule);
            const key = field.slice('company.'.length);
            if (rule.op === 'is_not_set') return { OR: [{ company_id: null }, { company: { [key]: null } }] };
            return { company: { [key]: inner } };
        }
        if (spec.type === 'array') {
            const values = asArray(rule.value);
            return rule.op === 'has' ? { [field]: { hasSome: values } } : { NOT: { [field]: { hasSome: values } } };
        }
        if (rule.op === 'is_not_set') return { [field]: null };
        if (rule.op === 'neq' || rule.op === 'not_in' || rule.op === 'not_contains') {
            // NOT on a nullable column also drops nulls in SQL; keep them explicitly.
            return { OR: [{ [field]: null }, { NOT: { [field]: this.scalarCondition(spec.type, { ...rule, op: rule.op === 'neq' ? 'eq' : rule.op === 'not_in' ? 'in' : 'contains' }) } }] };
        }
        return { [field]: this.scalarCondition(spec.type, rule) };
    }

    private scalarCondition(type: string, rule: SegmentRule): Record<string, unknown> {
        const v = rule.value;
        const text = (s: unknown) => String(s ?? '');
        switch (rule.op) {
            case 'eq': return type === 'string' ? { equals: text(v), mode: 'insensitive' } : { equals: text(v) };
            case 'neq': return { not: text(v) };
            case 'in': return { in: asArray(v) };
            case 'not_in': return { notIn: asArray(v) };
            case 'contains': return { contains: text(v), mode: 'insensitive' };
            case 'not_contains': return { not: { contains: text(v), mode: 'insensitive' } };
            case 'starts_with': return { startsWith: text(v), mode: 'insensitive' };
            case 'is_set': return { not: null };
            case 'before': return { lt: new Date(text(v)) };
            case 'after': return { gt: new Date(text(v)) };
            case 'within_days': return { gte: new Date(Date.now() - Number(v ?? 30) * day) };
            case 'older_than_days': return { lt: new Date(Date.now() - Number(v ?? 30) * day) };
            default: return {};
        }
    }

    private membershipWhere(node: SegmentNode | null | undefined): Prisma.MembershipWhereInput {
        if (!node || typeof node !== 'object') return {};
        if ('and' in node || 'or' in node) {
            const g = node as { and?: SegmentNode[]; or?: SegmentNode[] };
            return { ...(g.and?.length && { AND: g.and.map((n) => this.membershipWhere(n)) }), ...(g.or?.length && { OR: g.or.map((n) => this.membershipWhere(n)) }) };
        }
        const rule = node as SegmentRule;
        const spec = MEMBERSHIP_FIELDS.find((f) => f.key === rule.field);
        if (!spec || !spec.ops.includes(rule.op)) throw new BadRequestException({ message: `Unsupported member rule "${rule.field} ${rule.op}"`, code: 'segment_field_unknown' });
        if (rule.field === 'team_id') return { teams: { some: { team_id: { in: asArray(rule.value) }, ended_at: null } } };
        if (rule.field === 'branch_id') return { branches: { some: { branch_id: { in: asArray(rule.value) } } } };
        if (rule.op === 'is_not_set') return { [rule.field]: null };
        return { [rule.field]: this.scalarCondition(spec.type, rule) };
    }

    // ---------------------------------------------------------------- evaluation

    async segmentWhere(orgId: string, entityType: SegmentEntityType, definition: unknown): Promise<Prisma.CrmContactWhereInput> {
        return {
            organization_id: orgId,
            archived_at: null,
            merged_into_id: null,
            ...(await this.contactWhere(orgId, definition as SegmentNode, entityType === SegmentEntityType.CRM_COMPANY)),
        };
    }

    private contactCandidate(c: ContactRow, channel: CommChannel | null, orgName: string): AudienceCandidate {
        const address = channel === CommChannel.SMS ? c.mobile ?? c.phone : channel === CommChannel.EMAIL ? c.email : c.email ?? c.mobile ?? c.phone;
        const full = [c.first_name, c.last_name].filter(Boolean).join(' ');
        return {
            kind: CommRecipientKind.CRM_CONTACT,
            address: address ?? null,
            name: full || null,
            contact_id: c.id,
            membership_id: null,
            language: c.language,
            context: { first_name: c.first_name, last_name: c.last_name ?? '', full_name: full, email: c.email, phone: c.mobile ?? c.phone, job_title: c.job_title, company_name: c.company?.name ?? '', organization_name: orgName },
        };
    }

    private async orgName(orgId: string) {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { display_name: true } });
        return org?.display_name ?? '';
    }

    /** Evaluate a segment now. `limit` caps the rows loaded (previews); totals are always exact. */
    async evaluateSegment(orgId: string, segment: { entity_type: SegmentEntityType; definition: unknown; require_consent?: boolean }, channel: CommChannel | null, opts: { limit?: number; skip?: number; search?: string } = {}) {
        const orgName = await this.orgName(orgId);
        if (segment.entity_type === SegmentEntityType.MEMBERSHIP) {
            const where: Prisma.MembershipWhereInput = {
                organization_id: orgId,
                status: 'ACTIVE',
                type: 'INTERNAL',
                ...this.membershipWhere(segment.definition as SegmentNode),
                ...(opts.search && { user: { OR: [{ email: { contains: opts.search, mode: 'insensitive' } }, { display_name: { contains: opts.search, mode: 'insensitive' } }] } }),
            };
            const [rows, total] = await Promise.all([
                this.prisma.membership.findMany({ where, take: opts.limit, skip: opts.skip, orderBy: { joined_at: 'asc' }, select: { id: true, job_title: true, user: { select: { email: true, phone: true, first_name: true, last_name: true, display_name: true, locale: true } } } }),
                this.prisma.membership.count({ where }),
            ]);
            const candidates = rows.map<AudienceCandidate>((m) => {
                const name = m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || null;
                return {
                    kind: CommRecipientKind.MEMBERSHIP,
                    address: channel === CommChannel.SMS ? m.user.phone : m.user.email,
                    name,
                    contact_id: null,
                    membership_id: m.id,
                    language: m.user.locale,
                    context: { first_name: m.user.first_name ?? name ?? '', last_name: m.user.last_name ?? '', full_name: name ?? '', email: m.user.email, phone: m.user.phone, job_title: m.job_title, organization_name: orgName },
                };
            });
            return { candidates, total };
        }
        const base = await this.segmentWhere(orgId, segment.entity_type, segment.definition);
        const where: Prisma.CrmContactWhereInput = opts.search
            ? { AND: [base, { OR: [{ first_name: { contains: opts.search, mode: 'insensitive' } }, { last_name: { contains: opts.search, mode: 'insensitive' } }, { email: { contains: opts.search, mode: 'insensitive' } }] }] }
            : base;
        const [rows, total] = await Promise.all([
            this.prisma.crmContact.findMany({ where, select: CONTACT_SELECT, take: opts.limit, skip: opts.skip, orderBy: [{ first_name: 'asc' }, { id: 'asc' }] }),
            this.prisma.crmContact.count({ where }),
        ]);
        return { candidates: rows.map((c) => ({ ...this.contactCandidate(c, channel, orgName), consent_required: segment.require_consent })), total };
    }

    async listCandidates(orgId: string, listId: string, channel: CommChannel): Promise<AudienceCandidate[]> {
        const orgName = await this.orgName(orgId);
        const members = await this.prisma.commRecipientListMember.findMany({
            where: { list_id: listId },
            include: {
                contact: { select: { ...CONTACT_SELECT, archived_at: true } },
                membership: { select: { id: true, status: true, job_title: true, user: { select: { email: true, phone: true, first_name: true, last_name: true, display_name: true, locale: true } } } },
            },
        });
        const out: AudienceCandidate[] = [];
        for (const m of members) {
            if (m.kind === CommRecipientKind.CRM_CONTACT && m.contact) {
                if (m.contact.archived_at) continue;
                const c = this.contactCandidate(m.contact, channel, orgName);
                out.push(m.address ? { ...c, address: m.address } : c);
            } else if (m.kind === CommRecipientKind.MEMBERSHIP && m.membership) {
                if (m.membership.status !== 'ACTIVE') continue;
                const u = m.membership.user;
                const name = u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || null;
                out.push({ kind: m.kind, address: m.address ?? (channel === CommChannel.SMS ? u.phone : u.email), name, contact_id: null, membership_id: m.membership.id, language: u.locale, context: { first_name: u.first_name ?? '', last_name: u.last_name ?? '', full_name: name ?? '', email: u.email, job_title: m.membership.job_title, organization_name: orgName } });
            } else {
                const [first, ...rest] = (m.name ?? '').split(' ');
                out.push({ kind: CommRecipientKind.EXTERNAL, address: m.address, name: m.name, contact_id: null, membership_id: null, language: null, context: { first_name: first ?? '', last_name: rest.join(' '), full_name: m.name ?? '', email: m.address, organization_name: orgName } });
            }
        }
        return out;
    }

    /**
     * Resolve a campaign audience: union of INCLUDE sources minus EXCLUDE sources, deduplicated by normalized address,
     * then suppression (always), consent (CRM contacts, when the campaign or the contributing segment requires it) and
     * topic subscription. External list entries are not CRM contacts: they are checked against suppressions only.
     */
    async resolveCampaign(orgId: string, campaign: { channel: CommChannel; require_consent: boolean; topic_id: string | null; audiences: { mode: CampaignAudienceMode; list_id: string | null; segment_id: string | null }[] }): Promise<ResolvedAudience> {
        const included = new Map<string, AudienceCandidate & { address: string }>();
        const excluded: ExcludedRecipient[] = [];
        const excludeAddresses = new Set<string>();
        const excludeContacts = new Set<string>();

        const sourceCandidates = async (a: { list_id: string | null; segment_id: string | null }) => {
            if (a.list_id) return this.listCandidates(orgId, a.list_id, campaign.channel);
            if (a.segment_id) {
                const segment = await this.prisma.segment.findFirst({ where: { id: a.segment_id, organization_id: orgId } });
                if (!segment) return [];
                return (await this.evaluateSegment(orgId, segment, campaign.channel)).candidates;
            }
            return [];
        };

        for (const a of campaign.audiences.filter((x) => x.mode === CampaignAudienceMode.EXCLUDE)) {
            for (const c of await sourceCandidates(a)) {
                const n = normalizeAddress(campaign.channel, c.address);
                if (n) excludeAddresses.add(n);
                if (c.contact_id) excludeContacts.add(c.contact_id);
            }
        }
        for (const a of campaign.audiences.filter((x) => x.mode === CampaignAudienceMode.INCLUDE)) {
            for (const c of await sourceCandidates(a)) {
                const n = normalizeAddress(campaign.channel, c.address);
                if (!n) {
                    excluded.push({ address: c.address, name: c.name, contact_id: c.contact_id, reason: 'invalid_address' });
                    continue;
                }
                if (excludeAddresses.has(n) || (c.contact_id && excludeContacts.has(c.contact_id))) {
                    excluded.push({ address: n, name: c.name, contact_id: c.contact_id, reason: 'excluded_by_audience' });
                    continue;
                }
                const prev = included.get(n);
                if (prev) {
                    if (c.consent_required) prev.consent_required = true;
                    continue;
                }
                included.set(n, { ...c, address: n });
            }
        }

        const addresses = [...included.keys()];
        const suppressed = new Set(
            (await this.prisma.commSuppression.findMany({
                where: { organization_id: orgId, channel: campaign.channel, address: { in: addresses }, removed_at: null, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
                select: { address: true },
            })).map((s) => s.address),
        );
        const contactIds = [...included.values()].map((c) => c.contact_id).filter((x): x is string => !!x);
        const consented = new Set(
            (await this.prisma.commConsent.findMany({ where: { contact_id: { in: contactIds }, channel: campaign.channel, status: 'OPTED_IN' }, select: { contact_id: true } })).map((c) => c.contact_id),
        );
        let topicAllowed: Set<string> | null = null;
        if (campaign.topic_id) {
            const topic = await this.prisma.commTopic.findUnique({ where: { id: campaign.topic_id }, select: { default_opt_in: true } });
            const subs = await this.prisma.commTopicSubscription.findMany({ where: { topic_id: campaign.topic_id, contact_id: { in: contactIds } }, select: { contact_id: true, status: true } });
            const byContact = new Map(subs.map((s) => [s.contact_id, s.status]));
            topicAllowed = new Set(contactIds.filter((id) => {
                const s = byContact.get(id);
                return s ? s === 'OPTED_IN' : !!topic?.default_opt_in;
            }));
        }

        const final: (AudienceCandidate & { address: string })[] = [];
        for (const c of included.values()) {
            if (suppressed.has(c.address)) {
                excluded.push({ address: c.address, name: c.name, contact_id: c.contact_id, reason: 'suppressed' });
            } else if (c.contact_id && (campaign.require_consent || c.consent_required) && !consented.has(c.contact_id)) {
                excluded.push({ address: c.address, name: c.name, contact_id: c.contact_id, reason: 'no_consent' });
            } else if (c.contact_id && topicAllowed && !topicAllowed.has(c.contact_id)) {
                excluded.push({ address: c.address, name: c.name, contact_id: c.contact_id, reason: 'topic_unsubscribed' });
            } else {
                final.push(c);
            }
        }
        const by_reason: Record<string, number> = {};
        for (const e of excluded) by_reason[e.reason] = (by_reason[e.reason] ?? 0) + 1;
        return { included: final, excluded, counts: { total: final.length + excluded.length, included: final.length, excluded: excluded.length, by_reason } };
    }
}
