import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEventVisibility, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { displayName, memberUserSelect } from '@/modules/notifications/utils/system-context';
import { CalendarAccessService } from './calendar-access.service';
import { CreateAvailabilityScheduleDto, FreeBusyQuery, SuggestQuery, UpdateAvailabilityScheduleDto } from './dto/availability.dto';
import { Interval, ScheduleLike, defaultSchedule, isValidZone, mergeIntervals, slotsIn, subtractIntervals, workingIntervals } from './utils/availability.utils';

const MAX_RANGE_DAYS = 62;
const scheduleInclude = { rules: { orderBy: [{ weekday: 'asc' }, { start_time: 'asc' }] }, overrides: { orderBy: { date: 'asc' } } } satisfies Prisma.CalendarAvailabilityScheduleInclude;

/** 19 §6 — availability schedules (own), free/busy across members and slot suggestions. */
@Injectable()
export class AvailabilityService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: CalendarAccessService,
    ) { }

    // ------------------------------------------------------------------ own schedules

    async listSchedules(ctx: OrgContext) {
        const me = this.access.me(ctx);
        return this.prisma.calendarAvailabilitySchedule.findMany({ where: { organization_id: ctx.organization_id, membership_id: me, archived_at: null }, include: scheduleInclude, orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }] });
    }

    async createSchedule(ctx: OrgContext, dto: CreateAvailabilityScheduleDto) {
        const me = this.access.me(ctx);
        this.validate(dto);
        const hasAny = await this.prisma.calendarAvailabilitySchedule.count({ where: { organization_id: ctx.organization_id, membership_id: me, archived_at: null } });
        const isDefault = dto.is_default ?? !hasAny;
        const row = await this.prisma.$transaction(async (tx) => {
            if (isDefault) await tx.calendarAvailabilitySchedule.updateMany({ where: { organization_id: ctx.organization_id, membership_id: me }, data: { is_default: false } });
            return tx.calendarAvailabilitySchedule.create({
                data: {
                    organization_id: ctx.organization_id, membership_id: me, name: dto.name, timezone: dto.timezone, is_default: isDefault,
                    honor_holidays: dto.honor_holidays ?? true, honor_leave: dto.honor_leave ?? true,
                    rules: { create: dto.rules.map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time })) },
                    overrides: { create: (dto.overrides ?? []).map((o) => ({ date: new Date(o.date.slice(0, 10)), kind: o.kind ?? 'UNAVAILABLE', start_time: o.start_time ?? null, end_time: o.end_time ?? null, reason: o.reason ?? null })) },
                },
                include: scheduleInclude,
            });
        });
        await this.audit.record(ctx, 'calendar_availability.created', { resource_type: 'calendar_availability_schedule', resource_id: row.id, metadata: { after: { name: dto.name, rules: dto.rules.length } } });
        this.events.publish(ctx, { event_key: 'calendar.availability_changed', module: ModuleKey.CALENDAR, entity_kind: 'calendar_availability_schedule', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updateSchedule(ctx: OrgContext, id: string, dto: UpdateAvailabilityScheduleDto) {
        const me = this.access.me(ctx);
        const before = await this.prisma.calendarAvailabilitySchedule.findFirst({ where: { id, organization_id: ctx.organization_id, membership_id: me } });
        if (!before) throw new NotFoundException({ message: 'Schedule not found', code: 'schedule_not_found' });
        this.validate({ timezone: dto.timezone ?? before.timezone, rules: dto.rules ?? [] });
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.calendarAvailabilitySchedule.updateMany({ where: { organization_id: ctx.organization_id, membership_id: me, id: { not: id } }, data: { is_default: false } });
            if (dto.rules) {
                await tx.calendarAvailabilityRule.deleteMany({ where: { schedule_id: id } });
                await tx.calendarAvailabilityRule.createMany({ data: dto.rules.map((r) => ({ schedule_id: id, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time })) });
            }
            if (dto.overrides) {
                await tx.calendarAvailabilityOverride.deleteMany({ where: { schedule_id: id } });
                await tx.calendarAvailabilityOverride.createMany({ data: dto.overrides.map((o) => ({ schedule_id: id, date: new Date(o.date.slice(0, 10)), kind: o.kind ?? 'UNAVAILABLE', start_time: o.start_time ?? null, end_time: o.end_time ?? null, reason: o.reason ?? null })) });
            }
            return tx.calendarAvailabilitySchedule.update({
                where: { id },
                data: { name: dto.name, timezone: dto.timezone, is_default: dto.is_default, honor_holidays: dto.honor_holidays, honor_leave: dto.honor_leave },
                include: scheduleInclude,
            });
        });
        await this.audit.record(ctx, 'calendar_availability.updated', { resource_type: 'calendar_availability_schedule', resource_id: id, metadata: { after: { name: dto.name, rules: dto.rules?.length, overrides: dto.overrides?.length } } });
        this.events.publish(ctx, { event_key: 'calendar.availability_changed', module: ModuleKey.CALENDAR, entity_kind: 'calendar_availability_schedule', entity_id: id, payload: { name: row.name } });
        return row;
    }

    async removeSchedule(ctx: OrgContext, id: string) {
        const me = this.access.me(ctx);
        const before = await this.prisma.calendarAvailabilitySchedule.findFirst({ where: { id, organization_id: ctx.organization_id, membership_id: me } });
        if (!before) throw new NotFoundException({ message: 'Schedule not found', code: 'schedule_not_found' });
        await this.prisma.calendarAvailabilitySchedule.update({ where: { id }, data: { archived_at: new Date(), is_default: false } });
        await this.audit.record(ctx, 'calendar_availability.archived', { resource_type: 'calendar_availability_schedule', resource_id: id });
        return { success: true };
    }

    private validate(dto: { timezone: string; rules: { weekday: number; start_time: string; end_time: string }[] }) {
        if (!isValidZone(dto.timezone)) throw new BadRequestException({ message: 'Unknown time zone', code: 'invalid_timezone' });
        for (const r of dto.rules) if (r.end_time <= r.start_time) throw new BadRequestException({ message: 'Each window must end after it starts', code: 'invalid_window' });
        for (let d = 0; d < 7; d++) {
            const day = dto.rules.filter((r) => r.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
            for (let i = 1; i < day.length; i++) if (day[i].start_time < day[i - 1].end_time) throw new BadRequestException({ message: 'Windows on the same day overlap', code: 'overlapping_windows' });
        }
    }

    /** The member's scheduling schedule: preference → default → first → Mon–Fri 09–17 in their zone (19 §6). */
    async scheduleFor(organizationId: string, membershipId: string, explicitId?: string | null): Promise<ScheduleLike> {
        if (explicitId) {
            const s = await this.prisma.calendarAvailabilitySchedule.findFirst({ where: { id: explicitId, organization_id: organizationId, archived_at: null }, include: scheduleInclude });
            if (s) return s;
        }
        const pref = await this.prisma.calendarPreference.findUnique({ where: { membership_id: membershipId }, select: { availability_schedule_id: true, timezone: true } });
        const s = await this.prisma.calendarAvailabilitySchedule.findFirst({
            where: { organization_id: organizationId, membership_id: membershipId, archived_at: null, ...(pref?.availability_schedule_id ? { id: pref.availability_schedule_id } : {}) },
            include: scheduleInclude,
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        if (s) return s;
        const member = await this.prisma.membership.findUnique({ where: { id: membershipId }, select: { user: { select: { timezone: true } }, organization: { select: { default_timezone: true } } } });
        return defaultSchedule([pref?.timezone, member?.user?.timezone, member?.organization?.default_timezone].find(isValidZone) ?? 'UTC');
    }

    // ------------------------------------------------------------------ free / busy

    async freeBusy(ctx: OrgContext, query: FreeBusyQuery) {
        const { from, to } = this.range(query.from, query.to);
        const members = await this.prisma.membership.findMany({ where: { id: { in: query.membership_ids }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true, user: { select: memberUserSelect } } });
        const ids = members.map((m) => m.id);
        const busy = await this.access.busyIntervals(ctx.organization_id, ids, from, to);
        // Titles only with calendar.calendars.read_team / calendar.events.read (or for the caller's own events); never for PRIVATE.
        const details = ctx.can('calendar.calendars.read_team') || ctx.can('calendar.events.read');
        return Promise.all(members.map(async (m) => {
            const schedule = await this.scheduleFor(ctx.organization_id, m.id);
            const working = workingIntervals(schedule, from, to);
            return {
                membership_id: m.id,
                name: displayName(m.user),
                photo_url: m.user.profile_photo_url,
                timezone: schedule.timezone,
                working,
                busy: busy.get(m.id).map((b) => {
                    const own = m.id === ctx.membership_id || b.organizer_membership_id === ctx.membership_id;
                    const show = own || (details && b.visibility !== CalendarEventVisibility.PRIVATE);
                    return { start: b.start, end: b.end, tentative: b.tentative, title: show ? b.title : null, event_id: show ? b.event_id : null };
                }).sort((a, b) => a.start.getTime() - b.start.getTime()),
            };
        }));
    }

    /** Common free slots of every listed member inside their working hours. */
    async suggest(ctx: OrgContext, query: SuggestQuery) {
        const { from, to } = this.range(query.from, query.to);
        const rows = await this.freeBusy(ctx, query);
        if (!rows.length) return [];
        let free: Interval[] = [{ start: from, end: to }];
        for (const r of rows) {
            const own = subtractIntervals(r.working, mergeIntervals(r.busy.map((b) => ({ start: b.start, end: b.end }))));
            free = intersect(free, own);
        }
        return slotsIn(free, query.duration, 15, new Date()).slice(0, query.limit);
    }

    private range(fromIso: string, toIso: string) {
        const from = new Date(fromIso);
        const to = new Date(toIso);
        if (!(to > from)) throw new BadRequestException({ message: '`to` must be after `from`', code: 'invalid_range' });
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw new BadRequestException({ message: `The range may span at most ${MAX_RANGE_DAYS} days`, code: 'range_too_large' });
        return { from, to };
    }
}

function intersect(a: Interval[], b: Interval[]): Interval[] {
    const out: Interval[] = [];
    for (const x of a) for (const y of b) {
        const start = new Date(Math.max(x.start.getTime(), y.start.getTime()));
        const end = new Date(Math.min(x.end.getTime(), y.end.getTime()));
        if (end > start) out.push({ start, end });
    }
    return mergeIntervals(out);
}
