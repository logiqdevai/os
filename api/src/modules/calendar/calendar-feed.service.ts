import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { CalendarEventStatus, CalendarEventVisibility, CalendarKind, ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CalendarAccessService } from './calendar-access.service';
import { isValidZone } from './utils/availability.utils';

const PAST_DAYS = 90;
const FUTURE_DAYS = 400;
const MAX_EVENTS = 3000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** RFC 5545 text escaping. */
const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 line folding at 75 octets. */
function fold(line: string) {
    const bytes = Buffer.from(line, 'utf8');
    if (bytes.length <= 75) return line;
    const out: string[] = [];
    let current = '';
    for (const ch of line) {
        if (Buffer.byteLength(current + ch, 'utf8') > (out.length ? 74 : 75)) {
            out.push(current);
            current = ch;
        } else current += ch;
    }
    out.push(current);
    return out.join('\r\n ');
}

const utc = (d: Date) => DateTime.fromJSDate(d).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

/**
 * 19 §7 — read-only iCalendar subscription feed per calendar (`GET /calendar/feed/{token}.ics`).
 * Calendar.feed_token stores the SHA-256 of the secret (the secret is shown once when the feed is turned on or rotated);
 * revoking clears it. PRIVATE events and free/busy-only calendars are exported as "Busy" only.
 */
