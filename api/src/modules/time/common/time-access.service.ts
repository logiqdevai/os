import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TimeNonBillableCategory, TimeRateKind, TimeTrackingSettings } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export const TIME_READ_OWN = 'time.entries.read_own';
export const TIME_READ_TEAM = 'time.entries.read_team';
export const TIME_READ_ALL = 'time.entries.read_all';
export const TIME_RATES_READ = 'time.rates.read';

export type TimeScope = 'mine' | 'team' | 'all';

/** Default activity types created lazily for a new organization (18 §3). */
const DEFAULT_ACTIVITY_TYPES: { name: string; slug: string; color: string; default_billable: boolean | null; default_non_billable_category?: TimeNonBillableCategory; is_default?: boolean }[] = [
    { name: 'Development', slug: 'development', color: 'blue', default_billable: null, is_default: true },
    { name: 'Design', slug: 'design', color: 'violet', default_billable: null },
    { name: 'Project management', slug: 'project-management', color: 'amber', default_billable: null },
    { name: 'Meeting', slug: 'meeting', color: 'green', default_billable: null },
    { name: 'Support', slug: 'support', color: 'red', default_billable: null },
    { name: 'Internal / admin', slug: 'internal-admin', color: 'gray', default_billable: false, default_non_billable_category: TimeNonBillableCategory.ADMIN },
];

/** Minimal person shape returned with entries, timesheets and rates. */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} satisfies Prisma.MembershipSelect;

/** Amount fields that need time.rates.read (field-level, 18 §12). */
const AMOUNT_FIELDS = ['billing_rate_id', 'billing_rate_amount', 'billable_amount', 'cost_rate_id', 'cost_rate_amount', 'cost_currency', 'cost_amount'] as const;

/**
 * Shared Time Tracking helpers: lazily created settings and activity types, the own / team / all member scope,
 * rate resolution (BILLING and COST) and field-level stripping of amounts. Every time service goes through here.
 */
@Injectable()
export class TimeAccessService {
    constructor(private readonly prisma: PrismaService) { }

    async settings(organizationId: string): Promise<TimeTrackingSettings> {
        const existing = await this.prisma.timeTrackingSettings.findUnique({ where: { organization_id: organizationId } });
        if (existing) return existing;
        return this.prisma.timeTrackingSettings.upsert({ where: { organization_id: organizationId }, update: {}, create: { organization_id: organizationId } });
    }

    async ensureActivityTypes(organizationId: string) {
        const count = await this.prisma.timeActivityType.count({ where: { organization_id: organizationId } });
        if (count) return;
        await this.prisma.timeActivityType.createMany({
            data: DEFAULT_ACTIVITY_TYPES.map((t, i) => ({ ...t, organization_id: organizationId, sort_order: i, is_default: t.is_default ?? false })),
            skipDuplicates: true,
        });
    }

    requireMembership(ctx: OrgContext): string {
        if (!ctx.membership_id) throw new BadRequestException({ message: 'This action needs a member identity (a service-account key cannot own time entries)', code: 'membership_required' });
        return ctx.membership_id;
    }

    /** Highest scope the caller can read. */
    maxScope(ctx: OrgContext): TimeScope | null {
        if (ctx.can(TIME_READ_ALL)) return 'all';
        if (ctx.can(TIME_READ_TEAM)) return 'team';
        if (ctx.can(TIME_READ_OWN)) return 'mine';
        return null;
    }

    /**
     * Membership ids visible for `scope`. `null` = every member of the organization.
     * - mine: the caller
     * - team: members of the active teams the caller belongs to + members of projects the caller owns + the caller
     * - all: organization-wide, or narrowed to the branches / teams / projects of a scoped read_all grant
     */
    async memberIds(ctx: OrgContext, scope: TimeScope): Promise<string[] | null> {
        const self = ctx.membership_id ? [ctx.membership_id] : [];
        if (scope === 'all' && ctx.can(TIME_READ_ALL)) {
            const s = ctx.scopeOf(TIME_READ_ALL);
            if (!s || s.organization) return null;
            const [branch, team, project] = await Promise.all([
                s.branch_ids.length ? this.prisma.membershipBranch.findMany({ where: { branch_id: { in: s.branch_ids }, ended_at: null }, select: { membership_id: true } }) : [],
                s.team_ids.length ? this.prisma.teamMembership.findMany({ where: { team_id: { in: s.team_ids }, ended_at: null }, select: { membership_id: true } }) : [],
                s.project_ids.length ? this.prisma.projectMember.findMany({ where: { project_id: { in: s.project_ids }, is_active: true }, select: { membership_id: true } }) : [],
            ]);
            return [...new Set([...self, ...branch, ...team, ...project].map((r) => (typeof r === 'string' ? r : r.membership_id)))];
        }
        if ((scope === 'team' || scope === 'all') && ctx.can(TIME_READ_TEAM) && ctx.membership_id) {
            return this.teamMemberIds(ctx.organization_id, ctx.membership_id);
        }
        if (ctx.can(TIME_READ_OWN) || ctx.can(TIME_READ_TEAM) || ctx.can(TIME_READ_ALL)) return self;
        return [];
    }

    async teamMemberIds(organizationId: string, membershipId: string): Promise<string[]> {
        const [teams, ownedProjects] = await Promise.all([
            this.prisma.teamMembership.findMany({ where: { membership_id: membershipId, ended_at: null, team: { organization_id: organizationId, archived_at: null } }, select: { team_id: true } }),
            this.prisma.project.findMany({ where: { organization_id: organizationId, owner_membership_id: membershipId }, select: { id: true } }),
        ]);
        const [teamMembers, projectMembers] = await Promise.all([
            teams.length ? this.prisma.teamMembership.findMany({ where: { team_id: { in: teams.map((t) => t.team_id) }, ended_at: null }, select: { membership_id: true } }) : [],
            ownedProjects.length ? this.prisma.projectMember.findMany({ where: { project_id: { in: ownedProjects.map((p) => p.id) }, is_active: true }, select: { membership_id: true } }) : [],
        ]);
        return [...new Set([membershipId, ...teamMembers.map((m) => m.membership_id), ...projectMembers.map((m) => m.membership_id)])];
    }

