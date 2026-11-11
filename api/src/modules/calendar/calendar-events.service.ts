import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    CalendarAttendeeKind, CalendarAttendeeResponse, CalendarEventStatus, CalendarEventVisibility, CalendarReminderMethod, CalendarResourceBookingStatus, ModuleKey, Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { displayName, memberUserSelect } from '@/modules/notifications/utils/system-context';
import { AccessibleCalendar, CalendarAccessService, CalendarRole, atLeast } from './calendar-access.service';
import { CalendarEventQuery, CancelCalendarEventDto, CreateCalendarEventDto, EventAttendeeInputDto, RespondCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { buildRRule, describeRule, expandOccurrences, nextOccurrence, seriesEndsAt } from './utils/recurrence.utils';
import { isValidZone, overlaps } from './utils/availability.utils';

const MAX_RANGE_DAYS = 120;
const LIST_CAP = 2000;

const listSelect = {
    id: true, title: true, status: true, starts_at: true, ends_at: true, all_day: true, timezone: true, recurrence_rule: true, recurrence_exdates: true,
    visibility: true, shows_as_busy: true, location: true, meeting_url: true, color: true, calendar_id: true, organizer_membership_id: true, project_id: true, company_id: true,
    calendar: { select: { id: true, name: true, color: true, kind: true, free_busy_only: true, owner_membership_id: true } },
    event_type: { select: { id: true, name: true, slug: true, color: true } },
    organizer: { select: { id: true, user: { select: memberUserSelect } } },
    attendees: { select: { membership_id: true, response: true, is_organizer: true } },
} satisfies Prisma.CalendarEventSelect;

type ListRow = Prisma.CalendarEventGetPayload<{ select: typeof listSelect }>;
type AttendeeRow = Omit<Prisma.CalendarEventAttendeeUncheckedCreateInput, 'event_id' | 'id'>;

/**
 * 19 §3–5, §9 — calendar events: range listing with server-side recurrence expansion, CRUD, RSVP, cancel.
 * Visibility: PRIVATE events of others and FREE_BUSY calendars are masked to "Busy" (§7, §10).
 * Invitations, updates, cancellations and RSVPs are published to the event bus (14 fan-out turns them into notifications).
 */
@Injectable()
export class CalendarEventsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
    ) { }

    // ------------------------------------------------------------------ permissions on one event

    canEdit(ctx: OrgContext, e: { organizer_membership_id: string | null; visibility: CalendarEventVisibility }, role: CalendarRole | null | undefined) {
        if (e.organizer_membership_id && e.organizer_membership_id === ctx.membership_id && ctx.can('calendar.events.update_own')) return true;
        if (atLeast(role, 'WRITE') && (ctx.can('calendar.events.update_own') || ctx.can('calendar.events.manage'))) return true;
        return ctx.can('calendar.events.manage') && atLeast(role, 'READ') && e.visibility !== CalendarEventVisibility.PRIVATE;
    }

    canDelete(ctx: OrgContext, e: { organizer_membership_id: string | null; visibility: CalendarEventVisibility }, role: CalendarRole | null | undefined) {
        if (e.organizer_membership_id && e.organizer_membership_id === ctx.membership_id && ctx.can('calendar.events.delete_own')) return true;
        if (atLeast(role, 'MANAGE') && ctx.can('calendar.events.delete_own')) return true;
        return ctx.can('calendar.events.manage') && atLeast(role, 'WRITE');
    }

    // ------------------------------------------------------------------ list

    async list(ctx: OrgContext, query: CalendarEventQuery) {
        const from = new Date(query.from);
        const to = new Date(query.to);
        if (!(to > from)) throw new BadRequestException({ message: '`to` must be after `from`', code: 'invalid_range' });
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw new BadRequestException({ message: `The range may span at most ${MAX_RANGE_DAYS} days`, code: 'range_too_large' });
        const me = this.access.me(ctx);
        await this.access.ensurePersonal(ctx);
        const accessible = await this.access.accessibleCalendars(ctx);
        const calendarIds = query.calendar_ids?.length
            ? query.calendar_ids.filter((id) => accessible.has(id))
            : [...accessible.values()].filter((a) => a.subscribed).map((a) => a.calendar.id);

        const mineOnly: Prisma.CalendarEventWhereInput[] = [{ organizer_membership_id: me }, { attendees: { some: { membership_id: me } } }];
        const rows = await this.prisma.calendarEvent.findMany({
            where: {
                organization_id: ctx.organization_id,
                recurring_event_id: null,
                ...(query.include_cancelled ? {} : { status: { not: CalendarEventStatus.CANCELLED } }),
                ...(query.event_type_id && { event_type_id: query.event_type_id }),
                ...(query.project_id && { project_id: query.project_id }),
                ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
                AND: [
                    this.access.rangeWhere(from, to),
                    { OR: query.mine ? mineOnly : [{ calendar_id: { in: calendarIds } }, ...(query.calendar_ids?.length ? [] : mineOnly)] },
                ],
            },
            select: listSelect,
            take: LIST_CAP,
        });

        const out = [];
        for (const e of rows) {
            const a = accessible.get(e.calendar_id);
            for (const o of expandOccurrences(e.starts_at, e.ends_at, e.recurrence_rule, e.timezone, from, to, e.recurrence_exdates)) {
                out.push(this.toListItem(ctx, e, a, o.start, o.end));
                if (out.length >= LIST_CAP) break;
            }
        }
        out.sort((x, y) => x.starts_at.getTime() - y.starts_at.getTime() || Number(y.all_day) - Number(x.all_day));
        return { data: out, from, to, calendars: [...accessible.values()].map((c) => ({ id: c.calendar.id, name: c.calendar.name, color: c.calendar.color, kind: c.calendar.kind, role: c.role, subscribed: c.subscribed, is_default: c.calendar.is_default, owner_membership_id: c.calendar.owner_membership_id })) };
    }

    private toListItem(ctx: OrgContext, e: ListRow, a: AccessibleCalendar | undefined, start: Date, end: Date) {
        const details = this.access.canSeeDetails(ctx, e, a?.role, e.calendar);
        const mine = e.attendees.find((x) => x.membership_id === ctx.membership_id);
        return {
            id: e.id,
            key: `${e.id}:${start.toISOString()}`,
            occurrence_start: e.recurrence_rule ? start.toISOString() : null,
            starts_at: start,
            ends_at: end,
            all_day: e.all_day,
            status: e.status,
            masked: !details,
            title: details ? e.title : 'Busy',
            location: details ? e.location : null,
            meeting_url: details ? e.meeting_url : null,
            visibility: e.visibility,
            shows_as_busy: e.shows_as_busy,
            color: e.color ?? e.event_type?.color ?? e.calendar.color,
            recurring: !!e.recurrence_rule,
            calendar: { id: e.calendar.id, name: e.calendar.name, color: e.calendar.color, kind: e.calendar.kind },
            event_type: details ? e.event_type : null,
            organizer: details && e.organizer ? { id: e.organizer.id, name: displayName(e.organizer.user) } : null,
            my_response: mine?.response ?? null,
            is_organizer: e.organizer_membership_id === ctx.membership_id,
            attendee_count: details ? e.attendees.length : 0,
            project_id: details ? e.project_id : null,
            can_edit: this.canEdit(ctx, e, a?.role),
        };
    }

    // ------------------------------------------------------------------ detail

    private async load(ctx: OrgContext, id: string) {
        const e = await this.prisma.calendarEvent.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                calendar: { select: { id: true, name: true, color: true, kind: true, free_busy_only: true, owner_membership_id: true, timezone: true } },
                event_type: { select: { id: true, name: true, slug: true, color: true } },
                organizer: { select: { id: true, user: { select: memberUserSelect } } },
                attendees: { orderBy: [{ is_organizer: 'desc' }, { created_at: 'asc' }], include: { membership: { select: { id: true, user: { select: memberUserSelect } } } } },
                reminders: { orderBy: { minutes_before: 'asc' } },
                resources: { include: { resource: { select: { id: true, name: true, kind: true, location: true } } } },
                links: true,
                project: { select: { id: true, name: true } },
                company: { select: { id: true, name: true } },
                booking: { select: { id: true, status: true, invitee_name: true, invitee_email: true, booking_link_id: true } },
            },
        });
        if (!e) throw new NotFoundException({ message: 'Event not found', code: 'calendar_event_not_found' });
        const a = await this.access.roleOn(ctx, e.calendar_id);
        const involved = !!ctx.membership_id && (e.organizer_membership_id === ctx.membership_id || e.attendees.some((x) => x.membership_id === ctx.membership_id));
        // 404 (never 403) when the caller cannot reach the calendar or the event (does not leak existence).
        if (!involved && !a) throw new NotFoundException({ message: 'Event not found', code: 'calendar_event_not_found' });
        if (!involved && !ctx.can('calendar.events.read') && !(a && a.subscribed)) throw new NotFoundException({ message: 'Event not found', code: 'calendar_event_not_found' });
        return { e, role: a?.role ?? null };
    }

    async findOne(ctx: OrgContext, id: string) {
        const { e, role } = await this.load(ctx, id);
        const details = this.access.canSeeDetails(ctx, e, role, e.calendar);
        const isOrganizer = e.organizer_membership_id === ctx.membership_id;
        const base = {
            id: e.id, starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day, timezone: e.timezone, status: e.status, visibility: e.visibility,
            shows_as_busy: e.shows_as_busy, recurring: !!e.recurrence_rule, calendar: e.calendar, masked: !details,
        };
        if (!details) return { ...base, title: 'Busy', can_edit: false, can_delete: false };
        const mine = e.attendees.find((x) => x.membership_id === ctx.membership_id) ?? null;
        return {
            ...base,
            title: e.title,
            description: e.description,
            location: e.location,
            meeting_url: e.meeting_url,
            color: e.color,
            guests_can_see_guests: e.guests_can_see_guests,
            recurrence: describeRule(e.recurrence_rule),
            recurrence_rule: e.recurrence_rule,
            recurrence_exdates: e.recurrence_exdates,
            event_type: e.event_type,
            organizer: e.organizer ? { id: e.organizer.id, name: displayName(e.organizer.user), email: e.organizer.user.email } : null,
            attendees: isOrganizer || e.guests_can_see_guests
                ? e.attendees.map((x) => ({ id: x.id, kind: x.kind, membership_id: x.membership_id, email: x.email, name: x.membership ? displayName(x.membership.user) : x.name ?? x.email, role: x.role, response: x.response, response_comment: x.response_comment, is_organizer: x.is_organizer, responded_at: x.responded_at }))
                : e.attendees.filter((x) => x.membership_id === ctx.membership_id || x.is_organizer).map((x) => ({ id: x.id, kind: x.kind, membership_id: x.membership_id, email: x.email, name: x.membership ? displayName(x.membership.user) : x.name ?? x.email, role: x.role, response: x.response, response_comment: x.response_comment, is_organizer: x.is_organizer, responded_at: x.responded_at })),
            my_attendee: mine ? { id: mine.id, response: mine.response, response_comment: mine.response_comment } : null,
            reminders: e.reminders.filter((r) => !r.membership_id || r.membership_id === ctx.membership_id).map((r) => ({ id: r.id, minutes_before: r.minutes_before, method: r.method, personal: !!r.membership_id, scheduled_at: r.scheduled_at })),
            resources: e.resources.map((r) => ({ id: r.resource.id, name: r.resource.name, kind: r.resource.kind, location: r.resource.location, status: r.status })),
            links: e.links,
            project: e.project,
            company: e.company,
            booking: e.booking,
            source: e.source,
            cancelled_at: e.cancelled_at,
            cancellation_reason: e.cancellation_reason,
            created_at: e.created_at,
            updated_at: e.updated_at,
            is_organizer: isOrganizer,
            can_edit: this.canEdit(ctx, e, role),
            can_delete: this.canDelete(ctx, e, role),
        };
    }

    // ------------------------------------------------------------------ writes

    async create(ctx: OrgContext, dto: CreateCalendarEventDto, opts: { source?: 'INTERNAL' | 'BOOKING' | 'API'; organizerId?: string; activitySummary?: string } = {}) {
        const me = opts.organizerId ?? this.access.me(ctx);
        await this.access.ensureEventTypes(ctx.organization_id);
        const calendar = await this.targetCalendar(ctx, dto.calendar_id, me);
        const type = dto.event_type_id ? await this.prisma.calendarEventType.findFirst({ where: { id: dto.event_type_id, organization_id: ctx.organization_id, archived_at: null } }) : null;
        if (dto.event_type_id && !type) throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        const { starts_at, ends_at } = this.times(dto.starts_at, dto.ends_at);
        const timezone = isValidZone(dto.timezone) ? dto.timezone : calendar.timezone && isValidZone(calendar.timezone) ? calendar.timezone : await this.access.timezoneOf(ctx);
        const recurrence_rule = dto.recurrence ? buildRRule(dto.recurrence) : null;
        await this.assertRefs(ctx, dto);
        const attendees = await this.resolveAttendees(ctx, dto.attendees ?? [], me);
        const resources = await this.resolveResources(ctx, dto.resource_ids ?? [], starts_at, ends_at, recurrence_rule, timezone);
        const reminders = dto.reminders ?? ((type?.default_reminders as { minutes_before: number }[] | null) ?? [{ minutes_before: 10 }]);
        const title = dto.title?.trim() || '(No title)';
        const visibility = dto.visibility ?? type?.default_visibility ?? calendar.default_visibility;

        const event = await this.prisma.$transaction(async (tx) => {
            const created = await tx.calendarEvent.create({
                data: {
                    organization_id: ctx.organization_id, calendar_id: calendar.id, event_type_id: type?.id ?? null, title, description: dto.description ?? null,
                    status: dto.status ?? CalendarEventStatus.CONFIRMED, starts_at, ends_at, all_day: dto.all_day ?? false, timezone,
                    recurrence_rule, recurrence_ends_at: seriesEndsAt(starts_at, ends_at, recurrence_rule, timezone),
                    organizer_membership_id: me, visibility, shows_as_busy: dto.shows_as_busy ?? type?.shows_as_busy ?? true,
                    location: dto.location || null, meeting_url: dto.meeting_url || null, color: dto.color ?? null,
                    guests_can_see_guests: dto.guests_can_see_guests ?? true, project_id: dto.project_id ?? null, company_id: dto.company_id ?? null,
                    source: opts.source ?? (ctx.channel === 'ui' ? 'INTERNAL' : 'API'), created_by_user_id: ctx.user_id,
                },
            });
            await tx.calendarEventAttendee.createMany({ data: attendees.map((a) => ({ ...a, event_id: created.id, invited_at: new Date() })), skipDuplicates: true });
            if (resources.length) await tx.calendarEventResource.createMany({ data: resources.map((r) => ({ event_id: created.id, resource_id: r.id, status: r.status })) });
            if (reminders.length) {
                await tx.calendarEventReminder.createMany({
                    data: reminders.map((r) => ({ event_id: created.id, minutes_before: r.minutes_before, method: (r as { method?: CalendarReminderMethod }).method ?? CalendarReminderMethod.NOTIFICATION, scheduled_at: this.reminderAt(created, r.minutes_before) })),
                    skipDuplicates: true,
                });
            }
            return created;
        });

        const invited = attendees.filter((a) => a.membership_id && a.membership_id !== me).map((a) => a.membership_id as string);
        await this.audit.record(ctx, 'calendar_event.created', { resource_type: 'calendar_event', resource_id: event.id, branch_id: event.branch_id, metadata: { after: { title, starts_at, ends_at, calendar_id: calendar.id, attendees: attendees.length, recurrence_rule } } });
        const who = await this.access.actorName(ctx);
        this.events.publish(ctx, {
            event_key: 'calendar.event_created',
            module: ModuleKey.CALENDAR,
            entity_type: 'CALENDAR_EVENT',
            entity_id: event.id,
            payload: { title, entity_label: title, starts_at, ends_at, calendar_id: calendar.id, attendee_membership_ids: invited, link: `/calendar/events/${event.id}`, notification_body: this.whenText(starts_at, timezone, event.all_day) },
            ...(visibility !== CalendarEventVisibility.PRIVATE && { activity: { summary: opts.activitySummary ?? `${who} scheduled ${title}`, entity_label: title, project_id: event.project_id, company_id: event.company_id } }),
        });
        // Background / public callers (no membership) get the id only; members get the full detail they may see.
        if (!ctx.membership_id) return { id: event.id } as Awaited<ReturnType<CalendarEventsService['findOne']>>;
        return this.findOne(ctx, event.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCalendarEventDto) {
        const { e, role } = await this.load(ctx, id);
        if (!this.canEdit(ctx, e, role)) throw new ForbiddenException({ message: 'You cannot edit this event', code: 'calendar_event_not_editable' });
        if (e.status === CalendarEventStatus.CANCELLED) throw new ConflictException({ message: 'Cancelled events cannot be edited', code: 'calendar_event_cancelled' });
        const calendar = dto.calendar_id && dto.calendar_id !== e.calendar_id ? await this.targetCalendar(ctx, dto.calendar_id, ctx.membership_id) : null;
        const type = dto.event_type_id ? await this.prisma.calendarEventType.findFirst({ where: { id: dto.event_type_id, organization_id: ctx.organization_id } }) : null;
        if (dto.event_type_id && !type) throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        const { starts_at, ends_at } = this.times(dto.starts_at ?? e.starts_at.toISOString(), dto.ends_at ?? e.ends_at.toISOString());
        const timezone = dto.timezone && isValidZone(dto.timezone) ? dto.timezone : e.timezone;
        const recurrence_rule = dto.recurrence === undefined ? e.recurrence_rule : dto.recurrence ? buildRRule(dto.recurrence) : null;
        await this.assertRefs(ctx, dto);
        const timeChanged = starts_at.getTime() !== e.starts_at.getTime() || ends_at.getTime() !== e.ends_at.getTime() || recurrence_rule !== e.recurrence_rule;
        const placeChanged = (dto.location !== undefined && (dto.location || null) !== e.location) || (dto.meeting_url !== undefined && (dto.meeting_url || null) !== e.meeting_url);
        const organizer = e.organizer_membership_id ?? ctx.membership_id;
        const nextAttendees = dto.attendees ? await this.resolveAttendees(ctx, dto.attendees, organizer) : null;
        const resources = dto.resource_ids ? await this.resolveResources(ctx, dto.resource_ids, starts_at, ends_at, recurrence_rule, timezone, id) : null;

        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.calendarEvent.update({
                where: { id },
                data: {
                    calendar_id: calendar?.id,
                    event_type_id: dto.event_type_id,
                    title: dto.title !== undefined ? dto.title.trim() || '(No title)' : undefined,
                    description: dto.description,
                    status: dto.status,
                    starts_at, ends_at, timezone, recurrence_rule,
                    recurrence_ends_at: seriesEndsAt(starts_at, ends_at, recurrence_rule, timezone),
                    ...(recurrence_rule !== e.recurrence_rule && { recurrence_exdates: [] }),
                    all_day: dto.all_day,
                    visibility: dto.visibility,
                    shows_as_busy: dto.shows_as_busy,
                    location: dto.location !== undefined ? dto.location || null : undefined,
                    meeting_url: dto.meeting_url !== undefined ? dto.meeting_url || null : undefined,
                    color: dto.color,
                    guests_can_see_guests: dto.guests_can_see_guests,
                    project_id: dto.project_id,
                    company_id: dto.company_id,
                    ...((timeChanged || placeChanged) && { sequence: { increment: 1 } }),
                },
            });
            if (nextAttendees) {
                const keep = new Set(nextAttendees.map((a) => a.email.toLowerCase()));
                await tx.calendarEventAttendee.deleteMany({ where: { event_id: id, is_organizer: false, email: { notIn: [...keep] } } });
                for (const a of nextAttendees) {
                    await tx.calendarEventAttendee.upsert({ where: { event_id_email: { event_id: id, email: a.email } }, update: { role: a.role, name: a.name }, create: { ...a, event_id: id, invited_at: new Date() } });
                }
            }
            if (resources) {
                await tx.calendarEventResource.deleteMany({ where: { event_id: id, resource_id: { notIn: resources.map((r) => r.id) } } });
                for (const r of resources) await tx.calendarEventResource.upsert({ where: { event_id_resource_id: { event_id: id, resource_id: r.id } }, update: {}, create: { event_id: id, resource_id: r.id, status: r.status } });
            }
            if (dto.reminders) {
                await tx.calendarEventReminder.deleteMany({ where: { event_id: id, membership_id: null } });
                await tx.calendarEventReminder.createMany({ data: dto.reminders.map((r) => ({ event_id: id, minutes_before: r.minutes_before, method: r.method ?? CalendarReminderMethod.NOTIFICATION, scheduled_at: this.reminderAt(row, r.minutes_before) })), skipDuplicates: true });
            } else if (timeChanged) {
                const rows = await tx.calendarEventReminder.findMany({ where: { event_id: id } });
                for (const r of rows) await tx.calendarEventReminder.update({ where: { id: r.id }, data: { scheduled_at: this.reminderAt(row, r.minutes_before), sent_at: null } });
            }
            return row;
        });

        const before = e.attendees.filter((a) => a.membership_id).map((a) => a.membership_id as string);
        const after = nextAttendees ? nextAttendees.filter((a) => a.membership_id).map((a) => a.membership_id as string) : before;
        const added = after.filter((m) => !before.includes(m) && m !== organizer);
        const existing = after.filter((m) => before.includes(m) && m !== ctx.membership_id);
        await this.audit.record(ctx, 'calendar_event.updated', {
            resource_type: 'calendar_event', resource_id: id,
            metadata: { before: { title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, location: e.location, attendees: before.length }, after: { ...dto, attendees: dto.attendees?.length } },
        });
        const who = await this.access.actorName(ctx);
        const title = updated.title;
        this.events.publish(ctx, {
            event_key: 'calendar.event_updated',
            module: ModuleKey.CALENDAR,
            entity_type: 'CALENDAR_EVENT',
            entity_id: id,
            payload: {
                title, entity_label: title, link: `/calendar/events/${id}`, attendee_membership_ids: added,
                ...(timeChanged || placeChanged ? { watcher_membership_ids: existing, notification_body: this.whenText(updated.starts_at, updated.timezone, updated.all_day) } : {}),
            },
            changes: dto as Record<string, unknown>,
            ...(updated.visibility !== CalendarEventVisibility.PRIVATE && { activity: { summary: `${who} ${timeChanged ? 'rescheduled' : 'updated'} ${title}`, entity_label: title, project_id: updated.project_id, company_id: updated.company_id } }),
        });
        return this.findOne(ctx, id);
    }

    async cancel(ctx: OrgContext, id: string, dto: CancelCalendarEventDto) {
        const { e, role } = await this.load(ctx, id);
        if (!this.canEdit(ctx, e, role)) throw new ForbiddenException({ message: 'You cannot cancel this event', code: 'calendar_event_not_editable' });
        const watchers = e.attendees.filter((a) => a.membership_id && a.membership_id !== ctx.membership_id).map((a) => a.membership_id as string);
        const who = await this.access.actorName(ctx);
        if (dto.occurrence_start && e.recurrence_rule) {
            const at = new Date(dto.occurrence_start);
            await this.prisma.calendarEvent.update({ where: { id }, data: { recurrence_exdates: { push: at }, sequence: { increment: 1 } } });
            await this.audit.record(ctx, 'calendar_event.occurrence_cancelled', { resource_type: 'calendar_event', resource_id: id, metadata: { occurrence_start: at, reason: dto.reason ?? null } });
            this.events.publish(ctx, {
                event_key: 'calendar.event_cancelled', module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_EVENT', entity_id: id,
                payload: { title: e.title, entity_label: e.title, occurrence_start: at, watcher_membership_ids: watchers, link: `/calendar/events/${id}`, notification_title: `${e.title} on ${this.whenText(at, e.timezone, e.all_day)} was cancelled`, notification_body: dto.reason ?? null },
            });
            return this.findOne(ctx, id);
        }
        if (e.status === CalendarEventStatus.CANCELLED) throw new ConflictException({ message: 'This event is already cancelled', code: 'calendar_event_cancelled' });
        await this.prisma.$transaction([
            this.prisma.calendarEvent.update({ where: { id }, data: { status: CalendarEventStatus.CANCELLED, cancelled_at: new Date(), cancelled_by_user_id: ctx.user_id, cancellation_reason: dto.reason ?? null, sequence: { increment: 1 } } }),
            this.prisma.calendarEventResource.updateMany({ where: { event_id: id }, data: { status: CalendarResourceBookingStatus.CANCELLED } }),
        ]);
        await this.audit.record(ctx, 'calendar_event.cancelled', { resource_type: 'calendar_event', resource_id: id, metadata: { title: e.title, reason: dto.reason ?? null } });
        this.events.publish(ctx, {
            event_key: 'calendar.event_cancelled', module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_EVENT', entity_id: id,
            payload: { title: e.title, entity_label: e.title, watcher_membership_ids: watchers, link: `/calendar/events/${id}`, notification_title: `${e.title} was cancelled`, notification_body: dto.reason ?? null },
            ...(e.visibility !== CalendarEventVisibility.PRIVATE && { activity: { summary: `${who} cancelled ${e.title}`, entity_label: e.title, project_id: e.project_id, company_id: e.company_id } }),
        });
        return this.findOne(ctx, id);
    }

    async remove(ctx: OrgContext, id: string) {
        const { e, role } = await this.load(ctx, id);
        if (!this.canDelete(ctx, e, role)) throw new ForbiddenException({ message: 'You cannot delete this event', code: 'calendar_event_not_deletable' });
        await this.prisma.calendarEvent.delete({ where: { id } });
        await this.audit.record(ctx, 'calendar_event.deleted', { resource_type: 'calendar_event', resource_id: id, metadata: { title: e.title, starts_at: e.starts_at } });
        this.events.publish(ctx, { event_key: 'calendar.event_deleted', module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_EVENT', entity_id: id, payload: { title: e.title } });
        return { success: true };
    }

    async respond(ctx: OrgContext, id: string, dto: RespondCalendarEventDto) {
        const { e } = await this.load(ctx, id);
        const mine = e.attendees.find((a) => a.membership_id === ctx.membership_id);
        if (!mine) throw new ConflictException({ message: 'You are not invited to this event', code: 'not_an_attendee' });
        await this.prisma.calendarEventAttendee.update({ where: { id: mine.id }, data: { response: dto.response, response_comment: dto.comment ?? null, responded_at: new Date() } });
        await this.audit.record(ctx, 'calendar_event.responded', { resource_type: 'calendar_event', resource_id: id, metadata: { response: dto.response } });
        const who = await this.access.actorName(ctx);
        const verb = dto.response === CalendarAttendeeResponse.ACCEPTED ? 'accepted' : dto.response === CalendarAttendeeResponse.DECLINED ? 'declined' : 'tentatively accepted';
        this.events.publish(ctx, {
            event_key: 'calendar.attendee_responded', module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_EVENT', entity_id: id,
            payload: { title: e.title, entity_label: e.title, response: dto.response, recipient_membership_ids: e.organizer_membership_id ? [e.organizer_membership_id] : [], link: `/calendar/events/${id}`, notification_title: `${who} ${verb} ${e.title}`, notification_body: dto.comment ?? null },
        });
        return this.findOne(ctx, id);
    }

    // ------------------------------------------------------------------ helpers

    private times(start: string, end: string) {
        const starts_at = new Date(start);
        const ends_at = new Date(end);
        if (Number.isNaN(starts_at.getTime()) || Number.isNaN(ends_at.getTime())) throw new BadRequestException({ message: 'Invalid start or end', code: 'invalid_time' });
        if (!(ends_at > starts_at)) throw new BadRequestException({ message: 'The end must be after the start', code: 'end_before_start' });
        return { starts_at, ends_at };
    }

    private async targetCalendar(ctx: OrgContext, calendarId: string | undefined, organizerId: string | null) {
        if (!calendarId) return this.access.ensurePersonal(ctx, organizerId ?? this.access.me(ctx));
        const a = await this.access.roleOn(ctx, calendarId);
        if (!a || a.calendar.archived_at) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        if (!atLeast(a.role, 'WRITE')) throw new ForbiddenException({ message: 'You cannot add events to this calendar', code: 'calendar_read_only' });
        return a.calendar;
    }

    private async assertRefs(ctx: OrgContext, dto: { project_id?: string; company_id?: string }) {
        if (dto.project_id && !(await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        }
        if (dto.company_id && !(await this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Customer not found', code: 'company_not_found' });
        }
    }

    /** Organizer first (ACCEPTED), then members (validated in this organization), then external emails. */
    private async resolveAttendees(ctx: OrgContext, input: EventAttendeeInputDto[], organizerId: string | null) {
        const memberIds = [...new Set([...(organizerId ? [organizerId] : []), ...input.map((a) => a.membership_id).filter(Boolean)])] as string[];
        const members = memberIds.length
            ? await this.prisma.membership.findMany({ where: { id: { in: memberIds }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true, user: { select: memberUserSelect } } })
            : [];
        const missing = memberIds.filter((m) => m !== organizerId && !members.some((x) => x.id === m));
        if (missing.length) throw new NotFoundException({ message: 'Some attendees are not members of this organization', code: 'attendee_not_found', membership_ids: missing });
        const byId = new Map(members.map((m) => [m.id, m]));
        const out: AttendeeRow[] = [];
        const seen = new Set<string>();
        const push = (row: AttendeeRow) => {
            const key = row.email.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ ...row, email: key });
        };
        const organizer = organizerId ? byId.get(organizerId) : null;
        if (organizer) push({ kind: CalendarAttendeeKind.MEMBER, membership_id: organizer.id, email: organizer.user.email, name: displayName(organizer.user), is_organizer: true, response: CalendarAttendeeResponse.ACCEPTED, responded_at: new Date() });
        for (const a of input) {
            if (a.membership_id) {
                const m = byId.get(a.membership_id);
                if (m && m.id !== organizerId) push({ kind: CalendarAttendeeKind.MEMBER, membership_id: m.id, email: m.user.email, name: displayName(m.user), role: a.role });
            } else if (a.email) {
                push({ kind: CalendarAttendeeKind.EXTERNAL, email: a.email, name: a.name ?? null, role: a.role });
            }
        }
        return out;
    }

    /** Rooms / equipment: conflicts only against APPROVED bookings of the same resource that overlap (19 §6). */
    private async resolveResources(ctx: OrgContext, ids: string[], start: Date, end: Date, rule: string | null, tz: string, excludeEventId?: string) {
        if (!ids.length) return [];
        const resources = await this.prisma.calendarResource.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id, archived_at: null } });
        if (resources.length !== new Set(ids).size) throw new NotFoundException({ message: 'Resource not found', code: 'resource_not_found' });
        const horizon = new Date(start.getTime() + 180 * 86_400_000);
        const mine = expandOccurrences(start, end, rule, tz, start, rule ? horizon : end, [], 200);
        const taken = await this.prisma.calendarEvent.findMany({
            where: {
                organization_id: ctx.organization_id,
                status: { not: CalendarEventStatus.CANCELLED },
                ...(excludeEventId && { id: { not: excludeEventId } }),
                resources: { some: { resource_id: { in: ids }, status: CalendarResourceBookingStatus.APPROVED } },
                AND: [this.access.rangeWhere(start, rule ? horizon : end)],
            },
            select: { title: true, starts_at: true, ends_at: true, timezone: true, recurrence_rule: true, recurrence_exdates: true, resources: { where: { resource_id: { in: ids } }, select: { resource_id: true } } },
        });
        for (const t of taken) {
            const theirs = expandOccurrences(t.starts_at, t.ends_at, t.recurrence_rule, t.timezone, start, rule ? horizon : end, t.recurrence_exdates, 400);
            const clash = mine.find((o) => theirs.some((x) => overlaps(o, x)));
            if (clash) {
                const r = resources.find((x) => t.resources.some((tr) => tr.resource_id === x.id));
                throw new ConflictException({ message: `${r?.name ?? 'This resource'} is already booked by “${t.title}” at that time`, code: 'resource_conflict' });
            }
        }
        return resources.map((r) => ({ id: r.id, status: r.requires_approval ? CalendarResourceBookingStatus.REQUESTED : CalendarResourceBookingStatus.APPROVED }));
    }

    /** Next reminder emission for the next occurrence that has not started yet. */
    reminderAt(e: { starts_at: Date; ends_at: Date; recurrence_rule: string | null; timezone: string; recurrence_exdates?: Date[] }, minutesBefore: number, after = new Date()) {
        const next = nextOccurrence(e.starts_at, e.ends_at, e.recurrence_rule, e.timezone, after, e.recurrence_exdates ?? []);
        return next ? new Date(next.start.getTime() - minutesBefore * 60_000) : null;
    }

    whenText(d: Date, tz: string, allDay: boolean) {
        try {
            return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', ...(allDay ? {} : { hour: '2-digit', minute: '2-digit' }) }).format(d);
        } catch {
            return d.toISOString();
        }
    }
}
