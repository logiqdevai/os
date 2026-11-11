import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarKind, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { displayName, memberUserSelect } from '@/modules/notifications/utils/system-context';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { CalendarAccessService, atLeast } from './calendar-access.service';
import {
    CalendarListQuery, CreateCalendarDto, CreateEventTypeDto, PeopleQuery, ShareCalendarDto, UpdateCalendarDto, UpdateCalendarPreferenceDto, UpdateEventTypeDto,
} from './dto/calendar.dto';
import { isValidZone } from './utils/availability.utils';

/** 19 §2, §4, §5, §7, §10 — calendars and sharing, event types, the member's calendar preferences and a member directory for pickers. */
@Injectable()
export class CalendarsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
    ) { }

    // ------------------------------------------------------------------ calendars

    async list(ctx: OrgContext, query: CalendarListQuery) {
        await this.access.ensurePersonal(ctx);
        const map = await this.access.accessibleCalendars(ctx, { includeArchived: !!query.archived });
        const rows = [...map.values()]
            .filter((a) => (query.archived ? !!a.calendar.archived_at : !a.calendar.archived_at))
            .filter((a) => !query.kind || a.calendar.kind === query.kind)
            .filter((a) => !query.search || a.calendar.name.toLowerCase().includes(query.search.toLowerCase()))
            // Other members' personal calendars appear only when the caller may read them (not just free/busy).
            .filter((a) => a.calendar.kind !== CalendarKind.PERSONAL || a.subscribed || atLeast(a.role, 'READ'));
        const ids = rows.map((r) => r.calendar.id);
        const [owners, counts] = await Promise.all([
            this.prisma.calendar.findMany({ where: { id: { in: ids } }, select: { id: true, owner: { select: { id: true, user: { select: memberUserSelect } } }, team: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, company: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, _count: { select: { shares: true } } } }),
            this.prisma.calendarEvent.groupBy({ by: ['calendar_id'], where: { calendar_id: { in: ids }, status: { not: 'CANCELLED' }, OR: [{ ends_at: { gte: new Date() } }, { recurrence_rule: { not: null } }] }, _count: { _all: true } }),
        ]);
        return rows.map((a) => {
            const extra = owners.find((o) => o.id === a.calendar.id);
            const { feed_token: feed, ...calendar } = a.calendar;
            return {
                ...calendar,
                feed_enabled: !!feed,
                role: a.role,
                subscribed: a.subscribed,
                owner: extra?.owner ? { id: extra.owner.id, name: displayName(extra.owner.user) } : null,
                scope: extra?.team ?? extra?.project ?? extra?.company ?? extra?.branch ?? null,
                share_count: extra?._count.shares ?? 0,
                upcoming_events: counts.find((c) => c.calendar_id === a.calendar.id)?._count._all ?? 0,
            };
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        const a = await this.access.roleOn(ctx, id);
        if (!a || (a.calendar.kind === CalendarKind.PERSONAL && !a.subscribed && !atLeast(a.role, 'READ'))) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        const row = await this.prisma.calendar.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, user: { select: memberUserSelect } } },
                team: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                company: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                shares: atLeast(a.role, 'MANAGE')
                    ? { include: { membership: { select: { id: true, user: { select: memberUserSelect } } }, team: { select: { id: true, name: true } } }, orderBy: { created_at: 'asc' } }
                    : false,
            },
        });
        // The feed secret is stored hashed and never returned; only whether the feed is on.
        const { feed_token: feed, ...rest } = row;
        return { ...rest, feed_enabled: !!feed, role: a.role, can_manage: this.canManage(ctx, a.calendar, a.role) };
    }

    private canManage(ctx: OrgContext, c: { kind: CalendarKind; owner_membership_id: string | null }, role: string) {
        if (c.kind === CalendarKind.PERSONAL) return c.owner_membership_id === ctx.membership_id || role === 'MANAGE';
        return ctx.can('calendar.calendars.manage') || role === 'MANAGE';
    }

    async create(ctx: OrgContext, dto: CreateCalendarDto) {
        const me = this.access.me(ctx);
        if (dto.kind === CalendarKind.PERSONAL) {
            if (!ctx.can('calendar.events.create')) throw new ForbiddenException({ message: 'You cannot create calendars', code: 'permission_denied' });
        } else if (!ctx.can('calendar.calendars.manage')) {
            throw new ForbiddenException({ message: 'You do not have permission to do this (calendar.calendars.manage)', code: 'permission_denied' });
        }
        const scope = await this.scopeFor(ctx, dto, me);
        const row = await this.prisma.calendar.create({
            data: {
                organization_id: ctx.organization_id, kind: dto.kind, name: dto.name, description: dto.description ?? null, color: dto.color ?? 'info',
                timezone: isValidZone(dto.timezone) ? dto.timezone : null, default_visibility: dto.default_visibility, free_busy_only: dto.free_busy_only ?? false,
                created_by_user_id: ctx.user_id, ...scope,
            },
        });
        await this.audit.record(ctx, 'calendar.created', { resource_type: 'calendar', resource_id: row.id, branch_id: row.branch_id, metadata: { after: { kind: row.kind, name: row.name } } });
        this.events.publish(ctx, { event_key: 'calendar.calendar_created', module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: row.id, payload: { name: row.name, kind: row.kind } });
        return row;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCalendarDto) {
        const a = await this.access.roleOn(ctx, id);
        if (!a) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        if (!this.canManage(ctx, a.calendar, a.role)) throw new ForbiddenException({ message: 'You cannot change this calendar', code: 'calendar_not_manageable' });
        if (dto.kind && dto.kind !== a.calendar.kind) throw new BadRequestException({ message: 'The kind of a calendar cannot change', code: 'calendar_kind_immutable' });
        const row = await this.prisma.calendar.update({
            where: { id },
            data: {
                name: dto.name, description: dto.description, color: dto.color, default_visibility: dto.default_visibility, free_busy_only: dto.free_busy_only,
                ...(dto.timezone !== undefined && { timezone: isValidZone(dto.timezone) ? dto.timezone : null }),
            },
        });
        await this.audit.record(ctx, 'calendar.updated', { resource_type: 'calendar', resource_id: id, metadata: { before: { name: a.calendar.name, free_busy_only: a.calendar.free_busy_only }, after: dto } });
        this.events.publish(ctx, { event_key: 'calendar.calendar_updated', module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: id, payload: { name: row.name }, changes: dto as Record<string, unknown> });
        return row;
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        const a = await this.access.roleOn(ctx, id);
        if (!a) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        if (!this.canManage(ctx, a.calendar, a.role)) throw new ForbiddenException({ message: 'You cannot change this calendar', code: 'calendar_not_manageable' });
        if (archived && a.calendar.kind === CalendarKind.PERSONAL && a.calendar.is_default) throw new ConflictException({ message: 'Your default calendar cannot be archived', code: 'default_calendar' });
        const row = await this.prisma.calendar.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'calendar.archived' : 'calendar.restored', { resource_type: 'calendar', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'calendar.calendar_archived' : 'calendar.calendar_restored', module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: id, payload: { name: row.name } });
        return row;
    }

    async share(ctx: OrgContext, id: string, dto: ShareCalendarDto) {
        const a = await this.access.roleOn(ctx, id);
        if (!a) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        if (!this.canManage(ctx, a.calendar, a.role)) throw new ForbiddenException({ message: 'You cannot share this calendar', code: 'calendar_not_manageable' });
        if (!!dto.membership_id === !!dto.team_id) throw new BadRequestException({ message: 'Share with exactly one member or team', code: 'share_target_required' });
        if (dto.membership_id && !(await this.prisma.membership.findFirst({ where: { id: dto.membership_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        if (dto.team_id && !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        const data = { role: dto.role, expires_at: dto.expires_at ? new Date(dto.expires_at) : null, shared_by_user_id: ctx.user_id };
        const row = dto.membership_id
            ? await this.prisma.calendarShare.upsert({ where: { calendar_id_membership_id: { calendar_id: id, membership_id: dto.membership_id } }, update: data, create: { ...data, calendar_id: id, membership_id: dto.membership_id } })
            : await this.prisma.calendarShare.upsert({ where: { calendar_id_team_id: { calendar_id: id, team_id: dto.team_id } }, update: data, create: { ...data, calendar_id: id, team_id: dto.team_id } });
        await this.audit.record(ctx, 'calendar.shared', { resource_type: 'calendar', resource_id: id, metadata: { membership_id: dto.membership_id ?? null, team_id: dto.team_id ?? null, role: dto.role } });
        this.events.publish(ctx, {
            event_key: 'calendar.calendar_shared', module: ModuleKey.CALENDAR, entity_kind: 'calendar', entity_id: id,
            payload: { name: a.calendar.name, role: dto.role, ...(dto.membership_id && { recipient_membership_ids: [dto.membership_id], notification_category: 'SHARE', notification_title: `${await this.access.actorName(ctx)} shared the calendar “${a.calendar.name}” with you`, link: '/calendar' }) },
        });
        return row;
    }

    async unshare(ctx: OrgContext, id: string, shareId: string) {
        const a = await this.access.roleOn(ctx, id);
        if (!a) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        if (!this.canManage(ctx, a.calendar, a.role)) throw new ForbiddenException({ message: 'You cannot share this calendar', code: 'calendar_not_manageable' });
        const res = await this.prisma.calendarShare.deleteMany({ where: { id: shareId, calendar_id: id } });
        if (!res.count) throw new NotFoundException({ message: 'Share not found', code: 'share_not_found' });
        await this.audit.record(ctx, 'calendar.unshared', { resource_type: 'calendar', resource_id: id, metadata: { share_id: shareId } });
        return { success: true };
    }

    /** Exactly one scope column per kind (19 §2); references must belong to this organization. */
    private async scopeFor(ctx: OrgContext, dto: CreateCalendarDto, me: string): Promise<Partial<Prisma.CalendarUncheckedCreateInput>> {
        const org = ctx.organization_id;
        const need = async (ok: unknown, what: string) => {
            if (!ok) throw new NotFoundException({ message: `${what} not found`, code: `${what.toLowerCase()}_not_found` });
        };
        switch (dto.kind) {
            case CalendarKind.PERSONAL:
                return { owner_membership_id: me };
            case CalendarKind.TEAM:
                if (!dto.team_id) throw new BadRequestException({ message: 'Choose a team', code: 'team_required' });
                await need(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: org } }), 'Team');
                return { team_id: dto.team_id };
            case CalendarKind.PROJECT:
                if (!dto.project_id) throw new BadRequestException({ message: 'Choose a project', code: 'project_required' });
                await need(await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: org } }), 'Project');
                return { project_id: dto.project_id };
            case CalendarKind.CUSTOMER:
                if (!dto.company_id) throw new BadRequestException({ message: 'Choose a customer', code: 'company_required' });
                await need(await this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: org } }), 'Customer');
                return { company_id: dto.company_id };
            case CalendarKind.BRANCH:
                if (!dto.branch_id) throw new BadRequestException({ message: 'Choose a branch', code: 'branch_required' });
                await need(await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: org } }), 'Branch');
                return { branch_id: dto.branch_id };
            default:
                return {};
        }
    }

    // ------------------------------------------------------------------ event types

    async listEventTypes(ctx: OrgContext, includeArchived = false) {
        await this.access.ensureEventTypes(ctx.organization_id);
        return this.prisma.calendarEventType.findMany({ where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
    }

    async createEventType(ctx: OrgContext, dto: CreateEventTypeDto) {
        await this.access.ensureEventTypes(ctx.organization_id);
        const slug = dto.slug ?? slugify(dto.name);
        try {
            const row = await this.prisma.calendarEventType.create({
                data: { ...dto, slug, organization_id: ctx.organization_id, default_reminders: (dto.default_reminders ?? undefined) as unknown as Prisma.InputJsonValue, sort_order: 100 },
            });
            await this.audit.record(ctx, 'calendar_event_type.created', { resource_type: 'calendar_event_type', resource_id: row.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'calendar.event_type_created', module: ModuleKey.CALENDAR, entity_kind: 'calendar_event_type', entity_id: row.id, payload: { name: row.name } });
            return row;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'An event type with this slug already exists', code: 'event_type_slug_taken' });
            throw error;
        }
    }

    async updateEventType(ctx: OrgContext, id: string, dto: UpdateEventTypeDto) {
        const before = await this.prisma.calendarEventType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        if (before.is_system && dto.slug && dto.slug !== before.slug) throw new ConflictException({ message: 'System event types keep their slug', code: 'system_event_type' });
        const row = await this.prisma.calendarEventType.update({ where: { id }, data: { ...dto, default_reminders: dto.default_reminders === undefined ? undefined : (dto.default_reminders as unknown as Prisma.InputJsonValue) } });
        await this.audit.record(ctx, 'calendar_event_type.updated', { resource_type: 'calendar_event_type', resource_id: id, metadata: { before: { name: before.name }, after: dto } });
        return row;
    }

    async archiveEventType(ctx: OrgContext, id: string) {
        const before = await this.prisma.calendarEventType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        if (before.is_system) throw new ConflictException({ message: 'System event types cannot be archived', code: 'system_event_type' });
        const row = await this.prisma.calendarEventType.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'calendar_event_type.archived', { resource_type: 'calendar_event_type', resource_id: id });
        return row;
    }

    // ------------------------------------------------------------------ preferences

    async getPreferences(ctx: OrgContext) {
        const me = this.access.me(ctx);
        const personal = await this.access.ensurePersonal(ctx);
        const row = await this.prisma.calendarPreference.findUnique({ where: { membership_id: me } });
        const timezone = await this.access.timezoneOf(ctx);
        return {
            membership_id: me, default_calendar_id: row?.default_calendar_id ?? personal.id, timezone: row?.timezone ?? null, effective_timezone: timezone,
            default_view: row?.default_view ?? 'week', week_start: row?.week_start ?? 1, show_weekends: row?.show_weekends ?? true, show_declined_events: row?.show_declined_events ?? false,
            default_event_duration: row?.default_event_duration ?? 30, default_reminders: row?.default_reminders ?? [{ minutes_before: 10, method: 'NOTIFICATION' }],
            overlay_calendar_ids: row?.overlay_calendar_ids ?? [], availability_schedule_id: row?.availability_schedule_id ?? null,
            projected_modules: row?.projected_modules ?? [],
        };
    }

    async updatePreferences(ctx: OrgContext, dto: UpdateCalendarPreferenceDto) {
        const me = this.access.me(ctx);
        if (dto.default_calendar_id) {
            const a = await this.access.roleOn(ctx, dto.default_calendar_id);
            if (!a || !atLeast(a.role, 'WRITE')) throw new NotFoundException({ message: 'Calendar not found', code: 'calendar_not_found' });
        }
        if (dto.timezone && !isValidZone(dto.timezone)) throw new BadRequestException({ message: 'Unknown time zone', code: 'invalid_timezone' });
        if (dto.availability_schedule_id && !(await this.prisma.calendarAvailabilitySchedule.findFirst({ where: { id: dto.availability_schedule_id, organization_id: ctx.organization_id, membership_id: me } }))) {
            throw new NotFoundException({ message: 'Schedule not found', code: 'schedule_not_found' });
        }
        const data = { ...dto, default_reminders: dto.default_reminders === undefined ? undefined : (dto.default_reminders as unknown as Prisma.InputJsonValue) };
        await this.prisma.calendarPreference.upsert({ where: { membership_id: me }, update: data, create: { ...data, membership_id: me } });
        await this.audit.record(ctx, 'calendar_preference.updated', { resource_type: 'calendar_preference', resource_id: me, metadata: { after: dto } });
        return this.getPreferences(ctx);
    }

    // ------------------------------------------------------------------ member directory (attendee / host pickers)

    async people(ctx: OrgContext, query: PeopleQuery) {
        const rows = await this.prisma.membership.findMany({
            where: {
                organization_id: ctx.organization_id,
                status: 'ACTIVE',
                ...(query.team_id && { teams: { some: { team_id: query.team_id, ended_at: null } } }),
                ...(query.search && {
                    user: { OR: ['display_name', 'first_name', 'last_name', 'email'].map((f) => ({ [f]: { contains: query.search, mode: 'insensitive' } })) },
                }),
            },
            take: query.limit,
            orderBy: { user: { first_name: 'asc' } },
            select: { id: true, job_title: true, user: { select: memberUserSelect } },
        });
        return rows.map((m) => ({ id: m.id, name: displayName(m.user), email: m.user.email, job_title: m.job_title, photo_url: m.user.profile_photo_url, is_me: m.id === ctx.membership_id }));
    }

    async teams(ctx: OrgContext) {
        return this.prisma.team.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    }
}
