import { BadRequestException, Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarsService } from './calendars.service';
import { AvailabilityService } from './availability.service';
import { ResourcesService } from './resources.service';
import { BookingLinksService } from './booking-links.service';
import { PublicBookingService } from './public-booking.service';
import { CalendarEventQuery, CalendarEventQuerySchema, CancelCalendarEventDto, CreateCalendarEventDto, RespondCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import {
    CalendarListQuery, CalendarListQuerySchema, CreateCalendarDto, CreateEventTypeDto, PeopleQuery, PeopleQuerySchema, ShareCalendarDto, UpdateCalendarDto, UpdateCalendarPreferenceDto, UpdateEventTypeDto,
} from './dto/calendar.dto';
import {
    CreateAvailabilityScheduleDto, CreateResourceDto, FreeBusyQuery, FreeBusyQuerySchema, ResourceQuery, ResourceQuerySchema, SuggestQuery, SuggestQuerySchema, UpdateAvailabilityScheduleDto, UpdateResourceDto,
} from './dto/availability.dto';
import { BookingActionDto, BookingLinkQuery, BookingLinkQuerySchema, BookingQuery, BookingQuerySchema, CreateBookingLinkDto, PublicBookingDto, PublicSlotsQuery, PublicSlotsQuerySchema, UpdateBookingLinkDto } from './dto/booking.dto';

const READ = ['calendar.events.read', 'calendar.events.read_own'];
const RangeSchema = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) });
type Range = z.infer<typeof RangeSchema>;

/** 19 — events (range listing with recurrence expansion, CRUD, RSVP, cancel). */
@ApiTags('Calendar · Events')
@ApiBearerAuth()
@Controller('calendar/events')
@UseGuards(JwtGuard, PermissionsGuard)
export class CalendarEventsController {
    constructor(private readonly events: CalendarEventsService) { }

    @Get()
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Occurrences overlapping [from, to) in my calendars (or the listed calendar_ids)' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CalendarEventQuerySchema)) query: CalendarEventQuery) {
        return this.events.list(ctx, query);
    }

    @Get(':id')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Event detail (masked to Busy when private to someone else)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.events.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('calendar.events.create')
    @ApiOperation({ summary: 'Create an event (attendees are invited)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCalendarEventDto) {
        return this.events.create(ctx, dto);
    }

    @Patch(':id')
    @RequireAnyPermission('calendar.events.update_own', 'calendar.events.manage')
    @ApiOperation({ summary: 'Update an event (whole series)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCalendarEventDto) {
        return this.events.update(ctx, id, dto);
    }

    @Post(':id/cancel')
    @RequireAnyPermission('calendar.events.update_own', 'calendar.events.manage')
    @ApiOperation({ summary: 'Cancel an event or one occurrence of a series' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelCalendarEventDto) {
        return this.events.cancel(ctx, id, dto);
    }

    @Post(':id/respond')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'RSVP to an event I am invited to' })
    respond(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondCalendarEventDto) {
        return this.events.respond(ctx, id, dto);
    }

    @Delete(':id')
    @RequireAnyPermission('calendar.events.delete_own', 'calendar.events.manage')
    @ApiOperation({ summary: 'Delete an event permanently' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.events.remove(ctx, id);
    }
}

/** 19 §2, §4, §5, §10 — calendars, sharing, event types, my preferences, member directory for pickers. */
@ApiTags('Calendar · Calendars')
@ApiBearerAuth()
@Controller('calendar')
@UseGuards(JwtGuard, PermissionsGuard)
export class CalendarsController {
    constructor(private readonly calendars: CalendarsService) { }

    @Get('calendars')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Calendars I can reach, with my role on each' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CalendarListQuerySchema)) query: CalendarListQuery) {
        return this.calendars.list(ctx, query);
    }

    @Get('calendars/:id')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Calendar detail (shares when I can manage it)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calendars.findOne(ctx, id);
    }

    @Post('calendars')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Create a calendar (PERSONAL: calendar.events.create; others: calendar.calendars.manage)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCalendarDto) {
        return this.calendars.create(ctx, dto);
    }

    @Patch('calendars/:id')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Update a calendar (owner, MANAGE share or calendar.calendars.manage)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCalendarDto) {
        return this.calendars.update(ctx, id, dto);
    }

    @Post('calendars/:id/archive')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Archive a calendar' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calendars.archive(ctx, id, true);
    }

    @Post('calendars/:id/restore')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Restore an archived calendar' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calendars.archive(ctx, id, false);
    }

    @Post('calendars/:id/shares')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Share with a member or team (FREE_BUSY, READ, WRITE, MANAGE)' })
    share(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareCalendarDto) {
        return this.calendars.share(ctx, id, dto);
    }

    @Delete('calendars/:id/shares/:shareId')
    @RequireAnyPermission('calendar.calendars.manage', 'calendar.events.create')
    @ApiOperation({ summary: 'Remove a share' })
    unshare(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('shareId', ParseUUIDPipe) shareId: string) {
        return this.calendars.unshare(ctx, id, shareId);
    }

    @Get('event-types')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Event types (system types are seeded on first use)' })
    eventTypes(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.calendars.listEventTypes(ctx, archived === 'true');
    }

    @Post('event-types')
    @RequirePermission('calendar.event_types.manage')
    @ApiOperation({ summary: 'Create an event type' })
    createEventType(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateEventTypeDto) {
        return this.calendars.createEventType(ctx, dto);
    }

    @Patch('event-types/:id')
    @RequirePermission('calendar.event_types.manage')
    @ApiOperation({ summary: 'Update an event type' })
    updateEventType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventTypeDto) {
        return this.calendars.updateEventType(ctx, id, dto);
    }

    @Post('event-types/:id/archive')
    @RequirePermission('calendar.event_types.manage')
    @ApiOperation({ summary: 'Archive a custom event type' })
    archiveEventType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.calendars.archiveEventType(ctx, id);
    }

    @Get('preferences/me')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'My calendar preferences (effective values)' })
    preferences(@CurrentOrg() ctx: OrgContext) {
        return this.calendars.getPreferences(ctx);
    }

    @Put('preferences/me')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Update my calendar preferences' })
    updatePreferences(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateCalendarPreferenceDto) {
        return this.calendars.updatePreferences(ctx, dto);
    }

    @Get('people')
    @RequireAnyPermission('calendar.availability.read', 'calendar.events.create')
    @ApiOperation({ summary: 'Active members for attendee / host pickers' })
    people(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PeopleQuerySchema)) query: PeopleQuery) {
        return this.calendars.people(ctx, query);
    }

    @Get('teams')
    @RequireAnyPermission('calendar.availability.read', 'calendar.events.create')
    @ApiOperation({ summary: 'Teams for the team availability view and sharing' })
    teams(@CurrentOrg() ctx: OrgContext) {
        return this.calendars.teams(ctx);
    }
}

