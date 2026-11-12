import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmployeeImportStatus, EmployeeWorkLocation, EmploymentStatus, EmploymentType, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuery, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '@/modules/files/storage/storage.service';
import { parseCsv } from '@/modules/crm/common/csv.utils';
import { EmployeesService } from '../employees/employees.service';
import { P } from '../common/people.utils';

/** Employee fields a CSV column can map to (EmployeeImportJob.mapping.columns: { "<header>": "<field>" }). */
export const IMPORT_FIELDS = [
    { key: 'email', label: 'Work email', required: true },
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'preferred_name', label: 'Preferred name' },
    { key: 'employee_number', label: 'Employee number' },
    { key: 'job_title', label: 'Job title' },
    { key: 'department', label: 'Department (team name)' },
    { key: 'branch', label: 'Branch (name)' },
    { key: 'manager_email', label: 'Manager email' },
    { key: 'employment_type', label: 'Employment type' },
    { key: 'employment_status', label: 'Employment status' },
    { key: 'work_location', label: 'Work location' },
    { key: 'hire_date', label: 'Hire date (YYYY-MM-DD)' },
    { key: 'work_phone', label: 'Work phone' },
    { key: 'weekly_capacity_hours', label: 'Weekly hours' },
] as const;
type FieldKey = (typeof IMPORT_FIELDS)[number]['key'];

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RowError { row: number; field?: string; message: string }
interface Lookups {
    teams: Map<string, string>;
    branches: Map<string, string>;
    /** lower-case email → employee id (work email or member email). */
    employees: Map<string, string>;
    numbers: Map<string, string>;
}
interface Planned { row: number; action: 'create' | 'update' | 'skip'; employee_id?: string; data: Record<string, unknown>; email: string; first_name?: string; last_name?: string; manager_email?: string }

/**
 * 10 "Employee Directory" — CSV import: upload (file kept in storage), column mapping, dry-run preview with per-row
 * errors, then a background run that creates or updates employees through EmployeesService (same validation,
 * numbering, audit and events as the form). EmployeeImportJob holds status, counters and errors.
 */
@Injectable()
export class EmployeeImportService {
    private readonly logger = new Logger(EmployeeImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly storage: StorageService,
        private readonly employees: EmployeesService,
    ) { }

    fields() {
        return IMPORT_FIELDS;
    }

