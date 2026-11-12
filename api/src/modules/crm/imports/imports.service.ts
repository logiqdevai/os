import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CrmImportStatus, CustomFieldDefinition, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '@/modules/files/storage/storage.service';
import { CRM_FINANCIALS, MEMBER_SELECT } from '../common/crm.constants';
import { companyScopeWhere, contactScopeWhere, dealScopeWhere, domainOf, leadScopeWhere } from '../common/crm-scope.utils';
import { CrmDefaultsService } from '../common/crm-defaults.service';
import { parseCsv, toCsv } from '../common/csv.utils';
import { CrmCustomFieldValuesService } from '../custom-fields/custom-field-values.service';
import { CrmLeadRulesService } from '../rules/lead-rules.service';
import { DuplicateStrategy, ImportMappingInput, ImportQuery } from './dto/import.dto';
import { ENTITY_KEYS, IMPORT_FIELDS, ImportEntity, ImportField, MATCH_KEYS, normHeader } from './import-fields';

export const IMPORT_KEY = 'crm.records.import';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const PREVIEW_ROWS = 100;
const MAX_STORED_ERRORS = 1000;

type Plan = 'create' | 'update' | 'skip' | 'error';
export interface RowResult { row: number; plan: Plan; message?: string; label?: string; existing_id?: string }

interface Lookups {
    defs: CustomFieldDefinition[];
    members: Map<string, string>;
    sources: Map<string, string>;
    lifecycle: Map<string, string>;
    statuses: Map<string, string>;
    pipelines: { id: string; name: string; currency: string | null; is_default: boolean; stages: { id: string; name: string; probability: number; forecast_category: string; is_won: boolean; is_lost: boolean }[] }[];
    companies: Map<string, string | null>;
    currency: string;
}

interface BuiltRow { data: Record<string, unknown>; custom: Record<string, unknown>; errors: string[]; label: string }

const lc = (s: string) => s.trim().toLowerCase();
/** Undo the formula-injection guard our own exports add (`'=…`). */
const clean = (v: string) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v);

/**
 * 02 §22 — CSV import: upload (parsed server-side, 5 MB / 10 000 rows) → map columns (incl. custom fields) →
 * duplicate strategy (skip | update | create by a match key) → preview (nothing written) → background run with
 * progress on the CrmImportJob → results with a downloadable error file → rollback of created records.
 * Needs `crm.records.import` plus the record type's create key (and update key for "update"). Audited as counts only.
 */
@Injectable()
export class CrmImportsService {
    private readonly logger = new Logger(CrmImportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly storage: StorageService,
        private readonly defaults: CrmDefaultsService,
        private readonly cf: CrmCustomFieldValuesService,
        private readonly leadRules: CrmLeadRulesService,
    ) { }

    private fileKey(ctx: OrgContext, id: string) {
        return `org/${ctx.organization_id}/crm-imports/${id}.csv`;
    }

    private async readFile(ctx: OrgContext, id: string): Promise<string[][]> {
        const stream = await this.storage.getStream(this.fileKey(ctx, id));
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return parseCsv(Buffer.concat(chunks).toString('utf8'));
    }

    private assertKeys(ctx: OrgContext, entity: ImportEntity, mode?: DuplicateStrategy['mode']) {
        const keys = [IMPORT_KEY, ENTITY_KEYS[entity].create, ...(mode === 'update' ? [ENTITY_KEYS[entity].update] : [])];
        const missing = keys.find((k) => !ctx.can(k));
        if (missing) throw new ForbiddenException({ message: `Missing permission ${missing}`, code: 'permission_denied', permission: missing });
    }

    /** Target fields (built-in + active custom fields) and match keys for the mapping step. */
    async fields(ctx: OrgContext, entity: ImportEntity) {
        const defs = await this.cf.definitionsFor(ctx.organization_id, entity as RecordEntityType);
        const money = ctx.can(CRM_FINANCIALS);
        return {
            fields: [
                ...IMPORT_FIELDS[entity].filter((f) => money || !f.money).map((f) => ({ key: f.key, label: f.label, required: !!f.required, kind: f.kind })),
                ...defs.map((d) => ({ key: `cf:${d.key}`, label: `${d.label} (custom)`, required: d.is_required, kind: d.type.toLowerCase() })),
            ],
            match_keys: MATCH_KEYS[entity],
        };
    }

    private suggestMapping(entity: ImportEntity, headers: string[], defs: CustomFieldDefinition[], money: boolean) {
        const out: Record<string, string> = {};
        const used = new Set<string>();
        for (const h of headers) {
            const n = normHeader(h);
            const f = IMPORT_FIELDS[entity].find((x) => (money || !x.money) && !used.has(x.key) && (normHeader(x.key) === n || normHeader(x.label) === n || x.aliases?.includes(n)));
            const d = !f ? defs.find((x) => !used.has(`cf:${x.key}`) && (normHeader(x.key) === n || normHeader(x.label) === n || `cf${normHeader(x.key)}` === n)) : undefined;
            const key = f?.key ?? (d ? `cf:${d.key}` : undefined);
            if (key) { out[h] = key; used.add(key); }
        }
        return out;
    }