/** 19 §6 — availability schedules, free/busy and slot suggestions. */
@ApiTags('Calendar · Availability')
@ApiBearerAuth()
@Controller('calendar/availability')
@UseGuards(JwtGuard, PermissionsGuard)
export class AvailabilityController {
    constructor(private readonly availability: AvailabilityService) { }

    @Get('schedules')
    @RequirePermission('calendar.availability.read')
    @ApiOperation({ summary: 'My availability schedules' })
    schedules(@CurrentOrg() ctx: OrgContext) {
        return this.availability.listSchedules(ctx);
    }

    @Post('schedules')
    @RequirePermission('calendar.availability.manage')
    @ApiOperation({ summary: 'Create one of my schedules' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateAvailabilityScheduleDto) {
        return this.availability.createSchedule(ctx, dto);
    }

    @Patch('schedules/:id')
    @RequirePermission('calendar.availability.manage')
    @ApiOperation({ summary: 'Update one of my schedules (rules / overrides are replaced when sent)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAvailabilityScheduleDto) {
        return this.availability.updateSchedule(ctx, id, dto);
    }

    @Delete('schedules/:id')
    @RequirePermission('calendar.availability.manage')
    @ApiOperation({ summary: 'Archive one of my schedules' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.availability.removeSchedule(ctx, id);
    }

    @Get('free-busy')
    @RequirePermission('calendar.availability.read')
    @ApiOperation({ summary: 'Working hours and busy blocks of members (titles only where allowed)' })
    freeBusy(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(FreeBusyQuerySchema)) query: FreeBusyQuery) {
        return this.availability.freeBusy(ctx, query);
    }

    @Get('suggest')
    @RequirePermission('calendar.availability.read')
    @ApiOperation({ summary: 'Common free slots of the listed members' })
    suggest(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(SuggestQuerySchema)) query: SuggestQuery) {
        return this.availability.suggest(ctx, query);
    }
}

/** 19 §6 — rooms and equipment. */
@ApiTags('Calendar · Resources')
@ApiBearerAuth()
@Controller('calendar/resources')
@UseGuards(JwtGuard, PermissionsGuard)
export class ResourcesController {
    constructor(private readonly resources: ResourcesService) { }

    @Get()
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Rooms and equipment' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ResourceQuerySchema)) query: ResourceQuery) {
        return this.resources.list(ctx, query);
    }

    @Get('requests')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Resource bookings waiting for approval' })
    requests(@CurrentOrg() ctx: OrgContext) {
        return this.resources.requests(ctx);
    }

