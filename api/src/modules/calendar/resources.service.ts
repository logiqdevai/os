import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEventStatus, CalendarKind, CalendarResourceBookingStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CalendarAccessService } from './calendar-access.service';
import { CreateResourceDto, ResourceQuery, UpdateResourceDto } from './dto/availability.dto';
import { expandOccurrences } from './utils/recurrence.utils';

/** 19 §6 — bookable rooms and equipment. Each resource owns a RESOURCE calendar used for conflict detection. */
@Injectable()
export class ResourcesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
    ) { }

    async list(ctx: OrgContext, query: ResourceQuery) {
        return this.prisma.calendarResource.findMany({
            where: {
                organization_id: ctx.organization_id,
                ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
                ...(query.kind && { kind: query.kind }),
                ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { location: { contains: query.search, mode: 'insensitive' } }] }),
            },
            include: { branch: { select: { id: true, name: true } } },
            orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        });
    }

    /** Bookings of one resource on one day (busy blocks; titles only when the caller may see the event). */
    async schedule(ctx: OrgContext, id: string, fromIso: string, toIso: string) {
        const resource = await this.prisma.calendarResource.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!resource) throw new NotFoundException({ message: 'Resource not found', code: 'resource_not_found' });
        const from = new Date(fromIso);
        const to = new Date(toIso);
        const events = await this.prisma.calendarEvent.findMany({
            where: {
                organization_id: ctx.organization_id, status: { not: CalendarEventStatus.CANCELLED },
                resources: { some: { resource_id: id, status: { in: [CalendarResourceBookingStatus.APPROVED, CalendarResourceBookingStatus.REQUESTED] } } },
                AND: [this.access.rangeWhere(from, to)],
            },
            select: { id: true, title: true, visibility: true, starts_at: true, ends_at: true, timezone: true, recurrence_rule: true, recurrence_exdates: true, organizer_membership_id: true, resources: { where: { resource_id: id }, select: { status: true } } },
        });
        const out = [];
        for (const e of events) {
            const show = e.visibility !== 'PRIVATE' || e.organizer_membership_id === ctx.membership_id;
            for (const o of expandOccurrences(e.starts_at, e.ends_at, e.recurrence_rule, e.timezone, from, to, e.recurrence_exdates)) {
                out.push({ event_id: show ? e.id : null, title: show ? e.title : 'Busy', start: o.start, end: o.end, status: e.resources[0]?.status });
            }
        }
        return { resource, bookings: out.sort((a, b) => a.start.getTime() - b.start.getTime()) };
    }

    async create(ctx: OrgContext, dto: CreateResourceDto) {
        await this.assertBranch(ctx, dto.branch_id);
        try {
            const row = await this.prisma.$transaction(async (tx) => {
                const r = await tx.calendarResource.create({ data: { ...dto, kind: dto.kind ?? 'ROOM', organization_id: ctx.organization_id } });
                await tx.calendar.create({ data: { organization_id: ctx.organization_id, kind: CalendarKind.RESOURCE, name: r.name, color: r.color ?? 'neutral', resource_id: r.id, branch_id: r.branch_id, created_by_user_id: ctx.user_id } });
                return r;
            });
            await this.audit.record(ctx, 'calendar_resource.created', { resource_type: 'calendar_resource', resource_id: row.id, branch_id: row.branch_id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'calendar.resource_created', module: ModuleKey.CALENDAR, entity_kind: 'calendar_resource', entity_id: row.id, payload: { name: row.name } });
            return row;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateResourceDto) {
        const before = await this.prisma.calendarResource.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Resource not found', code: 'resource_not_found' });
        await this.assertBranch(ctx, dto.branch_id);
        try {
            const row = await this.prisma.calendarResource.update({ where: { id }, data: dto });
            if (dto.name || dto.color) await this.prisma.calendar.updateMany({ where: { resource_id: id }, data: { name: row.name, color: row.color ?? undefined } });
            await this.audit.record(ctx, 'calendar_resource.updated', { resource_type: 'calendar_resource', resource_id: id, metadata: { before: { name: before.name, capacity: before.capacity }, after: dto } });
            this.events.publish(ctx, { event_key: 'calendar.resource_updated', module: ModuleKey.CALENDAR, entity_kind: 'calendar_resource', entity_id: id, payload: { name: row.name }, changes: dto as Record<string, unknown> });
            return row;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        const before = await this.prisma.calendarResource.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Resource not found', code: 'resource_not_found' });
        const row = await this.prisma.calendarResource.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.prisma.calendar.updateMany({ where: { resource_id: id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'calendar_resource.archived' : 'calendar_resource.restored', { resource_type: 'calendar_resource', resource_id: id });
        return row;
    }

    /** Requests waiting for approval (requires_approval resources). */
    async requests(ctx: OrgContext) {
        return this.prisma.calendarEventResource.findMany({
            where: { status: CalendarResourceBookingStatus.REQUESTED, resource: { organization_id: ctx.organization_id }, event: { status: { not: CalendarEventStatus.CANCELLED } } },
            include: { resource: { select: { id: true, name: true } }, event: { select: { id: true, title: true, starts_at: true, ends_at: true, organizer_membership_id: true } } },
            orderBy: { created_at: 'asc' },
        });
    }

    async decide(ctx: OrgContext, eventId: string, resourceId: string, approve: boolean, note?: string) {
        const row = await this.prisma.calendarEventResource.findFirst({ where: { event_id: eventId, resource_id: resourceId, resource: { organization_id: ctx.organization_id } }, include: { event: true, resource: true } });
        if (!row) throw new NotFoundException({ message: 'Request not found', code: 'resource_request_not_found' });
        if (approve) {
            const clash = await this.prisma.calendarEvent.findFirst({
                where: {
                    id: { not: eventId }, organization_id: ctx.organization_id, status: { not: CalendarEventStatus.CANCELLED },
                    resources: { some: { resource_id: resourceId, status: CalendarResourceBookingStatus.APPROVED } },
                    recurrence_rule: null, starts_at: { lt: row.event.ends_at }, ends_at: { gt: row.event.starts_at },
                },
                select: { title: true },
            });
            if (clash) throw new ConflictException({ message: `${row.resource.name} is already booked by “${clash.title}”`, code: 'resource_conflict' });
        }
        const updated = await this.prisma.calendarEventResource.update({
            where: { id: row.id },
            data: { status: approve ? CalendarResourceBookingStatus.APPROVED : CalendarResourceBookingStatus.DECLINED, decided_by_user_id: ctx.user_id, decided_at: new Date(), decision_note: note ?? null },
        });
        await this.audit.record(ctx, approve ? 'calendar_resource.request_approved' : 'calendar_resource.request_declined', { resource_type: 'calendar_resource', resource_id: resourceId, metadata: { event_id: eventId } });
        this.events.publish(ctx, {
            event_key: approve ? 'calendar.resource_approved' : 'calendar.resource_declined', module: ModuleKey.CALENDAR, entity_type: 'CALENDAR_EVENT', entity_id: eventId,
            payload: { resource: row.resource.name, recipient_membership_ids: row.event.organizer_membership_id ? [row.event.organizer_membership_id] : [], link: `/calendar/events/${eventId}`, notification_title: `${row.resource.name} ${approve ? 'approved' : 'declined'} for ${row.event.title}` },
        });
        return updated;
    }

    private async assertBranch(ctx: OrgContext, branchId: string | null | undefined) {
        if (branchId && !(await this.prisma.branch.findFirst({ where: { id: branchId, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        }
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'A resource with this code already exists', code: 'resource_code_taken' });
        throw error;
    }
}
