import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CalendarEventStatus, ModuleKey, NotificationCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { systemContext } from '@/modules/notifications/utils/system-context';
import { CalendarEventsService } from './calendar-events.service';

/**
 * 19 §9 — emits due reminders to 14 every minute: event-default reminders (membership_id null) go to the organizer and
 * every member attendee who has not declined; personal ones to that member. Series reminders move to the next occurrence.
 */
@Injectable()
export class CalendarRemindersService {
    private readonly logger = new Logger(CalendarRemindersService.name);
    private running = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
        private readonly calendarEvents: CalendarEventsService,
    ) { }

    @Interval('calendar-reminders', 60_000)
    async tick() {
        if (this.running) return;
        this.running = true;
        try {
            const now = new Date();
            const due = await this.prisma.calendarEventReminder.findMany({
                where: { scheduled_at: { lte: now, gte: new Date(now.getTime() - 6 * 3_600_000) }, OR: [{ sent_at: null }, { sent_at: { lt: this.prisma.calendarEventReminder.fields.scheduled_at } }] },
                include: { event: { include: { attendees: { select: { membership_id: true, response: true } } } } },
                take: 200,
            });
            for (const r of due) {
                const e = r.event;
                if (e.status === CalendarEventStatus.CANCELLED) {
                    await this.prisma.calendarEventReminder.update({ where: { id: r.id }, data: { sent_at: now, scheduled_at: null } });
                    continue;
                }
                const occurrenceStart = new Date((r.scheduled_at as Date).getTime() + r.minutes_before * 60_000);
                const recipients = r.membership_id
                    ? [r.membership_id]
                    : [...new Set([e.organizer_membership_id, ...e.attendees.filter((a) => a.response !== 'DECLINED').map((a) => a.membership_id)].filter(Boolean) as string[])];
                const when = r.minutes_before === 0 ? 'now' : r.minutes_before < 60 ? `in ${r.minutes_before} min` : r.minutes_before < 1440 ? `in ${Math.round(r.minutes_before / 60)} h` : `in ${Math.round(r.minutes_before / 1440)} days`;
                await this.notifications.notify(systemContext(e.organization_id), {
                    recipient_membership_ids: recipients,
                    event_key: 'calendar.event_reminder',
                    module: ModuleKey.CALENDAR,
                    category: NotificationCategory.REMINDER,
                    audience_reason: 'attendee',
                    title: `${e.title} starts ${when}`,
                    body: [this.calendarEvents.whenText(occurrenceStart, e.timezone, e.all_day), e.location].filter(Boolean).join(' · '),
                    link: `/calendar/events/${e.id}`,
                    entity_type: 'CALENDAR_EVENT',
                    entity_id: e.id,
                    entity_label: e.title,
                    expires_at: new Date(occurrenceStart.getTime() + (e.ends_at.getTime() - e.starts_at.getTime())),
                    idempotency_key: `reminder:${r.id}:${occurrenceStart.toISOString()}`,
                    include_actor: true,
                }).catch((err) => this.logger.warn(`reminder ${r.id}: ${(err as Error).message}`));
                // Next occurrence (series) or done.
                const nextAt = e.recurrence_rule ? this.calendarEvents.reminderAt(e, r.minutes_before, new Date(occurrenceStart.getTime() + 1000)) : null;
                await this.prisma.calendarEventReminder.update({ where: { id: r.id }, data: { sent_at: now, scheduled_at: e.recurrence_rule ? nextAt : r.scheduled_at } });
            }
        } catch (error) {
            this.logger.warn(`calendar reminders: ${(error as Error).message}`);
        } finally {
            this.running = false;
        }
    }
}
