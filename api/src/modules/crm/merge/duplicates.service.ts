import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBER_SELECT } from '../common/crm.constants';
import { companyScopeWhere, contactScopeWhere, domainOf, leadScopeWhere, PUBLIC_EMAIL_DOMAINS } from '../common/crm-scope.utils';
import { MERGE_KEYS } from './merge.config';

export const DuplicateEntitySchema = z.enum(['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD']);
type DupEntity = z.infer<typeof DuplicateEntitySchema>;

export const DuplicatesQuerySchema = z.object({
    entity_type: DuplicateEntitySchema,
    /** Only pairs matched by this key. */
    match: z.string().max(30).optional(),
    min_score: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});
export type DuplicatesQuery = z.infer<typeof DuplicatesQuerySchema>;

export const DismissSchema = z.object({ entity_type: DuplicateEntitySchema, record_a_id: z.string().uuid(), record_b_id: z.string().uuid() });
export const DuplicateRuleSchema = z.object({
    entity_type: DuplicateEntitySchema,
    match_keys: z.array(z.enum(['email', 'phone', 'domain', 'vat', 'tax_id', 'registration_number', 'name'])).min(1),
    min_score: z.number().int().min(1).max(100),
    auto_check: z.boolean().optional(),
    enabled: z.boolean().optional(),
});
export type DuplicateRuleInput = z.infer<typeof DuplicateRuleSchema>;

/** Points a match key contributes to a pair's score (capped at 100). */
const WEIGHTS: Record<string, number> = { email: 70, vat: 80, tax_id: 80, registration_number: 80, domain: 50, phone: 50, name: 50 };
const DEFAULT_KEYS: Record<DupEntity, string[]> = {
    CRM_COMPANY: ['name', 'domain', 'vat', 'tax_id', 'email', 'phone'],
    CRM_CONTACT: ['email', 'phone', 'name'],
    CRM_LEAD: ['email', 'phone', 'name'],
};
const MAX_RECORDS = 20_000;

