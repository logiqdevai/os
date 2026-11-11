import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { DAY_MS, P, PERSONAL_FIELDS, addDays, eachDay, isoDay, num, round2, toDay } from './people.utils';

export interface DayInfo {
    date: Date;
    /** Expected working hours that day from the schedule (0 on weekends / days off). */
    hours: number;
    holiday: { name: string; half: boolean } | null;
}

/**
 * Shared rules of module 10: who the caller is as an employee, which employees a permission reaches (scope),
 * field-level stripping (01 §60), HR settings (lazy) and the working-day calendar (schedule minus holidays).
 * Every People service goes through here so the rules are written once.
 */
@Injectable()
export class PeopleAccessService {
    constructor(private readonly prisma: PrismaService) { }

    /** The caller's own Employee record (null for service accounts or members without an HR record). */
    async me(ctx: OrgContext) {
        if (!ctx.membership_id) return null;
        return this.prisma.employee.findFirst({ where: { organization_id: ctx.organization_id, membership_id: ctx.membership_id } });
    }

    async meOrThrow(ctx: OrgContext) {
        const me = await this.me(ctx);
        if (!me) throw new NotFoundException({ message: 'You do not have an employee record in this organization yet', code: 'employee_record_missing' });
        return me;
    }

    /**
     * Employees reachable through a permission. Organization scope = all; branch/team scope = employees whose primary
     * branch / department / team membership is inside it. Without the key → nothing (callers add the "own" branch).
     * Organization scope returns a real condition, never `{}`: Prisma treats an empty filter inside `OR` as "no match".
     */
    scopeWhere(ctx: OrgContext, key: string): Prisma.EmployeeWhereInput | null {
        const scope = ctx.scopeOf(key);
        if (!scope) return null;
        if (scope.organization) return { organization_id: ctx.organization_id };
        const or: Prisma.EmployeeWhereInput[] = [];
        if (scope.branch_ids.length) {
            or.push({ primary_branch_id: { in: scope.branch_ids } });
            or.push({ membership: { branches: { some: { branch_id: { in: scope.branch_ids }, ended_at: null } } } });
        }
        if (scope.team_ids.length) {
            or.push({ department_team_id: { in: scope.team_ids } });
            or.push({ membership: { teams: { some: { team_id: { in: scope.team_ids }, ended_at: null } } } });
        }
        if (scope.resource_ids.length) or.push({ id: { in: scope.resource_ids } });
        return or.length ? { OR: or } : { id: '__none__' };
    }

    /** Scope for an "all" key, OR the caller's own record when they hold the "own" key. */
    readWhere(ctx: OrgContext, allKey: string, ownKey?: string): Prisma.EmployeeWhereInput {
        const all = this.scopeWhere(ctx, allKey);
        const own = ownKey && ctx.can(ownKey) && ctx.membership_id ? { membership_id: ctx.membership_id } : null;
        if (all && own) return ctx.scopeOf(allKey)?.organization ? all : { OR: [all, own] };
        if (all) return all;
        if (own) return own;
        return { id: '__none__' };
    }

