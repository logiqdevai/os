import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, TimeEntrySource, TimeImportStatus } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake, BaseListQuery } from '@/shared/utils/pagination/pagination.utils';
import { StorageService } from '@/modules/files/storage/storage.service';
import { parseCsv } from '@/modules/crm/common/csv.utils';
import { MEMBER_SELECT, TimeAccessService } from '../common/time-access.service';
import { TimeEntriesService } from '../entries/time-entries.service';

export const TIME_IMPORT_FIELDS = [
    { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
    { key: 'hours', label: 'Hours (e.g. 1.5 or 1:30)' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'start', label: 'Start time (HH:mm)' },
    { key: 'end', label: 'End time (HH:mm)' },
    { key: 'email', label: 'Member email (default: you)' },
    { key: 'project', label: 'Project (code or name)' },
    { key: 'task', label: 'Task (key, e.g. WEB-12)' },
    { key: 'activity', label: 'Activity type (name)' },
    { key: 'description', label: 'Description' },
    { key: 'billable', label: 'Billable (yes / no)' },
    { key: 'ref', label: 'External id (re-import safe)' },
] as const;
type Field = (typeof TIME_IMPORT_FIELDS)[number]['key'];

export const UploadTimeImportSchema = z.object({ file_name: z.string().max(200).optional(), csv: z.string().min(1).max(5_300_000) });
export const TimeImportMappingSchema = z.object({ columns: z.record(z.string(), z.string()) });

const MAX_ROWS = 10_000;
export interface RowError { row: number; field?: string; message: string }
interface Planned { row: number; ref: string; dto: Record<string, unknown> }

/**
 * 18 §10 — CSV import of time entries (TimeImportJob): upload (file kept in storage) → column mapping → dry-run preview →
 * background run. Every row goes through TimeEntriesService.create (same validation, rates, timesheets and the
 * create_team check when the row belongs to someone else) with source IMPORTED; external_ref makes re-imports idempotent.
 */
@Injectable()
export class TimeImportService {
    private readonly logger = new Logger(TimeImportService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly storage: StorageService,
        private readonly access: TimeAccessService,
        private readonly entries: TimeEntriesService,
    ) { }

    async list(ctx: OrgContext, query: BaseListQuery) {
        const where: Prisma.TimeImportJobWhereInput = { organization_id: ctx.organization_id };
        const [items, total] = await Promise.all([
            this.prisma.timeImportJob.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' }, include: { created_by: { select: MEMBER_SELECT } } }),
            this.prisma.timeImportJob.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        const rows = await this.rows(job);
        return { ...job, file_name: (job.mapping as { file_name?: string } | null)?.file_name ?? null, columns: rows[0] ?? [], sample: rows.slice(1, 6), fields: TIME_IMPORT_FIELDS };
    }

    async upload(ctx: OrgContext, dto: z.infer<typeof UploadTimeImportSchema>) {
        this.access.requireMembership(ctx);
        const rows = parseCsv(dto.csv);
        if (rows.length < 2) throw new BadRequestException({ message: 'The file needs a header row and at least one data row', code: 'import_empty' });
        if (rows.length - 1 > MAX_ROWS) throw new BadRequestException({ message: `At most ${MAX_ROWS} rows per import`, code: 'import_too_many_rows' });
        const job = await this.prisma.timeImportJob.create({
            data: {
                organization_id: ctx.organization_id, source: 'csv', status: TimeImportStatus.PENDING, total_rows: rows.length - 1, created_by_membership_id: ctx.membership_id,
                mapping: { file_name: dto.file_name ?? 'time.csv', columns: suggest(rows[0]) } as Prisma.InputJsonValue,
            },
        });
        await this.storage.put(this.key(ctx.organization_id, job.id), Buffer.from(dto.csv, 'utf8'), 'text/csv');
        await this.audit.record(ctx, 'time.import.uploaded', { resource_type: 'time_import_job', resource_id: job.id, metadata: { rows: job.total_rows, file_name: dto.file_name } });
        return this.findOne(ctx, job.id);
    }

    async preview(ctx: OrgContext, id: string, columns: Record<string, string>) {
        const job = await this.job(ctx, id);
        if (job.status !== TimeImportStatus.PENDING) throw new ConflictException({ message: 'This import already ran', code: 'import_already_ran' });
        const allowed = new Set<string>(TIME_IMPORT_FIELDS.map((f) => f.key));
        const clean = Object.fromEntries(Object.entries(columns).filter(([, f]) => allowed.has(f)));
        const fields = Object.values(clean);
        if (!fields.includes('date')) throw new BadRequestException({ message: 'Map a column to Date', code: 'import_date_required' });
        if (!fields.includes('hours') && !fields.includes('minutes') && !(fields.includes('start') && fields.includes('end'))) throw new BadRequestException({ message: 'Map Hours, Minutes, or Start and End', code: 'import_duration_required' });
        const rows = await this.rows(job);
        const { planned, errors } = await this.plan(ctx, rows, clean);
        const file_name = (job.mapping as { file_name?: string } | null)?.file_name;
        await this.prisma.timeImportJob.update({ where: { id }, data: { mapping: { file_name, columns: clean } as Prisma.InputJsonValue, errors: errors as unknown as Prisma.InputJsonValue } });
        const okRows = planned.filter((p) => !errors.some((e) => e.row === p.row));
        return {
            counts: { total: rows.length - 1, valid: okRows.length, errors: new Set(errors.map((e) => e.row)).size, minutes: okRows.reduce((s, p) => s + Number(p.dto.duration_minutes ?? 0), 0) },
            errors: errors.slice(0, 200),
            preview: planned.slice(0, 20).map((p) => ({ row: p.row, ...p.dto })),
        };
    }

    async run(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        if (!(job.mapping as { columns?: Record<string, string> } | null)?.columns || job.status !== TimeImportStatus.PENDING) throw new ConflictException({ message: 'Preview the import before running it', code: 'import_not_previewed' });
        const claimed = await this.prisma.timeImportJob.updateMany({ where: { id, status: TimeImportStatus.PENDING }, data: { status: TimeImportStatus.PROCESSING, started_at: new Date() } });
        if (!claimed.count) throw new ConflictException({ message: 'This import is already running', code: 'import_running' });
        await this.audit.record(ctx, 'time.import.started', { resource_type: 'time_import_job', resource_id: id, metadata: { rows: job.total_rows } });
        setImmediate(() => this.execute(ctx, id).catch((e) => this.logger.error(`Time import ${id} failed: ${(e as Error).message}`)));
        return this.job(ctx, id);
    }

    private async execute(ctx: OrgContext, id: string) {
        const job = await this.job(ctx, id);
        try {
            const rows = await this.rows(job);
            const { planned, errors } = await this.plan(ctx, rows, (job.mapping as { columns: Record<string, string> }).columns);
            const failed = new Set(errors.map((e) => e.row));
            let imported = 0, skipped = 0;
            for (const p of planned) {
                if (failed.has(p.row)) continue;
                const dup = await this.prisma.timeEntry.count({ where: { organization_id: ctx.organization_id, import_job_id: id, external_ref: p.ref } });
                if (dup) { skipped++; continue; }
                try {
                    await this.entries.create(ctx, p.dto as any, { source: TimeEntrySource.IMPORTED, import_job_id: id, external_ref: p.ref });
                    imported++;
                } catch (error) {
                    errors.push({ row: p.row, message: (error as { response?: { message?: string } })?.response?.message ?? (error as Error).message });
                    failed.add(p.row);
                }
                if (imported % 50 === 0) await this.prisma.timeImportJob.update({ where: { id }, data: { imported_rows: imported } });
            }
            await this.prisma.timeImportJob.update({ where: { id }, data: { status: TimeImportStatus.COMPLETED, completed_at: new Date(), imported_rows: imported, skipped_rows: skipped, failed_rows: failed.size, errors: errors as unknown as Prisma.InputJsonValue } });
            await this.audit.record(ctx, 'time.import.completed', { resource_type: 'time_import_job', resource_id: id, metadata: { imported, skipped, failed: failed.size } });
            this.events.publish(ctx, {
                event_key: 'time.import.completed', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_import_job', entity_id: id,
                payload: { imported, skipped, failed: failed.size, recipient_membership_ids: ctx.membership_id ? [ctx.membership_id] : [], notification_title: 'Time import finished', link: '/time/import' },
            });
        } catch (error) {
            await this.prisma.timeImportJob.update({ where: { id }, data: { status: TimeImportStatus.FAILED, completed_at: new Date(), errors: [{ row: 0, message: (error as Error).message }] as unknown as Prisma.InputJsonValue } });
        }
    }

    /** Rows → CreateTimeEntryDto with lookups (member, project, task, activity) and format checks; no writes. */
    private async plan(ctx: OrgContext, rows: string[][], columns: Record<string, string>) {
        const header = rows[0] ?? [];
        const index = new Map<Field, number>();
        for (const [col, f] of Object.entries(columns)) { const i = header.indexOf(col); if (i >= 0) index.set(f as Field, i); }
        const org = ctx.organization_id;
        const [members, projects, activities, tasks] = await Promise.all([
            this.prisma.membership.findMany({ where: { organization_id: org, status: 'ACTIVE' }, select: { id: true, user: { select: { email: true } } } }),
            this.prisma.project.findMany({ where: { organization_id: org }, select: { id: true, name: true, code: true } }),
            this.prisma.timeActivityType.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true } }),
            index.has('task') ? this.prisma.task.findMany({ where: { organization_id: org }, select: { id: true, number: true, project_id: true, team: { select: { task_key: true } } } }) : Promise.resolve([]),
        ]);
        const byEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m.id]));
        const byProject = new Map<string, string>();
        for (const p of projects) { byProject.set(p.name.toLowerCase(), p.id); if (p.code) byProject.set(p.code.toLowerCase(), p.id); }
        const byActivity = new Map(activities.map((a) => [a.name.toLowerCase(), a.id]));
        const byTask = new Map(tasks.map((t) => [`${t.team?.task_key ?? ''}-${t.number}`.toLowerCase(), t]));
        const errors: RowError[] = [];
        const planned: Planned[] = [];
        const seenRefs = new Set<string>();
        rows.slice(1).forEach((r, i) => {
            const row = i + 2;
            const get = (f: Field) => (index.has(f) ? (r[index.get(f)!] ?? '').trim() : '');
            const err = (field: string, message: string) => errors.push({ row, field, message });
            const dto: Record<string, unknown> = {};
            const date = get('date');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) err('date', 'Use YYYY-MM-DD'); else dto.date = date;
            const hours = get('hours'), minutes = get('minutes'), start = get('start'), end = get('end');
            let duration: number | null = null;
            if (hours) {
                const m = /^(\d+):([0-5]\d)$/.exec(hours);
                const n = m ? Number(m[1]) + Number(m[2]) / 60 : Number(hours.replace(',', '.'));
                if (Number.isFinite(n) && n > 0) duration = Math.round(n * 60); else err('hours', `Not a number of hours: “${hours}”`);
            } else if (minutes) {
                const n = Number(minutes);
                if (Number.isInteger(n) && n > 0) duration = n; else err('minutes', `Not a number of minutes: “${minutes}”`);
            } else if (start && end && dto.date) {
                const t = (v: string) => /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
                const s = t(start), e = t(end);
                if (!s || !e) err('start', 'Use HH:mm for start and end');
                else duration = (Number(e[1]) * 60 + Number(e[2])) - (Number(s[1]) * 60 + Number(s[2]));
                if (duration !== null && duration <= 0) { err('end', 'End is before start'); duration = null; }
            }
            if (duration === null && !errors.some((x) => x.row === row)) err('hours', 'A duration is required');
            if (duration !== null) { if (duration > 1440) err('hours', 'More than 24 hours'); else dto.duration_minutes = duration; }
            const email = get('email').toLowerCase();
            if (email) { const m = byEmail.get(email); if (!m) err('email', `No active member with email ${email}`); else if (m !== ctx.membership_id) dto.membership_id = m; }
            const project = get('project');
            if (project) { const p = byProject.get(project.toLowerCase()); if (p) dto.project_id = p; else err('project', `No project “${project}”`); }
            const task = get('task');
            if (task) {
                const t = byTask.get(task.toLowerCase()) ?? byTask.get(`-${task.replace(/^#/, '')}`.toLowerCase());
                if (!t) err('task', `No task “${task}”`);
                else { dto.task_id = t.id; if (!dto.project_id && t.project_id) dto.project_id = t.project_id; }
            }
            const activity = get('activity');
            if (activity) { const a = byActivity.get(activity.toLowerCase()); if (a) dto.activity_type_id = a; else err('activity', `No activity type “${activity}”`); }
            const description = get('description');
            if (description) dto.description = description.slice(0, 2000);
            const billable = get('billable').toLowerCase();
            if (billable) {
                if (['yes', 'y', 'true', '1', 'billable'].includes(billable)) dto.is_billable = true;
                else if (['no', 'n', 'false', '0', 'non-billable'].includes(billable)) dto.is_billable = false;
                else err('billable', 'Use yes or no');
            }
            const ref = get('ref') || `row-${row}`;
            if (seenRefs.has(ref)) err('ref', `Duplicate external id “${ref}”`);
            seenRefs.add(ref);
            planned.push({ row, ref, dto });
        });
        return { planned, errors };
    }

    private async rows(job: { id: string; organization_id: string }) {
        const stream = await this.storage.getStream(this.key(job.organization_id, job.id)).catch(() => null);
        if (!stream) throw new NotFoundException({ message: 'The uploaded file is no longer available. Upload it again.', code: 'import_file_missing' });
        const chunks: Buffer[] = [];
        for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
        return parseCsv(Buffer.concat(chunks).toString('utf8'));
    }

    private key(orgId: string, jobId: string) {
        return `org/${orgId}/imports/time/${jobId}.csv`;
    }

    private async job(ctx: OrgContext, id: string) {
        const job = await this.prisma.timeImportJob.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { created_by: { select: MEMBER_SELECT } } });
        if (!job) throw new NotFoundException({ message: 'Import not found', code: 'import_not_found' });
        return job;
    }
}

function suggest(header: string[]) {
    const aliases: Record<Field, string[]> = {
        date: ['date', 'day', 'spent on', 'work date'],
        hours: ['hours', 'duration', 'time', 'hours spent'],
        minutes: ['minutes', 'mins'],
        start: ['start', 'start time', 'from'],
        end: ['end', 'end time', 'to'],
        email: ['email', 'user', 'member', 'user email', 'employee email'],
        project: ['project', 'project name', 'project code'],
        task: ['task', 'issue', 'ticket', 'task key'],
        activity: ['activity', 'activity type', 'type', 'category'],
        description: ['description', 'notes', 'note', 'comment'],
        billable: ['billable', 'is billable'],
        ref: ['id', 'ref', 'external id', 'entry id'],
    };
    const out: Record<string, string> = {};
    const used = new Set<string>();
    for (const h of header) {
        const n = h.toLowerCase().replace(/[_\-.]+/g, ' ').trim();
        const hit = (Object.entries(aliases) as [Field, string[]][]).find(([f, names]) => !used.has(f) && names.includes(n));
        if (hit) { out[h] = hit[0]; used.add(hit[0]); }
    }
    return out;
}
