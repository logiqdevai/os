import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { PeopleAccessService } from '../common/people-access.service';
import { P, addDays, isoDay, personName, toDay, today, userSelect, weekStart } from '../common/people.utils';
import { AttendanceBoardQuery, AttendanceQuery, BreakDto, ClockInDto, ClockOutDto, EditRecordDto, EditSessionDto, ManualAttendanceDto } from './attendance.dto';

const MIN = 60_000;
const sessionsInclude = { sessions: { orderBy: { clock_in_at: 'asc' as const }, include: { breaks: { orderBy: { started_at: 'asc' as const } } } } };

/**
 * 10 "Attendance & Working Hours" — presence only (work effort is 18 Time Tracking). One record per employee per day
 * aggregates clock sessions and breaks; worked, overtime and lateness are recomputed against the work schedule.
 */
@Injectable()
export class AttendanceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
    ) { }

    /** My clock card: today's record, the open session / break and this week's records. */
    async me(ctx: OrgContext) {
        const me = await this.access.meOrThrow(ctx);
        const from = weekStart(today());
        const records = await this.prisma.attendanceRecord.findMany({ where: { employee_id: me.id, date: { gte: from, lte: addDays(from, 6) } }, orderBy: { date: 'asc' }, include: sessionsInclude });
        const open = await this.openSession(me.id);
        const settings = await this.access.settings(ctx.organization_id);
        const calendar = await this.access.calendar(me, from, addDays(from, 6));
        return {
            employee: { id: me.id, name: personName(me as any) },
            today: records.find((r) => isoDay(r.date) === isoDay(today())) ?? null,
            open_session: open,
            open_break: open?.breaks.find((b) => !b.ended_at) ?? null,
            week: calendar.map((d) => ({ date: isoDay(d.date), scheduled_hours: d.holiday ? 0 : d.hours, holiday: d.holiday?.name ?? null, record: records.find((r) => isoDay(r.date) === isoDay(d.date)) ?? null })),
            allowed_sources: settings.allowed_clock_sources,
        };
    }

    async clockIn(ctx: OrgContext, dto: ClockInDto) {
        const me = await this.access.meOrThrow(ctx);
        const settings = await this.access.settings(ctx.organization_id);
        const source = dto.source ?? 'WEB';
        if (!settings.allowed_clock_sources.includes(source)) throw new ForbiddenException({ message: `Clocking in from ${source.toLowerCase()} is not allowed`, code: 'clock_source_not_allowed' });
        if (await this.openSession(me.id)) throw new ConflictException({ message: 'You are already clocked in', code: 'already_clocked_in' });
        const now = new Date();
        const date = today();
        const [day] = await this.access.calendar(me, date, date);
        const scheduled = day.holiday ? 0 : Math.round(day.hours * 60);
        const record = await this.prisma.attendanceRecord.upsert({
            where: { employee_id_date: { employee_id: me.id, date } },
            update: { status: 'CLOCKED_IN', work_location: dto.work_location ?? undefined },
            create: { organization_id: ctx.organization_id, employee_id: me.id, date, status: 'CLOCKED_IN', work_location: dto.work_location ?? me.work_location, first_clock_in_at: now, scheduled_minutes: scheduled },
        });
        const session = await this.prisma.attendanceSession.create({
            data: { attendance_record_id: record.id, clock_in_at: now, work_location: dto.work_location ?? record.work_location, clock_in_source: source, note: dto.note },
        });
        const late = await this.lateness(me, record.first_clock_in_at ?? now, settings.late_tolerance_minutes);
        await this.prisma.attendanceRecord.update({ where: { id: record.id }, data: { first_clock_in_at: record.first_clock_in_at ?? now, late_minutes: late } });
        await this.audit.record(ctx, 'attendance.clock_in', { resource_type: 'attendance_record', resource_id: record.id, metadata: { session_id: session.id, source, work_location: session.work_location } });
        this.events.publish(ctx, { event_key: 'employees.attendance.clocked_in', module: ModuleKey.EMPLOYEES, entity_kind: 'attendance_record', entity_id: record.id, payload: { employee_id: me.id, owner_membership_id: me.membership_id, late_minutes: late } });
        return this.me(ctx);
    }

    async clockOut(ctx: OrgContext, dto: ClockOutDto) {
        const me = await this.access.meOrThrow(ctx);
        const open = await this.openSession(me.id);
        if (!open) throw new ConflictException({ message: 'You are not clocked in', code: 'not_clocked_in' });
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.attendanceBreak.updateMany({ where: { session_id: open.id, ended_at: null }, data: { ended_at: now } });
            await tx.attendanceSession.update({ where: { id: open.id }, data: { clock_out_at: now, clock_out_source: dto.source ?? 'WEB', note: dto.note ?? open.note } });
        });
        const record = await this.recompute(open.attendance_record_id);
        await this.audit.record(ctx, 'attendance.clock_out', { resource_type: 'attendance_record', resource_id: record.id, metadata: { session_id: open.id, worked_minutes: record.worked_minutes } });
        this.events.publish(ctx, {
            event_key: 'employees.attendance.clocked_out', module: ModuleKey.EMPLOYEES, entity_kind: 'attendance_record', entity_id: record.id,
            payload: { employee_id: me.id, owner_membership_id: me.membership_id, worked_minutes: record.worked_minutes, overtime_minutes: record.overtime_minutes },
        });
        return this.me(ctx);
    }

    async startBreak(ctx: OrgContext, dto: BreakDto) {
        const me = await this.access.meOrThrow(ctx);
        const open = await this.openSession(me.id);
        if (!open) throw new ConflictException({ message: 'Clock in before taking a break', code: 'not_clocked_in' });
        if (open.breaks.some((b) => !b.ended_at)) throw new ConflictException({ message: 'You are already on a break', code: 'already_on_break' });
        const row = await this.prisma.attendanceBreak.create({ data: { session_id: open.id, kind: dto.kind ?? 'UNPAID', started_at: new Date() } });
        await this.audit.record(ctx, 'attendance.break_started', { resource_type: 'attendance_record', resource_id: open.attendance_record_id, metadata: { break_id: row.id } });
        return this.me(ctx);
    }

    async endBreak(ctx: OrgContext) {
        const me = await this.access.meOrThrow(ctx);
        const open = await this.openSession(me.id);
        const brk = open?.breaks.find((b) => !b.ended_at);
        if (!brk) throw new ConflictException({ message: 'You are not on a break', code: 'not_on_break' });
        await this.prisma.attendanceBreak.update({ where: { id: brk.id }, data: { ended_at: new Date() } });
        await this.recompute(open.attendance_record_id);
        await this.audit.record(ctx, 'attendance.break_ended', { resource_type: 'attendance_record', resource_id: open.attendance_record_id, metadata: { break_id: brk.id } });
        return this.me(ctx);
    }

    /** Records in range (read_all within scope, or own with read_own). */
    async records(ctx: OrgContext, query: AttendanceQuery) {
        const to = query.to ? toDay(query.to) : today();
        const from = query.from ? toDay(query.from) : addDays(to, -13);
        const where: Prisma.AttendanceRecordWhereInput = {
            organization_id: ctx.organization_id,
            date: { gte: from, lte: to },
            employee: {
                ...this.access.readWhere(ctx, P.attReadAll, P.attReadOwn),
                ...(query.team_id && { department_team_id: query.team_id }),
            },
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.status && { status: query.status }),
        };
        const [items, total] = await Promise.all([
            this.prisma.attendanceRecord.findMany({
                where, ...skipTake(query), orderBy: [{ date: 'desc' }, { first_clock_in_at: 'asc' }],
                include: { ...sessionsInclude, employee: { select: { id: true, employee_number: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership_id: true, membership: { select: { user: { select: userSelect } } } } } },
            }),
            this.prisma.attendanceRecord.count({ where }),
        ]);
        return paginate(items.map((r) => ({ ...r, employee: { ...r.employee, name: personName(r.employee), is_me: this.access.isOwn(ctx, r.employee) } })), total, query);
    }

    /** Who is in today: every employee in scope with today's record (or the reason they are not: leave, holiday, absent). */
    async board(ctx: OrgContext, query: AttendanceBoardQuery) {
        const date = query.date ? toDay(query.date) : today();
        const employees = await this.prisma.employee.findMany({
            where: {
                organization_id: ctx.organization_id, archived_at: null, employment_status: { in: ['ACTIVE', 'ONBOARDING', 'ON_LEAVE', 'OFFBOARDING'] },
                ...this.access.readWhere(ctx, P.attReadAll),
                ...(query.team_id && { department_team_id: query.team_id }),
            },
            orderBy: { preferred_name: 'asc' },
            include: {
                membership: { select: { user: { select: userSelect } } },
                department: { select: { id: true, name: true } },
                attendance_records: { where: { date }, include: sessionsInclude },
                leave_requests: { where: { status: 'APPROVED', start_date: { lte: date }, end_date: { gte: date } }, select: { id: true, leave_type: { select: { name: true } } } },
            },
            take: 500,
        });
        const rows = employees.map((e) => {
            const record = e.attendance_records[0] ?? null;
            const open = record?.sessions.find((s) => !s.clock_out_at);
            const state = open ? (open.breaks.some((b) => !b.ended_at) ? 'ON_BREAK' : 'CLOCKED_IN') : record ? 'CLOCKED_OUT' : e.leave_requests.length ? 'ON_LEAVE' : 'NOT_IN';
            return {
                employee: { id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, department: e.department, job_title: e.job_title },
                state, record, leave: e.leave_requests[0]?.leave_type.name ?? null,
            };
        });
        const count = (s: string) => rows.filter((r) => r.state === s).length;
        return { date: isoDay(date), summary: { clocked_in: count('CLOCKED_IN') + count('ON_BREAK'), clocked_out: count('CLOCKED_OUT'), on_leave: count('ON_LEAVE'), not_in: count('NOT_IN'), late: rows.filter((r) => (r.record?.late_minutes ?? 0) > 0).length }, rows };
    }

    async addManual(ctx: OrgContext, dto: ManualAttendanceDto) {
        const e = await this.manageable(ctx, dto.employee_id);
        const inAt = new Date(dto.clock_in_at);
        const outAt = new Date(dto.clock_out_at);
        if (outAt <= inAt) throw new BadRequestException({ message: 'Clock-out must be after clock-in', code: 'invalid_range' });
        const date = toDay(inAt);
        const [day] = await this.access.calendar(e, date, date);
        const record = await this.prisma.attendanceRecord.upsert({
            where: { employee_id_date: { employee_id: e.id, date } },
            update: {},
            create: { organization_id: ctx.organization_id, employee_id: e.id, date, status: 'COMPLETED', work_location: dto.work_location ?? e.work_location, first_clock_in_at: inAt, scheduled_minutes: day.holiday ? 0 : Math.round(day.hours * 60) },
        });
        await this.prisma.attendanceSession.create({ data: { attendance_record_id: record.id, clock_in_at: inAt, clock_out_at: outAt, clock_in_source: 'MANUAL', clock_out_source: 'MANUAL', work_location: dto.work_location ?? record.work_location, note: dto.reason } });
        const updated = await this.recompute(record.id, { edited_by_membership_id: ctx.membership_id, edited_at: new Date() });
        await this.audit.record(ctx, 'attendance.record_edited', { resource_type: 'attendance_record', resource_id: record.id, metadata: { manual: true, reason: dto.reason, clock_in_at: dto.clock_in_at, clock_out_at: dto.clock_out_at } });
        return updated;
    }

    async editSession(ctx: OrgContext, sessionId: string, dto: EditSessionDto) {
        const session = await this.prisma.attendanceSession.findFirst({ where: { id: sessionId, record: { organization_id: ctx.organization_id } }, include: { record: true } });
        if (!session) throw new NotFoundException({ message: 'Session not found', code: 'attendance_session_not_found' });
        await this.manageable(ctx, session.record.employee_id);
        const inAt = dto.clock_in_at ? new Date(dto.clock_in_at) : session.clock_in_at;
        const outAt = dto.clock_out_at ? new Date(dto.clock_out_at) : session.clock_out_at;
        if (outAt && outAt <= inAt) throw new BadRequestException({ message: 'Clock-out must be after clock-in', code: 'invalid_range' });
        await this.prisma.attendanceSession.update({ where: { id: sessionId }, data: { clock_in_at: inAt, clock_out_at: outAt } });
        const record = await this.recompute(session.attendance_record_id, { edited_by_membership_id: ctx.membership_id, edited_at: new Date() });
        await this.audit.record(ctx, 'attendance.record_edited', {
            resource_type: 'attendance_record', resource_id: record.id,
            metadata: { session_id: sessionId, reason: dto.reason, before: { clock_in_at: session.clock_in_at, clock_out_at: session.clock_out_at }, after: { clock_in_at: inAt, clock_out_at: outAt } },
        });
        return record;
    }

    async editRecord(ctx: OrgContext, recordId: string, dto: EditRecordDto) {
        const record = await this.prisma.attendanceRecord.findFirst({ where: { id: recordId, organization_id: ctx.organization_id } });
        if (!record) throw new NotFoundException({ message: 'Attendance record not found', code: 'attendance_record_not_found' });
        await this.manageable(ctx, record.employee_id);
        const { reason, ...changes } = dto;
        const updated = await this.prisma.attendanceRecord.update({ where: { id: recordId }, data: { ...changes, edited_by_membership_id: ctx.membership_id, edited_at: new Date() } });
        await this.audit.record(ctx, 'attendance.record_edited', { resource_type: 'attendance_record', resource_id: recordId, metadata: { reason, before: { status: record.status, note: record.note }, after: changes } });
        return updated;
    }

    async approveOvertime(ctx: OrgContext, recordId: string) {
        const record = await this.prisma.attendanceRecord.findFirst({ where: { id: recordId, organization_id: ctx.organization_id }, include: { employee: true } });
        if (!record) throw new NotFoundException({ message: 'Attendance record not found', code: 'attendance_record_not_found' });
        await this.manageable(ctx, record.employee_id);
        if (this.access.isOwn(ctx, record.employee)) throw new ForbiddenException({ message: 'You cannot approve your own overtime', code: 'self_approval' });
        if (!record.overtime_minutes) throw new ConflictException({ message: 'There is no overtime on this day', code: 'no_overtime' });
        const updated = await this.prisma.attendanceRecord.update({ where: { id: recordId }, data: { overtime_approved: true, overtime_approved_by_membership_id: ctx.membership_id, overtime_approved_at: new Date() } });
        await this.audit.record(ctx, 'attendance.overtime_approved', { resource_type: 'attendance_record', resource_id: recordId, metadata: { overtime_minutes: record.overtime_minutes } });
        this.events.publish(ctx, { event_key: 'employees.attendance.overtime_approved', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: record.employee_id, payload: { owner_membership_id: record.employee.membership_id, overtime_minutes: record.overtime_minutes, date: isoDay(record.date) } });
        return updated;
    }

    // ------------------------------------------------------------ helpers

    private openSession(employeeId: string) {
        return this.prisma.attendanceSession.findFirst({ where: { clock_out_at: null, record: { employee_id: employeeId } }, orderBy: { clock_in_at: 'desc' }, include: { breaks: true } });
    }

    private async manageable(ctx: OrgContext, employeeId: string) {
        const scope = this.access.scopeWhere(ctx, P.attManage);
        const e = scope && (await this.prisma.employee.findFirst({ where: { id: employeeId, organization_id: ctx.organization_id, ...scope } }));
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        return e;
    }

    /** Minutes after the scheduled start (+ tolerance) of today's schedule day, 0 for flexible / no start time. */
    private async lateness(employee: Employee, clockIn: Date, tolerance: number) {
        const schedule = await this.prisma.employeeWorkSchedule.findFirst({
            where: { employee_id: employee.id, effective_from: { lte: clockIn }, OR: [{ effective_to: null }, { effective_to: { gte: toDay(clockIn) } }] },
            orderBy: { effective_from: 'desc' }, include: { days: true },
        });
        if (!schedule || schedule.schedule_type === 'FLEXIBLE') return 0;
        const day = schedule.days.find((d) => d.weekday === clockIn.getUTCDay());
        if (!day?.starts_at) return 0;
        const [h, m] = day.starts_at.split(':').map(Number);
        const start = new Date(Date.UTC(clockIn.getUTCFullYear(), clockIn.getUTCMonth(), clockIn.getUTCDate(), h, m));
        return Math.max(0, Math.round((clockIn.getTime() - start.getTime()) / MIN) - tolerance);
    }

    /** Re-aggregate a day: worked = sessions − unpaid breaks; overtime above scheduled + threshold. */
    private async recompute(recordId: string, extra: Prisma.AttendanceRecordUncheckedUpdateInput = {}) {
        const record = await this.prisma.attendanceRecord.findUniqueOrThrow({ where: { id: recordId }, include: sessionsInclude });
        const settings = await this.access.settings(record.organization_id);
        const now = Date.now();
        let worked = 0;
        let breaks = 0;
        for (const s of record.sessions) {
            const end = s.clock_out_at?.getTime() ?? now;
            worked += Math.max(0, end - s.clock_in_at.getTime()) / MIN;
            for (const b of s.breaks) {
                const len = Math.max(0, (b.ended_at?.getTime() ?? now) - b.started_at.getTime()) / MIN;
                breaks += len;
                if (b.kind === 'UNPAID') worked -= len;
            }
        }
        worked = Math.max(0, Math.round(worked));
        const open = record.sessions.some((s) => !s.clock_out_at);
        const last = record.sessions.filter((s) => s.clock_out_at).map((s) => s.clock_out_at!.getTime()).sort().pop();
        const overtime = Math.max(0, worked - record.scheduled_minutes - settings.overtime_threshold_minutes);
        const early = !open && record.scheduled_minutes && worked < record.scheduled_minutes ? record.scheduled_minutes - worked : 0;
        return this.prisma.attendanceRecord.update({
            where: { id: recordId },
            data: {
                worked_minutes: worked, break_minutes: Math.round(breaks), overtime_minutes: record.scheduled_minutes ? overtime : 0, early_leave_minutes: early,
                status: open ? 'CLOCKED_IN' : 'COMPLETED', last_clock_out_at: last ? new Date(last) : null,
                first_clock_in_at: record.sessions[0]?.clock_in_at ?? record.first_clock_in_at,
                ...extra,
            },
            include: sessionsInclude,
        });
    }
}