const normName = (s?: string | null) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\b(inc|ltd|llc|gmbh|sa|s\.a|ae|ike|oe|plc|co|corp|corporation|company)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
const normPhone = (s?: string | null) => { const d = (s ?? '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; };
const normId = (s?: string | null) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(EL|GR|DE|FR|IT|ES|NL|BE|AT|CY|GB)/, '');

/**
 * 02 §22 — duplicates inbox. Candidates are computed on request from the organization's records (match keys from
 * `CrmDuplicateRule`, else defaults): exact email, phone (last 10 digits), website domain, VAT / tax id, normalized
 * name. Pairs dismissed as "not a duplicate" never return. Suggestions only — nothing is merged automatically.
 */
@Injectable()
export class CrmDuplicatesService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly events: EventsService) { }

    async rules(ctx: OrgContext) {
        const rows = await this.prisma.crmDuplicateRule.findMany({ where: { organization_id: ctx.organization_id } });
        return DuplicateEntitySchema.options.map((e) => rows.find((r) => r.entity_type === e) ?? { entity_type: e, match_keys: DEFAULT_KEYS[e], min_score: 50, auto_check: true, enabled: true, id: null });
    }

    async saveRule(ctx: OrgContext, dto: DuplicateRuleInput) {
        const rule = await this.prisma.crmDuplicateRule.upsert({
            where: { organization_id_entity_type: { organization_id: ctx.organization_id, entity_type: dto.entity_type } },
            update: { match_keys: dto.match_keys, min_score: dto.min_score, ...(dto.auto_check !== undefined && { auto_check: dto.auto_check }), ...(dto.enabled !== undefined && { enabled: dto.enabled }) },
            create: { organization_id: ctx.organization_id, entity_type: dto.entity_type, match_keys: dto.match_keys, min_score: dto.min_score, auto_check: dto.auto_check ?? true, enabled: dto.enabled ?? true },
        });
        await this.audit.record(ctx, 'crm.duplicate_rule.updated', { resource_type: 'crm_duplicate_rule', resource_id: rule.id, metadata: { after: dto } });
        return rule;
    }

    private async records(ctx: OrgContext, entity: DupEntity) {
        const read = MERGE_KEYS[entity].read;
        const base = { organization_id: ctx.organization_id, merged_into_id: null, archived_at: null };
        if (entity === 'CRM_COMPANY') {
            const rows = await this.prisma.crmCompany.findMany({ where: { ...base, ...companyScopeWhere(ctx, read) }, select: { id: true, name: true, website: true, email: true, phone: true, vat_number: true, tax_id: true, registration_number: true, country: true, created_at: true, owner: { select: MEMBER_SELECT } }, take: MAX_RECORDS, orderBy: { created_at: 'asc' } });
            return rows.map((r) => ({
                record: { id: r.id, label: r.name, sub: [r.website, r.email].filter(Boolean).join(' · '), created_at: r.created_at, owner: r.owner },
                keys: {
                    name: normName(r.name) ? `${normName(r.name)}|${r.country ?? ''}` : '',
                    domain: (() => { const d = domainOf(r.website) ?? domainOf(r.email); return d && !PUBLIC_EMAIL_DOMAINS.has(d) ? d : ''; })(),
                    email: r.email?.toLowerCase() ?? '', phone: normPhone(r.phone), vat: normId(r.vat_number), tax_id: normId(r.tax_id), registration_number: normId(r.registration_number),
                },
            }));
        }
        if (entity === 'CRM_CONTACT') {
            const rows = await this.prisma.crmContact.findMany({ where: { ...base, ...contactScopeWhere(ctx, read) }, select: { id: true, first_name: true, last_name: true, email: true, phone: true, mobile: true, company_id: true, created_at: true, company: { select: { name: true } }, owner: { select: MEMBER_SELECT } }, take: MAX_RECORDS, orderBy: { created_at: 'asc' } });
            return rows.map((r) => ({
                record: { id: r.id, label: [r.first_name, r.last_name].filter(Boolean).join(' '), sub: [r.email, r.company?.name].filter(Boolean).join(' · '), created_at: r.created_at, owner: r.owner },
                keys: {
                    email: r.email?.toLowerCase() ?? '', phone: normPhone(r.mobile) || normPhone(r.phone),
                    name: r.last_name ? `${normName(r.first_name)}${normName(r.last_name)}|${r.company_id ?? ''}` : '',
                },
            }));
        }
        const rows = await this.prisma.crmLead.findMany({ where: { ...base, converted_at: null, ...leadScopeWhere(ctx, read) }, select: { id: true, name: true, email: true, phone: true, company_name: true, contact_name: true, created_at: true, owner: { select: MEMBER_SELECT } }, take: MAX_RECORDS, orderBy: { created_at: 'asc' } });
        return rows.map((r) => ({
            record: { id: r.id, label: r.name, sub: [r.contact_name, r.company_name, r.email].filter(Boolean).join(' · '), created_at: r.created_at, owner: r.owner },
            keys: { email: r.email?.toLowerCase() ?? '', phone: normPhone(r.phone), name: normName(r.company_name || r.name) },
        }));
    }

    async find(ctx: OrgContext, q: DuplicatesQuery) {
        const entity = q.entity_type;
        if (!ctx.can(MERGE_KEYS[entity].read)) throw new ForbiddenException({ message: `Missing permission ${MERGE_KEYS[entity].read}`, code: 'permission_denied', permission: MERGE_KEYS[entity].read });
        const rule = (await this.rules(ctx)).find((r) => r.entity_type === entity)!;
        const keys = (q.match ? [q.match] : rule.match_keys).filter((k) => DEFAULT_KEYS[entity].includes(k) || (entity === 'CRM_COMPANY' && k === 'registration_number'));
        const minScore = q.min_score ?? rule.min_score;
        const [items, dismissed] = await Promise.all([
            this.records(ctx, entity),
            this.prisma.crmDuplicateDismissal.findMany({ where: { organization_id: ctx.organization_id, entity_type: entity }, select: { record_a_id: true, record_b_id: true } }),
        ]);
        const skip = new Set(dismissed.map((d) => `${d.record_a_id}|${d.record_b_id}`));
        const pairs = new Map<string, { a: number; b: number; reasons: Set<string> }>();
        for (const key of keys) {
            const buckets = new Map<string, number[]>();
            items.forEach((it, i) => {
                const v = (it.keys as Record<string, string>)[key];
                if (v) buckets.set(v, [...(buckets.get(v) ?? []), i]);
            });
            for (const idx of buckets.values()) {
                if (idx.length < 2 || idx.length > 25) continue; // huge buckets are noise (e.g. a shared switchboard number)
                for (let x = 0; x < idx.length; x++) for (let y = x + 1; y < idx.length; y++) {
                    const [a, b] = items[idx[x]].record.id < items[idx[y]].record.id ? [idx[x], idx[y]] : [idx[y], idx[x]];
                    const id = `${items[a].record.id}|${items[b].record.id}`;
                    if (skip.has(id)) continue;
                    const p = pairs.get(id) ?? { a, b, reasons: new Set<string>() };
                    p.reasons.add(key);
                    pairs.set(id, p);
                }
            }
        }
        const results = [...pairs.values()]
            .map((p) => ({ records: [items[p.a].record, items[p.b].record], reasons: [...p.reasons], score: Math.min(100, [...p.reasons].reduce((n, r) => n + (WEIGHTS[r] ?? 30), 0)) }))
            .filter((p) => p.score >= minScore)
            .sort((x, y) => y.score - x.score);
        return { entity_type: entity, total: results.length, min_score: minScore, match_keys: keys, can_merge: ctx.can(MERGE_KEYS[entity].merge), data: results.slice(0, q.limit) };
    }

    async dismiss(ctx: OrgContext, dto: z.infer<typeof DismissSchema>) {
        const key = MERGE_KEYS[dto.entity_type].update;
        if (!ctx.can(key)) throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
        const [a, b] = dto.record_a_id < dto.record_b_id ? [dto.record_a_id, dto.record_b_id] : [dto.record_b_id, dto.record_a_id];
        const table = { CRM_COMPANY: this.prisma.crmCompany, CRM_CONTACT: this.prisma.crmContact, CRM_LEAD: this.prisma.crmLead }[dto.entity_type] as unknown as { count: (a: unknown) => Promise<number> };
        if ((await table.count({ where: { id: { in: [a, b] }, organization_id: ctx.organization_id } })) !== 2) throw new NotFoundException({ message: 'Record not found', code: 'reference_not_found' });
        const row = await this.prisma.crmDuplicateDismissal.upsert({
            where: { organization_id_entity_type_record_a_id_record_b_id: { organization_id: ctx.organization_id, entity_type: dto.entity_type as RecordEntityType, record_a_id: a, record_b_id: b } },
            update: {},
            create: { organization_id: ctx.organization_id, entity_type: dto.entity_type as RecordEntityType, record_a_id: a, record_b_id: b, dismissed_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'crm.duplicate.dismissed', { resource_type: 'crm_duplicate_dismissal', resource_id: row.id, metadata: { entity_type: dto.entity_type, record_a_id: a, record_b_id: b } });
        this.events.publish(ctx, { event_key: 'crm.duplicate.dismissed', module: ModuleKey.CRM, entity_kind: 'crm_duplicate_dismissal', entity_id: row.id, payload: { entity_type: dto.entity_type, record_a_id: a, record_b_id: b } });
        return { success: true };
    }
}