    // ---- upload / read --------------------------------------------------------------------------------------

    async upload(ctx: OrgContext, entity: ImportEntity, file: { buffer?: Buffer; originalname?: string; size?: number } | undefined) {
        this.assertKeys(ctx, entity);
        if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose a CSV file (multipart field "file")', code: 'file_required' });
        if (file.buffer.length > MAX_BYTES) throw new BadRequestException({ message: 'The file is larger than 5 MB. Split it into smaller files.', code: 'file_too_large' });
        const name = file.originalname || 'import.csv';
        if (!/\.(csv|txt)$/i.test(name)) throw new BadRequestException({ message: 'Only .csv files can be imported', code: 'file_type' });
        const text = file.buffer.toString('utf8');
        if (text.includes('\u0000')) throw new BadRequestException({ message: 'This does not look like a text CSV file', code: 'file_type' });
        const rows = parseCsv(text);
        if (rows.length < 2) throw new BadRequestException({ message: 'The file needs a header row and at least one data row', code: 'file_empty' });
        const headers = rows[0].map((h, i) => h || `Column ${i + 1}`);
        if (new Set(headers).size !== headers.length) throw new BadRequestException({ message: 'Column headers must be unique', code: 'duplicate_headers' });
        if (rows.length - 1 > MAX_ROWS) throw new BadRequestException({ message: `At most ${MAX_ROWS} rows per import (this file has ${rows.length - 1})`, code: 'too_many_rows' });
        await this.defaults.ensure(ctx.organization_id);
        const defs = await this.cf.definitionsFor(ctx.organization_id, entity as RecordEntityType);
        const job = await this.prisma.crmImportJob.create({
            data: {
                organization_id: ctx.organization_id,
                entity_type: entity as RecordEntityType,
                status: CrmImportStatus.PENDING,
                file_name: name.slice(0, 200),
                total_rows: rows.length - 1,
                field_mapping: this.suggestMapping(entity, headers, defs, ctx.can(CRM_FINANCIALS)),
                duplicate_strategy: { mode: 'skip', match_key: MATCH_KEYS[entity][0].key },
                started_by_membership_id: ctx.membership_id,
            },
        });
        await this.storage.put(this.fileKey(ctx, job.id), file.buffer, 'text/csv');
        await this.audit.record(ctx, 'crm.records.import_uploaded', { resource_type: 'crm_import_job', resource_id: job.id, metadata: { entity_type: entity, rows: job.total_rows, file_name: job.file_name } });
        return this.findOne(ctx, job.id);
    }