    async list(ctx: OrgContext, query: BaseListQuery) {
        const where: Prisma.EmployeeImportJobWhereInput = { organization_id: ctx.organization_id };
        const [items, total] = await Promise.all([
            this.prisma.employeeImportJob.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' } }),
            this.prisma.employeeImportJob.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        const rows = await this.rows(job);
        return { ...job, columns: rows[0] ?? [], sample: rows.slice(1, 6), fields: IMPORT_FIELDS };
    }

    /** Upload: parse the header, store the file, suggest a mapping by header name. */
    async upload(ctx: OrgContext, dto: { file_name?: string; csv: string }) {
        if (Buffer.byteLength(dto.csv, 'utf8') > MAX_BYTES) throw new BadRequestException({ message: 'The file is larger than 5 MB', code: 'import_too_large' });
        const rows = parseCsv(dto.csv);
        if (rows.length < 2) throw new BadRequestException({ message: 'The file needs a header row and at least one data row', code: 'import_empty' });
        if (rows.length - 1 > MAX_ROWS) throw new BadRequestException({ message: `At most ${MAX_ROWS} rows per import`, code: 'import_too_many_rows' });
        const header = rows[0];
        const job = await this.prisma.employeeImportJob.create({
            data: { organization_id: ctx.organization_id, status: EmployeeImportStatus.PENDING, file_name: dto.file_name ?? 'employees.csv', total_rows: rows.length - 1, created_by_user_id: ctx.user_id, mapping: { columns: suggest(header), update_existing: false } as Prisma.InputJsonValue },
        });
        await this.storage.put(this.key(ctx.organization_id, job.id), Buffer.from(dto.csv, 'utf8'), 'text/csv');
        await this.audit.record(ctx, 'employee_import.uploaded', { resource_type: 'employee_import_job', resource_id: job.id, metadata: { file_name: job.file_name, rows: job.total_rows } });
        return this.findOne(ctx, job.id);
    }

    /** Save the mapping and validate every row (dry run). Returns counts, per-row errors and a preview of the first rows. */
    async preview(ctx: OrgContext, id: string, dto: { columns: Record<string, string>; update_existing?: boolean }) {
        const job = await this.job(ctx, id);
        if (job.status === EmployeeImportStatus.IMPORTING || job.status === EmployeeImportStatus.COMPLETED) throw new ConflictException({ message: 'This import already ran', code: 'import_already_ran' });
        if (dto.update_existing && !ctx.can(P.update)) throw new ForbiddenException({ message: 'Updating existing employees needs employees.employees.update', code: 'permission_denied', permissions: [P.update] });
        const fields = new Set<string>(IMPORT_FIELDS.map((f) => f.key));
        const columns = Object.fromEntries(Object.entries(dto.columns).filter(([, f]) => f && fields.has(f)));
        if (!Object.values(columns).includes('email')) throw new BadRequestException({ message: 'Map a column to Work email', code: 'import_email_required' });
        const rows = await this.rows(job);
        const plan = await this.plan(ctx, rows, columns, !!dto.update_existing);
        const counts = { create: plan.planned.filter((p) => p.action === 'create').length, update: plan.planned.filter((p) => p.action === 'update').length, skip: plan.planned.filter((p) => p.action === 'skip').length };
        await this.prisma.employeeImportJob.update({
            where: { id },
            data: {
                status: EmployeeImportStatus.PREVIEW, mapping: { columns, update_existing: !!dto.update_existing } as Prisma.InputJsonValue,
                total_rows: rows.length - 1, error_rows: new Set(plan.errors.map((e) => e.row)).size, errors: plan.errors as unknown as Prisma.InputJsonValue,
            },
        });
        return {
            counts: { ...counts, errors: new Set(plan.errors.map((e) => e.row)).size, total: rows.length - 1 },
            errors: plan.errors.slice(0, 200),
            preview: plan.planned.slice(0, 20).map((p) => ({ row: p.row, action: p.action, email: p.email, ...p.data, manager_email: p.manager_email })),
        };
    }

    /** Start the import in the background; the client polls the job. Rows with errors are skipped. */
    async run(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        if (job.status !== EmployeeImportStatus.PREVIEW) throw new ConflictException({ message: 'Preview the import before running it', code: 'import_not_previewed' });
        const claimed = await this.prisma.employeeImportJob.updateMany({ where: { id, status: EmployeeImportStatus.PREVIEW }, data: { status: EmployeeImportStatus.IMPORTING, started_at: new Date(), created_rows: 0, updated_rows: 0, skipped_rows: 0 } });
        if (!claimed.count) throw new ConflictException({ message: 'This import is already running', code: 'import_running' });
        await this.audit.record(ctx, 'employee_import.started', { resource_type: 'employee_import_job', resource_id: id, metadata: { rows: job.total_rows } });
        setImmediate(() => this.execute(ctx, id).catch((e) => this.logger.error(`Employee import ${id} failed: ${(e as Error).message}`)));
        return this.job(ctx, id);
    }

    private async execute(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        const mapping = (job.mapping ?? {}) as { columns?: Record<string, string>; update_existing?: boolean };
        try {
            const rows = await this.rows(job);
            const { planned, errors } = await this.plan(ctx, rows, mapping.columns ?? {}, !!mapping.update_existing);
            const failed = new Set(errors.map((e) => e.row));
            let created = 0, updated = 0, skipped = 0;
            const createdIds = new Map<string, string>();
            for (const p of planned) {
                if (failed.has(p.row) || p.action === 'skip') { skipped++; continue; }
                try {
                    if (p.action === 'create') {
                        const e = await this.employees.create(ctx, { ...(p.data as any), new_hire: { email: p.email, first_name: p.first_name || p.email.split('@')[0], last_name: p.last_name || '-' } });
                        createdIds.set(p.email.toLowerCase(), e.id);
                        created++;
                    } else if (p.employee_id) {
                        await this.employees.update(ctx, p.employee_id, p.data as any);
                        updated++;
                    }
                } catch (error) {
                    errors.push({ row: p.row, message: errorMessage(error) });
                    failed.add(p.row);
                }
                if ((created + updated) % 25 === 0) await this.prisma.employeeImportJob.update({ where: { id }, data: { created_rows: created, updated_rows: updated } });
            }
            // Second pass: managers that were created in this same file.
            const lookups = await this.lookups(ctx);
            for (const p of planned) {
                if (failed.has(p.row) || p.action === 'skip' || !p.manager_email) continue;
                const managerId = lookups.employees.get(p.manager_email.toLowerCase());
                const selfId = p.employee_id ?? createdIds.get(p.email.toLowerCase());
                if (!managerId || !selfId || managerId === selfId) continue;
                try { await this.employees.update(ctx, selfId, { manager_employee_id: managerId } as any); } catch (error) { errors.push({ row: p.row, field: 'manager_email', message: errorMessage(error) }); }
            }
            await this.prisma.employeeImportJob.update({
                where: { id },
                data: { status: EmployeeImportStatus.COMPLETED, completed_at: new Date(), created_rows: created, updated_rows: updated, skipped_rows: skipped, error_rows: failed.size, errors: errors as unknown as Prisma.InputJsonValue },
            });
            await this.audit.record(ctx, 'employee_import.completed', { resource_type: 'employee_import_job', resource_id: id, metadata: { created, updated, skipped, errors: failed.size } });
            this.events.publish(ctx, {
                event_key: 'employees.import.completed', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_import_job', entity_id: id,
                payload: { created, updated, skipped, errors: failed.size, recipient_membership_ids: ctx.membership_id ? [ctx.membership_id] : [], notification_title: 'Employee import finished', link: '/people/import' },
            });
        } catch (error) {
            await this.prisma.employeeImportJob.update({ where: { id }, data: { status: EmployeeImportStatus.FAILED, completed_at: new Date(), errors: [{ row: 0, message: errorMessage(error) }] as unknown as Prisma.InputJsonValue } });
            await this.audit.record(ctx, 'employee_import.failed', { resource_type: 'employee_import_job', resource_id: id, metadata: { error: errorMessage(error) } });
        }
    }

    /** Turn the file into create / update / skip actions with per-row validation (no writes). */
    private async plan(ctx: OrgContext, rows: string[][], columns: Record<string, string>, updateExisting: boolean) {
        const header = rows[0] ?? [];
        const index = new Map<FieldKey, number>();
        for (const [column, field] of Object.entries(columns)) {
            const i = header.indexOf(column);
            if (i >= 0) index.set(field as FieldKey, i);
        }
        const lookups = await this.lookups(ctx);
        const fileEmails = new Set(rows.slice(1).map((r) => (index.has('email') ? (r[index.get('email')!] ?? '').toLowerCase() : '')).filter(Boolean));
        const seen = new Set<string>();
        const errors: RowError[] = [];
        const planned: Planned[] = [];
        rows.slice(1).forEach((r, i) => {
            const row = i + 2; // 1-based, header is row 1
            const get = (f: FieldKey) => (index.has(f) ? (r[index.get(f)!] ?? '').trim() : '');
            const err = (field: string, message: string) => errors.push({ row, field, message });
            const email = get('email').toLowerCase();
            if (!email || !EMAIL.test(email)) err('email', 'A valid work email is required');
            if (email && seen.has(email)) err('email', 'Duplicate email in the file');
            seen.add(email);
            const data: Record<string, unknown> = {};
            const text = (f: FieldKey, max = 120) => { const v = get(f); if (v) { if (v.length > max) err(f, `Longer than ${max} characters`); data[f] = v; } };
            text('preferred_name'); text('job_title'); text('employee_number', 40); text('work_phone', 40);
            const dept = get('department');
            if (dept) { const t = lookups.teams.get(dept.toLowerCase()); if (t) data.department_team_id = t; else err('department', `No team named “${dept}”`); }
            const branch = get('branch');
            if (branch) { const b = lookups.branches.get(branch.toLowerCase()); if (b) data.primary_branch_id = b; else err('branch', `No branch named “${branch}”`); }
            const enumOf = <T extends string>(f: FieldKey, values: Record<string, T>, key: string) => {
                const v = get(f); if (!v) return;
                const norm = v.toUpperCase().replace(/[\s-]+/g, '_');
                if ((Object.values(values) as string[]).includes(norm)) data[key] = norm; else err(f, `Unknown value “${v}”`);
            };
            enumOf('employment_type', EmploymentType, 'employment_type');
            enumOf('employment_status', EmploymentStatus, 'employment_status');
            enumOf('work_location', EmployeeWorkLocation, 'work_location');
            const hire = get('hire_date');
            if (hire) { if (/^\d{4}-\d{2}-\d{2}$/.test(hire) && !Number.isNaN(Date.parse(hire))) data.hire_date = hire; else err('hire_date', 'Use YYYY-MM-DD'); }
            const hours = get('weekly_capacity_hours');
            if (hours) { const n = Number(hours.replace(',', '.')); if (Number.isFinite(n) && n >= 0 && n <= 80) data.weekly_capacity_hours = n; else err('weekly_capacity_hours', 'Between 0 and 80'); }
            const manager = get('manager_email').toLowerCase();
            if (manager && !lookups.employees.has(manager) && !fileEmails.has(manager)) err('manager_email', `No employee with email ${manager}`);
            if (manager && manager === email) err('manager_email', 'An employee cannot report to themselves');
            const existing = (email && lookups.employees.get(email)) || (data.employee_number ? lookups.numbers.get(String(data.employee_number)) : undefined);
            const action: Planned['action'] = existing ? (updateExisting ? 'update' : 'skip') : 'create';
            if (action === 'update') delete data.employee_number;
            if (action === 'create') { const first = get('first_name'), last = get('last_name'); if (!first && !last && !data.preferred_name) err('first_name', 'A first or last name is required for a new employee'); }
            planned.push({ row, action, employee_id: existing, data, email, first_name: get('first_name'), last_name: get('last_name'), manager_email: manager || undefined });
        });
        return { planned, errors };
    }

    private async lookups(ctx: OrgContext): Promise<Lookups> {
        const org = ctx.organization_id;
        const [teams, branches, employees] = await Promise.all([
            this.prisma.team.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true } }),
            this.prisma.branch.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true } }),
            this.prisma.employee.findMany({ where: { organization_id: org }, select: { id: true, work_email: true, employee_number: true, membership: { select: { user: { select: { email: true } } } } } }),
        ]);
        const emp = new Map<string, string>();
        for (const e of employees) {
            if (e.membership.user.email) emp.set(e.membership.user.email.toLowerCase(), e.id);
            if (e.work_email) emp.set(e.work_email.toLowerCase(), e.id);
        }
        return {
            teams: new Map(teams.map((t) => [t.name.toLowerCase(), t.id])),
            branches: new Map(branches.map((b) => [b.name.toLowerCase(), b.id])),
            employees: emp,
            numbers: new Map(employees.map((e) => [e.employee_number, e.id])),
        };
    }

    private async rows(job: { id: string; organization_id: string }) {
        const stream = await this.storage.getStream(this.key(job.organization_id, job.id)).catch(() => null);
        if (!stream) throw new NotFoundException({ message: 'The uploaded file is no longer available. Upload it again.', code: 'import_file_missing' });
        const chunks: Buffer[] = [];
        for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
        return parseCsv(Buffer.concat(chunks).toString('utf8'));
    }

    private key(orgId: string, jobId: string) {
        return `org/${orgId}/imports/employees/${jobId}.csv`;
    }

    private async job(ctx: OrgContext, id: string) {
        const job = await this.prisma.employeeImportJob.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!job) throw new NotFoundException({ message: 'Import not found', code: 'import_not_found' });
        return job;
    }
}

