import { Injectable } from '@nestjs/common';
import { BookingHostAssignment, CalendarBookingStatus } from 'generated/prisma';
import { DateTime } from 'luxon';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import { CalendarAccessService } from './calendar-access.service';
import { Interval, isValidZone, slotsIn, subtractIntervals, workingIntervals } from './utils/availability.utils';

export interface BookingSlot extends Interval {
    host_ids: string[];
}

export interface SlotLink {
    id: string;
    organization_id: string;
    duration_minutes: number;
    slot_interval_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    min_notice_minutes: number;
    max_days_ahead: number;
    available_from: Date | null;
    available_until: Date | null;
    max_bookings_per_day: number | null;
    host_assignment: BookingHostAssignment;
    availability_schedule_id: string | null;
    timezone: string | null;
    hosts: { membership_id: string; priority: number; availability_schedule_id: string | null }[];
}

/**
 * 19 §6 — slot computation for booking links: host availability schedule, minus busy events (with buffers),
 * respecting min notice, max days ahead, the fixed window, slot interval and max bookings per day.
 * SINGLE = first host · ROUND_ROBIN = any host free · COLLECTIVE = every host free. Nothing is held (re-checked on submit).
 */
@Injectable()
export class BookingSlotsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly availability: AvailabilityService,
        private readonly access: CalendarAccessService,
    ) { }

    async slots(link: SlotLink, fromIso: Date, toIso: Date, durationMinutes?: number): Promise<BookingSlot[]> {
        const duration = durationMinutes ?? link.duration_minutes;
        const now = new Date();
        const earliest = new Date(now.getTime() + link.min_notice_minutes * 60_000);
        const latest = new Date(now.getTime() + link.max_days_ahead * 86_400_000);
        let from = new Date(Math.max(fromIso.getTime(), earliest.getTime()));
        let to = new Date(Math.min(toIso.getTime(), latest.getTime(), fromIso.getTime() + 62 * 86_400_000));
        if (link.available_from) from = new Date(Math.max(from.getTime(), link.available_from.getTime()));
        if (link.available_until) to = new Date(Math.min(to.getTime(), link.available_until.getTime() + 86_400_000));
        if (!(to > from) || !link.hosts.length) return [];

        const hosts = [...link.hosts].sort((a, b) => a.priority - b.priority);
        const used = link.host_assignment === BookingHostAssignment.SINGLE ? hosts.slice(0, 1) : hosts;
        const busy = await this.access.busyIntervals(link.organization_id, used.map((h) => h.membership_id), new Date(from.getTime() - 86_400_000), new Date(to.getTime() + 86_400_000));

        const perHost = new Map<string, Interval[]>();
        for (const h of used) {
            const schedule = await this.availability.scheduleFor(link.organization_id, h.membership_id, h.availability_schedule_id ?? link.availability_schedule_id);
            const working = workingIntervals(schedule, from, to);
            const blocked = busy.get(h.membership_id).map((b) => ({ start: new Date(b.start.getTime() - link.buffer_before_minutes * 60_000), end: new Date(b.end.getTime() + link.buffer_after_minutes * 60_000) }));
            perHost.set(h.membership_id, slotsIn(subtractIntervals(working, blocked), duration, link.slot_interval_minutes, earliest));
        }

        const byStart = new Map<number, BookingSlot>();
        for (const [hostId, list] of perHost) {
            for (const s of list) {
                const k = s.start.getTime();
                const slot = byStart.get(k) ?? { start: s.start, end: s.end, host_ids: [] };
                slot.host_ids.push(hostId);
                byStart.set(k, slot);
            }
        }
        let out = [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
        if (link.host_assignment === BookingHostAssignment.COLLECTIVE) out = out.filter((s) => s.host_ids.length === used.length);

        if (link.max_bookings_per_day) {
            const tz = isValidZone(link.timezone) ? link.timezone : 'UTC';
            const existing = await this.prisma.calendarBooking.findMany({
                where: { booking_link_id: link.id, status: { in: [CalendarBookingStatus.CONFIRMED, CalendarBookingStatus.PENDING] }, starts_at: { gte: new Date(from.getTime() - 86_400_000), lt: new Date(to.getTime() + 86_400_000) } },
                select: { starts_at: true },
            });
            const perDay = new Map<string, number>();
            existing.forEach((b) => {
                const d = DateTime.fromJSDate(b.starts_at, { zone: tz }).toISODate();
                perDay.set(d, (perDay.get(d) ?? 0) + 1);
            });
            out = out.filter((s) => (perDay.get(DateTime.fromJSDate(s.start, { zone: tz }).toISODate()) ?? 0) < link.max_bookings_per_day);
        }
        return out;
    }
}