    /** Effective read scope for a request: the requested one capped at what the caller holds. */
    effectiveScope(ctx: OrgContext, requested?: TimeScope): TimeScope {
        const max = this.maxScope(ctx) ?? 'mine';
        const order: TimeScope[] = ['mine', 'team', 'all'];
        if (!requested) return max;
        return order.indexOf(requested) <= order.indexOf(max) ? requested : max;
    }

    /** True when the caller may act on `membershipId`'s records with a `_team` key (or it is their own). */
    async canActOnMember(ctx: OrgContext, membershipId: string, teamKey: string): Promise<boolean> {
        if (membershipId === ctx.membership_id) return true;
        if (!ctx.can(teamKey)) return false;
        const scope = ctx.scopeOf(teamKey);
        if (scope?.organization && ctx.can(TIME_READ_ALL)) return true;
        if (!ctx.membership_id) return !!scope?.organization;
        const ids = await this.teamMemberIds(ctx.organization_id, ctx.membership_id);
        return ids.includes(membershipId);
    }

    stripAmounts<T extends Record<string, unknown>>(ctx: OrgContext, row: T): T {
        if (ctx.can(TIME_RATES_READ)) return row;
        const copy: Record<string, unknown> = { ...row };
        for (const f of AMOUNT_FIELDS) delete copy[f];
        if (copy.billing_rate) delete copy.billing_rate;
        if (copy.cost_rate) delete copy.cost_rate;
        return copy as T;
    }

    /**
     * Resolve the rate valid on `date`. BILLING: PROJECT_MEMBER > PROJECT > MEMBER > ORGANIZATION; a rate bound to an
     * activity type wins over the generic one at the same level and never applies to another activity.
     * COST: MEMBER cost rate > ORGANIZATION cost rate > the member's Employee compensation cost_rate_hourly (10).
     */
    async resolveRate(organizationId: string, kind: TimeRateKind, input: { membership_id: string; project_id?: string | null; activity_type_id?: string | null; date: Date }) {
        const rates = await this.prisma.billingRate.findMany({
            where: {
                organization_id: organizationId,
                kind,
                archived_at: null,
                effective_from: { lte: input.date },
                OR: [{ effective_to: null }, { effective_to: { gte: input.date } }],
                AND: [{ OR: [{ activity_type_id: null }, ...(input.activity_type_id ? [{ activity_type_id: input.activity_type_id }] : [])] }],
            },
        });
        const score = (r: (typeof rates)[number]) => {
            let s = -1;
            if (r.scope === 'PROJECT_MEMBER' && r.project_id && r.project_id === input.project_id && r.membership_id === input.membership_id) s = 50;
            else if (r.scope === 'PROJECT' && r.project_id && r.project_id === input.project_id) s = 40;
            else if (r.scope === 'MEMBER' && r.membership_id === input.membership_id) s = 30;
            else if (r.scope === 'ORGANIZATION') s = 10;
            if (s < 0) return s;
            return s + (r.activity_type_id ? 5 : 0);
        };
        const best = rates
            .map((r) => ({ r, s: score(r) }))
            .filter((x) => x.s >= 0)
            .sort((a, b) => b.s - a.s || b.r.effective_from.getTime() - a.r.effective_from.getTime())[0]?.r;
        if (best) return { id: best.id, hourly_rate: Number(best.hourly_rate), currency: best.currency, scope: best.scope as string, source: 'rate_card' as const };
        if (kind === TimeRateKind.COST) {
            const comp = await this.prisma.employeeCompensation.findFirst({
                where: {
                    employee: { membership_id: input.membership_id, organization_id: organizationId },
                    cost_rate_hourly: { not: null },
                    effective_from: { lte: input.date },
                    OR: [{ effective_to: null }, { effective_to: { gte: input.date } }],
                },
                orderBy: { effective_from: 'desc' },
            });
            if (comp?.cost_rate_hourly) return { id: null, hourly_rate: Number(comp.cost_rate_hourly), currency: comp.currency, scope: 'COMPENSATION', source: 'compensation' as const };
        }
        return null;
    }

    async memberBranchId(membershipId: string): Promise<string | null> {
        const m = await this.prisma.membership.findUnique({ where: { id: membershipId }, select: { default_branch_id: true } });
        return m?.default_branch_id ?? null;
    }

    async employeeIdOf(membershipId: string): Promise<string | null> {
        const e = await this.prisma.employee.findUnique({ where: { membership_id: membershipId }, select: { id: true } });
        return e?.id ?? null;
    }

    /** Expected minutes per week for a member: Employee.weekly_capacity_hours, else settings.default_expected_hours_per_week. */
    async expectedWeeklyMinutes(organizationId: string, membershipIds: string[], fallbackHours: number): Promise<Map<string, number>> {
        const employees = await this.prisma.employee.findMany({ where: { organization_id: organizationId, membership_id: { in: membershipIds } }, select: { membership_id: true, weekly_capacity_hours: true } });
        const map = new Map<string, number>();
        for (const id of membershipIds) map.set(id, Math.round(fallbackHours * 60));
        for (const e of employees) if (e.weekly_capacity_hours !== null) map.set(e.membership_id, Math.round(Number(e.weekly_capacity_hours) * 60));
        return map;
    }
}