/** Header → field by common names ("E-mail", "Job title", "Manager email" …). */
function suggest(header: string[]) {
    const aliases: Record<FieldKey, string[]> = {
        email: ['email', 'work email', 'e-mail', 'mail'],
        first_name: ['first name', 'firstname', 'given name'],
        last_name: ['last name', 'lastname', 'surname', 'family name'],
        preferred_name: ['preferred name', 'name', 'display name', 'full name'],
        employee_number: ['employee number', 'employee id', 'emp no', 'number'],
        job_title: ['job title', 'title', 'position', 'role'],
        department: ['department', 'team'],
        branch: ['branch', 'office', 'location'],
        manager_email: ['manager email', 'manager', 'reports to'],
        employment_type: ['employment type', 'type', 'contract type'],
        employment_status: ['status', 'employment status'],
        work_location: ['work location', 'remote'],
        hire_date: ['hire date', 'start date', 'joined'],
        work_phone: ['phone', 'work phone', 'mobile'],
        weekly_capacity_hours: ['weekly hours', 'hours per week', 'capacity'],
    };
    const out: Record<string, string> = {};
    const used = new Set<string>();
    for (const h of header) {
        const n = h.toLowerCase().replace(/[_\-.]+/g, ' ').trim();
        const hit = (Object.entries(aliases) as [FieldKey, string[]][]).find(([f, names]) => !used.has(f) && names.includes(n));
        if (hit) { out[h] = hit[0]; used.add(hit[0]); }
    }
    return out;
}

function errorMessage(error: unknown) {
    const r = (error as { response?: { message?: unknown } })?.response;
    if (r && typeof r.message === 'string') return r.message;
    return (error as Error)?.message ?? 'Unknown error';
}
