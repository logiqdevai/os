import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { PeopleAccessService } from '../common/people-access.service';
import { P, addDays, isoDay, num, personName, round2, today, userSelect, weekStart } from '../common/people.utils';

/**
 * People dashboard (10 "Dashboards & Reporting"). Every block is computed from the source tables and returned only when
 * the caller holds its read key (null otherwise → the UI shows a Restricted tile). No compensation totals here (09).
 */
@Injectable()
export class PeopleReportsService {
    constructor(private readonly prisma: PrismaService, private readonly access: PeopleAccessService) { }

    async overview(ctx: OrgContext) {
        const [headcount, leave, attendance, capacity, performance, celebrations] = await Promise.all([
            this.access.scopeWhere(ctx, P.read) ? this.headcount(ctx) : null,
            this.access.scopeWhere(ctx, P.leaveReadAll) ? this.leave(ctx) : null,
            this.access.scopeWhere(ctx, P.attReadAll) ? this.attendance(ctx) : null,
            this.access.scopeWhere(ctx, P.capacity) ? this.capacity(ctx) : null,
            this.access.scopeWhere(ctx, P.perfReadAll) ? this.performance(ctx) : null,
            this.access.scopeWhere(ctx, P.directoryRead) ? this.celebrations(ctx) : null,
        ]);
        return { headcount, leave, attendance, capacity, performance, celebrations };
    }

    private async headcount(ctx: OrgContext) {
        const scope = this.access.scopeWhere(ctx, P.read);
        const base = { organization_id: ctx.organization_id, archived_at: null, ...scope };
        const since = addDays(today(), -90);
        const [byStatus, byType, byDepartment, hires, leavers] = await Promise.all([
            this.prisma.employee.groupBy({ by: ['employment_status'], where: base, _count: { _all: true } }),
            this.prisma.employee.groupBy({ by: ['employment_type'], where: { ...base, employment_status: { not: 'TERMINATED' } }, _count: { _all: true } }),
            this.prisma.employee.groupBy({ by: ['department_team_id'], where: { ...base, employment_status: { not: 'TERMINATED' } }, _count: { _all: true } }),
            this.prisma.employee.count({ where: { ...base, hire_date: { gte: since } } }),
            this.prisma.employee.count({ where: { ...base, termination_date: { gte: since, lte: today() } } }),
        ]);
        const teams = await this.prisma.team.findMany({ where: { id: { in: byDepartment.map((d) => d.department_team_id).filter(Boolean) as string[] } }, select: { id: true, name: true } });
        const status = Object.fromEntries(byStatus.map((s) => [s.employment_status, s._count._all]));
        const active = byStatus.filter((s) => s.employment_status !== 'TERMINATED').reduce((s, r) => s + r._count._all, 0);
        return {
            active, by_status: status,
            by_type: byType.map((t) => ({ type: t.employment_type, count: t._count._all })),
            by_department: byDepartment.map((d) => ({ department: teams.find((t) => t.id === d.department_team_id) ?? null, count: d._count._all })).sort((a, b) => b.count - a.count),
            hires_90d: hires, leavers_90d: leavers,
            onboarding: status.ONBOARDING ?? 0, offboarding: status.OFFBOARDING ?? 0,
        };
    }

