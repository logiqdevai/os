import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CommChannel, CommMessageKind, ModuleKey, Prisma, TimeReportFormat, TimeReportFrequency } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { StorageService } from '@/modules/files/storage/storage.service';
import { MessagesService } from '@/modules/communications/messages/messages.service';
import { MEMBER_SELECT } from '../common/time-access.service';
import { addDays, isoDate, toDateOnly } from '../common/time-dates';
import { TimeReportsService } from '../reports/time-reports.service';

const EXPORT = 'time.entries.export';
const REPORTS = 'time.reports.read';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Report keys a schedule can send; each is the hours summary grouped differently plus the entries CSV. */
export const SCHEDULE_REPORTS = [
    { key: 'hours_by_project', label: 'Hours by project', group_by: 'project' },
    { key: 'hours_by_customer', label: 'Hours by customer', group_by: 'customer' },
    { key: 'hours_by_employee', label: 'Hours by person', group_by: 'member' },
    { key: 'hours_by_activity', label: 'Hours by activity', group_by: 'activity' },
] as const;

export const ScheduleSchema = z.object({
    name: z.string().trim().min(1).max(120),
    report_key: z.enum(SCHEDULE_REPORTS.map((r) => r.key) as [string, ...string[]]),
    filters: z.object({
        scope: z.enum(['mine', 'team', 'all']).optional(),
        project_id: z.string().uuid().optional(),
        company_id: z.string().uuid().optional(),
        membership_id: z.string().uuid().optional(),
        billable: z.boolean().optional(),
    }).default({}),
    frequency: z.nativeEnum(TimeReportFrequency),
    day_of_week: z.number().int().min(1).max(7).optional(),
    day_of_month: z.number().int().min(1).max(28).optional(),
    time_of_day: z.string().regex(HHMM).default('08:00'),
    timezone: z.string().min(1).max(60).default('UTC'),
    recipient_membership_ids: z.array(z.string().uuid()).max(50).default([]),
    recipient_emails: z.array(z.string().email()).max(50).default([]),
    is_active: z.boolean().default(true),
});
export type ScheduleInput = z.infer<typeof ScheduleSchema>;
export const UpdateScheduleSchema = ScheduleSchema.partial();

/**
 * 18 §10 — scheduled time reports (TimeReportSchedule). Every minute due schedules are claimed (next_run_at moved
 * forward first, so two API instances never send twice) and run AS THEIR CREATOR: the creator's current permissions
 * and scope decide what the report contains (never more than they could export by hand). The CSV is logged as a
 * TimeExport (schedule_id) and stored; recipients get an in-app notification (14) and an e-mail through
 * Communications (11) — sending e-mail needs the creator to hold communications.messages.send and the org's provider.
 */