    async findAll(ctx: OrgContext, query: ImportQuery) {
        if (!ctx.can(IMPORT_KEY)) throw new ForbiddenException({ message: `Missing permission ${IMPORT_KEY}`, code: 'permission_denied', permission: IMPORT_KEY });
        const where: Prisma.CrmImportJobWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.entity_type && { entity_type: query.entity_type as RecordEntityType }),
            ...(query.status?.length && { status: { in: query.status } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.crmImportJob.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' }, omit: { errors: true, created_record_ids: true, field_mapping: true }, include: { started_by: { select: MEMBER_SELECT } } }),
            this.prisma.crmImportJob.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    private async getJob(ctx: OrgContext, id: string) {
        const job = await this.prisma.crmImportJob.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!job) throw new NotFoundException({ message: 'Import not found', code: 'import_not_found' });
        return job;
    }

    /** Job with progress; while it is being set up also the headers and the first rows of the file. */
    async findOne(ctx: OrgContext, id: string) {
        const job = await this.prisma.crmImportJob.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { started_by: { select: MEMBER_SELECT } } });
        if (!job) throw new NotFoundException({ message: 'Import not found', code: 'import_not_found' });
        const setup = job.status === 'PENDING' || job.status === 'PREVIEW';
        let file: { headers: string[]; sample: string[][] } | null = null;
        if (setup) {
            const rows = await this.readFile(ctx, id).catch(() => null);
            if (rows) file = { headers: rows[0], sample: rows.slice(1, 6) };
        }
        const errors = (job.errors ?? {}) as { rows?: RowResult[]; preview?: Record<string, number> };
        const { created_record_ids, errors: _e, ...rest } = job;
        return {
            ...rest,
            created_count: created_record_ids.length,
            processed_rows: job.imported_rows + job.updated_rows + job.skipped_rows + job.error_rows,
            preview_summary: errors.preview ?? null,
            error_sample: job.status === 'PREVIEW' ? [] : (errors.rows ?? []).filter((r) => r.plan === 'error').slice(0, 50),
            ...(job.status === 'PREVIEW' && { preview_rows: errors.rows ?? [] }),
            file,
            ...(setup && { target: await this.fields(ctx, job.entity_type as ImportEntity) }),
        };
    }

    // ---- mapping ---------------------------------------------------------------------------------------------

    async setMapping(ctx: OrgContext, id: string, dto: ImportMappingInput) {
        const job = await this.getJob(ctx, id);
        const entity = job.entity_type as ImportEntity;
        this.assertKeys(ctx, entity, dto.duplicate_strategy.mode);
        if (job.status !== 'PENDING' && job.status !== 'PREVIEW') throw new ConflictException({ message: 'This import already ran', code: 'import_locked' });
        const { fields } = await this.fields(ctx, entity);
        const valid = new Set(fields.map((f) => f.key));
        const mapping = Object.fromEntries(Object.entries(dto.field_mapping).filter(([, v]) => v));
        const targets = Object.values(mapping);
        const unknown = targets.find((t) => !valid.has(t));
        if (unknown) throw new BadRequestException({ message: `Unknown field "${unknown}"`, code: 'mapping_unknown_field' });
        const dupe = targets.find((t, i) => targets.indexOf(t) !== i);
        if (dupe) throw new BadRequestException({ message: `Two columns are mapped to ${fields.find((f) => f.key === dupe)?.label ?? dupe}`, code: 'mapping_duplicate' });
        const required = IMPORT_FIELDS[entity].filter((f) => f.required).map((f) => f.key);
        const hasName = entity === 'CRM_CONTACT' ? targets.includes('first_name') || targets.includes('full_name') : required.every((r) => targets.includes(r));
        if (!hasName) throw new BadRequestException({ message: `Map a column to ${IMPORT_FIELDS[entity].find((f) => f.required)?.label}`, code: 'mapping_required' });
        if (!MATCH_KEYS[entity].some((m) => m.key === dto.duplicate_strategy.match_key)) throw new BadRequestException({ message: 'Unknown match key', code: 'mapping_match_key' });
        await this.prisma.crmImportJob.update({ where: { id }, data: { field_mapping: mapping, duplicate_strategy: dto.duplicate_strategy, status: 'PENDING', errors: Prisma.JsonNull } });
        if (dto.save_as) {
            await this.prisma.crmImportMapping.upsert({
                where: { organization_id_entity_type_name: { organization_id: ctx.organization_id, entity_type: job.entity_type, name: dto.save_as } },
                update: { field_mapping: mapping, duplicate_strategy: dto.duplicate_strategy },
                create: { organization_id: ctx.organization_id, entity_type: job.entity_type, name: dto.save_as, field_mapping: mapping, duplicate_strategy: dto.duplicate_strategy, created_by_membership_id: ctx.membership_id },
            });
        }
        await this.audit.record(ctx, 'crm.records.import_mapped', { resource_type: 'crm_import_job', resource_id: id, metadata: { columns: Object.keys(mapping).length, duplicate_strategy: dto.duplicate_strategy, saved_mapping: dto.save_as ?? null } });
        return this.findOne(ctx, id);
    }

    savedMappings(ctx: OrgContext, entity: ImportEntity) {
        if (!ctx.can(IMPORT_KEY)) throw new ForbiddenException({ message: `Missing permission ${IMPORT_KEY}`, code: 'permission_denied', permission: IMPORT_KEY });
        return this.prisma.crmImportMapping.findMany({ where: { organization_id: ctx.organization_id, entity_type: entity as RecordEntityType }, orderBy: { name: 'asc' } });
    }

    async deleteMapping(ctx: OrgContext, id: string) {
        const m = await this.prisma.crmImportMapping.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!m) throw new NotFoundException({ message: 'Mapping not found', code: 'mapping_not_found' });
        await this.prisma.crmImportMapping.delete({ where: { id } });
        await this.audit.record(ctx, 'crm.records.import_mapping_deleted', { resource_type: 'crm_import_mapping', resource_id: id, metadata: { name: m.name } });
        return { success: true };
    }

    // ---- row building ----------------------------------------------------------------------------------------

    private async lookups(ctx: OrgContext, entity: ImportEntity): Promise<Lookups> {
        const org = ctx.organization_id;
        const [defs, members, sources, lifecycle, statuses, pipelines, currency] = await Promise.all([
            this.cf.definitionsFor(org, entity as RecordEntityType),
            this.prisma.membership.findMany({ where: { organization_id: org, status: 'ACTIVE' }, select: { id: true, user: { select: { email: true } } } }),
            this.prisma.crmLeadSource.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true } }),
            this.prisma.crmLifecycleStage.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true } }),
            this.prisma.crmLeadStatus.findMany({ where: { organization_id: org, archived_at: null, is_converted: false, is_lost: false }, select: { id: true, name: true } }),
            entity === 'CRM_DEAL'
                ? this.prisma.crmPipeline.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true, currency: true, is_default: true, stages: { orderBy: { sort_order: 'asc' }, select: { id: true, name: true, probability: true, forecast_category: true, is_won: true, is_lost: true } } } })
                : Promise.resolve([]),
            this.prisma.organization.findUnique({ where: { id: org }, select: { default_currency: true } }),
        ]);
        return {
            defs,
            members: new Map(members.filter((m) => m.user?.email).map((m) => [lc(m.user.email), m.id])),
            sources: new Map(sources.map((s) => [lc(s.name), s.id])),
            lifecycle: new Map(lifecycle.map((s) => [lc(s.name), s.id])),
            statuses: new Map(statuses.map((s) => [lc(s.name), s.id])),
            pipelines,
            companies: new Map(),
            currency: currency?.default_currency ?? 'EUR',
        };
    }

    private async companyId(ctx: OrgContext, lk: Lookups, name: string) {
        const key = lc(name);
        if (!lk.companies.has(key)) {
            const c = await this.prisma.crmCompany.findFirst({ where: { organization_id: ctx.organization_id, merged_into_id: null, archived_at: null, name: { equals: name.trim(), mode: 'insensitive' } }, select: { id: true } });
            lk.companies.set(key, c?.id ?? null);
        }
        return lk.companies.get(key) ?? null;
    }

    private async buildRow(ctx: OrgContext, entity: ImportEntity, headers: string[], cells: string[], mapping: Record<string, string>, lk: Lookups): Promise<BuiltRow> {
        const data: Record<string, unknown> = {};
        const custom: Record<string, unknown> = {};
        const errors: string[] = [];
        const money = ctx.can(CRM_FINANCIALS);
        const fields = new Map(IMPORT_FIELDS[entity].map((f) => [f.key, f]));
        for (let i = 0; i < headers.length; i++) {
            const target = mapping[headers[i]];
            const raw = clean(cells[i] ?? '').trim();
            if (!target || raw === '') continue;
            if (target.startsWith('cf:')) { custom[target.slice(3)] = raw; continue; }
            const f = fields.get(target);
            if (!f || (f.money && !money)) continue;
            const err = await this.parseField(ctx, f, raw, data, lk);
            if (err) errors.push(`${f.label}: ${err}`);
        }
        if (entity === 'CRM_DEAL') this.resolveStage(data, lk, errors);
        const label = String(data.name ?? [data.first_name, data.last_name].filter(Boolean).join(' ') ?? '');
        for (const f of IMPORT_FIELDS[entity].filter((x) => x.required)) if (!data[f.key]) errors.push(`${f.label} is empty`);
        return { data, custom, errors, label };
    }

    private async parseField(ctx: OrgContext, f: ImportField, raw: string, data: Record<string, unknown>, lk: Lookups): Promise<string | null> {
        switch (f.kind) {
            case 'text':
                if (f.max && raw.length > f.max) return `longer than ${f.max} characters`;
                data[f.key] = f.key === 'country' || f.key === 'currency' ? raw.toUpperCase() : raw;
                return null;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `"${raw}" is not an email address`;
                data[f.key] = raw.toLowerCase();
                return null;
            case 'url':
                if (raw.length > 300) return 'too long';
                data[f.key] = raw;
                return null;
            case 'int': case 'number': {
                const n = Number(raw.replace(/[\s€$£%]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
                if (!Number.isFinite(n) || n < 0) return `"${raw}" is not a number`;
                if (f.kind === 'int' && !Number.isInteger(n)) return `"${raw}" is not a whole number`;
                if (f.key === 'probability' && n > 100) return 'must be 0–100';
                data[f.key] = n;
                return null;
            }
            case 'date': {
                const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : (() => {
                    const m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(raw);
                    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
                })();
                if (!iso || Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return `"${raw}" is not a date (YYYY-MM-DD or DD/MM/YYYY)`;
                data[f.key] = iso;
                return null;
            }
            case 'enum': {
                const v = f.enum?.find((e) => e.toLowerCase() === raw.toLowerCase());
                if (!v) return `"${raw}" must be one of ${f.enum?.join(', ')}`;
                data[f.key] = v;
                return null;
            }
            case 'owner': {
                const id = lk.members.get(lc(raw));
                if (!id) return `no active member with email ${raw}`;
                data.owner_membership_id = id;
                return null;
            }
            case 'company': {
                const id = await this.companyId(ctx, lk, raw);
                if (!id) return `company "${raw}" not found (import companies first)`;
                data.company_id = id;
                return null;
            }
            case 'lead_source': case 'lifecycle_stage': case 'lead_status': {
                const map = f.kind === 'lead_source' ? lk.sources : f.kind === 'lifecycle_stage' ? lk.lifecycle : lk.statuses;
                const id = map.get(lc(raw));
                if (!id) return `"${raw}" is not a known ${f.label.toLowerCase()}`;
                data[f.kind === 'lead_source' ? 'lead_source_id' : f.kind === 'lifecycle_stage' ? 'lifecycle_stage_id' : 'status_id'] = id;
                return null;
            }
            case 'pipeline': case 'stage':
                data[`_${f.kind}`] = raw;
                return null;
            case 'full_name': {
                const parts = raw.split(/\s+/);
                if (!data.first_name) data.first_name = parts[0];
                if (!data.last_name && parts.length > 1) data.last_name = parts.slice(1).join(' ');
                return null;
            }
        }
    }

    private resolveStage(data: Record<string, unknown>, lk: Lookups, errors: string[]) {
        const pipeName = data._pipeline as string | undefined;
        const stageName = data._stage as string | undefined;
        delete data._pipeline; delete data._stage;
        const pipeline = pipeName ? lk.pipelines.find((p) => lc(p.name) === lc(pipeName)) : lk.pipelines.find((p) => p.is_default) ?? lk.pipelines[0];
        if (!pipeline) { errors.push(pipeName ? `Pipeline "${pipeName}" not found` : 'No pipeline exists'); return; }
        const stage = stageName ? pipeline.stages.find((s) => lc(s.name) === lc(stageName)) : pipeline.stages.find((s) => !s.is_won && !s.is_lost);
        if (!stage) { errors.push(`Stage "${stageName}" is not in pipeline ${pipeline.name}`); return; }
        data._pipeline_ref = pipeline;
        data._stage_ref = stage;
    }

    /** Existing record id for a row by the match key, plus whether the caller may update it. */
    private async findExisting(ctx: OrgContext, entity: ImportEntity, data: Record<string, unknown>, matchKey: string): Promise<{ id: string; writable: boolean } | null> {
        const org = ctx.organization_id;
        const upd = ENTITY_KEYS[entity].update;
        const ci = (v: unknown) => ({ equals: String(v), mode: 'insensitive' as const });
        if (entity === 'CRM_COMPANY') {
            const domain = matchKey === 'domain' ? domainOf(data.website as string) : null;
            const where: Prisma.CrmCompanyWhereInput | null =
                matchKey === 'name' && data.name ? { name: ci(data.name) }
                    : matchKey === 'domain' && domain ? { website: { contains: domain, mode: 'insensitive' } }
                        : matchKey === 'vat_number' && data.vat_number ? { vat_number: ci(data.vat_number) }
                            : matchKey === 'email' && data.email ? { email: ci(data.email) } : null;
            if (!where) return null;
            const hit = await this.prisma.crmCompany.findFirst({ where: { organization_id: org, merged_into_id: null, ...where }, select: { id: true } });
            if (!hit) return null;
            const ok = await this.prisma.crmCompany.count({ where: { id: hit.id, ...companyScopeWhere(ctx, upd) } });
            return { id: hit.id, writable: ok > 0 };
        }
        if (entity === 'CRM_CONTACT') {
            const where: Prisma.CrmContactWhereInput | null =
                matchKey === 'email' && data.email ? { email: ci(data.email) }
                    : matchKey === 'name' && data.first_name && data.last_name ? { first_name: ci(data.first_name), last_name: ci(data.last_name) } : null;
            if (!where) return null;
            const hit = await this.prisma.crmContact.findFirst({ where: { organization_id: org, merged_into_id: null, ...where }, select: { id: true } });
            if (!hit) return null;
            const ok = await this.prisma.crmContact.count({ where: { id: hit.id, ...contactScopeWhere(ctx, upd) } });
            return { id: hit.id, writable: ok > 0 };
        }
        if (entity === 'CRM_LEAD') {
            const where: Prisma.CrmLeadWhereInput | null =
                matchKey === 'email' && data.email ? { email: ci(data.email) } : matchKey === 'name' && data.name ? { name: ci(data.name) } : null;
            if (!where) return null;
            const hit = await this.prisma.crmLead.findFirst({ where: { organization_id: org, merged_into_id: null, converted_at: null, ...where }, select: { id: true } });
            if (!hit) return null;
            const ok = await this.prisma.crmLead.count({ where: { id: hit.id, ...leadScopeWhere(ctx, upd) } });
            return { id: hit.id, writable: ok > 0 };
        }
        if (!data.name) return null;
        const hit = await this.prisma.crmDeal.findFirst({ where: { organization_id: org, merged_into_id: null, name: ci(data.name), ...(data.company_id ? { company_id: data.company_id as string } : {}) }, select: { id: true } });
        if (!hit) return null;
        const ok = await this.prisma.crmDeal.count({ where: { id: hit.id, ...dealScopeWhere(ctx, upd) } });
        return { id: hit.id, writable: ok > 0 };
    }

    /** Decide what happens to one row. `seen` catches duplicates inside the file during a preview. */
    private async planRow(ctx: OrgContext, entity: ImportEntity, built: BuiltRow, strategy: DuplicateStrategy, lk: Lookups, dryRunSeen?: Set<string>): Promise<{ plan: Plan; message?: string; existing_id?: string; custom?: Awaited<ReturnType<CrmCustomFieldValuesService['prepare']>> }> {
        if (built.errors.length) return { plan: 'error', message: built.errors.join('; ') };
        let existing = strategy.mode === 'create' ? null : await this.findExisting(ctx, entity, built.data, strategy.match_key);
        if (!existing && dryRunSeen && strategy.mode !== 'create') {
            const k = `${strategy.match_key}:${String(built.data[strategy.match_key === 'domain' ? 'website' : strategy.match_key === 'name' && entity === 'CRM_CONTACT' ? 'email' : strategy.match_key] ?? '').toLowerCase()}`;
            if (!k.endsWith(':')) {
                if (dryRunSeen.has(k)) existing = { id: 'in-file', writable: true };
                dryRunSeen.add(k);
            }
        }
        if (existing && strategy.mode === 'skip') return { plan: 'skip', message: 'Matches an existing record', existing_id: existing.id };
        if (existing && !existing.writable) return { plan: 'error', message: 'Matches a record outside your access' };
        let custom;
        try {
            custom = await this.cf.prepare(ctx, entity as RecordEntityType, built.custom, { creating: !existing, coerce: true, definitions: lk.defs });
        } catch (e) {
            return { plan: 'error', message: (e as { response?: { message?: string } }).response?.message ?? 'Invalid custom field' };
        }
        return existing ? { plan: 'update', existing_id: existing.id, custom } : { plan: 'create', custom };
    }

    // ---- preview / run ---------------------------------------------------------------------------------------

    /** Validate every row without writing anything (status PREVIEW). */
    async preview(ctx: OrgContext, id: string) {
        const job = await this.getJob(ctx, id);
        const entity = job.entity_type as ImportEntity;
        const strategy = (job.duplicate_strategy ?? { mode: 'skip', match_key: 'name' }) as DuplicateStrategy;
        this.assertKeys(ctx, entity, strategy.mode);
        if (job.status !== 'PENDING' && job.status !== 'PREVIEW') throw new ConflictException({ message: 'This import already ran', code: 'import_locked' });
        if (!job.field_mapping || !Object.keys(job.field_mapping as object).length) throw new BadRequestException({ message: 'Map the columns first', code: 'mapping_required' });
        await this.prisma.crmImportJob.update({ where: { id }, data: { status: 'VALIDATING' } });
        try {
            const rows = await this.readFile(ctx, id);
            const headers = rows[0];
            const lk = await this.lookups(ctx, entity);
            const seen = new Set<string>();
            const results: RowResult[] = [];
            const summary = { create: 0, update: 0, skip: 0, error: 0 };
            for (let i = 1; i < rows.length; i++) {
                const built = await this.buildRow(ctx, entity, headers, rows[i], job.field_mapping as Record<string, string>, lk);
                const p = await this.planRow(ctx, entity, built, strategy, lk, seen);
                summary[p.plan]++;
                if (results.length < PREVIEW_ROWS || (p.plan === 'error' && results.filter((r) => r.plan === 'error').length < MAX_STORED_ERRORS)) {
                    results.push({ row: i + 1, plan: p.plan, message: p.message, label: built.label, existing_id: p.existing_id === 'in-file' ? undefined : p.existing_id });
                }
            }
            await this.prisma.crmImportJob.update({ where: { id }, data: { status: 'PREVIEW', errors: { preview: summary, rows: results } as unknown as Prisma.InputJsonValue } });
            return { summary, rows: results.slice(0, PREVIEW_ROWS), total_rows: rows.length - 1 };
        } catch (e) {
            await this.prisma.crmImportJob.update({ where: { id }, data: { status: 'PENDING' } });
            throw e;
        }
    }

    /** Start the import in the background; poll `GET /crm/imports/:id` for progress. */
    async start(ctx: OrgContext, id: string) {
        const job = await this.getJob(ctx, id);
        const entity = job.entity_type as ImportEntity;
        const strategy = (job.duplicate_strategy ?? { mode: 'skip', match_key: 'name' }) as DuplicateStrategy;
        this.assertKeys(ctx, entity, strategy.mode);
        if (job.status !== 'PREVIEW') throw new ConflictException({ message: job.status === 'PENDING' ? 'Run the preview first' : 'This import already ran', code: 'import_not_ready' });
        const claimed = await this.prisma.crmImportJob.updateMany({ where: { id, status: 'PREVIEW' }, data: { status: 'IMPORTING', started_at: new Date(), started_by_membership_id: ctx.membership_id, imported_rows: 0, updated_rows: 0, skipped_rows: 0, error_rows: 0, created_record_ids: [] } });
        if (!claimed.count) throw new ConflictException({ message: 'This import is already running', code: 'import_running' });
        await this.audit.record(ctx, 'crm.records.import_started', { resource_type: 'crm_import_job', resource_id: id, metadata: { entity_type: entity, rows: job.total_rows, duplicate_strategy: strategy } });
        setImmediate(() => { void this.run(ctx, id, entity, strategy, job.field_mapping as Record<string, string>); });
        return this.findOne(ctx, id);
    }

    private async run(ctx: OrgContext, id: string, entity: ImportEntity, strategy: DuplicateStrategy, mapping: Record<string, string>) {
        const counts = { imported_rows: 0, updated_rows: 0, skipped_rows: 0, error_rows: 0 };
        const created: string[] = [];
        const errors: RowResult[] = [];
        try {
            const rows = await this.readFile(ctx, id);
            const headers = rows[0];
            const lk = await this.lookups(ctx, entity);
            for (let i = 1; i < rows.length; i++) {
                const built = await this.buildRow(ctx, entity, headers, rows[i], mapping, lk);
                try {
                    const p = await this.planRow(ctx, entity, built, strategy, lk);
                    if (p.plan === 'error') { counts.error_rows++; errors.push({ row: i + 1, plan: 'error', message: p.message, label: built.label }); }
                    else if (p.plan === 'skip') counts.skipped_rows++;
                    else if (p.plan === 'update') { await this.writeRow(ctx, entity, built, p.custom!, p.existing_id!); counts.updated_rows++; }
                    else { created.push(await this.writeRow(ctx, entity, built, p.custom!, null, lk)); counts.imported_rows++; }
                } catch (e) {
                    counts.error_rows++;
                    errors.push({ row: i + 1, plan: 'error', message: (e as { response?: { message?: string }; message?: string }).response?.message ?? (e as Error).message ?? 'Could not save', label: built.label });
                }
                if (i % 25 === 0) await this.prisma.crmImportJob.update({ where: { id }, data: { ...counts, created_record_ids: created } });
            }
            await this.prisma.crmImportJob.update({
                where: { id },
                data: { ...counts, created_record_ids: created, status: 'COMPLETED', completed_at: new Date(), errors: { rows: errors.slice(0, MAX_STORED_ERRORS) } as unknown as Prisma.InputJsonValue },
            });
            await this.audit.record(ctx, 'crm.records.imported', { resource_type: 'crm_import_job', resource_id: id, metadata: { entity_type: entity, ...counts } });
            this.events.publish(ctx, {
                event_key: 'crm.records.imported', module: ModuleKey.CRM, entity_kind: 'crm_import_job', entity_id: id,
                payload: { entity_type: entity, ...counts },
                activity: { summary: `imported ${counts.imported_rows} ${ENTITY_KEYS[entity].label} (${counts.updated_rows} updated)` },
            });
        } catch (e) {
            this.logger.error(`Import ${id} failed: ${(e as Error).message}`);
            await this.prisma.crmImportJob.update({
                where: { id },
                data: { ...counts, created_record_ids: created, status: 'FAILED', completed_at: new Date(), errors: { rows: errors, fatal: (e as Error).message } as unknown as Prisma.InputJsonValue },
            }).catch(() => undefined);
            await this.audit.record(ctx, 'crm.records.import_failed', { resource_type: 'crm_import_job', resource_id: id, outcome: 'FAILURE', metadata: { entity_type: entity, ...counts } }).catch(() => undefined);
        }
    }

    /** Create or update one record with its custom fields in one transaction. Returns the record id. */
    private async writeRow(ctx: OrgContext, entity: ImportEntity, built: BuiltRow, custom: Awaited<ReturnType<CrmCustomFieldValuesService['prepare']>>, existingId: string | null, lk?: Lookups): Promise<string> {
        const { _pipeline_ref, _stage_ref, ...data } = built.data as Record<string, any>;
        const base = { organization_id: ctx.organization_id, created_by_user_id: ctx.user_id };
        const type = entity as RecordEntityType;
        if (existingId) {
            await this.prisma.$transaction(async (tx) => {
                if (entity === 'CRM_COMPANY') await tx.crmCompany.update({ where: { id: existingId }, data: data as Prisma.CrmCompanyUpdateInput });
                else if (entity === 'CRM_CONTACT') await tx.crmContact.update({ where: { id: existingId }, data: data as Prisma.CrmContactUncheckedUpdateInput });
                else if (entity === 'CRM_LEAD') await tx.crmLead.update({ where: { id: existingId }, data: data as Prisma.CrmLeadUncheckedUpdateInput });
                else await tx.crmDeal.update({ where: { id: existingId }, data: { ...data, ...(data.expected_close_date && { expected_close_date: new Date(`${data.expected_close_date}T00:00:00Z`) }), ...(data.value !== undefined && { one_time_value: data.value }) } as Prisma.CrmDealUncheckedUpdateInput });
                await this.cf.write(tx, type, existingId, custom);
            });
            return existingId;
        }
        const owner = (data.owner_membership_id as string | undefined) ?? ctx.membership_id;
        return this.prisma.$transaction(async (tx) => {
            let recId: string;
            if (entity === 'CRM_COMPANY') {
                const lifecycle_stage_id = data.lifecycle_stage_id ?? (await tx.crmLifecycleStage.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null }, select: { id: true } }))?.id;
                const c = await tx.crmCompany.create({ data: { ...base, ...data, name: data.name, owner_membership_id: owner, lifecycle_stage_id, ...(data.type === 'CUSTOMER' && { customer_since: new Date() }) } as Prisma.CrmCompanyUncheckedCreateInput });
                if (lifecycle_stage_id) await tx.crmLifecycleHistory.create({ data: { company_id: c.id, stage_id: lifecycle_stage_id, changed_by_user_id: ctx.user_id } });
                recId = c.id;
            } else if (entity === 'CRM_CONTACT') {
                const c = await tx.crmContact.create({ data: { ...base, ...data, first_name: data.first_name, owner_membership_id: owner } as Prisma.CrmContactUncheckedCreateInput });
                recId = c.id;
            } else if (entity === 'CRM_LEAD') {
                const status_id = data.status_id ?? (await tx.crmLeadStatus.findFirst({ where: { organization_id: ctx.organization_id, is_default: true, archived_at: null }, select: { id: true } }))?.id;
                const l = await tx.crmLead.create({
                    data: { ...base, ...data, name: data.name, status_id, owner_membership_id: data.owner_membership_id ?? null, currency: data.currency ?? (data.estimated_value !== undefined ? lk?.currency : undefined), lead_source_id: data.lead_source_id } as Prisma.CrmLeadUncheckedCreateInput,
                });
                recId = l.id;
            } else {
                const p = _pipeline_ref as Lookups['pipelines'][number];
                const s = _stage_ref as Lookups['pipelines'][number]['stages'][number];
                const status = s.is_won ? 'WON' : s.is_lost ? 'LOST' : 'OPEN';
                const d = await tx.crmDeal.create({
                    data: {
                        ...base, ...data, name: data.name, pipeline_id: p.id, stage_id: s.id, status, owner_membership_id: owner,
                        value: data.value ?? 0, one_time_value: data.value ?? 0, currency: String(data.currency ?? p.currency ?? lk?.currency ?? 'EUR').toUpperCase(),
                        probability: data.probability ?? s.probability, forecast_category: s.forecast_category,
                        expected_close_date: data.expected_close_date ? new Date(`${data.expected_close_date}T00:00:00Z`) : undefined,
                        ...(status !== 'OPEN' && { actual_close_date: new Date(new Date().toISOString().slice(0, 10)) }),
                    } as Prisma.CrmDealUncheckedCreateInput,
                });
                await tx.crmDealStageHistory.create({ data: { deal_id: d.id, to_stage_id: s.id, changed_by_user_id: ctx.user_id } });
                recId = d.id;
            }
            await this.cf.write(tx, type, recId, custom);
            if (entity === 'CRM_LEAD') await this.leadRules.applyOnCreate(tx, ctx, recId, { assign: !data.owner_membership_id, fallbackOwner: ctx.membership_id });
            return recId;
        });
    }

    // ---- results ---------------------------------------------------------------------------------------------

    /** Error rows as CSV (row number, label, message). */
    async errorsCsv(ctx: OrgContext, id: string) {
        const job = await this.getJob(ctx, id);
        const rows = (((job.errors ?? {}) as { rows?: RowResult[] }).rows ?? []).filter((r) => r.plan === 'error');
        return { filename: `import-errors-${id.slice(0, 8)}.csv`, content: toCsv(['row', 'record', 'error'], rows.map((r) => [r.row, r.label, r.message])), count: rows.length };
    }

    /** Delete the records this import created (updates cannot be undone). */
    async rollback(ctx: OrgContext, id: string) {
        const job = await this.getJob(ctx, id);
        this.assertKeys(ctx, job.entity_type as ImportEntity);
        if (job.status !== 'COMPLETED' && job.status !== 'FAILED') throw new ConflictException({ message: 'Only finished imports can be rolled back', code: 'import_not_finished' });
        const ids = job.created_record_ids;
        const type = job.entity_type;
        let kept = 0;
        await this.prisma.$transaction(async (tx) => {
            let removable = ids;
            if (type === 'CRM_COMPANY') {
                const withDeals = await tx.crmDeal.findMany({ where: { company_id: { in: ids } }, select: { company_id: true }, distinct: ['company_id'] });
                const blocked = new Set(withDeals.map((d) => d.company_id));
                removable = ids.filter((x) => !blocked.has(x));
                kept = ids.length - removable.length;
            }
            await tx.tagging.deleteMany({ where: { entity_type: type, entity_id: { in: removable } } });
            await tx.crmNote.deleteMany({ where: { organization_id: ctx.organization_id, entity_type: type, entity_id: { in: removable } } });
            await tx.customFieldValue.deleteMany({ where: { entity_type: type, entity_id: { in: removable } } });
            const where = { id: { in: removable }, organization_id: ctx.organization_id };
            if (type === 'CRM_COMPANY') await tx.crmCompany.deleteMany({ where });
            else if (type === 'CRM_CONTACT') await tx.crmContact.deleteMany({ where });
            else if (type === 'CRM_LEAD') await tx.crmLead.deleteMany({ where });
            else await tx.crmDeal.deleteMany({ where });
            await tx.crmImportJob.update({ where: { id }, data: { status: 'ROLLED_BACK', rolled_back_at: new Date(), created_record_ids: ids.filter((x) => !removable.includes(x)) } });
            await this.audit.record(ctx, 'crm.records.import_rolled_back', { resource_type: 'crm_import_job', resource_id: id, metadata: { entity_type: type, deleted: removable.length, kept } }, tx);
        }, { timeout: 60_000 });
        this.events.publish(ctx, { event_key: 'crm.records.import_rolled_back', module: ModuleKey.CRM, entity_kind: 'crm_import_job', entity_id: id, payload: { entity_type: type, deleted: ids.length - kept, kept } });
        return { deleted: ids.length - kept, kept };
    }
}