    private async leave(ctx: OrgContext) {
        const scope = this.access.scopeWhere(ctx, P.leaveReadAll);
        const now = today();
        const [outToday, pending, upcoming] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where: { organization_id: ctx.organization_id, status: 'APPROVED', start_date: { lte: now }, end_date: { gte: now }, employee: scope },
                select: { id: true, end_date: true, leave_type: { select: { name: true, color: true } }, employee: { select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: userSelect } } } } } },
                take: 20,
            }),
            this.prisma.leaveRequest.count({ where: { organization_id: ctx.organization_id, status: 'PENDING', employee: scope } }),
            this.prisma.leaveRequest.count({ where: { organization_id: ctx.organization_id, status: 'APPROVED', start_date: { gt: now, lte: addDays(now, 14) }, employee: scope } }),
        ]);
        return {
            out_today: outToday.map((r) => ({ request_id: r.id, employee_id: r.employee.id, name: personName(r.employee), photo_url: r.employee.membership.user.profile_photo_url, leave_type: r.leave_type, until: isoDay(r.end_date) })),
            pending_requests: pending,
            upcoming_14d: upcoming,
        };
    }

    private async attendance(ctx: OrgContext) {
        const scope = this.access.scopeWhere(ctx, P.attReadAll);
        const [clockedIn, records] = await Promise.all([
            this.prisma.attendanceSession.count({ where: { clock_out_at: null, record: { organization_id: ctx.organization_id, date: today(), employee: scope } } }),
            this.prisma.attendanceRecord.aggregate({ where: { organization_id: ctx.organization_id, date: { gte: addDays(today(), -6), lte: today() }, employee: scope }, _sum: { worked_minutes: true, overtime_minutes: true }, _count: { _all: true } }),
        ]);
        const late = await this.prisma.attendanceRecord.count({ where: { organization_id: ctx.organization_id, date: today(), late_minutes: { gt: 0 }, employee: scope } });
        return { clocked_in_now: clockedIn, late_today: late, worked_minutes_7d: records._sum.worked_minutes ?? 0, overtime_minutes_7d: records._sum.overtime_minutes ?? 0, records_7d: records._count._all };
    }

    private async capacity(ctx: OrgContext) {
        const scope = this.access.scopeWhere(ctx, P.capacity);
        const ws = weekStart(today());
        const rows = await this.prisma.employeeCapacityPeriod.findMany({ where: { organization_id: ctx.organization_id, period_type: 'WEEK', period_start: ws, employee: scope }, select: { status: true, available_hours: true, planned_hours: true, logged_hours: true } });
        const available = rows.reduce((s, r) => s + num(r.available_hours), 0);
        const planned = rows.reduce((s, r) => s + num(r.planned_hours), 0);
        return {
            week_start: isoDay(ws), computed: rows.length > 0,
            available_hours: round2(available), planned_hours: round2(planned), logged_hours: round2(rows.reduce((s, r) => s + num(r.logged_hours), 0)),
            allocation_percent: available ? round2((planned / available) * 100) : null,
            overloaded: rows.filter((r) => r.status === 'OVERLOADED').length, underutilized: rows.filter((r) => r.status === 'UNDERUTILIZED').length,
        };
    }

    private async performance(ctx: OrgContext) {
        const scope = this.access.scopeWhere(ctx, P.perfReadAll);
        const cycle = await this.prisma.performanceReviewCycle.findFirst({ where: { organization_id: ctx.organization_id, status: 'ACTIVE' }, orderBy: { period_start: 'desc' } });
        if (!cycle) return { active_cycle: null };
        const rows = await this.prisma.performanceReview.groupBy({ by: ['status'], where: { cycle_id: cycle.id, employee: scope }, _count: { _all: true } });
        const total = rows.reduce((s, r) => s + r._count._all, 0);
        const done = rows.filter((r) => ['COMPLETED', 'ACKNOWLEDGED'].includes(r.status)).reduce((s, r) => s + r._count._all, 0);
        return { active_cycle: { id: cycle.id, name: cycle.name, due_date: cycle.due_date, total, completed: done, by_status: Object.fromEntries(rows.map((r) => [r.status, r._count._all])) } };
    }

    /** Work anniversaries in the next 30 days (birthdays only with personal-data read). */
    private async celebrations(ctx: OrgContext) {
        const employees = await this.prisma.employee.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, employment_status: { not: 'TERMINATED' }, directory_visible: true },
            select: { id: true, hire_date: true, date_of_birth: ctx.can(P.personalRead), preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: userSelect } } } },
        });
        const now = today();
        const horizon = addDays(now, 30);
        const next = (d: Date) => {
            let n = new Date(Date.UTC(now.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            if (n < now) n = new Date(Date.UTC(now.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
            return n;
        };
        const out: { employee_id: string; name: string; photo_url: string | null; kind: 'ANNIVERSARY' | 'BIRTHDAY'; date: string; years?: number }[] = [];
        for (const e of employees) {
            if (e.hire_date) {
                const n = next(e.hire_date);
                const years = n.getUTCFullYear() - e.hire_date.getUTCFullYear();
                if (n <= horizon && years > 0) out.push({ employee_id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, kind: 'ANNIVERSARY', date: isoDay(n), years });
            }
            const dob = (e as any).date_of_birth as Date | undefined;
            if (dob) {
                const n = next(dob);
                if (n <= horizon) out.push({ employee_id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, kind: 'BIRTHDAY', date: isoDay(n) });
            }
        }
        return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
    }
}
