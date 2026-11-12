import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CRM_FINANCIALS } from '../common/crm.constants';
import { companyScopeWhere, contactScopeWhere, dealScopeWhere, leadScopeWhere } from '../common/crm-scope.utils';
import { CrmCustomFieldValuesService } from '../custom-fields/custom-field-values.service';
import { MERGE_FIELDS, MERGE_KEYS, MergeEntity, MONEY_FIELDS, OWNER_FIELDS, REFS } from './merge.config';

export const MergeEntitySchema = z.enum(['CRM_COMPANY', 'CRM_CONTACT', 'CRM_LEAD', 'CRM_DEAL']);

export const MergePreviewQuerySchema = z.object({
    entity_type: MergeEntitySchema,
    ids: z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(z.string().uuid()).min(2).max(5)),
});
export type MergePreviewQuery = z.infer<typeof MergePreviewQuerySchema>;

export const MergeSchema = z.object({
    entity_type: MergeEntitySchema,
    survivor_id: z.string().uuid(),
    merged_ids: z.array(z.string().uuid()).min(1).max(4),
    /** `{ field: record_id }` — the record whose value the survivor keeps (default: the survivor's own value). */
    field_choices: z.record(z.string(), z.string().uuid()).optional().default({}),
    /** `updated_at` of every record as seen in the preview; a newer change blocks the merge (409 merge_conflict). */
    expected_updated_at: z.record(z.string(), z.string()).optional(),
});
export type MergeInput = z.infer<typeof MergeSchema>;

type Row = Record<string, any> & { id: string; updated_at: Date };

const label = (entity: MergeEntity, r: Row) => (entity === 'CRM_CONTACT' ? [r.first_name, r.last_name].filter(Boolean).join(' ') : r.name);

/**
 * 02 §22 — merge duplicates: the survivor keeps its id and the chosen field values; every related record (contacts,
 * deals, activities, notes, tags, custom field values, proposals, invoices, tickets, files … see merge.config.ts)
 * is re-pointed in one transaction; merged records are archived with `merged_into_id` so old links still resolve.
 * Needs the entity's `merge` key and its `update` scope on every record. One CrmMergeLog row per merge.
 */
