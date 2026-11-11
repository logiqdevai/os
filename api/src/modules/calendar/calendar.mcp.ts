import { Injectable, OnModuleInit } from '@nestjs/common';
import { CalendarAttendeeResponse, ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CalendarEventsService } from './calendar-events.service';
import { AvailabilityService } from './availability.service';
import { BookingLinksService } from './booking-links.service';
import { CalendarEventQuerySchema, CreateCalendarEventSchema, UpdateOccurrenceSchema } from './dto/calendar-event.dto';
import { FreeBusyQuerySchema, SuggestQuerySchema } from './dto/availability.dto';
import { BookingQuerySchema } from './dto/booking.dto';
import { ProjectedQuerySchema } from './dto/projected.dto';
import { CalendarProjectedService } from './calendar-projected.service';

/** MCP adapter for 19 — same service methods and validation as REST; the organization comes from the credential. */
@Injectable()
export class CalendarMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly events: CalendarEventsService,
        private readonly availability: AvailabilityService,
        private readonly links: BookingLinksService,
        private readonly projected: CalendarProjectedService,
    ) { }

    onModuleInit() {
        const M = ModuleKey.CALENDAR;
        this.registry.registerMany([
            {
                name: 'calendar_events_read',
                description: 'List my calendar events between from and to (ISO); recurring series are expanded. Optional calendar_ids, project_id, search.',
                permission: 'calendar.events.read_own', module: M, resource_type: 'calendar_event',
                input: CalendarEventQuerySchema,
                handler: (ctx, args) => this.events.list(ctx, args),
            },
            {
                name: 'calendar_events_get',
                description: 'Get one calendar event with attendees and reminders.',
                permission: 'calendar.events.read_own', module: M, resource_type: 'calendar_event',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.events.findOne(ctx, args.id),
            },
            {
                name: 'calendar_events_create',
                description: 'Create a calendar event (attendees by membership_id or email are invited).',
                permission: 'calendar.events.create', module: M, resource_type: 'calendar_event',
                input: CreateCalendarEventSchema,
                handler: (ctx, args) => this.events.create(ctx, args),
            },
            {
                name: 'calendar_events_update',
                description: 'Update a calendar event I organize or can edit.',
                permission: 'calendar.events.update_own', module: M, resource_type: 'calendar_event',
                input: CreateCalendarEventSchema.partial().extend({ id: z.string().uuid() }),
                handler: (ctx, { id, ...dto }) => this.events.update(ctx, id, dto),
            },
            {
                name: 'calendar_events_update_occurrence',
                description: 'Change one occurrence of a recurring event (occurrence_start = its start as listed); the rest of the series stays as is.',
                permission: 'calendar.events.update_own', module: M, resource_type: 'calendar_event',
                input: UpdateOccurrenceSchema,
                handler: (ctx, { id, ...dto }) => this.events.editOccurrence(ctx, id, dto),
            },
            {
                name: 'calendar_events_respond',
                description: 'Answer an invitation: ACCEPTED, TENTATIVE or DECLINED.',
                permission: 'calendar.events.read_own', module: M, resource_type: 'calendar_event',
                input: z.object({ id: z.string().uuid(), response: z.enum([CalendarAttendeeResponse.ACCEPTED, CalendarAttendeeResponse.TENTATIVE, CalendarAttendeeResponse.DECLINED]), comment: z.string().max(1000).optional() }),
                handler: (ctx, { id, ...dto }) => this.events.respond(ctx, id, dto),
            },
            {
                name: 'calendar_events_cancel',
                description: 'Cancel an event (or one occurrence of a series); attendees are notified.',
                permission: 'calendar.events.update_own', module: M, resource_type: 'calendar_event', sensitive: true,
                input: z.object({ id: z.string().uuid(), reason: z.string().max(1000).optional(), occurrence_start: z.string().datetime({ offset: true }).optional() }),
                handler: (ctx, { id, ...dto }) => this.events.cancel(ctx, id, dto),
            },
            {
                name: 'calendar_projected_read',
                description: 'Read-only dates from other modules between from and to (ISO): project milestones, my task due dates (tasks=all for every readable task), approved leave. Only modules the caller can read.',
                permission: 'calendar.events.read_own', module: M, resource_type: 'calendar_projected',
                input: ProjectedQuerySchema,
                handler: (ctx, args) => this.projected.list(ctx, args),
            },
            {
                name: 'calendar_availability_read',
                description: 'Free/busy of members (membership_ids, from, to): working hours and busy blocks.',
                permission: 'calendar.availability.read', module: M, resource_type: 'calendar_availability',
                input: FreeBusyQuerySchema,
                handler: (ctx, args) => this.availability.freeBusy(ctx, args),
            },
            {
                name: 'calendar_availability_suggest',
                description: 'Suggest common free slots for members (membership_ids, from, to, duration minutes).',
                permission: 'calendar.availability.read', module: M, resource_type: 'calendar_availability',
                input: SuggestQuerySchema,
                handler: (ctx, args) => this.availability.suggest(ctx, args),
            },
            {
                name: 'calendar_bookings_read',
                description: 'List bookings made through booking links (status, link, upcoming).',
                permission: 'calendar.bookings.read', module: M, resource_type: 'calendar_booking',
                input: BookingQuerySchema,
                handler: (ctx, args) => this.links.listBookings(ctx, args),
            },
            {
                name: 'calendar_bookings_manage',
                description: 'Confirm, cancel, mark no-show or complete a booking.',
                permission: 'calendar.bookings.manage', module: M, resource_type: 'calendar_booking', sensitive: true,
                input: z.object({ id: z.string().uuid(), action: z.enum(['confirm', 'cancel', 'no_show', 'complete']), reason: z.string().max(1000).optional() }),
                handler: (ctx, args) => this.links.act(ctx, args.id, args.action, args.reason),
            },
        ]);
    }
}
