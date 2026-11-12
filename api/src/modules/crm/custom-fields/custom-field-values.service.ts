import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomFieldDefinition, CustomFieldType, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CustomFieldValuesInput, OPTION_TYPES } from './dto/custom-field.dto';

export interface PreparedValues {
    upserts: { definition_id: string; value: Prisma.InputJsonValue; value_text: string | null }[];
    deletes: string[];
}

interface FieldOption { value: string; label: string }
interface FieldValidation { min?: number; max?: number; max_length?: number; pattern?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC_TYPES: CustomFieldType[] = ['NUMBER', 'DECIMAL', 'CURRENCY', 'PERCENTAGE'];

const invalid = (def: { key: string; label: string }, message: string) =>
    new BadRequestException({ message: `${def.label}: ${message}`, code: 'custom_field_invalid', field: def.key });

/**
 * Values of custom fields on CRM records (02 §24–26). Every write path (REST, MCP, import, merge) validates through
 * `prepare()` and stores through `write()` inside the record's transaction, so values are typed and consistent.
 * Values are keyed by the stable definition `key` in every API payload.
 */
@Injectable()
export class CrmCustomFieldValuesService {
    constructor(private readonly prisma: PrismaService) { }

    /** Active definitions that apply to an entity type, in display order. */
    definitionsFor(organization_id: string, entity_type: RecordEntityType) {
        return this.prisma.customFieldDefinition.findMany({
            where: { organization_id, archived_at: null, entity_types: { has: entity_type } },
            orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
        });
    }

    /**
     * Validate `{ key: value }` for one record. `creating` applies defaults and enforces required fields;
     * `coerce` accepts strings (CSV import): numbers, booleans, option labels, `;`-separated multi-select values.
     * Unknown keys are rejected so integrations notice typos.
     */
    async prepare(ctx: OrgContext, entity_type: RecordEntityType, input: CustomFieldValuesInput | undefined | null, opts: { creating: boolean; coerce?: boolean; definitions?: CustomFieldDefinition[] }): Promise<PreparedValues> {
        const defs = opts.definitions ?? (await this.definitionsFor(ctx.organization_id, entity_type));
        const values = input ?? {};
        const byKey = new Map(defs.map((d) => [d.key, d]));
        for (const key of Object.keys(values)) {
            if (!byKey.has(key)) throw new BadRequestException({ message: `Unknown custom field "${key}"`, code: 'custom_field_unknown', field: key });
        }
        const out: PreparedValues = { upserts: [], deletes: [] };
        const memberIds: { def: CustomFieldDefinition; id: string }[] = [];
        for (const def of defs) {
            const has = Object.prototype.hasOwnProperty.call(values, def.key);
            let raw: unknown = has ? values[def.key] : opts.creating ? def.default_value : undefined;
            if (!has && !opts.creating) continue;
            if (typeof raw === 'string' && raw.trim() === '') raw = null;
            if (Array.isArray(raw) && raw.length === 0) raw = null;
            if (raw === null || raw === undefined) {
                if (def.is_required && (opts.creating || has)) throw invalid(def, 'is required');
                if (has) out.deletes.push(def.id);
                continue;
            }
            const value = this.normalize(def, raw, !!opts.coerce);
            if (def.type === 'USER') memberIds.push({ def, id: value as string });
            out.upserts.push({ definition_id: def.id, value: value as Prisma.InputJsonValue, value_text: this.textOf(def, value) });
        }
        if (memberIds.length) {
            const ids = [...new Set(memberIds.map((m) => m.id))];
            const found = await this.prisma.membership.count({ where: { id: { in: ids }, organization_id: ctx.organization_id } });
            if (found !== ids.length) throw invalid(memberIds[0].def, 'member not found');
        }
        return out;
    }