@Injectable()
export class CrmMergeService {
    constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly events: EventsService, private readonly cf: CrmCustomFieldValuesService) { }

    private delegate(tx: Prisma.TransactionClient | PrismaService, entity: MergeEntity) {
        return ({ CRM_COMPANY: tx.crmCompany, CRM_CONTACT: tx.crmContact, CRM_LEAD: tx.crmLead, CRM_DEAL: tx.crmDeal } as Record<MergeEntity, any>)[entity];
    }

    private scope(ctx: OrgContext, entity: MergeEntity, key: string) {
        return entity === 'CRM_COMPANY' ? companyScopeWhere(ctx, key) : entity === 'CRM_CONTACT' ? contactScopeWhere(ctx, key) : entity === 'CRM_LEAD' ? leadScopeWhere(ctx, key) : dealScopeWhere(ctx, key);
    }

    private async load(ctx: OrgContext, entity: MergeEntity, ids: string[], key: string): Promise<Row[]> {
        const rows: Row[] = await this.delegate(this.prisma, entity).findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id, merged_into_id: null, ...this.scope(ctx, entity, key) } });
        if (rows.length !== new Set(ids).size) throw new NotFoundException({ message: `One of the records was not found, was already merged or is outside your access`, code: 'merge_record_not_found' });
        return ids.map((id) => rows.find((r) => r.id === id)!);
    }

    private async counts(entity: MergeEntity, ids: string[]) {
        const out: Record<string, number> = {};
        for (const [model, col] of REFS[entity]) {
            const n = await (this.prisma as any)[model].count({ where: { [col]: { in: ids } } });
            if (n) out[`${model}.${col}`] = n;
        }
        const [notes, tags, values] = await Promise.all([
            this.prisma.crmNote.count({ where: { entity_type: entity, entity_id: { in: ids } } }),
            this.prisma.tagging.count({ where: { entity_type: entity, entity_id: { in: ids } } }),
            this.prisma.customFieldValue.count({ where: { entity_type: entity, entity_id: { in: ids } } }),
        ]);
        return { ...out, ...(notes && { notes }), ...(tags && { tags }), ...(values && { custom_field_values: values }) };
    }

    /** Field-by-field comparison and the counts of related records that will move (mockup `company-merge`). */
    async preview(ctx: OrgContext, q: MergePreviewQuery) {
        const entity = q.entity_type;
        const keys = MERGE_KEYS[entity];
        if (!ctx.can(keys.merge)) throw new ForbiddenException({ message: `Missing permission ${keys.merge}`, code: 'permission_denied', permission: keys.merge });
        const rows = await this.load(ctx, entity, q.ids, keys.update);
        const money = ctx.can(CRM_FINANCIALS);
        const fields = MERGE_FIELDS[entity].filter((f) => money || !MONEY_FIELDS.has(f));
        const custom = await this.cf.valuesFor(ctx.organization_id, entity as RecordEntityType, q.ids);
        const comparison = fields.map((f) => {
            const values = rows.map((r) => ({ record_id: r.id, value: r[f] instanceof Date ? r[f].toISOString() : r[f] === null || r[f] === undefined ? null : typeof r[f] === 'object' && 'toFixed' in r[f] ? String(r[f]) : r[f] }));
            const distinct = new Set(values.map((v) => JSON.stringify(v.value)));
            // Default: the first non-empty value, preferring the most recently updated record.
            const ordered = [...rows].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
            const suggested = ordered.find((r) => r[f] !== null && r[f] !== undefined && r[f] !== '')?.id ?? rows[0].id;
            return { field: f, values, differs: distinct.size > 1, suggested_record_id: suggested };
        });
        const labels = await this.labels(ctx, comparison.flatMap((c) => c.values.map((v) => ({ field: c.field, value: v.value }))));
        for (const c of comparison) for (const v of c.values as { value: unknown; label?: string | null }[]) v.label = typeof v.value === 'string' ? labels.get(`${c.field}:${v.value}`) ?? null : null;
        return {
            entity_type: entity,
            records: rows.map((r) => ({ id: r.id, label: label(entity, r), created_at: r.created_at, updated_at: r.updated_at, archived_at: r.archived_at, custom_fields: custom.get(r.id) ?? {} })),
            fields: comparison,
            moves: await this.counts(entity, q.ids),
            can_assign: ctx.can(keys.assign),
        };
    }

    async merge(ctx: OrgContext, dto: MergeInput) {
        const entity = dto.entity_type;
        const keys = MERGE_KEYS[entity];
        if (!ctx.can(keys.merge)) throw new ForbiddenException({ message: `Missing permission ${keys.merge}`, code: 'permission_denied', permission: keys.merge });
        const merged = [...new Set(dto.merged_ids)].filter((id) => id !== dto.survivor_id);
        if (!merged.length) throw new BadRequestException({ message: 'Pick at least one record to merge into the survivor', code: 'merge_nothing' });
        const all = [dto.survivor_id, ...merged];
        const rows = await this.load(ctx, entity, all, keys.update);
        if (dto.expected_updated_at) {
            const changed = rows.find((r) => dto.expected_updated_at![r.id] && new Date(dto.expected_updated_at![r.id]).getTime() !== r.updated_at.getTime());
            if (changed) throw new ConflictException({ message: `${label(entity, changed)} changed since the preview. Review the values again.`, code: 'merge_conflict' });
        }
        const survivor = rows[0];
        const money = ctx.can(CRM_FINANCIALS);
        const allowed = new Set<string>(MERGE_FIELDS[entity].filter((f) => money || !MONEY_FIELDS.has(f)));
        const patch: Record<string, unknown> = {};
        const choices: Record<string, { chosen_from: string; value: unknown }> = {};
        for (const [field, recordId] of Object.entries(dto.field_choices ?? {})) {
            if (!allowed.has(field)) throw new BadRequestException({ message: `Field ${field} cannot be chosen`, code: 'merge_field_invalid' });
            const source = rows.find((r) => r.id === recordId);
            if (!source) throw new BadRequestException({ message: 'A field choice points at a record that is not part of the merge', code: 'merge_choice_invalid' });
            if (recordId === survivor.id || JSON.stringify(source[field]) === JSON.stringify(survivor[field])) continue;
            if (OWNER_FIELDS.has(field) && !ctx.can(keys.assign)) throw new ForbiddenException({ message: `Missing permission ${keys.assign}`, code: 'permission_denied', permission: keys.assign });
            patch[field] = source[field] ?? null;
            choices[field] = { chosen_from: recordId, value: source[field] instanceof Date ? source[field].toISOString() : source[field] === null ? null : String(source[field]) };
        }
        if (entity === 'CRM_COMPANY' && merged.includes(patch.parent_company_id as string)) patch.parent_company_id = null;

        const moved: Record<string, number> = {};
        const kept: string[] = [];
        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(patch).length) await this.delegate(tx, entity).update({ where: { id: survivor.id }, data: patch });
            if (entity === 'CRM_CONTACT') {
                const roles = [...new Set(rows.flatMap((r) => r.roles ?? []))];
                await tx.crmContact.update({ where: { id: survivor.id }, data: { roles } });
            }
            // Re-point every foreign key. Each update runs in a savepoint: a unique clash (e.g. the same contact on a deal
            // twice) leaves that row on the archived record instead of failing the whole merge.
            for (const [model, col] of [...this.refs(entity)]) {
                const sp = `m_${model}_${col}`.slice(0, 60);
                await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
                try {
                    const where: Record<string, unknown> = { [col]: { in: merged } };
                    if (model === 'crmCompany' && col === 'parent_company_id') where.id = { not: survivor.id };
                    const r = await (tx as any)[model].updateMany({ where, data: { [col]: survivor.id } });
                    if (r.count) moved[`${model}.${col}`] = r.count;
                    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
                } catch {
                    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
                    kept.push(`${model}.${col}`);
                }
            }
            // Polymorphic links: notes, tags (deduplicated) and custom field values (survivor's values win).
            const notes = await tx.crmNote.updateMany({ where: { organization_id: ctx.organization_id, entity_type: entity, entity_id: { in: merged } }, data: { entity_id: survivor.id } });
            if (notes.count) moved.notes = notes.count;
            const survivorTags = new Set((await tx.tagging.findMany({ where: { entity_type: entity, entity_id: survivor.id }, select: { tag_id: true } })).map((t) => t.tag_id));
            const otherTags = await tx.tagging.findMany({ where: { entity_type: entity, entity_id: { in: merged } } });
            for (const t of otherTags) {
                if (survivorTags.has(t.tag_id)) continue;
                survivorTags.add(t.tag_id);
                await tx.tagging.create({ data: { tag_id: t.tag_id, entity_type: t.entity_type, entity_id: survivor.id } });
                moved.tags = (moved.tags ?? 0) + 1;
            }
            await tx.tagging.deleteMany({ where: { entity_type: entity, entity_id: { in: merged } } });
            const cfMoved = await this.cf.moveForMerge(tx, entity as RecordEntityType, survivor.id, merged);
            if (cfMoved) moved.custom_field_values = cfMoved;
            const now = new Date();
            await this.delegate(tx, entity).updateMany({ where: { id: { in: merged } }, data: { merged_into_id: survivor.id, merged_at: now, archived_at: now } });
            await tx.crmMergeLog.create({
                data: { organization_id: ctx.organization_id, entity_type: entity, survivor_id: survivor.id, merged_ids: merged, field_choices: choices as Prisma.InputJsonValue, moved_counts: { ...moved, ...(kept.length && { kept_on_merged: kept }) } as Prisma.InputJsonValue, merged_by_membership_id: ctx.membership_id },
            });
            await tx.crmDuplicateDismissal.deleteMany({ where: { organization_id: ctx.organization_id, entity_type: entity, OR: [{ record_a_id: { in: all } }, { record_b_id: { in: all } }] } });
            await this.audit.record(ctx, `crm.${keys.label}.merged`, { resource_type: `crm_${keys.label}`, resource_id: survivor.id, metadata: { survivor_id: survivor.id, merged_ids: merged, field_choices: choices, moved_counts: moved } }, tx);
        }, { timeout: 60_000 });
        this.events.publish(ctx, {
            event_key: `crm.${keys.label}.merged`, module: ModuleKey.CRM, entity_type: entity as RecordEntityType, entity_id: survivor.id,
            payload: { survivor_id: survivor.id, merged_ids: merged, moved_counts: moved },
            activity: { summary: `merged ${merged.length} duplicate ${keys.label}${merged.length > 1 ? 's' : ''} into ${label(entity, { ...survivor, ...patch } as Row)}`, entity_label: label(entity, { ...survivor, ...patch } as Row), ...(entity === 'CRM_COMPANY' && { company_id: survivor.id }) },
        });
        return { survivor_id: survivor.id, merged_ids: merged, moved_counts: moved, kept_on_merged: kept };
    }

    /** Display names for id fields on the merge screen (owner, stage, source, company …). */
    private async labels(ctx: OrgContext, items: { field: string; value: unknown }[]) {
        const ids = (fields: string[]) => [...new Set(items.filter((i) => fields.includes(i.field) && typeof i.value === 'string').map((i) => i.value as string))];
        const org = ctx.organization_id;
        const members = ids(['owner_membership_id', 'account_manager_membership_id']);
        const [m, ls, src, st, co, ct, tm] = await Promise.all([
            members.length ? this.prisma.membership.findMany({ where: { id: { in: members }, organization_id: org }, select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } }) : [],
            this.prisma.crmLifecycleStage.findMany({ where: { id: { in: ids(['lifecycle_stage_id']) }, organization_id: org }, select: { id: true, name: true } }),
            this.prisma.crmLeadSource.findMany({ where: { id: { in: ids(['lead_source_id']) }, organization_id: org }, select: { id: true, name: true } }),
            this.prisma.crmLeadStatus.findMany({ where: { id: { in: ids(['status_id']) }, organization_id: org }, select: { id: true, name: true } }),
            this.prisma.crmCompany.findMany({ where: { id: { in: ids(['company_id', 'parent_company_id']) }, organization_id: org }, select: { id: true, name: true } }),
            this.prisma.crmContact.findMany({ where: { id: { in: ids(['contact_id', 'primary_contact_id']) }, organization_id: org }, select: { id: true, first_name: true, last_name: true } }),
            this.prisma.team.findMany({ where: { id: { in: ids(['team_id']) }, organization_id: org }, select: { id: true, name: true } }),
        ]);
        const out = new Map<string, string>();
        const put = (fields: string[], id: string, name: string) => fields.forEach((f) => out.set(`${f}:${id}`, name));
        m.forEach((x) => put(['owner_membership_id', 'account_manager_membership_id'], x.id, x.user.display_name || [x.user.first_name, x.user.last_name].filter(Boolean).join(' ') || x.user.email));
        ls.forEach((x) => put(['lifecycle_stage_id'], x.id, x.name));
        src.forEach((x) => put(['lead_source_id'], x.id, x.name));
        st.forEach((x) => put(['status_id'], x.id, x.name));
        co.forEach((x) => put(['company_id', 'parent_company_id'], x.id, x.name));
        ct.forEach((x) => put(['contact_id', 'primary_contact_id'], x.id, [x.first_name, x.last_name].filter(Boolean).join(' ')));
        tm.forEach((x) => put(['team_id'], x.id, x.name));
        return out;
    }

    private refs(entity: MergeEntity) {
        return REFS[entity];
    }

    /** Merge history of a record (survivor). */
    history(ctx: OrgContext, entity: MergeEntity, survivor_id: string) {
        return this.prisma.crmMergeLog.findMany({ where: { organization_id: ctx.organization_id, entity_type: entity, survivor_id }, orderBy: { created_at: 'desc' }, take: 20 });
    }
}
