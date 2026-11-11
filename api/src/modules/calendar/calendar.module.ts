import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AvailabilityController, BookingLinksController, CalendarEventsController, CalendarsController, PublicBookingController, ResourcesController } from './calendar.controller';
import { CalendarAccessService } from './calendar-access.service';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarsService } from './calendars.service';
import { AvailabilityService } from './availability.service';
import { ResourcesService } from './resources.service';
import { BookingSlotsService } from './booking-slots.service';
import { BookingLinksService } from './booking-links.service';
import { PublicBookingService } from './public-booking.service';
import { CalendarRemindersService } from './calendar-reminders.service';
import { CalendarMcp } from './calendar.mcp';

/** 19 Calendar — events, calendars, availability, resources, booking links (+ public page), reminders. */
@Module({
    imports: [NotificationsModule],
    controllers: [CalendarEventsController, CalendarsController, AvailabilityController, ResourcesController, BookingLinksController, PublicBookingController],
    providers: [
        CalendarAccessService, CalendarEventsService, CalendarsService, AvailabilityService, ResourcesService, BookingSlotsService,
        BookingLinksService, PublicBookingService, CalendarRemindersService, CalendarMcp,
    ],
    exports: [CalendarEventsService, CalendarAccessService, AvailabilityService],
})
export class CalendarModule { }
