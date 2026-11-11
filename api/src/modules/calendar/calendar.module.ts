import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { ProjectsModule } from '@/modules/projects/projects.module';
import { TasksModule } from '@/modules/tasks/tasks.module';
import { PeopleModule } from '@/modules/people/people.module';
import { CalendarProjectedService } from './calendar-projected.service';
import { AvailabilityController, BookingLinksController, CalendarEventsController, CalendarFeedController, CalendarsController, PublicBookingController, ResourcesController } from './calendar.controller';
import { CalendarFeedService } from './calendar-feed.service';
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
    // Projects / Tasks / People are imported read-only for the projected-dates overlay (their scope helpers).
    imports: [NotificationsModule, ProjectsModule, TasksModule, PeopleModule],
    controllers: [CalendarEventsController, CalendarsController, AvailabilityController, ResourcesController, BookingLinksController, PublicBookingController, CalendarFeedController],
    providers: [
        CalendarAccessService, CalendarEventsService, CalendarsService, AvailabilityService, ResourcesService, BookingSlotsService,
        BookingLinksService, PublicBookingService, CalendarRemindersService, CalendarFeedService, CalendarProjectedService, CalendarMcp,
    ],
    exports: [CalendarEventsService, CalendarAccessService, AvailabilityService],
})
export class CalendarModule { }
