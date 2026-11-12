import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, TimeEntrySource, TimeSuggestionSource, TimeSuggestionStatus } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TimeAccessService } from '../common/time-access.service';
import { addDays, isoDate, toDateOnly, todayUtc } from '../common/time-dates';
import { TimeEntriesService } from '../entries/time-entries.service';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MINUTES = 8 * 60;
/** Pending suggestions older than this are expired on the next generation run. */
const EXPIRE_DAYS = 30;

export const SuggestionQuerySchema = z.object({
    status: z.nativeEnum(TimeSuggestionStatus).optional().default(TimeSuggestionStatus.PENDING),
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
});
export type SuggestionQuery = z.infer<typeof SuggestionQuerySchema>;

export const GenerateSuggestionsSchema = z.object({
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
});

export const AcceptSuggestionSchema = z.object({
    duration_minutes: z.number().int().min(1).max(1440).optional(),
    date: z.string().regex(DATE).optional(),
    project_id: z.string().uuid().nullable().optional(),
    task_id: z.string().uuid().nullable().optional(),
    activity_type_id: z.string().uuid().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    is_billable: z.boolean().optional(),
});
export type AcceptSuggestion = z.infer<typeof AcceptSuggestionSchema>;

const INCLUDE = {
    project: { select: { id: true, name: true, code: true, color: true } },
    task: { select: { id: true, number: true, title: true, team: { select: { task_key: true } } } },
    activity_type: { select: { id: true, name: true } },
} satisfies Prisma.TimeSuggestionInclude;

/**
 * 18 §4 — suggested entries. Generated for the caller from calendar events they organised or accepted (19) and from
 * task status changes they made (06: time in progress until review / done). Review is always required: accepting
 * creates a TimeEntry through TimeEntriesService (same validation and rates); dismissing keeps the row so the same
 * source is never proposed again (unique membership + source + external_ref).
 */