    /** Typed value for one definition (throws 400 `custom_field_invalid`). Exported for definition defaults. */
    normalize(def: Pick<CustomFieldDefinition, 'key' | 'label' | 'type' | 'options' | 'validation'>, raw: unknown, coerce = false): unknown {
        const rules = (def.validation ?? {}) as FieldValidation;
        const options = ((def.options ?? []) as unknown as FieldOption[]);
        const pickOption = (v: unknown) => {
            const s = String(v).trim();
            const hit = options.find((o) => o.value === s) ?? (coerce ? options.find((o) => o.value.toLowerCase() === s.toLowerCase() || o.label.toLowerCase() === s.toLowerCase()) : undefined);
            if (!hit) throw invalid(def, `"${s}" is not one of the options`);
            return hit.value;
        };
        switch (def.type) {
            case 'TEXT': case 'LONG_TEXT': case 'PHONE': {
                if (typeof raw !== 'string' && !(coerce && typeof raw === 'number')) throw invalid(def, 'must be text');
                const s = String(raw).trim();
                const max = rules.max_length ?? (def.type === 'LONG_TEXT' ? 10000 : 500);
                if (s.length > max) throw invalid(def, `must be at most ${max} characters`);
                if (rules.pattern) {
                    let re: RegExp | null = null;
                    try { re = new RegExp(rules.pattern); } catch { re = null; }
                    if (re && !re.test(s)) throw invalid(def, 'has the wrong format');
                }
                return s;
            }
            case 'EMAIL': {
                const s = String(raw).trim().toLowerCase();
                if (typeof raw !== 'string' || !EMAIL.test(s)) throw invalid(def, 'must be an email address');
                return s;
            }
            case 'URL': {
                if (typeof raw !== 'string') throw invalid(def, 'must be a link');
                const s = raw.trim();
                try {
                    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
                    if (!u.hostname.includes('.')) throw new Error('host');
                    return u.toString();
                } catch {
                    throw invalid(def, 'must be a valid link');
                }
            }
            case 'NUMBER': case 'DECIMAL': case 'CURRENCY': case 'PERCENTAGE': {
                const n = typeof raw === 'number' ? raw : coerce && typeof raw === 'string' ? Number(raw.replace(/\s/g, '').replace(',', '.')) : NaN;
                if (!Number.isFinite(n)) throw invalid(def, 'must be a number');
                if (def.type === 'NUMBER' && !Number.isInteger(n)) throw invalid(def, 'must be a whole number');
                if (rules.min !== undefined && n < rules.min) throw invalid(def, `must be at least ${rules.min}`);
                if (rules.max !== undefined && n > rules.max) throw invalid(def, `must be at most ${rules.max}`);
                return NUMERIC_TYPES.includes(def.type) && def.type !== 'NUMBER' ? Math.round(n * 10000) / 10000 : n;
            }
            case 'BOOLEAN': {
                if (typeof raw === 'boolean') return raw;
                if (coerce && typeof raw === 'string') {
                    const s = raw.trim().toLowerCase();
                    if (['true', 'yes', 'y', '1', 'x'].includes(s)) return true;
                    if (['false', 'no', 'n', '0'].includes(s)) return false;
                }
                throw invalid(def, 'must be yes or no');
            }
            case 'DATE': {
                const s = typeof raw === 'string' ? raw.trim().slice(0, 10) : '';
                if (!DATE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw invalid(def, 'must be a date (YYYY-MM-DD)');
                return s;
            }
            case 'DATETIME': {
                const d = typeof raw === 'string' ? new Date(raw) : null;
                if (!d || Number.isNaN(d.getTime())) throw invalid(def, 'must be a date and time');
                return d.toISOString();
            }
            case 'DROPDOWN': case 'RADIO':
                if (typeof raw !== 'string' && typeof raw !== 'number') throw invalid(def, 'must be one of the options');
                return pickOption(raw);
            case 'MULTI_SELECT': {
                const list = Array.isArray(raw) ? raw : coerce && typeof raw === 'string' ? raw.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : null;
                if (!list) throw invalid(def, 'must be a list of options');
                return [...new Set(list.map(pickOption))];
            }
            case 'USER': {
                const s = String(raw).trim();
                if (!/^[0-9a-f-]{36}$/i.test(s)) throw invalid(def, 'must be a member id');
                return s;
            }
            default:
                throw invalid(def, 'this field type cannot be set yet');
        }
    }

    private textOf(def: CustomFieldDefinition, value: unknown): string | null {
        const options = ((def.options ?? []) as unknown as FieldOption[]);
        const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
        if (OPTION_TYPES.includes(def.type)) return Array.isArray(value) ? value.map((v) => label(String(v))).join('; ') : label(String(value));
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return String(value).slice(0, 1000);
    }

    /** Store prepared values inside the caller's transaction. */
    async write(tx: Prisma.TransactionClient, entity_type: RecordEntityType, entity_id: string, prepared: PreparedValues) {
        if (prepared.deletes.length) await tx.customFieldValue.deleteMany({ where: { entity_id, definition_id: { in: prepared.deletes } } });
        for (const u of prepared.upserts) {
            await tx.customFieldValue.upsert({
                where: { definition_id_entity_id: { definition_id: u.definition_id, entity_id } },
                update: { value: u.value, value_text: u.value_text, entity_type },
                create: { definition_id: u.definition_id, entity_type, entity_id, value: u.value, value_text: u.value_text },
            });
        }
    }

    /** `{ key: value }` per record id (active definitions only). */
    async valuesFor(organization_id: string, entity_type: RecordEntityType, ids: string[]) {
        const map = new Map<string, Record<string, unknown>>();
        if (!ids.length) return map;
        const rows = await this.prisma.customFieldValue.findMany({
            where: { entity_type, entity_id: { in: ids }, definition: { organization_id, archived_at: null } },
            select: { entity_id: true, value: true, value_text: true, definition: { select: { key: true } } },
        });
        for (const r of rows) map.set(r.entity_id, { ...(map.get(r.entity_id) ?? {}), [r.definition.key]: r.value });
        return map;
    }

    /** Display text per record id and key (CSV export). */
    async textsFor(organization_id: string, entity_type: RecordEntityType, ids: string[]) {
        const map = new Map<string, Record<string, string>>();
        if (!ids.length) return map;
        for (let i = 0; i < ids.length; i += 2000) {
            const rows = await this.prisma.customFieldValue.findMany({
                where: { entity_type, entity_id: { in: ids.slice(i, i + 2000) }, definition: { organization_id, archived_at: null } },
                select: { entity_id: true, value_text: true, definition: { select: { key: true } } },
            });
            for (const r of rows) map.set(r.entity_id, { ...(map.get(r.entity_id) ?? {}), [r.definition.key]: r.value_text ?? '' });
        }
        return map;
    }

    /** Extra CSV columns for an export: headers + a row mapper. */
    async exportColumns(organization_id: string, entity_type: RecordEntityType, ids: string[]) {
        const defs = await this.definitionsFor(organization_id, entity_type);
        const texts = await this.textsFor(organization_id, entity_type, ids);
        return {
            headers: defs.map((d) => `cf_${d.key}`),
            row: (id: string) => defs.map((d) => texts.get(id)?.[d.key] ?? ''),
        };
    }

    /** Record ids whose value for `key` contains `text` (custom-field list filter, 02 §26). */
    async idsMatching(organization_id: string, entity_type: RecordEntityType, key: string, text: string) {
        const rows = await this.prisma.customFieldValue.findMany({
            where: { entity_type, value_text: { contains: text, mode: 'insensitive' }, definition: { organization_id, key, archived_at: null } },
            select: { entity_id: true },
            take: 5000,
        });
        return rows.map((r) => r.entity_id);
    }

    /** Combine a tag filter with a custom-field filter: `undefined` = no restriction. */
    async restrictIds(organization_id: string, entity_type: RecordEntityType, query: { cf_key?: string; cf_value?: string }, ids?: string[]) {
        if (!query.cf_key || !query.cf_value) return ids;
        const matched = await this.idsMatching(organization_id, entity_type, query.cf_key, query.cf_value);
        if (!ids) return matched;
        const set = new Set(matched);
        return ids.filter((id) => set.has(id));
    }

    /**
     * Shared fields follow a record when it is converted (02 §25): copy the values of fields that also apply to the
     * target type, unless the caller already set them.
     */
    async carryOver(tx: Prisma.TransactionClient, organization_id: string, from_id: string, to_type: RecordEntityType, to_id: string) {
        const rows = await tx.customFieldValue.findMany({ where: { entity_id: from_id, definition: { organization_id, archived_at: null, entity_types: { has: to_type } } } });
        for (const r of rows) {
            const exists = await tx.customFieldValue.findUnique({ where: { definition_id_entity_id: { definition_id: r.definition_id, entity_id: to_id } } });
            if (!exists) await tx.customFieldValue.create({ data: { definition_id: r.definition_id, entity_type: to_type, entity_id: to_id, value: r.value ?? Prisma.JsonNull, value_text: r.value_text } });
        }
    }

    /** Move values of merged records onto the survivor (values already on the survivor win unless chosen). */
    async moveForMerge(tx: Prisma.TransactionClient, entity_type: RecordEntityType, survivor_id: string, merged_ids: string[]) {
        const survivorDefs = new Set((await tx.customFieldValue.findMany({ where: { entity_id: survivor_id }, select: { definition_id: true } })).map((r) => r.definition_id));
        const rows = await tx.customFieldValue.findMany({ where: { entity_id: { in: merged_ids } } });
        let moved = 0;
        for (const r of rows) {
            if (survivorDefs.has(r.definition_id)) continue;
            survivorDefs.add(r.definition_id);
            await tx.customFieldValue.create({ data: { definition_id: r.definition_id, entity_type, entity_id: survivor_id, value: r.value ?? Prisma.JsonNull, value_text: r.value_text } });
            moved++;
        }
        await tx.customFieldValue.deleteMany({ where: { entity_id: { in: merged_ids } } });
        return moved;
    }
}