@Injectable()
export class TimeReportSchedulesService {
    private readonly logger = new Logger(TimeReportSchedulesService.name);
    private running = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly storage: StorageService,
        private readonly reports: TimeReportsService,
        private readonly messages: MessagesService,
    ) { }

    reportKeys() {
        return SCHEDULE_REPORTS;
    }

    list(ctx: OrgContext) {
        return this.prisma.timeReportSchedule.findMany({
            where: { organization_id: ctx.organization_id, ...(!ctx.can('time.entries.read_all') && { created_by_membership_id: ctx.membership_id ?? '__none__' }) },
            orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
            include: { created_by: { select: MEMBER_SELECT }, exports: { orderBy: { created_at: 'desc' }, take: 5, select: { id: true, status: true, row_count: true, created_at: true, error: true } } },
        });
    }

    async create(ctx: OrgContext, input: ScheduleInput) {
        await this.validate(ctx, input);
        const row = await this.prisma.timeReportSchedule.create({
            data: { ...this.data(input), organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id, next_run_at: input.is_active ? nextRun(input, new Date()) : null },
        });
        await this.audit.record(ctx, 'time.report_schedule.created', { resource_type: 'time_report_schedule', resource_id: row.id, metadata: { after: input } });
        this.events.publish(ctx, { event_key: 'time.report_schedule.created', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_report_schedule', entity_id: row.id, payload: { name: row.name, frequency: row.frequency } });
        return row;
    }

    async update(ctx: OrgContext, id: string, input: Partial<ScheduleInput>) {
        const before = await this.own(ctx, id);
        const merged = { ...this.toInput(before), ...input } as ScheduleInput;
        await this.validate(ctx, merged);
        const row = await this.prisma.timeReportSchedule.update({ where: { id }, data: { ...this.data(merged), next_run_at: merged.is_active ? nextRun(merged, new Date()) : null, last_error: merged.is_active ? before.last_error : null } });
        await this.audit.record(ctx, 'time.report_schedule.updated', { resource_type: 'time_report_schedule', resource_id: id, metadata: { before: this.toInput(before), after: input } });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        await this.own(ctx, id);
        await this.prisma.timeReportSchedule.delete({ where: { id } });
        await this.audit.record(ctx, 'time.report_schedule.deleted', { resource_type: 'time_report_schedule', resource_id: id });
        return { success: true };
    }

    /** Send now (does not move the regular schedule). */
    async runNow(ctx: OrgContext, id: string) {
        const s = await this.own(ctx, id);
        return this.execute(s, ctx);
    }

    /** Download a stored export CSV (own exports, or any with time.entries.read_all). */
    async download(ctx: OrgContext, exportId: string) {
        const exp = await this.prisma.timeExport.findFirst({ where: { id: exportId, organization_id: ctx.organization_id, ...(!ctx.can('time.entries.read_all') && { created_by_membership_id: ctx.membership_id ?? '__none__' }) } });
        if (!exp) throw new NotFoundException({ message: 'Export not found', code: 'export_not_found' });
        const stream = await this.storage.getStream(exportKey(ctx.organization_id, exp.id)).catch(() => null);
        if (!stream) throw new NotFoundException({ message: 'The file of this export is not stored', code: 'export_file_missing' });
        await this.audit.record(ctx, 'time.export.downloaded', { resource_type: 'time_export', resource_id: exp.id });
        return { stream, filename: `time-report_${isoDate(exp.created_at)}.csv` };
    }

    // ------------------------------------------------------------------ worker

    @Interval('time-report-schedules', 60_000)
    async tick() {
        if (this.running) return;
        this.running = true;
        try {
            const due = await this.prisma.timeReportSchedule.findMany({ where: { is_active: true, next_run_at: { lte: new Date() } }, take: 20 });
            for (const s of due) {
                // Claim: move next_run_at first; another instance that read the same row loses the updateMany.
                const next = nextRun(this.toInput(s), new Date(Math.max(Date.now(), s.next_run_at!.getTime()) + 60_000));
                const claimed = await this.prisma.timeReportSchedule.updateMany({ where: { id: s.id, next_run_at: s.next_run_at }, data: { next_run_at: next } });
                if (!claimed.count) continue;
                if (!s.created_by_membership_id) { await this.fail(s.id, 'The schedule has no owner; recreate it.'); continue; }
                const ctx = await this.authorization.contextFor({ organization_id: s.organization_id, membership_id: s.created_by_membership_id, channel: 'automation' });
                await this.execute(s, ctx).catch((e) => this.fail(s.id, (e as Error).message));
            }
        } catch (e) {
            this.logger.warn(`Report schedule tick failed: ${(e as Error).message}`);
        } finally {
            this.running = false;
        }
    }

    private async execute(s: Prisma.TimeReportScheduleGetPayload<object>, ctx: OrgContext) {
        if (!ctx.can(EXPORT) || !ctx.can(REPORTS)) {
            await this.fail(s.id, 'The owner no longer has time.entries.export and time.reports.read');
            throw new ForbiddenException({ message: 'The schedule owner needs time.entries.export and time.reports.read', code: 'permission_denied' });
        }
        const filters = (s.filters ?? {}) as ScheduleInput['filters'];
        const { from, to } = reportRange(s.frequency, s.timezone);
        const report = SCHEDULE_REPORTS.find((r) => r.key === s.report_key) ?? SCHEDULE_REPORTS[0];
        const q = { from: isoDate(from), to: isoDate(to), group_by: report.group_by, scope: filters.scope, project_id: filters.project_id, company_id: filters.company_id, membership_id: filters.membership_id, billable: filters.billable } as const;
        const summary = await this.reports.summary(ctx, q as any);
        const file = await this.reports.exportCsv(ctx, q as any);
        await this.prisma.timeExport.update({ where: { id: file.export_id }, data: { schedule_id: s.id, report_key: s.report_key } });
        await this.storage.put(exportKey(s.organization_id, file.export_id), Buffer.from(`﻿${file.csv}`, 'utf8'), 'text/csv');

        const title = `${s.name}: ${isoDate(from)} – ${isoDate(to)}`;
        const rows = summary.groups.slice(0, 25);
        const hours = (m?: number) => ((m ?? 0) / 60).toFixed(1);
        const html = `<h2 style="font-family:sans-serif">${esc(title)}</h2><table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">`
            + `<tr><th align="left">${esc(report.label.replace('Hours by ', ''))}</th><th align="right">Hours</th><th align="right">Billable</th></tr>`
            + rows.map((r) => `<tr><td>${esc(r.label)}</td><td align="right">${hours(r.total_minutes)}</td><td align="right">${hours(r.billable_minutes)}</td></tr>`).join('')
            + `</table><p style="font-family:sans-serif;font-size:13px">${file.row_count} entries. Download the CSV in Logiqdev → Time → Reports → Scheduled.</p>`;

        // In-app (14) for member recipients; e-mail (11) for members and external addresses.
        if (s.recipient_membership_ids.length) {
            this.events.publish(ctx, {
                event_key: 'time.report_schedule.sent', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_report_schedule', entity_id: s.id,
                payload: { export_id: file.export_id, recipient_membership_ids: s.recipient_membership_ids, notification_title: title, notification_body: `${file.row_count} entries`, link: '/time/reports?tab=scheduled' },
            });
        }
        const memberEmails = s.recipient_membership_ids.length
            ? (await this.prisma.membership.findMany({ where: { id: { in: s.recipient_membership_ids }, organization_id: s.organization_id, status: 'ACTIVE' }, select: { user: { select: { email: true } } } })).map((m) => m.user.email)
            : [];
        const to_addresses = [...new Set([...memberEmails, ...s.recipient_emails].map((e) => e.toLowerCase()))];
        const failures: string[] = [];
        for (const address of to_addresses) {
            try {
                const msg = await this.messages.create(ctx, { channel: CommChannel.EMAIL, to_address: address, subject: title, body_html: html, kind: CommMessageKind.TRANSACTIONAL });
                if ((msg as { status?: string }).status === 'FAILED') failures.push(`${address}: ${(msg as { failure_reason?: string }).failure_reason ?? 'failed'}`);
            } catch (e) {
                failures.push(`${address}: ${(e as { response?: { message?: string } })?.response?.message ?? (e as Error).message}`);
            }
        }
        const error = failures.length ? `E-mail not sent to ${failures.length} recipient(s): ${failures[0]}` : null;
        await this.prisma.timeReportSchedule.update({ where: { id: s.id }, data: { last_run_at: new Date(), last_error: error } });
        await this.audit.record(ctx, 'time.report_schedule.run', { resource_type: 'time_report_schedule', resource_id: s.id, metadata: { export_id: file.export_id, rows: file.row_count, emails: to_addresses.length, failures: failures.length } });
        return { export_id: file.export_id, row_count: file.row_count, emailed: to_addresses.length - failures.length, error };
    }

    // ------------------------------------------------------------------ helpers

    private async fail(id: string, message: string) {
        await this.prisma.timeReportSchedule.update({ where: { id }, data: { last_error: message.slice(0, 500), last_run_at: new Date() } }).catch(() => undefined);
    }

    private async validate(ctx: OrgContext, input: ScheduleInput) {
        if (input.frequency === 'WEEKLY' && !input.day_of_week) throw new BadRequestException({ message: 'Pick the weekday', code: 'day_of_week_required' });
        if (input.frequency === 'MONTHLY' && !input.day_of_month) throw new BadRequestException({ message: 'Pick the day of the month', code: 'day_of_month_required' });
        try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { throw new BadRequestException({ message: 'Unknown time zone', code: 'invalid_timezone' }); }
        if (!input.recipient_membership_ids.length && !input.recipient_emails.length) throw new BadRequestException({ message: 'Add at least one recipient', code: 'recipients_required' });
        if (input.recipient_membership_ids.length) {
            const n = await this.prisma.membership.count({ where: { id: { in: input.recipient_membership_ids }, organization_id: ctx.organization_id } });
            if (n !== new Set(input.recipient_membership_ids).size) throw new NotFoundException({ message: 'A recipient was not found', code: 'membership_not_found' });
        }
        if (input.filters.scope === 'all' && !ctx.can('time.entries.read_all')) throw new ForbiddenException({ message: 'Organization-wide reports need time.entries.read_all', code: 'permission_denied' });
    }

    private data(i: ScheduleInput) {
        return {
            name: i.name, report_key: i.report_key, filters: i.filters as Prisma.InputJsonValue, format: TimeReportFormat.CSV, frequency: i.frequency,
            day_of_week: i.frequency === 'WEEKLY' ? i.day_of_week ?? 1 : null, day_of_month: i.frequency === 'MONTHLY' ? i.day_of_month ?? 1 : null,
            time_of_day: i.time_of_day, timezone: i.timezone, recipient_membership_ids: i.recipient_membership_ids, recipient_emails: i.recipient_emails, is_active: i.is_active,
        };
    }

    private toInput(s: Prisma.TimeReportScheduleGetPayload<object>): ScheduleInput {
        return {
            name: s.name, report_key: s.report_key, filters: (s.filters ?? {}) as ScheduleInput['filters'], frequency: s.frequency, day_of_week: s.day_of_week ?? undefined, day_of_month: s.day_of_month ?? undefined,
            time_of_day: s.time_of_day, timezone: s.timezone, recipient_membership_ids: s.recipient_membership_ids, recipient_emails: s.recipient_emails, is_active: s.is_active,
        };
    }

    private async own(ctx: OrgContext, id: string) {
        const s = await this.prisma.timeReportSchedule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!s) throw new NotFoundException({ message: 'Schedule not found', code: 'schedule_not_found' });
        if (s.created_by_membership_id !== ctx.membership_id && !ctx.can('time.entries.read_all')) throw new NotFoundException({ message: 'Schedule not found', code: 'schedule_not_found' });
        return s;
    }
}