@Injectable()
export class TimeSuggestionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
        private readonly entries: TimeEntriesService,
    ) { }

    async list(ctx: OrgContext, q: SuggestionQuery) {
        const me = this.access.requireMembership(ctx);
        const rows = await this.prisma.timeSuggestion.findMany({
            where: {
                organization_id: ctx.organization_id, membership_id: me, status: q.status,
                ...((q.from || q.to) && { date: { ...(q.from && { gte: toDateOnly(q.from) }), ...(q.to && { lte: toDateOnly(q.to) }) } }),
            },
            orderBy: [{ date: 'desc' }, { start_at: 'asc' }],
            take: 200,
            include: INCLUDE,
        });
        return { data: rows, totals: { count: rows.length, minutes: rows.reduce((s, r) => s + r.duration_minutes, 0) } };
    }

    /** Scan the last 14 days (or the given range) and create new PENDING suggestions. Idempotent. */
    async generate(ctx: OrgContext, input: { from?: string; to?: string } = {}) {
        const me = this.access.requireMembership(ctx);
        const to = input.to ? toDateOnly(input.to) : todayUtc();
        const from = input.from ? toDateOnly(input.from) : addDays(to, -13);
        if (to < from) throw new BadRequestException({ message: 'The range ends before it starts', code: 'invalid_range' });
        if ((to.getTime() - from.getTime()) / 86_400_000 > 62) throw new BadRequestException({ message: 'Scan at most two months at a time', code: 'range_too_long' });
        const end = addDays(to, 1);

        await this.prisma.timeSuggestion.updateMany({ where: { membership_id: me, status: TimeSuggestionStatus.PENDING, date: { lt: addDays(todayUtc(), -EXPIRE_DAYS) } }, data: { status: TimeSuggestionStatus.EXPIRED } });

        const candidates: Prisma.TimeSuggestionCreateManyInput[] = [];

        // 19 Calendar — single (non-recurring) timed events I organise or accepted; declined and cancelled ones are skipped.
        const events = await this.prisma.calendarEvent.findMany({
            where: {
                organization_id: ctx.organization_id, starts_at: { gte: from, lt: end }, all_day: false, status: { not: 'CANCELLED' }, cancelled_at: null, recurrence_rule: null,
                OR: [{ organizer_membership_id: me }, { attendees: { some: { membership_id: me, response: { in: ['ACCEPTED', 'TENTATIVE'] } } } }],
            },
            select: { id: true, title: true, starts_at: true, ends_at: true, project_id: true },
            take: 500,
        });
        const loggedEvents = new Set((await this.prisma.timeEntry.findMany({ where: { membership_id: me, deleted_at: null, calendar_event_id: { in: events.map((e) => e.id) } }, select: { calendar_event_id: true } })).map((e) => e.calendar_event_id));
        for (const ev of events) {
            const minutes = Math.round((ev.ends_at.getTime() - ev.starts_at.getTime()) / 60_000 / 5) * 5;
            if (minutes < 5 || minutes > MAX_MINUTES || loggedEvents.has(ev.id)) continue;
            candidates.push({
                organization_id: ctx.organization_id, membership_id: me, source: TimeSuggestionSource.CALENDAR, date: toDateOnly(ev.starts_at), start_at: ev.starts_at, end_at: ev.ends_at,
                duration_minutes: minutes, project_id: ev.project_id, description: ev.title, calendar_event_id: ev.id, external_ref: `cal:${ev.id}`,
                rationale: `Calendar event “${ev.title}”`, payload: { title: ev.title } as Prisma.InputJsonValue, confidence: 0.8,
            });
        }

        // 06 Tasks — I moved a task out of IN_PROGRESS (to review / done): suggest the time it spent in progress (capped).
        const changes = await this.prisma.taskStatusHistory.findMany({
            where: { changed_by_membership_id: me, changed_at: { gte: from, lt: end }, to_category: { in: ['IN_REVIEW', 'DONE'] }, from_status: { category: 'IN_PROGRESS' }, task: { organization_id: ctx.organization_id } },
            select: { id: true, changed_at: true, seconds_in_previous: true, task: { select: { id: true, number: true, title: true, project_id: true, team: { select: { task_key: true } } } } },
            take: 500,
        });
        const loggedTasks = new Set((await this.prisma.timeEntry.findMany({
            where: { membership_id: me, deleted_at: null, task_id: { in: changes.map((c) => c.task.id) }, date: { gte: from, lte: to } }, select: { task_id: true, date: true },
        })).map((e) => `${e.task_id}:${isoDate(e.date)}`));
        for (const c of changes) {
            const raw = Math.round((c.seconds_in_previous ?? 0) / 60);
            if (raw < 10) continue;
            const minutes = Math.min(MAX_MINUTES, Math.max(15, Math.round(raw / 15) * 15));
            const day = toDateOnly(c.changed_at);
            if (loggedTasks.has(`${c.task.id}:${isoDate(day)}`)) continue;
            const key = `${c.task.team?.task_key ? `${c.task.team.task_key}-` : '#'}${c.task.number}`;
            candidates.push({
                organization_id: ctx.organization_id, membership_id: me, source: TimeSuggestionSource.TASK_ACTIVITY, date: day, duration_minutes: minutes,
                project_id: c.task.project_id, task_id: c.task.id, description: `${key} ${c.task.title}`, external_ref: `task-status:${c.id}`,
                rationale: `${key} was in progress for ${Math.round(raw / 60 * 10) / 10} h before you moved it on${raw > MAX_MINUTES ? ' (capped at 8 h)' : ''}`,
                confidence: raw > MAX_MINUTES ? 0.4 : 0.6,
            });
        }

        const created = candidates.length ? (await this.prisma.timeSuggestion.createMany({ data: candidates, skipDuplicates: true })).count : 0;
        if (created) await this.audit.record(ctx, 'time.suggestions.generated', { resource_type: 'time_suggestion', metadata: { from: isoDate(from), to: isoDate(to), created } });
        return { created, scanned: { calendar_events: events.length, task_changes: changes.length }, from: isoDate(from), to: isoDate(to) };
    }

    /** Accept (optionally edited): creates the TimeEntry as the caller and links it. */
    async accept(ctx: OrgContext, id: string, dto: AcceptSuggestion) {
        const s = await this.pending(ctx, id);
        const entry = await this.entries.create(ctx, {
            date: dto.date ?? isoDate(s.date),
            duration_minutes: dto.duration_minutes ?? s.duration_minutes,
            project_id: dto.project_id !== undefined ? dto.project_id : s.project_id,
            task_id: dto.task_id !== undefined ? dto.task_id : s.task_id,
            activity_type_id: dto.activity_type_id !== undefined ? dto.activity_type_id : s.activity_type_id,
            description: dto.description !== undefined ? dto.description : s.description,
            ...((dto.is_billable ?? s.is_billable) !== null && (dto.is_billable ?? s.is_billable) !== undefined && { is_billable: (dto.is_billable ?? s.is_billable) as boolean }),
        }, { source: s.source === TimeSuggestionSource.CALENDAR ? TimeEntrySource.CALENDAR : TimeEntrySource.GENERATED, calendar_event_id: s.calendar_event_id });
        const claimed = await this.prisma.timeSuggestion.updateMany({ where: { id, status: TimeSuggestionStatus.PENDING }, data: { status: TimeSuggestionStatus.ACCEPTED, accepted_time_entry_id: entry.id, reviewed_at: new Date() } });
        if (!claimed.count) throw new ConflictException({ message: 'This suggestion was already reviewed', code: 'suggestion_reviewed' });
        await this.audit.record(ctx, 'time.suggestion.accepted', { resource_type: 'time_suggestion', resource_id: id, metadata: { time_entry_id: entry.id, source: s.source, edited: Object.keys(dto) } });
        this.events.publish(ctx, { event_key: 'time.suggestion.accepted', module: ModuleKey.TIME_TRACKING, entity_kind: 'time_suggestion', entity_id: id, payload: { time_entry_id: entry.id, source: s.source } });
        return { suggestion_id: id, entry };
    }

    async dismiss(ctx: OrgContext, id: string) {
        await this.pending(ctx, id);
        await this.prisma.timeSuggestion.update({ where: { id }, data: { status: TimeSuggestionStatus.DISMISSED, reviewed_at: new Date() } });
        await this.audit.record(ctx, 'time.suggestion.dismissed', { resource_type: 'time_suggestion', resource_id: id });
        return { success: true };
    }

    /** Accept several as proposed; one failure (e.g. a locked period) does not stop the others. */
    async acceptMany(ctx: OrgContext, ids: string[]) {
        const results: { id: string; ok: boolean; error?: string }[] = [];
        for (const id of ids) {
            try { await this.accept(ctx, id, {}); results.push({ id, ok: true }); } catch (e) { results.push({ id, ok: false, error: (e as { response?: { message?: string } })?.response?.message ?? (e as Error).message }); }
        }
        return { accepted: results.filter((r) => r.ok).length, results };
    }

    private async pending(ctx: OrgContext, id: string) {
        const me = this.access.requireMembership(ctx);
        const s = await this.prisma.timeSuggestion.findFirst({ where: { id, organization_id: ctx.organization_id, membership_id: me } });
        if (!s) throw new NotFoundException({ message: 'Suggestion not found', code: 'suggestion_not_found' });
        if (s.status !== TimeSuggestionStatus.PENDING) throw new ConflictException({ message: `This suggestion is ${s.status.toLowerCase()}`, code: 'suggestion_reviewed' });
        return s;
    }
}