    @Get(':id/schedule')
    @RequireAnyPermission(...READ)
    @ApiOperation({ summary: 'Bookings of a resource in a range' })
    schedule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(RangeSchema)) q: Range) {
        return this.resources.schedule(ctx, id, q.from, q.to);
    }

    @Post()
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Create a resource' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateResourceDto) {
        return this.resources.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Update a resource' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto) {
        return this.resources.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Archive a resource' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.resources.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Restore a resource' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.resources.archive(ctx, id, false);
    }

    @Post(':id/requests/:eventId/approve')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Approve a resource request' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: BookingActionDto) {
        return this.resources.decide(ctx, eventId, id, true, dto.reason);
    }

    @Post(':id/requests/:eventId/decline')
    @RequirePermission('calendar.resources.manage')
    @ApiOperation({ summary: 'Decline a resource request' })
    decline(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: BookingActionDto) {
        return this.resources.decide(ctx, eventId, id, false, dto.reason);
    }
}

/** 19 §6 — booking links and bookings. */
@ApiTags('Calendar · Booking')
@ApiBearerAuth()
@Controller('calendar')
@UseGuards(JwtGuard, PermissionsGuard)
export class BookingLinksController {
    constructor(private readonly links: BookingLinksService) { }

    @Get('booking-links')
    @RequirePermission('calendar.booking_links.manage')
    @ApiOperation({ summary: 'Booking links with 30-day stats' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BookingLinkQuerySchema)) query: BookingLinkQuery) {
        return this.links.list(ctx, query);
    }

    @Get('booking-links/:id')
    @RequirePermission('calendar.booking_links.manage')
    @ApiOperation({ summary: 'Booking link detail' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.links.findOne(ctx, id);
    }

    @Get('booking-links/:id/slots')
    @RequirePermission('calendar.booking_links.manage')
    @ApiOperation({ summary: 'Preview the slots the public page offers' })
    slots(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(RangeSchema)) q: Range) {
        return this.links.previewSlots(ctx, id, new Date(q.from), new Date(q.to));
    }

    @Post('booking-links')
    @RequirePermission('calendar.booking_links.manage')
    @ApiOperation({ summary: 'Create a booking link' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateBookingLinkDto) {
        return this.links.create(ctx, dto);
    }

    @Patch('booking-links/:id')
    @RequirePermission('calendar.booking_links.manage')
    @ApiOperation({ summary: 'Update a booking link (status ACTIVE / PAUSED / ARCHIVED)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingLinkDto) {
        return this.links.update(ctx, id, dto);
    }

    @Get('bookings')
    @RequireAnyPermission('calendar.bookings.read', 'calendar.events.read_own')
    @ApiOperation({ summary: 'Bookings (all in scope with calendar.bookings.read, otherwise my own as host)' })
    bookings(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BookingQuerySchema)) query: BookingQuery) {
        return this.links.listBookings(ctx, query);
    }

    @Get('bookings/:id')
    @RequireAnyPermission('calendar.bookings.read', 'calendar.events.read_own')
    @ApiOperation({ summary: 'Booking detail' })
    booking(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.links.findBooking(ctx, id);
    }

    @Post('bookings/:id/:action')
    @RequireAnyPermission('calendar.bookings.manage', 'calendar.events.update_own')
    @ApiOperation({ summary: 'confirm | cancel | no-show | complete (host or calendar.bookings.manage)' })
    act(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string, @Body() dto: BookingActionDto) {
        const map = { confirm: 'confirm', cancel: 'cancel', 'no-show': 'no_show', complete: 'complete' } as const;
        const a = map[action as keyof typeof map];
        if (!a) throw new BadRequestException({ message: 'Unknown booking action', code: 'invalid_booking_action' });
        return this.links.act(ctx, id, a, dto.reason);
    }
}

/** 19 §6, §8 — public booking page API (no login, PUBLIC links only, rate limited). */
@ApiTags('Calendar · Public booking')
@Controller('public/booking-links')
@UseGuards(JwtGuard)
@Public()
export class PublicBookingController {
    constructor(private readonly booking: PublicBookingService) { }

    @Get(':id/slots')
    @ApiOperation({ summary: 'Free slots in a range' })
    slots(@Ip() ip: string, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(PublicSlotsQuerySchema)) query: PublicSlotsQuery) {
        this.booking.limit(`slots:${ip}`, 60, 60_000);
        return this.booking.availableSlots(id, query);
    }

    @Get(':orgSlug/:slug')
    @ApiOperation({ summary: 'Booking page (only ACTIVE PUBLIC links)' })
    page(@Ip() ip: string, @Param('orgSlug') orgSlug: string, @Param('slug') slug: string) {
        this.booking.limit(`page:${ip}`, 60, 60_000);
        return this.booking.page(orgSlug, slug);
    }

    @Post(':id/bookings')
    @ApiOperation({ summary: 'Book a slot (409 with fresh slots when it was just taken)' })
    book(@Ip() ip: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublicBookingDto) {
        this.booking.limit(`book:${ip}`, 5, 10 * 60_000);
        return this.booking.book(id, dto, ip ?? null);
    }
}