const exportKey = (orgId: string, exportId: string) => `org/${orgId}/exports/time/${exportId}.csv`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Offset (ms) of a time zone at an instant: local wall clock − UTC. */
function tzOffset(at: number, timeZone: string) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at;
}

/** UTC instant of a wall-clock time in a zone (two passes handle DST edges). */
function zoned(y: number, m: number, d: number, hh: number, mm: number, timeZone: string) {
    const guess = Date.UTC(y, m, d, hh, mm);
    let t = guess - tzOffset(guess, timeZone);
    t = guess - tzOffset(t, timeZone);
    return new Date(t);
}

/** Today's date in a zone (as a UTC-midnight Date). */
function localToday(timeZone: string, at = Date.now()) {
    return toDateOnly(new Date(at + tzOffset(at, timeZone)));
}

/** Next send time strictly after `after`. WEEKLY day_of_week: 1 = Monday … 7 = Sunday; MONTHLY day_of_month 1–28. */
export function nextRun(s: Pick<ScheduleInput, 'frequency' | 'day_of_week' | 'day_of_month' | 'time_of_day' | 'timezone'>, after: Date): Date {
    const [hh, mm] = s.time_of_day.split(':').map(Number);
    const start = localToday(s.timezone, after.getTime());
    for (let i = 0; i < 70; i++) {
        const day = addDays(start, i);
        const iso = ((day.getUTCDay() + 6) % 7) + 1;
        if (s.frequency === 'WEEKLY' && iso !== (s.day_of_week ?? 1)) continue;
        if (s.frequency === 'MONTHLY' && day.getUTCDate() !== (s.day_of_month ?? 1)) continue;
        const at = zoned(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hh, mm, s.timezone);
        if (at > after) return at;
    }
    return addDays(after, 1);
}

/** Period a run reports on: DAILY = yesterday, WEEKLY = the previous Monday–Sunday, MONTHLY = the previous calendar month. */
export function reportRange(frequency: TimeReportFrequency, timeZone: string) {
    const today = localToday(timeZone);
    if (frequency === 'DAILY') { const y = addDays(today, -1); return { from: y, to: y }; }
    if (frequency === 'WEEKLY') {
        const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
        return { from: addDays(monday, -7), to: addDays(monday, -1) };
    }
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)), to: addDays(first, -1) };
}