@Injectable()
export class CalendarFeedService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
        private readonly config: ConfigService,
    ) { }

    private feedUrl(token: string) {
        const base = (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
        return `${base}/calendar/feed/${token}.ics`;
    }

    /** Owner of a personal calendar, a MANAGE share, or calendar.calendars.manage for shared calendars (same rule as sharing). */
    private async manageable(ctx: OrgContext, id: string) {
        const a = await this.access.roleOn(ctx, id);
        if (!a || a.calendar.archived_at) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        const c = a.calendar;
        const ok = c.kind === CalendarKind.PERSONAL ? c.owner_membership_id === ctx.membership_id || a.role === 'MANAGE' : ctx.can('calendar.calendars.manage') || a.role === 'MANAGE';
        if (!ok) throw new ForbiddenException({ message: 'You cannot publish this calendar', code: 'calendar_not_manageable' });
        return c;
    }

    /** Turn the feed on, or replace its secret (the old link stops working). Returns the URL once. */
    async rotate(ctx: OrgContext, id: string) {
        const c = await this.manageable(ctx, id);
        const token = randomBytes(24).toString('base64url');
        const rotated_at = new Date();
        await this.prisma.calendar.update({ where: { id }, data: { feed_token: hashToken(token), feed_token_rotated_at: rotated_at } });
        const action = c.feed_token ? 'calendar.feed_rotated' : 'calendar.feed_enabled';
        await this.audit.record(ctx, action, { resource_type: 'calendar', resource_id: id, branch_id: c.branch_id, metadata: { name: c.name, sensitive: true } });
        this.events.publish(ctx, { event_key: action, module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: id, payload: { name: c.name } });
        return { calendar_id: id, url: this.feedUrl(token), feed_enabled: true, feed_token_rotated_at: rotated_at };
    }

    async revoke(ctx: OrgContext, id: string) {
        const c = await this.manageable(ctx, id);
        if (!c.feed_token) return { calendar_id: id, feed_enabled: false };
        await this.prisma.calendar.update({ where: { id }, data: { feed_token: null, feed_token_rotated_at: new Date() } });
        await this.audit.record(ctx, 'calendar.feed_revoked', { resource_type: 'calendar', resource_id: id, branch_id: c.branch_id, metadata: { name: c.name, sensitive: true } });
        this.events.publish(ctx, { event_key: 'calendar.feed_revoked', module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: id, payload: { name: c.name } });
        return { calendar_id: id, feed_enabled: false };
    }

    /** Public: render the .ics for a token (404 for unknown / revoked tokens and archived calendars). */
    async render(file: string) {
        const token = file.replace(/\.ics$/i, '');
        if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException({ message: 'Feed not found', code: 'feed_not_found' });
        const calendar = await this.prisma.calendar.findFirst({
            where: { feed_token: hashToken(token), archived_at: null },
            include: { organization: { select: { default_timezone: true, name: true } } },
        });
        if (!calendar) throw new NotFoundException({ message: 'Feed not found', code: 'feed_not_found' });
        const tz = [calendar.timezone, calendar.organization.default_timezone].find(isValidZone) ?? 'UTC';
        const now = Date.now();
        const from = new Date(now - PAST_DAYS * 86_400_000);
        const to = new Date(now + FUTURE_DAYS * 86_400_000);
        const rows = await this.prisma.calendarEvent.findMany({
            where: { calendar_id: calendar.id, organization_id: calendar.organization_id, AND: [this.access.rangeWhere(from, to)] },
            select: {
                id: true, ical_uid: true, title: true, description: true, location: true, meeting_url: true, status: true, visibility: true, shows_as_busy: true,
                starts_at: true, ends_at: true, all_day: true, timezone: true, recurrence_rule: true, recurrence_exdates: true, recurring_event_id: true, original_start_at: true,
                sequence: true, updated_at: true, recurring_event: { select: { ical_uid: true, timezone: true } },
            },
            orderBy: { starts_at: 'asc' },
            take: MAX_EVENTS,
        });
        const overridden = new Map<string, Set<number>>();
        for (const r of rows) if (r.recurring_event_id && r.original_start_at) {
            const set = overridden.get(r.recurring_event_id) ?? new Set<number>();
            set.add(r.original_start_at.getTime());
            overridden.set(r.recurring_event_id, set);
        }

        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Logiqdev OS//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(calendar.name)}`, `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
        for (const e of rows) {
            const busyOnly = calendar.free_busy_only || e.visibility === CalendarEventVisibility.PRIVATE;
            const zone = isValidZone(e.timezone) ? e.timezone : tz;
            const local = (d: Date) => DateTime.fromJSDate(d, { zone }).toFormat("yyyyMMdd'T'HHmmss");
            const day = (d: Date) => DateTime.fromJSDate(d, { zone }).toFormat('yyyyMMdd');
            const stamp = (name: string, d: Date) => (e.all_day ? `${name};VALUE=DATE:${day(d)}` : `${name};TZID=${zone}:${local(d)}`);
            const uid = e.recurring_event?.ical_uid ?? e.ical_uid;
            lines.push('BEGIN:VEVENT', `UID:${uid}@logiqdev-os`, `DTSTAMP:${utc(e.updated_at)}`, `LAST-MODIFIED:${utc(e.updated_at)}`, stamp('DTSTART', e.starts_at), stamp('DTEND', e.ends_at), `SEQUENCE:${e.sequence}`);
            if (e.recurring_event_id && e.original_start_at) lines.push(stamp('RECURRENCE-ID', e.original_start_at));
            if (e.recurrence_rule) {
                lines.push(`RRULE:${e.recurrence_rule.replace(/^RRULE:/i, '')}`);
                const skip = overridden.get(e.id);
                const ex = e.recurrence_exdates.filter((d) => !skip?.has(d.getTime()));
                if (ex.length) lines.push(e.all_day ? `EXDATE;VALUE=DATE:${ex.map(day).join(',')}` : `EXDATE;TZID=${zone}:${ex.map(local).join(',')}`);
            }
            lines.push(`SUMMARY:${esc(busyOnly ? 'Busy' : e.title)}`);
            if (!busyOnly) {
                if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
                const desc = [e.description, e.meeting_url ? `Join: ${e.meeting_url}` : null].filter(Boolean).join('\n\n');
                if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
                if (e.meeting_url) lines.push(`URL:${e.meeting_url}`);
            }
            lines.push(`CLASS:${busyOnly ? 'PRIVATE' : 'PUBLIC'}`, `TRANSP:${e.shows_as_busy ? 'OPAQUE' : 'TRANSPARENT'}`);
            lines.push(`STATUS:${e.status === CalendarEventStatus.CANCELLED ? 'CANCELLED' : e.status === CalendarEventStatus.TENTATIVE ? 'TENTATIVE' : 'CONFIRMED'}`, 'END:VEVENT');
        }
        lines.push('END:VCALENDAR');
        return `${lines.map(fold).join('\r\n')}\r\n`;
    }
}
