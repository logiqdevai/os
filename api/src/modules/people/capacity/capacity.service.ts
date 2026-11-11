import { BadRequestException, Injectable } from '@nestjs/common';
import { EmployeeCapacityStatus, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { PeopleAccessService } from '../common/people-access.service';
import { DAY_MS, P, addDays, isoDay, num, personName, round2, toDay, today, userSelect, weekStart } from '../common/people.utils';

export const CapacityQuerySchema = z.object({
    from: z.string().date().optional(),
    weeks: z.coerce.number().int().min(1).max(12).optional().default(4),
    team_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    status: z.nativeEnum(EmployeeCapacityStatus).optional(),
    employee_id: z.string().uuid().optional(),
});
export type CapacityQuery = z.infer<typeof CapacityQuerySchema>;

/**
 * 10 "Capacity & Workload" — available hours (schedule − holidays − approved leave) are owned here; planned hours come
 * from 05 ProjectAllocation and logged hours from 18 TimeEntry (read-only). Each computed week is materialized into
 * EmployeeCapacityPeriod so other modules can read it.
 */
@Injectable()
export class CapacityService {
    constructor(private readonly prisma: PrismaService, private readonly access: PeopleAccessService) { }

    async weeks(ctx: OrgContext, query: CapacityQuery) {
        const first = weekStart(query.from ? toDay(query.from) : today());
        const last = addDays(first, query.weeks * 7 - 1);
        const scope = this.access.scopeWhere(ctx, P.capacity);
        if (!scope) throw new BadRequestException({ message: 'No capacity scope', code: 'forbidden' });
        const settings = await this.access.settings(ctx.organization_id);
        const employees = await this.prisma.employee.findMany({
            where: {
                organization_id: ctx.organization_id, archived_at: null, employment_status: { in: ['ACTIVE', 'ONBOARDING', 'ON_LEAVE', 'OFFBOARDING'] }, ...scope,
                ...(query.team_id && { OR: [{ department_team_id: query.team_id }, { membership: { teams: { some: { team_id: query.team_id, ended_at: null } } } }] }),
                ...(query.branch_id && { primary_branch_id: query.branch_id }),
                ...(query.employee_id && { id: query.employee_id }),
            },
            include: { membership: { select: { user: { select: userSelect } } }, department: { select: { id: true, name: true } } },
            orderBy: { preferred_name: 'asc' },
            take: 300,
        });
        const memberships = employees.map((e) => e.membership_id);
        const ids = employees.map((e) => e.id);
        const [leaveDays, allocations, logged] = await Promise.all([
            this.prisma.leaveRequestDay.findMany({ where: { date: { gte: first, lte: last }, leave_request: { employee_id: { in: ids }, status: 'APPROVED' } }, select: { date: true, hours: true, day_part: true, leave_request: { select: { employee_id: true } } } }),
            this.prisma.projectAllocation.findMany({
                where: { membership_id: { in: memberships }, OR: [{ start_date: null }, { start_date: { lte: last } }], AND: [{ OR: [{ end_date: null }, { end_date: { gte: first } }] }] },
                select: { membership_id: true, planned_hours: true, allocation_percent: true, start_date: true, end_date: true, project: { select: { id: true, name: true, archived_at: true } } },
            }),
            this.prisma.timeEntry.groupBy({ by: ['membership_id', 'date'], where: { organization_id: ctx.organization_id, membership_id: { in: memberships }, date: { gte: first, lte: last }, deleted_at: null }, _sum: { duration_minutes: true } }),
        ]);

        const rows = [];
        const snapshots: (() => Promise<unknown>)[] = [];
        for (const e of employees) {
            const calendar = await this.access.calendar(e, first, last);
            const target = num(e.target_utilization_percent ?? settings.target_utilization_percent);
            const periods = [];
            for (let w = 0; w < query.weeks; w++) {
                const ws = addDays(first, w * 7);
                const we = addDays(ws, 6);
                const days = calendar.filter((d) => d.date >= ws && d.date <= we);
                const scheduled = days.reduce((s, d) => s + d.hours, 0);
                const holiday = days.reduce((s, d) => s + (d.holiday ? (d.holiday.half ? d.hours / 2 : d.hours) : 0), 0);
                const leave = leaveDays
                    .filter((l) => l.leave_request.employee_id === e.id && l.date >= ws && l.date <= we)
                    .reduce((s, l) => s + (l.hours !== null ? num(l.hours) : (days.find((d) => isoDay(d.date) === isoDay(l.date))?.hours ?? 0) * (l.day_part === 'FULL_DAY' ? 1 : 0.5)), 0);
                const available = Math.max(0, scheduled - holiday - leave);
                const projects: { project_id: string; name: string; hours: number }[] = [];
                for (const a of allocations.filter((x) => x.membership_id === e.membership_id && !x.project.archived_at)) {
                    const aStart = a.start_date ?? ws;
                    const aEnd = a.end_date ?? we;
                    const overlap = Math.max(0, (Math.min(aEnd.getTime(), we.getTime()) - Math.max(aStart.getTime(), ws.getTime())) / DAY_MS + 1);
                    if (!overlap) continue;
                    let hours = 0;
                    if (a.planned_hours !== null && a.start_date && a.end_date) {
                        const total = (a.end_date.getTime() - a.start_date.getTime()) / DAY_MS + 1;
                        hours = num(a.planned_hours) * (overlap / total);
                    } else if (a.allocation_percent) hours = (scheduled - holiday) * (a.allocation_percent / 100) * (overlap / 7);
                    if (hours > 0) projects.push({ project_id: a.project.id, name: a.project.name, hours: round2(hours) });
                }
                const planned = projects.reduce((s, p) => s + p.hours, 0);
                const loggedMinutes = logged.filter((l) => l.membership_id === e.membership_id && l.date >= ws && l.date <= we).reduce((s, l) => s + (l._sum.duration_minutes ?? 0), 0);
                const allocation = available ? (planned / available) * 100 : planned ? 999 : 0;
                const utilization = available ? (loggedMinutes / 60 / available) * 100 : 0;
                const status: EmployeeCapacityStatus =
                    allocation > num(settings.overload_threshold_percent) ? 'OVERLOADED' : allocation < num(settings.underutilized_threshold_percent) ? 'UNDERUTILIZED' : 'BALANCED';
                const period = {
                    period_start: isoDay(ws), period_end: isoDay(we), scheduled_hours: round2(scheduled), holiday_hours: round2(holiday), leave_hours: round2(leave),
                    available_hours: round2(available), planned_hours: round2(planned), logged_hours: round2(loggedMinutes / 60),
                    allocation_percent: round2(Math.min(allocation, 999)), utilization_percent: round2(Math.min(utilization, 999)), status, target_utilization_percent: target,
                    breakdown: { projects },
                };
                periods.push(period);
                snapshots.push(() => this.materialize(ctx.organization_id, e.id, ws, we, period));
            }
            if (query.status && !periods.some((p) => p.status === query.status)) continue;
            rows.push({ employee: { id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, job_title: e.job_title, department: e.department, availability_status: e.availability_status }, periods });
        }
        // Materialize after responding (other modules read EmployeeCapacityPeriod); failures never surface.
        setImmediate(async () => {
            for (const run of snapshots) await run().catch(() => undefined);
        });
        const totals = (key: 'available_hours' | 'planned_hours' | 'logged_hours') => round2(rows.reduce((s, r) => s + r.periods.reduce((x, p) => x + p[key], 0), 0));
        return {
            from: isoDay(first), to: isoDay(last), weeks: query.weeks,
            thresholds: { overload: num(settings.overload_threshold_percent), underutilized: num(settings.underutilized_threshold_percent), target: num(settings.target_utilization_percent) },
            totals: { available_hours: totals('available_hours'), planned_hours: totals('planned_hours'), logged_hours: totals('logged_hours') },
            rows,
        };
    }

    private materialize(orgId: string, employeeId: string, ws: Date, we: Date, p: { scheduled_hours: number; leave_hours: number; holiday_hours: number; available_hours: number; planned_hours: number; logged_hours: number; allocation_percent: number; utilization_percent: number; status: EmployeeCapacityStatus; breakdown: unknown }) {
        const data = {
            period_end: we, scheduled_hours: p.scheduled_hours, leave_hours: p.leave_hours, holiday_hours: p.holiday_hours, available_hours: p.available_hours,
            planned_hours: p.planned_hours, logged_hours: p.logged_hours, allocation_percent: p.allocation_percent, utilization_percent: p.utilization_percent,
            status: p.status, breakdown: p.breakdown as Prisma.InputJsonValue, computed_at: new Date(),
        };
        return this.prisma.employeeCapacityPeriod.upsert({
            where: { employee_id_period_type_period_start: { employee_id: employeeId, period_type: 'WEEK', period_start: ws } },
            update: data,
            create: { ...data, organization_id: orgId, employee_id: employeeId, period_type: 'WEEK', period_start: ws },
        });
    }
}
