import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingLinkStatus, CalendarBookingStatus, CalendarEventStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { displayName, memberUserSelect } from '@/modules/notifications/utils/system-context';
import { CalendarAccessService } from './calendar-access.service';
import { BookingSlotsService } from './booking-slots.service';
import { BookingLinkQuery, BookingQuery, CreateBookingLinkDto, UpdateBookingLinkDto } from './dto/booking.dto';
import { isValidZone } from './utils/availability.utils';

const linkInclude = {
    hosts: { orderBy: { priority: 'asc' }, include: { membership: { select: { id: true, user: { select: memberUserSelect } } } } },
    event_type: { select: { id: true, name: true, color: true } },
    owner: { select: { id: true, user: { select: memberUserSelect } } },
    company: { select: { id: true, name: true } },
} satisfies Prisma.BookingLinkInclude;

/** 19 §6 — booking links (calendar.booking_links.manage) and the bookings they produce (calendar.bookings.read / manage, hosts always see their own). */
@Injectable()
export class BookingLinksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
        private readonly slots: BookingSlotsService,
    ) { }

    // ------------------------------------------------------------------ links

    async list(ctx: OrgContext, query: BookingLinkQuery) {
        const where: Prisma.BookingLinkWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status ? { status: query.status } : { status: { not: BookingLinkStatus.ARCHIVED } }),
            ...(query.audience && { audience: query.audience }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const since = new Date(Date.now() - 30 * 86_400_000);
        const [items, total, org] = await Promise.all([
            this.prisma.bookingLink.findMany({
                where, ...skipTake(query), orderBy: orderBy(query, ['name', 'created_at', 'status'], 'created_at'),
                include: { ...linkInclude, _count: { select: { bookings: { where: { status: { in: [CalendarBookingStatus.CONFIRMED, CalendarBookingStatus.PENDING] }, starts_at: { gte: new Date() } } } } }, daily_stats: { where: { date: { gte: since } }, select: { page_views: true, bookings_created: true } } },
            }),
            this.prisma.bookingLink.count({ where }),
            this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { slug: true } }),
        ]);
        return paginate(items.map((l) => this.present(l, org.slug)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const [link, org] = await Promise.all([
            this.prisma.bookingLink.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { ...linkInclude, daily_stats: { where: { date: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { date: 'asc' } } } }),
            this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { slug: true } }),
        ]);
        if (!link) throw new NotFoundException({ message: 'Booking link not found', code: 'booking_link_not_found' });
        return this.present(link, org.slug);
    }

    private present<T extends { slug: string; hosts: { membership: { id: string; user: Parameters<typeof displayName>[0] } }[]; daily_stats?: { page_views: number; bookings_created: number }[] }>(l: T, orgSlug: string) {
        const views = l.daily_stats?.reduce((s, d) => s + d.page_views, 0) ?? 0;
        const booked = l.daily_stats?.reduce((s, d) => s + d.bookings_created, 0) ?? 0;
        return {
            ...l,
            public_path: `/book/${orgSlug}/${l.slug}`,
            hosts: l.hosts.map((h) => ({ ...h, name: displayName(h.membership.user) })),
            stats_30d: { page_views: views, bookings: booked, conversion: views ? Math.round((booked / views) * 1000) / 10 : null },
        };
    }

    async create(ctx: OrgContext, dto: CreateBookingLinkDto) {
        await this.assertRefs(ctx, dto);
        try {
            const link = await this.prisma.bookingLink.create({
                data: {
                    organization_id: ctx.organization_id, slug: dto.slug, name: dto.name, description: dto.description ?? null,
                    status: dto.status ?? BookingLinkStatus.ACTIVE, audience: dto.audience, owner_membership_id: ctx.membership_id,
                    company_id: dto.company_id ?? null, event_type_id: dto.event_type_id ?? (await this.bookingTypeId(ctx)), host_assignment: dto.host_assignment,
                    duration_minutes: dto.duration_minutes, slot_interval_minutes: dto.slot_interval_minutes ?? dto.duration_minutes, buffer_before_minutes: dto.buffer_before_minutes,
                    buffer_after_minutes: dto.buffer_after_minutes, min_notice_minutes: dto.min_notice_minutes, max_days_ahead: dto.max_days_ahead,
                    max_bookings_per_day: dto.max_bookings_per_day ?? null, requires_confirmation: dto.requires_confirmation, timezone: isValidZone(dto.timezone) ? dto.timezone : await this.access.timezoneOf(ctx),
                    location: dto.location ?? null, questions: (dto.questions ?? undefined) as unknown as Prisma.InputJsonValue, confirmation_message: dto.confirmation_message ?? null,
                    redirect_url: dto.redirect_url || null, cancellation_notice_minutes: dto.cancellation_notice_minutes ?? null, created_by_user_id: ctx.user_id,
                    hosts: { create: dto.hosts.map((h, i) => ({ membership_id: h.membership_id, priority: h.priority ?? i })) },
                },
            });
            await this.audit.record(ctx, 'booking_link.created', { resource_type: 'booking_link', resource_id: link.id, metadata: { after: { slug: dto.slug, name: dto.name, hosts: dto.hosts.length } } });
            this.events.publish(ctx, { event_key: 'calendar.booking_link_created', module: ModuleKey.CALENDAR, entity_kind: 'booking_link', entity_id: link.id, payload: { name: link.name, slug: link.slug } });
            return this.findOne(ctx, link.id);
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateBookingLinkDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto);
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.bookingLink.update({
                    where: { id },
                    data: {
                        slug: dto.slug, name: dto.name, description: dto.description, status: dto.status, audience: dto.audience, company_id: dto.company_id, event_type_id: dto.event_type_id,
                        host_assignment: dto.host_assignment, duration_minutes: dto.duration_minutes, slot_interval_minutes: dto.slot_interval_minutes, buffer_before_minutes: dto.buffer_before_minutes,
                        buffer_after_minutes: dto.buffer_after_minutes, min_notice_minutes: dto.min_notice_minutes, max_days_ahead: dto.max_days_ahead, max_bookings_per_day: dto.max_bookings_per_day,
                        requires_confirmation: dto.requires_confirmation, ...(dto.timezone !== undefined && { timezone: isValidZone(dto.timezone) ? dto.timezone : before.timezone }),
                        location: dto.location, ...(dto.questions !== undefined && { questions: dto.questions as unknown as Prisma.InputJsonValue }), confirmation_message: dto.confirmation_message,
                        ...(dto.redirect_url !== undefined && { redirect_url: dto.redirect_url || null }), cancellation_notice_minutes: dto.cancellation_notice_minutes,
                        ...(dto.status === BookingLinkStatus.ARCHIVED && { archived_at: new Date() }),
                    },
                });
                if (dto.hosts) {
                    await tx.bookingLinkHost.deleteMany({ where: { booking_link_id: id } });
                    await tx.bookingLinkHost.createMany({ data: dto.hosts.map((h, i) => ({ booking_link_id: id, membership_id: h.membership_id, priority: h.priority ?? i })) });
                }
            });
        } catch (error) {
            this.rethrowUnique(error);
        }
        await this.audit.record(ctx, 'booking_link.updated', { resource_type: 'booking_link', resource_id: id, metadata: { before: { slug: before.slug, status: before.status }, after: { ...dto, hosts: dto.hosts?.length } } });
        this.events.publish(ctx, { event_key: 'calendar.booking_link_updated', module: ModuleKey.CALENDAR, entity_kind: 'booking_link', entity_id: id, payload: { name: dto.name ?? before.name, status: dto.status ?? before.status } });
        return this.findOne(ctx, id);
    }

    /** Preview of the slots the public page offers (same computation). */
    async previewSlots(ctx: OrgContext, id: string, from: Date, to: Date) {
        const link = await this.prisma.bookingLink.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { hosts: true } });
        if (!link) throw new NotFoundException({ message: 'Booking link not found', code: 'booking_link_not_found' });
        return this.slots.slots(link, from, to);
    }

    private async bookingTypeId(ctx: OrgContext) {
        await this.access.ensureEventTypes(ctx.organization_id);
        return (await this.prisma.calendarEventType.findFirst({ where: { organization_id: ctx.organization_id, slug: 'booking' }, select: { id: true } }))?.id ?? null;
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateBookingLinkDto) {
        if (dto.hosts) {
            const ids = [...new Set(dto.hosts.map((h) => h.membership_id))];
            if (ids.length !== dto.hosts.length) throw new BadRequestException({ message: 'A host is listed twice', code: 'duplicate_host' });
            const found = await this.prisma.membership.count({ where: { id: { in: ids }, organization_id: ctx.organization_id, status: 'ACTIVE' } });
            if (found !== ids.length) throw new NotFoundException({ message: 'Some hosts are not active members', code: 'host_not_found' });
        }
        if (dto.event_type_id && !(await this.prisma.calendarEventType.findFirst({ where: { id: dto.event_type_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        }
        if (dto.company_id && !(await this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Customer not found', code: 'company_not_found' });
        }
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'This link address is already used', code: 'booking_link_slug_taken' });
        throw error;
    }

    // ------------------------------------------------------------------ bookings

    async listBookings(ctx: OrgContext, query: BookingQuery) {
        const hostOnly = !ctx.can('calendar.bookings.read');
        const where: Prisma.CalendarBookingWhereInput = {
            organization_id: ctx.organization_id,
            ...(hostOnly && { host_membership_id: ctx.membership_id ?? '__none__' }),
            ...(query.status && { status: query.status }),
            ...(query.booking_link_id && { booking_link_id: query.booking_link_id }),
            ...(query.upcoming && { starts_at: { gte: new Date() } }),
            ...(query.search && { OR: [{ invitee_name: { contains: query.search, mode: 'insensitive' } }, { invitee_email: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.calendarBooking.findMany({
                where, ...skipTake(query),
                orderBy: query.upcoming ? { starts_at: 'asc' } : orderBy(query, ['starts_at', 'created_at'], 'starts_at'),
                omit: { manage_token: true },
                include: { booking_link: { select: { id: true, name: true, slug: true } }, host: { select: { id: true, user: { select: memberUserSelect } } } },
            }),
            this.prisma.calendarBooking.count({ where }),
        ]);
        return paginate(items.map((b) => ({ ...b, host_name: b.host ? displayName(b.host.user) : null })), total, query);
    }

    async findBooking(ctx: OrgContext, id: string) {
        const b = await this.prisma.calendarBooking.findFirst({
            where: { id, organization_id: ctx.organization_id },
            omit: { manage_token: true },
            include: { booking_link: { select: { id: true, name: true, slug: true, questions: true } }, host: { select: { id: true, user: { select: memberUserSelect } } }, event: { select: { id: true, title: true, status: true } } },
        });
        // Hosts always see their own; others need calendar.bookings.read. 404 otherwise (no leak).
        if (!b || (!ctx.can('calendar.bookings.read') && b.host_membership_id !== ctx.membership_id)) throw new NotFoundException({ message: 'Booking not found', code: 'booking_not_found' });
        return { ...b, host_name: b.host ? displayName(b.host.user) : null };
    }

    async act(ctx: OrgContext, id: string, action: 'confirm' | 'cancel' | 'no_show' | 'complete', reason?: string) {
        const b = await this.findBooking(ctx, id);
        if (!ctx.can('calendar.bookings.manage') && b.host_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the host or a booking manager can do this', code: 'booking_not_manageable' });
        const now = new Date();
        const next: Record<typeof action, { from: CalendarBookingStatus[]; data: Prisma.CalendarBookingUpdateInput }> = {
            confirm: { from: [CalendarBookingStatus.PENDING], data: { status: CalendarBookingStatus.CONFIRMED, confirmed_at: now, confirmed_by_user_id: ctx.user_id } },
            cancel: { from: [CalendarBookingStatus.PENDING, CalendarBookingStatus.CONFIRMED], data: { status: CalendarBookingStatus.CANCELLED, cancelled_at: now, cancelled_by: 'host', cancellation_reason: reason ?? null } },
            no_show: { from: [CalendarBookingStatus.CONFIRMED], data: { status: CalendarBookingStatus.NO_SHOW, no_show_marked_at: now } },
            complete: { from: [CalendarBookingStatus.CONFIRMED], data: { status: CalendarBookingStatus.COMPLETED, completed_at: now } },
        };
        if (!next[action].from.includes(b.status)) throw new ConflictException({ message: `A ${b.status.toLowerCase()} booking cannot be changed this way`, code: 'booking_invalid_transition' });
        await this.prisma.$transaction(async (tx) => {
            await tx.calendarBooking.update({ where: { id }, data: next[action].data });
            if (b.event_id && action === 'confirm') await tx.calendarEvent.update({ where: { id: b.event_id }, data: { status: CalendarEventStatus.CONFIRMED } });
            if (b.event_id && action === 'cancel') await tx.calendarEvent.update({ where: { id: b.event_id }, data: { status: CalendarEventStatus.CANCELLED, cancelled_at: now, cancelled_by_user_id: ctx.user_id, cancellation_reason: reason ?? null } });
            if (action === 'cancel') {
                const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                await tx.bookingLinkStatsDaily.upsert({ where: { booking_link_id_date: { booking_link_id: b.booking_link_id, date } }, update: { bookings_cancelled: { increment: 1 } }, create: { organization_id: ctx.organization_id, booking_link_id: b.booking_link_id, date, bookings_cancelled: 1 } });
            }
        });
        await this.audit.record(ctx, `calendar_booking.${action}`, { resource_type: 'calendar_booking', resource_id: id, metadata: { reason: reason ?? null, before: { status: b.status } } });
        this.events.publish(ctx, {
            event_key: action === 'cancel' ? 'calendar.booking_cancelled' : action === 'confirm' ? 'calendar.booking_confirmed' : `calendar.booking_${action}`,
            module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_BOOKING', entity_id: id,
            payload: { invitee_name: b.invitee_name, booking_link_id: b.booking_link_id, starts_at: b.starts_at },
        });
        return this.findBooking(ctx, id);
    }
}
