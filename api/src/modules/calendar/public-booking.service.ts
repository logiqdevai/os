import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { BookingHostAssignment, BookingLinkAudience, BookingLinkStatus, CalendarAttendeeRole, CalendarBookingSource, CalendarBookingStatus, CalendarEventStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { displayName, memberUserSelect, systemContext } from '@/modules/notifications/utils/system-context';
import { BookingSlotsService } from './booking-slots.service';
import { CalendarEventsService } from './calendar-events.service';
import { PublicBookingDto, PublicSlotsQuery } from './dto/booking.dto';
import { isValidZone } from './utils/availability.utils';

type Bucket = { count: number; reset: number };

/**
 * 19 §6, §8 — the public booking page (no login, PUBLIC links only). Never exposes host calendar content, only slots.
 * Slots are not held: the submit re-checks availability and answers 409 with fresh slots when the slot is gone.
 * Rate limited per IP (in-process buckets).
 */
@Injectable()
export class PublicBookingService {
    private readonly buckets = new Map<string, Bucket>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly slots: BookingSlotsService,
        private readonly calendarEvents: CalendarEventsService,
    ) { }

    limit(key: string, max: number, windowMs: number) {
        const now = Date.now();
        const b = this.buckets.get(key);
        if (!b || b.reset < now) {
            this.buckets.set(key, { count: 1, reset: now + windowMs });
            if (this.buckets.size > 10_000) for (const [k, v] of this.buckets) if (v.reset < now) this.buckets.delete(k);
            return;
        }
        if (++b.count > max) throw new HttpException({ message: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    private async activeLink(where: Prisma.BookingLinkWhereInput) {
        const link = await this.prisma.bookingLink.findFirst({
            where: { ...where, audience: BookingLinkAudience.PUBLIC },
            include: {
                hosts: { orderBy: { priority: 'asc' }, include: { membership: { select: { id: true, status: true, user: { select: memberUserSelect } } } } },
                organization: { select: { id: true, display_name: true, logo_url: true, slug: true, default_timezone: true } },
            },
        });
        if (!link) throw new NotFoundException({ message: 'This booking page does not exist', code: 'booking_link_not_found' });
        if (link.status !== BookingLinkStatus.ACTIVE || link.archived_at) throw new NotFoundException({ message: 'This booking page is not available', code: 'booking_link_unavailable' });
        link.hosts = link.hosts.filter((h) => h.membership.status === 'ACTIVE');
        return link;
    }

    async page(orgSlug: string, slug: string) {
        const link = await this.activeLink({ slug, organization: { slug: orgSlug } });
        await this.bumpStats(link.organization_id, link.id, { page_views: { increment: 1 } });
        return {
            id: link.id,
            name: link.name,
            description: link.description,
            duration_minutes: link.duration_minutes,
            duration_options: link.duration_options,
            timezone: link.timezone ?? link.organization.default_timezone,
            location: link.location,
            questions: link.questions ?? [],
            requires_confirmation: link.requires_confirmation,
            max_days_ahead: link.max_days_ahead,
            organization: { name: link.organization.display_name, logo_url: link.organization.logo_url },
            hosts: (link.host_assignment === BookingHostAssignment.SINGLE ? link.hosts.slice(0, 1) : link.hosts).map((h) => ({ name: displayName(h.membership.user), photo_url: h.membership.user.profile_photo_url })),
        };
    }

    async availableSlots(id: string, query: PublicSlotsQuery) {
        const link = await this.activeLink({ id });
        const duration = this.duration(link, query.duration);
        const list = await this.slots.slots(link, new Date(query.from), new Date(query.to), duration);
        return list.map((s) => ({ start: s.start, end: s.end }));
    }

    async book(id: string, dto: PublicBookingDto, ip: string | null) {
        const link = await this.activeLink({ id });
        const duration = this.duration(link, dto.duration);
        const start = new Date(dto.starts_at);
        if (Number.isNaN(start.getTime())) throw new BadRequestException({ message: 'Invalid time', code: 'invalid_time' });
        this.validateAnswers(link.questions as { key: string; label: string; required?: boolean }[] | null, dto.answers);

        // Re-check the slot now (nothing was held while the invitee filled the form).
        const dayFrom = new Date(start.getTime() - 12 * 3_600_000);
        const dayTo = new Date(start.getTime() + 36 * 3_600_000);
        const fresh = await this.slots.slots(link, dayFrom, dayTo, duration);
        const slot = fresh.find((s) => s.start.getTime() === start.getTime());
        if (!slot) {
            throw new ConflictException({ message: 'That time was just taken. Please pick another one.', code: 'slot_taken', slots: fresh.slice(0, 20).map((s) => ({ start: s.start, end: s.end })) });
        }
        const hostIds = await this.pickHosts(link, slot.host_ids);
        const organizer = hostIds[0];
        const ctx = systemContext(link.organization_id, null, 'api');
        const pending = link.requires_confirmation;
        const title = (link.event_title_template ?? '{invitee_name} × {link_name}').replace('{invitee_name}', dto.name).replace('{link_name}', link.name).replace('{host_name}', displayName(link.hosts.find((h) => h.membership_id === organizer)?.membership.user));

        const event = await this.calendarEvents.create(
            ctx,
            {
                title,
                description: dto.notes ? `Notes from ${dto.name}:\n\n${dto.notes}` : undefined,
                starts_at: slot.start.toISOString(),
                ends_at: new Date(slot.start.getTime() + duration * 60_000).toISOString(),
                timezone: link.timezone ?? link.organization.default_timezone,
                event_type_id: link.event_type_id ?? undefined,
                status: pending ? CalendarEventStatus.TENTATIVE : CalendarEventStatus.CONFIRMED,
                location: link.location ?? undefined,
                company_id: link.company_id ?? undefined,
                attendees: [...hostIds.slice(1).map((m) => ({ membership_id: m })), { email: dto.email.toLowerCase(), name: dto.name, role: CalendarAttendeeRole.REQUIRED }],
            },
            { source: 'BOOKING', organizerId: organizer, activitySummary: `${dto.name} booked ${link.name}` },
        );
        const booking = await this.prisma.calendarBooking.create({
            data: {
                organization_id: link.organization_id, booking_link_id: link.id, event_id: event.id, host_membership_id: organizer,
                status: pending ? CalendarBookingStatus.PENDING : CalendarBookingStatus.CONFIRMED, source: CalendarBookingSource.PUBLIC_LINK,
                starts_at: slot.start, ends_at: new Date(slot.start.getTime() + duration * 60_000), timezone: isValidZone(dto.timezone) ? dto.timezone : 'UTC',
                invitee_name: dto.name, invitee_email: dto.email.toLowerCase(), invitee_phone: dto.phone ?? null, company_id: link.company_id,
                answers: (dto.answers ?? undefined) as Prisma.InputJsonValue, notes: dto.notes ?? null, confirmed_at: pending ? null : new Date(),
            },
        });
        await this.bumpStats(link.organization_id, link.id, { bookings_created: { increment: 1 } });
        await this.audit.record(ctx, 'calendar_booking.created', { resource_type: 'calendar_booking', resource_id: booking.id, metadata: { booking_link_id: link.id, host_membership_id: organizer, ip_address: ip } });
        this.events.publish(ctx, {
            event_key: 'calendar.booking_created',
            module: ModuleKey.CALENDAR,
            entity_type: 'CALENDAR_BOOKING',
            entity_id: booking.id,
            payload: {
                booking_link_id: link.id, invitee_name: dto.name, starts_at: slot.start, status: booking.status, recipient_membership_ids: hostIds,
                notification_title: pending ? `${dto.name} requested ${link.name} — confirm it` : `${dto.name} booked ${link.name}`,
                notification_body: this.calendarEvents.whenText(slot.start, link.timezone ?? link.organization.default_timezone, false),
                notification_priority: 'IMPORTANT', link: `/calendar/bookings/${booking.id}`,
            },
        });
        return {
            status: booking.status,
            starts_at: booking.starts_at,
            ends_at: booking.ends_at,
            host_name: displayName(link.hosts.find((h) => h.membership_id === organizer)?.membership.user),
            confirmation_message: link.confirmation_message,
            redirect_url: link.redirect_url,
        };
    }

    private duration(link: { duration_minutes: number; duration_options: number[] }, requested?: number) {
        if (!requested || requested === link.duration_minutes) return link.duration_minutes;
        if (!link.duration_options.includes(requested)) throw new BadRequestException({ message: 'This duration is not offered', code: 'invalid_duration' });
        return requested;
    }

    private validateAnswers(questions: { key: string; label: string; required?: boolean }[] | null, answers: Record<string, string> | undefined) {
        for (const q of questions ?? []) {
            const v = answers?.[q.key];
            if (q.required && (typeof v !== 'string' || !v.trim())) throw new BadRequestException({ message: `${q.label} is required`, code: 'answer_required', field: q.key });
            if (v !== undefined && (typeof v !== 'string' || v.length > 2000)) throw new BadRequestException({ message: `${q.label} is invalid`, code: 'answer_invalid', field: q.key });
        }
    }

    /** SINGLE: first host · COLLECTIVE: all hosts · ROUND_ROBIN: by priority, then least recently booked. */
    private async pickHosts(link: { id: string; host_assignment: BookingHostAssignment; hosts: { membership_id: string; priority: number }[] }, available: string[]) {
        if (link.host_assignment === BookingHostAssignment.COLLECTIVE) return link.hosts.map((h) => h.membership_id);
        if (link.host_assignment === BookingHostAssignment.SINGLE) return [available[0]];
        const candidates = link.hosts.filter((h) => available.includes(h.membership_id));
        const last = await this.prisma.calendarBooking.groupBy({ by: ['host_membership_id'], where: { booking_link_id: link.id, host_membership_id: { in: candidates.map((c) => c.membership_id) } }, _max: { created_at: true } });
        const lastAt = (m: string) => last.find((l) => l.host_membership_id === m)?._max.created_at?.getTime() ?? 0;
        candidates.sort((a, b) => a.priority - b.priority || lastAt(a.membership_id) - lastAt(b.membership_id));
        return [candidates[0].membership_id];
    }

    private async bumpStats(organizationId: string, bookingLinkId: string, inc: Prisma.BookingLinkStatsDailyUpdateInput) {
        const now = new Date();
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const create: Prisma.BookingLinkStatsDailyUncheckedCreateInput = { organization_id: organizationId, booking_link_id: bookingLinkId, date };
        for (const [k, v] of Object.entries(inc)) (create as Record<string, unknown>)[k] = (v as { increment: number }).increment;
        await this.prisma.bookingLinkStatsDaily.upsert({ where: { booking_link_id_date: { booking_link_id: bookingLinkId, date } }, update: inc, create }).catch(() => undefined);
    }
}
