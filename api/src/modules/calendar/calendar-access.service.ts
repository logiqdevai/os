import { ForbiddenException, Injectable } from '@nestjs/common';
import { Calendar, CalendarEventStatus, CalendarEventVisibility, CalendarKind, CalendarShareRole, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { displayName, memberUserSelect } from '@/modules/notifications/utils/system-context';
import { Interval, isValidZone } from './utils/availability.utils';
import { expandOccurrences } from './utils/recurrence.utils';

export type CalendarRole = 'FREE_BUSY' | 'READ' | 'WRITE' | 'MANAGE';
const RANK: Record<CalendarRole, number> = { FREE_BUSY: 0, READ: 1, WRITE: 2, MANAGE: 3 };
const best = (a: CalendarRole | null, b: CalendarRole | null): CalendarRole | null => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);
export const atLeast = (role: CalendarRole | null | undefined, min: CalendarRole) => !!role && RANK[role] >= RANK[min];

/** System event types seeded per organization on first use (19 §4; is_system, not deletable). Colors are token names. */
const SYSTEM_EVENT_TYPES: Omit<Prisma.CalendarEventTypeCreateManyInput, 'organization_id'>[] = [
    { slug: 'meeting', name: 'Meeting', color: 'info', default_duration_minutes: 30, default_visibility: CalendarEventVisibility.TEAM, is_default: true, sort_order: 0 },
    { slug: 'customer-meeting', name: 'Customer meeting', color: 'violet', default_duration_minutes: 45, default_visibility: CalendarEventVisibility.ORGANIZATION, is_customer_facing: true, sort_order: 1 },
    { slug: 'kickoff', name: 'Kickoff', color: 'success', default_duration_minutes: 60, sort_order: 2 },
    { slug: 'review', name: 'Review', color: 'info', default_duration_minutes: 30, sort_order: 3 },
    { slug: 'interview', name: 'Interview', color: 'warning', default_duration_minutes: 45, default_visibility: CalendarEventVisibility.PRIVATE, sort_order: 4 },
    { slug: 'deadline', name: 'Deadline', color: 'danger', default_duration_minutes: 15, shows_as_busy: false, sort_order: 5 },
    { slug: 'out-of-office', name: 'Out of office', color: 'neutral', default_visibility: CalendarEventVisibility.ORGANIZATION, sort_order: 6 },
    { slug: 'focus-time', name: 'Focus time', color: 'neutral', default_duration_minutes: 120, default_visibility: CalendarEventVisibility.PRIVATE, sort_order: 7 },
    { slug: 'booking', name: 'Booking', color: 'success', default_duration_minutes: 30, is_customer_facing: true, sort_order: 8 },
];

export interface AccessibleCalendar {
    calendar: Calendar;
    role: CalendarRole;
    /** Shown by default in the caller's grid (own, team, organization, explicitly shared). */
    subscribed: boolean;
}

/**
 * 19 §10 — calendar access rules, shared by every calendar service:
 *  - own PERSONAL calendar: MANAGE · explicit CalendarShare (member or team): its role
 *  - TEAM calendar of a team you are in: WRITE · ORGANIZATION: READ (WRITE with calendar.events.manage)
 *  - other members' PERSONAL calendars: READ with calendar.calendars.read_team or calendar.events.read, FREE_BUSY otherwise
 *    (and always FREE_BUSY when free_busy_only, unless shared explicitly)
 *  - non-personal calendars: MANAGE with calendar.calendars.manage
 * PRIVATE events of others are always masked to "Busy".
 */
@Injectable()
export class CalendarAccessService {
    private readonly seeded = new Set<string>();

    constructor(private readonly prisma: PrismaService) { }

    me(ctx: OrgContext) {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Calendars belong to organization members', code: 'calendar_requires_membership' });
        return ctx.membership_id;
    }