    /** Load one employee the caller may reach through `allKey` (or as themselves with `ownKey`). 404 otherwise. */
    async employeeOrThrow(ctx: OrgContext, id: string, allKey: string, ownKey?: string) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.readWhere(ctx, allKey, ownKey) },
        });
        if (!employee) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        return employee;
    }

    isOwn(ctx: OrgContext, employee: { membership_id: string }) {
        return !!ctx.membership_id && employee.membership_id === ctx.membership_id;
    }

    /** True when the caller's employee is a (direct or indirect) manager of the employee. */
    async isManagerOf(ctx: OrgContext, employeeId: string) {
        const me = await this.me(ctx);
        if (!me) return false;
        let current = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { manager_employee_id: true } });
        for (let depth = 0; current?.manager_employee_id && depth < 12; depth++) {
            if (current.manager_employee_id === me.id) return true;
            current = await this.prisma.employee.findUnique({ where: { id: current.manager_employee_id }, select: { manager_employee_id: true } });
        }
        return false;
    }

    /** One EmployeeHrSettings row per organization, created with defaults on first use. */
    settings(orgId: string) {
        return this.prisma.employeeHrSettings.upsert({ where: { organization_id: orgId }, update: {}, create: { organization_id: orgId } });
    }

    /**
     * Field-level stripping (01 §60): personal data, compensation, HR notes and documents are removed when the caller
     * lacks the key; the removed property names are listed in `restricted_fields`. Own record: personal data is visible.
     */
    present<T extends Record<string, any>>(ctx: OrgContext, employee: T): T & { restricted_fields: string[]; is_me: boolean } {
        const out: Record<string, any> = { ...employee };
        const own = this.isOwn(ctx, employee as any);
        const restricted: string[] = [];
        if (!ctx.can(P.personalRead) && !own) {
            for (const f of PERSONAL_FIELDS) if (f in out) { delete out[f]; restricted.push(f); }
            if ('emergency_contacts' in out) { delete out.emergency_contacts; restricted.push('emergency_contacts'); }
        }
        const strip = (key: string, permission: string) => {
            if (key in out && !ctx.can(permission)) { delete out[key]; restricted.push(key); }
        };
        strip('compensations', P.compRead);
        strip('hr_notes', P.notesRead);
        if ('documents' in out && !ctx.can(P.docsRead)) {
            if (own) out.documents = (out.documents as any[]).filter((d) => d.employee_visible && !d.is_confidential);
            else { delete out.documents; restricted.push('documents'); }
        }
        strip('equipment', P.equipmentRead);
        return { ...(out as T), restricted_fields: restricted, is_me: own };
    }

    // ---------------------------------------------------------------- working days & holidays

    /** Expected hours per weekday (0 = Monday … 6 = Sunday) from the schedule effective on `on`, else 5 × (weekly/5). */
    async weekdayHours(employeeId: string, on: Date, fallbackWeekly?: number): Promise<number[]> {
        const schedule = await this.prisma.employeeWorkSchedule.findFirst({
            where: { employee_id: employeeId, effective_from: { lte: on }, OR: [{ effective_to: null }, { effective_to: { gte: on } }] },
            orderBy: { effective_from: 'desc' },
            include: { days: true },
        });
        const hours = [0, 0, 0, 0, 0, 0, 0];
        if (schedule?.days.length) {
            for (const d of schedule.days) hours[((d.weekday % 7) + 6) % 7] = num(d.hours); // weekday stored 0=Sun..6=Sat or 1..7
            return hours;
        }
        const weekly = schedule ? num(schedule.weekly_hours) : fallbackWeekly ?? 40;
        for (let i = 0; i < 5; i++) hours[i] = round2(weekly / 5);
        return hours;
    }

    /** Company holidays (org-wide or for the branch) plus BranchHoliday rows, keyed by YYYY-MM-DD. Recurring rows repeat yearly. */
    async holidays(orgId: string, branchId: string | null, from: Date, to: Date) {
        const [company, branch] = await Promise.all([
            this.prisma.companyHoliday.findMany({ where: { organization_id: orgId, OR: [{ date: { gte: from, lte: to } }, { recurring: true }] } }),
            branchId ? this.prisma.branchHoliday.findMany({ where: { branch_id: branchId, OR: [{ date: { gte: from, lte: to } }, { recurring: true }] } }) : Promise.resolve([]),
        ]);
        const map = new Map<string, { name: string; half: boolean }>();
        const years = new Set<number>();
        for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) years.add(y);
        const put = (date: Date, recurring: boolean, value: { name: string; half: boolean }) => {
            const dates = recurring ? [...years].map((y) => new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()))) : [date];
            for (const d of dates) if (d >= from && d <= to) map.set(isoDay(d), value);
        };
        for (const h of company) {
            if (h.applies_to_branch_ids.length && (!branchId || !h.applies_to_branch_ids.includes(branchId))) continue;
            put(h.date, h.recurring, { name: h.name, half: h.is_half_day });
        }
        for (const h of branch) put(h.date, h.recurring, { name: h.name, half: false });
        return map;
    }

    /** Per-day expected hours between two dates for one employee, with holidays marked (holiday hours are removed). */
    async calendar(employee: { id: string; organization_id: string; primary_branch_id: string | null; weekly_capacity_hours?: Prisma.Decimal | null }, from: Date, to: Date): Promise<DayInfo[]> {
        const settings = await this.settings(employee.organization_id);
        const [hours, holidays] = await Promise.all([
            this.weekdayHours(employee.id, from, employee.weekly_capacity_hours ? num(employee.weekly_capacity_hours) : num(settings.default_weekly_hours)),
            this.holidays(employee.organization_id, employee.primary_branch_id, from, to),
        ]);
        const out: DayInfo[] = [];
        for (const d of eachDay(from, to)) {
            const base = hours[(d.getUTCDay() + 6) % 7];
            const holiday = holidays.get(isoDay(d)) ?? null;
            out.push({ date: d, hours: base, holiday });
        }
        return out;
    }

    /** Days between two dates inclusive. */
    static spanDays(from: Date, to: Date) {
        return Math.round((toDay(to).getTime() - toDay(from).getTime()) / DAY_MS) + 1;
    }

    static addDays = addDays;
}