    async timezoneOf(ctx: OrgContext): Promise<string> {
        const [pref, membership, org] = await Promise.all([
            ctx.membership_id ? this.prisma.calendarPreference.findUnique({ where: { membership_id: ctx.membership_id }, select: { timezone: true } }) : null,
            ctx.membership_id ? this.prisma.membership.findUnique({ where: { id: ctx.membership_id }, select: { user: { select: { timezone: true } } } }) : null,
            this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { default_timezone: true } }),
        ]);
        return [pref?.timezone, membership?.user?.timezone, org?.default_timezone].find(isValidZone) ?? 'UTC';
    }

    async actorName(ctx: OrgContext) {
        if (!ctx.membership_id) return 'Someone';
        const m = await this.prisma.membership.findUnique({ where: { id: ctx.membership_id }, select: { user: { select: memberUserSelect } } });
        return displayName(m?.user);
    }

    /** The member's default personal calendar, created on first use. */
    async ensurePersonal(ctx: OrgContext, membershipId = this.me(ctx)) {
        const existing = await this.prisma.calendar.findFirst({ where: { organization_id: ctx.organization_id, kind: CalendarKind.PERSONAL, owner_membership_id: membershipId, archived_at: null }, orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }] });
        if (existing) return existing;
        const member = await this.prisma.membership.findFirst({ where: { id: membershipId, organization_id: ctx.organization_id }, select: { user: { select: { ...memberUserSelect, timezone: true } } } });
        return this.prisma.calendar.create({
            data: {
                organization_id: ctx.organization_id,
                kind: CalendarKind.PERSONAL,
                name: member ? displayName(member.user) : 'My calendar',
                color: 'info',
                owner_membership_id: membershipId,
                is_default: true,
                timezone: isValidZone(member?.user?.timezone) ? member.user.timezone : null,
                default_visibility: CalendarEventVisibility.TEAM,
                created_by_user_id: ctx.user_id,
            },
        });
    }

    /** Seed the system event types for the organization once. */
    async ensureEventTypes(organizationId: string) {
        if (this.seeded.has(organizationId)) return;
        const count = await this.prisma.calendarEventType.count({ where: { organization_id: organizationId, is_system: true } });
        if (!count) {
            await this.prisma.calendarEventType.createMany({ data: SYSTEM_EVENT_TYPES.map((t) => ({ ...t, organization_id: organizationId, is_system: true })), skipDuplicates: true });
        }
        this.seeded.add(organizationId);
    }

    async myTeamIds(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        const rows = await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } });
        return rows.map((r) => r.team_id);
    }

    /** Every calendar of the organization the caller can reach, with the caller's role on it. */
    async accessibleCalendars(ctx: OrgContext, opts: { includeArchived?: boolean } = {}): Promise<Map<string, AccessibleCalendar>> {
        const me = ctx.membership_id;
        const teamIds = await this.myTeamIds(ctx);
        const calendars = await this.prisma.calendar.findMany({
            where: { organization_id: ctx.organization_id, ...(opts.includeArchived ? {} : { archived_at: null }) },
            include: { shares: { where: { OR: [{ membership_id: me ?? '__none__' }, { team_id: { in: teamIds } }], AND: [{ OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] }] } } },
            orderBy: [{ kind: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
        });
        const readOthers = ctx.can('calendar.calendars.read_team') || ctx.can('calendar.events.read');
        const manageCalendars = ctx.can('calendar.calendars.manage');
        const manageEvents = ctx.can('calendar.events.manage');
        const out = new Map<string, AccessibleCalendar>();
        for (const { shares, ...c } of calendars) {
            let role: CalendarRole | null = null;
            let subscribed = false;
            for (const s of shares) {
                role = best(role, s.role as CalendarShareRole as CalendarRole);
                subscribed = true;
            }
            switch (c.kind) {
                case CalendarKind.PERSONAL:
                    if (c.owner_membership_id === me) {
                        role = 'MANAGE';
                        subscribed = true;
                    } else if (!role) role = c.free_busy_only || !readOthers ? 'FREE_BUSY' : 'READ';
                    break;
                case CalendarKind.TEAM:
                    if (c.team_id && teamIds.includes(c.team_id)) {
                        role = best(role, 'WRITE');
                        subscribed = true;
                    } else role = best(role, readOthers ? 'READ' : null);
                    break;
                case CalendarKind.ORGANIZATION:
                    role = best(role, manageEvents ? 'WRITE' : 'READ');
                    subscribed = true;
                    break;
                case CalendarKind.RESOURCE:
                    role = best(role, ctx.can('calendar.resources.manage') ? 'MANAGE' : 'READ');
                    break;
                default:
                    role = best(role, readOthers ? (manageEvents ? 'WRITE' : 'READ') : null);
            }
            if (manageCalendars && c.kind !== CalendarKind.PERSONAL) role = best(role, 'MANAGE');
            if (role) out.set(c.id, { calendar: c, role, subscribed });
        }
        return out;
    }

    async roleOn(ctx: OrgContext, calendarId: string): Promise<AccessibleCalendar | null> {
        return (await this.accessibleCalendars(ctx, { includeArchived: true })).get(calendarId) ?? null;
    }

    /** Whether the event's content may be shown to the caller (else it is masked to "Busy"). */
    canSeeDetails(
        ctx: OrgContext,
        event: { organizer_membership_id: string | null; visibility: CalendarEventVisibility; attendees?: { membership_id: string | null }[] },
        role: CalendarRole | null | undefined,
        calendar?: { free_busy_only: boolean; owner_membership_id: string | null } | null,
    ) {
        const me = ctx.membership_id;
        if (me && (event.organizer_membership_id === me || event.attendees?.some((a) => a.membership_id === me))) return true;
        if (calendar?.owner_membership_id && calendar.owner_membership_id === me) return true;
        if (!atLeast(role, 'READ')) return false;
        return event.visibility !== CalendarEventVisibility.PRIVATE;
    }

    /** Busy intervals of members in [from, to) — events they organize or attend (not declined) that show as busy. */
    async busyIntervals(organizationId: string, membershipIds: string[], from: Date, to: Date, opts: { excludeEventId?: string } = {}) {
        const result = new Map<string, (Interval & { event_id: string; title: string; visibility: CalendarEventVisibility; tentative: boolean; organizer_membership_id: string | null; calendar_id: string })[]>();
        membershipIds.forEach((m) => result.set(m, []));
        if (!membershipIds.length) return result;
        const events = await this.prisma.calendarEvent.findMany({
            where: {
                organization_id: organizationId,
                status: { not: CalendarEventStatus.CANCELLED },
                shows_as_busy: true,
                ...(opts.excludeEventId && { id: { not: opts.excludeEventId } }),
                AND: [
                    this.rangeWhere(from, to),
                    {
                        OR: [
                            { organizer_membership_id: { in: membershipIds } },
                            { attendees: { some: { membership_id: { in: membershipIds }, response: { not: 'DECLINED' } } } },
                            { calendar: { kind: CalendarKind.PERSONAL, owner_membership_id: { in: membershipIds } } },
                        ],
                    },
                ],
            },
            select: {
                id: true, title: true, starts_at: true, ends_at: true, timezone: true, recurrence_rule: true, recurrence_exdates: true, status: true, visibility: true,
                organizer_membership_id: true, calendar_id: true, calendar: { select: { owner_membership_id: true } },
                attendees: { where: { membership_id: { in: membershipIds } }, select: { membership_id: true, response: true } },
            },
        });
        for (const e of events) {
            const who = new Set<string>();
            if (e.organizer_membership_id && result.has(e.organizer_membership_id)) who.add(e.organizer_membership_id);
            if (e.calendar.owner_membership_id && result.has(e.calendar.owner_membership_id)) who.add(e.calendar.owner_membership_id);
            e.attendees.filter((a) => a.response !== 'DECLINED' && a.membership_id).forEach((a) => who.add(a.membership_id as string));
            for (const o of expandOccurrences(e.starts_at, e.ends_at, e.recurrence_rule, e.timezone, from, to, e.recurrence_exdates)) {
                for (const m of who) {
                    const tentative = e.status === CalendarEventStatus.TENTATIVE || e.attendees.some((a) => a.membership_id === m && a.response === 'TENTATIVE');
                    result.get(m).push({ ...o, event_id: e.id, title: e.title, visibility: e.visibility, tentative, organizer_membership_id: e.organizer_membership_id, calendar_id: e.calendar_id });
                }
            }
        }
        return result;
    }

    /** Events (and recurring series) that may overlap [from, to). */
    rangeWhere(from: Date, to: Date): Prisma.CalendarEventWhereInput {
        return {
            OR: [
                { recurrence_rule: null, starts_at: { lt: to }, ends_at: { gt: from } },
                { recurrence_rule: { not: null }, starts_at: { lt: to }, OR: [{ recurrence_ends_at: null }, { recurrence_ends_at: { gt: from } }] },
            ],
        };
    }
}
