import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, EmployeeAvailabilityStatus, LeaveCategory, LeaveDayPart, LeavePolicy, LeaveType, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { PeopleAccessService } from '../common/people-access.service';
import { DAY_MS, P, addDays, isoDay, num, personName, round2, toDay, today, userSelect } from '../common/people.utils';
import { LeaveConfigService } from './leave-config.service';
import { AdjustBalanceDto, CancelLeaveDto, DecideLeaveDto, LeaveBalanceQuery, LeaveCalendarQuery, LeaveRequestDto, LeaveRequestQuery } from './dto/leave.dto';

const OPEN = ['PENDING', 'APPROVED'] as const;

const AVAILABILITY_BY_CATEGORY: Partial<Record<LeaveCategory, EmployeeAvailabilityStatus>> = {
    VACATION: 'VACATION',
    SICK: 'SICK_LEAVE',
    PUBLIC_HOLIDAY: 'PUBLIC_HOLIDAY',
};

const requestInclude = {
    leave_type: { select: { id: true, name: true, code: true, category: true, color: true, deducts_balance: true } },
    employee: { select: { id: true, employee_number: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership_id: true, department: { select: { id: true, name: true } }, membership: { select: { user: { select: userSelect } } } } },
    covering_employee: { select: { id: true, preferred_name: true, membership: { select: { user: { select: userSelect } } } } },
    decided_by: { select: { id: true, user: { select: userSelect } } },
    approvals: { orderBy: { step: 'asc' as const }, include: { approver: { select: { id: true, user: { select: userSelect } } } } },
} satisfies Prisma.LeaveRequestInclude;

export interface PreviewDay { date: string; day_part: LeaveDayPart; days: number; hours: number }

/**
 * 10 "Leave Management": requests with working-day calculation (schedule − holidays), overlap and balance checks,
 * the approval chain (EmployeeHrSettings.leave_approver_strategy), the balance ledger and the leave calendar.
 */
@Injectable()
export class LeaveService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
        private readonly config: LeaveConfigService,
    ) { }

    // ================================================================ requests

    async list(ctx: OrgContext, query: LeaveRequestQuery) {
        const me = ctx.membership_id ?? '__none__';
        const scoped = this.access.readWhere(ctx, P.leaveReadAll, P.leaveReadOwn);
        const visibility: Prisma.LeaveRequestWhereInput = query.to_approve
            ? { status: 'PENDING', employee: { membership_id: { not: me } }, OR: [{ current_approver_membership_id: me }, ...(ctx.can(P.leaveApprove) && this.access.scopeWhere(ctx, P.leaveReadAll) ? [{ current_approver_membership_id: null, employee: this.access.scopeWhere(ctx, P.leaveReadAll) }] : [])] }
            : { OR: [{ employee: scoped }, { current_approver_membership_id: me }] };
        const where: Prisma.LeaveRequestWhereInput = {
            organization_id: ctx.organization_id,
            AND: [visibility],
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.mine && { employee: { membership_id: me } }),
            ...(query.leave_type_id && { leave_type_id: query.leave_type_id }),
            ...(query.from && { end_date: { gte: toDay(query.from) } }),
            ...(query.to && { start_date: { lte: toDay(query.to) } }),
            ...(query.search && { employee: { OR: [{ preferred_name: { contains: query.search, mode: 'insensitive' } }, { employee_number: { contains: query.search, mode: 'insensitive' } }, { membership: { user: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } } }] } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.leaveRequest.findMany({ where, ...skipTake(query), orderBy: [{ start_date: query.order_direction ?? 'desc' }], include: requestInclude }),
            this.prisma.leaveRequest.count({ where }),
        ]);
        return paginate(items.map((r) => this.shape(ctx, r)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const r = await this.prisma.leaveRequest.findFirst({
            where: { id, organization_id: ctx.organization_id, OR: [{ employee: this.access.readWhere(ctx, P.leaveReadAll, P.leaveReadOwn) }, { current_approver_membership_id: ctx.membership_id ?? '__none__' }] },
            include: { ...requestInclude, days: { orderBy: { date: 'asc' } }, balance_transactions: true },
        });
        if (!r) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        return this.shape(ctx, r);
    }

    /** Days, balance impact and conflicts before submitting (POST /leave-requests/preview). */
    async preview(ctx: OrgContext, dto: LeaveRequestDto) {
        const employee = await this.requester(ctx, dto.employee_id);
        const type = await this.typeFor(ctx, dto.leave_type_id, employee);
        const calc = await this.computeDays(employee, type, dto);
        const balance = type.deducts_balance ? await this.balanceFor(employee, type, toDay(dto.start_date)) : null;
        const overlaps = await this.overlaps(employee.id, calc.days.map((d) => d.date));
        const conflicts = await this.conflicts(employee, toDay(dto.start_date), toDay(dto.end_date));
        const warnings: string[] = [];
        const noticeDays = Math.round((toDay(dto.start_date).getTime() - today().getTime()) / DAY_MS);
        if (type.min_notice_days && noticeDays < type.min_notice_days) warnings.push(`${type.name} needs ${type.min_notice_days} days notice`);
        if (type.max_consecutive_days && calc.total_days > type.max_consecutive_days) warnings.push(`At most ${type.max_consecutive_days} days in one request`);
        if (overlaps.length) warnings.push('Overlaps another request of yours');
        if (balance && balance.available < calc.total_days && !balance.policy?.allow_negative_balance) warnings.push('Not enough balance');
        return {
            ...calc,
            balance: balance && { available: balance.available, after: round2(balance.available - calc.total_days), period_start: balance.row.period_start, period_end: balance.row.period_end },
            conflicts,
            overlaps,
            warnings,
        };
    }

    async create(ctx: OrgContext, dto: LeaveRequestDto) {
        const employee = await this.requester(ctx, dto.employee_id);
        const onBehalf = !this.access.isOwn(ctx, employee);
        const type = await this.typeFor(ctx, dto.leave_type_id, employee);
        const start = toDay(dto.start_date);
        const end = toDay(dto.end_date);
        const calc = await this.computeDays(employee, type, dto);
        const submit = dto.submit !== false;

        if (!onBehalf && type.min_notice_days) {
            const notice = Math.round((start.getTime() - today().getTime()) / DAY_MS);
            if (notice < type.min_notice_days && type.category !== 'SICK') throw new BadRequestException({ message: `${type.name} needs at least ${type.min_notice_days} days notice`, code: 'leave_notice_too_short' });
        }
        if (type.max_consecutive_days && calc.total_days > type.max_consecutive_days) throw new BadRequestException({ message: `At most ${type.max_consecutive_days} days of ${type.name} in one request`, code: 'leave_too_long' });
        if (submit && type.requires_attachment && !dto.attachment_document_id && calc.total_days > (type.attachment_after_days ?? 0)) {
            throw new BadRequestException({ message: `${type.name} longer than ${type.attachment_after_days ?? 0} days needs an attachment`, code: 'leave_attachment_required' });
        }
        const overlaps = await this.overlaps(employee.id, calc.days.map((d) => d.date));
        if (overlaps.length) throw new ConflictException({ message: 'You already have leave on some of these days', code: 'leave_overlap', overlaps });

        let balance: Awaited<ReturnType<LeaveService['balanceFor']>> | null = null;
        if (type.deducts_balance) {
            balance = await this.balanceFor(employee, type, start);
            const floor = balance.policy?.allow_negative_balance ? -num(balance.policy.max_negative_days ?? 9999) : 0;
            if (submit && balance.available - calc.total_days < floor) {
                throw new BadRequestException({ message: `Not enough ${type.name} balance (${balance.available} days available)`, code: 'leave_insufficient_balance', available: balance.available });
            }
        }
        if (dto.covering_employee_id && !(await this.prisma.employee.count({ where: { id: dto.covering_employee_id, organization_id: ctx.organization_id } }))) {
            throw new NotFoundException({ message: 'Covering employee not found', code: 'employee_not_found' });
        }
        const conflicts = await this.conflicts(employee, start, end);
        const settings = await this.access.settings(ctx.organization_id);
        const approvers = submit && type.requires_approval ? await this.firstApprovers(employee, settings.leave_approver_strategy) : [];
        const autoApprove = submit && !type.requires_approval;

        const request = await this.prisma.$transaction(async (tx) => {
            const r = await tx.leaveRequest.create({
                data: {
                    organization_id: ctx.organization_id, employee_id: employee.id, leave_type_id: type.id,
                    status: !submit ? 'DRAFT' : autoApprove ? 'APPROVED' : 'PENDING',
                    start_date: start, end_date: end, start_day_part: dto.start_day_part ?? 'FULL_DAY', end_day_part: dto.end_day_part ?? 'FULL_DAY',
                    total_days: calc.total_days, total_hours: calc.total_hours, reason: dto.reason, covering_employee_id: dto.covering_employee_id,
                    attachment_document_id: dto.attachment_document_id, submitted_at: submit ? new Date() : null,
                    current_approver_membership_id: approvers[0] ?? null,
                    conflicts: conflicts as unknown as Prisma.InputJsonValue, has_conflicts: conflicts.length > 0,
                    ...(autoApprove && { decided_at: new Date() }),
                    days: { create: calc.days.map((d) => ({ date: toDay(d.date), day_part: d.day_part, hours: d.hours })) },
                    approvals: { create: approvers.map((a) => ({ approver_membership_id: a, step: 1 })) },
                },
            });
            if (balance && submit) {
                if (autoApprove) {
                    await tx.leaveBalance.update({ where: { id: balance.row.id }, data: { used_days: { increment: calc.total_days } } });
                    await tx.leaveBalanceTransaction.create({ data: { leave_balance_id: balance.row.id, leave_request_id: r.id, type: 'USAGE', days: -calc.total_days, effective_on: start, created_by_membership_id: ctx.membership_id } });
                } else {
                    await tx.leaveBalance.update({ where: { id: balance.row.id }, data: { pending_days: { increment: calc.total_days } } });
                }
            }
            if (autoApprove) await this.project(tx, r.id, employee, type, start, end);
            return r;
        });

        await this.audit.record(ctx, submit ? 'leave_request.submitted' : 'leave_request.created', {
            resource_type: 'leave_request', resource_id: request.id, branch_id: employee.primary_branch_id,
            metadata: { employee_id: employee.id, leave_type: type.code, days: calc.total_days, on_behalf: onBehalf, auto_approved: autoApprove },
        });
        if (submit) {
            this.events.publish(ctx, {
                event_key: autoApprove ? 'employees.leave.approved' : 'employees.leave.requested', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.LEAVE_REQUEST, entity_id: request.id,
                payload: {
                    employee_id: employee.id, owner_membership_id: employee.membership_id, approver_membership_ids: approvers, leave_type: type.name,
                    start_date: dto.start_date, end_date: dto.end_date, total_days: calc.total_days, has_conflicts: conflicts.length > 0,
                },
                activity: { summary: `${personName(employee as any)} requested ${calc.total_days} day(s) of ${type.name}`, entity_label: type.name, branch_id: employee.primary_branch_id },
            });
        }
        return this.findOne(ctx, request.id);
    }

    /** Submit a DRAFT. */
    async submit(ctx: OrgContext, id: string) {
        const r = await this.prisma.leaveRequest.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { employee: true, leave_type: true } });
        if (!r) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        if (!this.access.isOwn(ctx, r.employee) && !ctx.can(P.leaveBalances)) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        if (r.status !== 'DRAFT') throw new ConflictException({ message: 'Only drafts can be submitted', code: 'leave_not_draft', status: r.status });
        const dto: LeaveRequestDto = {
            employee_id: r.employee_id, leave_type_id: r.leave_type_id, start_date: isoDay(r.start_date), end_date: isoDay(r.end_date),
            start_day_part: r.start_day_part, end_day_part: r.end_day_part, reason: r.reason ?? undefined, covering_employee_id: r.covering_employee_id ?? undefined,
            attachment_document_id: r.attachment_document_id ?? undefined, submit: true,
        };
        await this.prisma.leaveRequest.delete({ where: { id } });
        return this.create(ctx, dto);
    }

    async approve(ctx: OrgContext, id: string, dto: DecideLeaveDto) {
        const { request, employee } = await this.decidable(ctx, id);
        const settings = await this.access.settings(ctx.organization_id);
        const hrScope = this.access.scopeWhere(ctx, P.leaveReadAll);
        const isHr = !!hrScope && !!(await this.prisma.employee.count({ where: { id: employee.id, ...hrScope } }));
        const step = request.approvals.find((a) => a.decision === 'PENDING')?.step ?? (request.approvals.length ? Math.max(...request.approvals.map((a) => a.step)) + 1 : 1);
        const needsHrStep = settings.leave_approver_strategy === 'MANAGER_THEN_HR' && step === 1 && !isHr;
        const balance = !needsHrStep && request.leave_type.deducts_balance ? await this.balanceFor(employee, request.leave_type, request.start_date) : null;

        const updated = await this.prisma.$transaction(async (tx) => {
            await this.recordDecision(tx, request.id, step, ctx.membership_id!, 'APPROVED', dto.note);
            if (needsHrStep) {
                // Manager approved; HR (anyone holding leave.approve with read_all over the employee) decides step 2.
                return tx.leaveRequest.update({ where: { id }, data: { current_approver_membership_id: null } });
            }
            const r = await tx.leaveRequest.update({
                where: { id },
                data: { status: 'APPROVED', decided_at: new Date(), decided_by_membership_id: ctx.membership_id, decision_note: dto.note, current_approver_membership_id: null },
            });
            if (balance) {
                const days = num(request.total_days);
                await tx.leaveBalance.update({ where: { id: balance.row.id }, data: { pending_days: { decrement: Math.min(days, num(balance.row.pending_days)) }, used_days: { increment: days } } });
                await tx.leaveBalanceTransaction.create({ data: { leave_balance_id: balance.row.id, leave_request_id: id, type: 'USAGE', days: -days, effective_on: request.start_date, created_by_membership_id: ctx.membership_id } });
            }
            await this.project(tx, id, employee, request.leave_type, request.start_date, request.end_date);
            return r;
        });

        await this.audit.record(ctx, needsHrStep ? 'leave_request.step_approved' : 'leave_request.approved', {
            resource_type: 'leave_request', resource_id: id, branch_id: employee.primary_branch_id, metadata: { step, note: dto.note, days: num(request.total_days) },
        });
        this.events.publish(ctx, {
            event_key: needsHrStep ? 'employees.leave.step_approved' : 'employees.leave.approved', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.LEAVE_REQUEST, entity_id: id,
            payload: { employee_id: employee.id, owner_membership_id: employee.membership_id, approver_membership_ids: [], leave_type: request.leave_type.name, start_date: isoDay(request.start_date), end_date: isoDay(request.end_date), total_days: num(request.total_days) },
            activity: needsHrStep ? undefined : { summary: `Approved ${num(request.total_days)} day(s) of ${request.leave_type.name} for ${personName(employee as any)}`, entity_label: request.leave_type.name, branch_id: employee.primary_branch_id },
        });
        return this.findOne(ctx, updated.id);
    }

    async reject(ctx: OrgContext, id: string, dto: DecideLeaveDto) {
        const { request, employee } = await this.decidable(ctx, id);
        const step = request.approvals.find((a) => a.decision === 'PENDING')?.step ?? 1;
        const balance = request.leave_type.deducts_balance ? await this.balanceFor(employee, request.leave_type, request.start_date) : null;
        await this.prisma.$transaction(async (tx) => {
            await this.recordDecision(tx, id, step, ctx.membership_id!, 'REJECTED', dto.note);
            await tx.leaveRequest.update({ where: { id }, data: { status: 'REJECTED', decided_at: new Date(), decided_by_membership_id: ctx.membership_id, decision_note: dto.note, current_approver_membership_id: null } });
            await this.releasePending(tx, balance?.row ?? null, request);
        });
        await this.audit.record(ctx, 'leave_request.rejected', { resource_type: 'leave_request', resource_id: id, branch_id: employee.primary_branch_id, metadata: { note: dto.note } });
        this.events.publish(ctx, {
            event_key: 'employees.leave.rejected', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.LEAVE_REQUEST, entity_id: id,
            payload: { employee_id: employee.id, owner_membership_id: employee.membership_id, leave_type: request.leave_type.name, note: dto.note ?? null },
        });
        return this.findOne(ctx, id);
    }

    /** Own request (pending, or approved and not started) or anybody's with employees.leave.manage_balances. */
    async cancel(ctx: OrgContext, id: string, dto: CancelLeaveDto) {
        const request = await this.prisma.leaveRequest.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { employee: true, leave_type: true } });
        if (!request) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        const own = this.access.isOwn(ctx, request.employee);
        const manager = !own && ctx.can(P.leaveBalances) && this.access.scopeWhere(ctx, P.leaveBalances) && (await this.prisma.employee.count({ where: { id: request.employee_id, ...this.access.scopeWhere(ctx, P.leaveBalances) } }));
        if (!own && !manager) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        if (!['DRAFT', 'PENDING', 'APPROVED'].includes(request.status)) throw new ConflictException({ message: `Request is already ${request.status.toLowerCase()}`, code: 'leave_not_cancellable', status: request.status });
        if (own && !manager && request.status === 'APPROVED' && request.start_date <= today()) {
            throw new ConflictException({ message: 'Leave that already started can only be cancelled by HR', code: 'leave_started' });
        }
        const wasApproved = request.status === 'APPROVED';
        const balance = request.leave_type.deducts_balance && ['PENDING', 'APPROVED'].includes(request.status) ? await this.balanceFor(request.employee, request.leave_type, request.start_date) : null;
        await this.prisma.$transaction(async (tx) => {
            await tx.leaveRequest.update({ where: { id }, data: { status: own && request.status !== 'APPROVED' ? 'WITHDRAWN' : 'CANCELLED', cancelled_at: new Date(), cancellation_reason: dto.cancellation_reason, current_approver_membership_id: null } });
            if (request.status === 'PENDING') await this.releasePending(tx, balance?.row ?? null, request);
            if (wasApproved && balance) {
                const days = num(request.total_days);
                await tx.leaveBalance.update({ where: { id: balance.row.id }, data: { used_days: { decrement: days } } });
                await tx.leaveBalanceTransaction.create({ data: { leave_balance_id: balance.row.id, leave_request_id: id, type: 'REVERSAL', days, effective_on: today(), reason: dto.cancellation_reason ?? 'Leave cancelled', created_by_membership_id: ctx.membership_id } });
            }
            if (wasApproved) await tx.employeeAvailabilityEntry.deleteMany({ where: { leave_request_id: id } });
        });
        if (wasApproved) await this.refreshAvailability(request.employee.id);
        await this.audit.record(ctx, 'leave_request.cancelled', { resource_type: 'leave_request', resource_id: id, metadata: { reason: dto.cancellation_reason, was: request.status } });
        this.events.publish(ctx, {
            event_key: 'employees.leave.cancelled', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.LEAVE_REQUEST, entity_id: id,
            payload: { employee_id: request.employee_id, owner_membership_id: request.employee.membership_id, approver_membership_ids: request.current_approver_membership_id ? [request.current_approver_membership_id] : [], was: request.status },
        });
        return this.findOne(ctx, id);
    }

    // ================================================================ balances

    /**
     * Balances per employee and leave type for the period containing `year` (rows are created lazily from the policy).
     * Without read_all the caller only sees their own.
     */
    async balances(ctx: OrgContext, query: LeaveBalanceQuery) {
        await this.config.ensureDefaults(ctx.organization_id);
        const on = query.year ? new Date(Date.UTC(query.year, 6, 1)) : today();
        const where: Prisma.EmployeeWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: null,
            employment_status: { not: 'TERMINATED' },
            ...this.access.readWhere(ctx, P.leaveReadAll, P.leaveReadOwn),
            ...(query.employee_id && { id: query.employee_id }),
            ...(query.department_team_id && { department_team_id: query.department_team_id }),
            ...(query.search && { OR: [{ preferred_name: { contains: query.search, mode: 'insensitive' } }, { employee_number: { contains: query.search, mode: 'insensitive' } }, { membership: { user: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }] } } }] }),
        };
        const [employees, total, types] = await Promise.all([
            this.prisma.employee.findMany({ where, ...skipTake(query), orderBy: { employee_number: 'asc' }, include: { membership: { select: { user: { select: userSelect } } }, department: { select: { id: true, name: true } } } }),
            this.prisma.employee.count({ where }),
            this.prisma.leaveType.findMany({ where: { organization_id: ctx.organization_id, archived_at: null, deducts_balance: true }, orderBy: { sort_order: 'asc' } }),
        ]);
        const data = [];
        for (const e of employees) {
            const rows = [];
            for (const t of types) {
                if (t.applies_to_types.length && !t.applies_to_types.includes(e.employment_type)) continue;
                const b = await this.balanceFor(e, t, on);
                rows.push({ ...this.balanceShape(b.row), leave_type: { id: t.id, name: t.name, code: t.code, color: t.color, category: t.category }, policy: b.policy ? { id: b.policy.id, name: b.policy.name } : null });
            }
            data.push({ employee: { id: e.id, employee_number: e.employee_number, name: personName(e), photo_url: e.membership.user.profile_photo_url, department: e.department, is_me: this.access.isOwn(ctx, e) }, balances: rows });
        }
        return paginate(data, total, query);
    }

    async transactions(ctx: OrgContext, balanceId: string) {
        const balance = await this.prisma.leaveBalance.findFirst({ where: { id: balanceId, organization_id: ctx.organization_id, employee: this.access.readWhere(ctx, P.leaveReadAll, P.leaveReadOwn) } });
        if (!balance) throw new NotFoundException({ message: 'Balance not found', code: 'leave_balance_not_found' });
        return this.prisma.leaveBalanceTransaction.findMany({ where: { leave_balance_id: balanceId }, orderBy: { created_at: 'desc' } });
    }

    async adjust(ctx: OrgContext, balanceId: string, dto: AdjustBalanceDto) {
        const scope = this.access.scopeWhere(ctx, P.leaveBalances);
        const balance = await this.prisma.leaveBalance.findFirst({ where: { id: balanceId, organization_id: ctx.organization_id, ...(scope ? { employee: scope } : { id: '__none__' }) }, include: { employee: true } });
        if (!balance) throw new NotFoundException({ message: 'Balance not found', code: 'leave_balance_not_found' });
        if (dto.days === 0) throw new BadRequestException({ message: 'Days must not be 0', code: 'invalid_days' });
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.leaveBalanceTransaction.create({ data: { leave_balance_id: balanceId, type: 'ADJUSTMENT', days: dto.days, effective_on: today(), reason: dto.reason, created_by_membership_id: ctx.membership_id } });
            return tx.leaveBalance.update({ where: { id: balanceId }, data: { adjusted_days: { increment: dto.days } } });
        });
        await this.audit.record(ctx, 'leave_balance.adjusted', { resource_type: 'leave_balance', resource_id: balanceId, metadata: { employee_id: balance.employee_id, days: dto.days, reason: dto.reason } });
        this.events.publish(ctx, { event_key: 'employees.leave_balance.adjusted', module: ModuleKey.EMPLOYEES, entity_kind: 'leave_balance', entity_id: balanceId, payload: { employee_id: balance.employee_id, owner_membership_id: balance.employee.membership_id, days: dto.days } });
        return this.balanceShape(updated);
    }

    // ================================================================ calendar

    async calendar(ctx: OrgContext, query: LeaveCalendarQuery) {
        const from = toDay(query.from);
        const to = toDay(query.to);
        if (to < from || (to.getTime() - from.getTime()) / DAY_MS > 92) throw new BadRequestException({ message: 'Pick a range of at most 3 months', code: 'invalid_range' });
        const employeeWhere: Prisma.EmployeeWhereInput = {
            organization_id: ctx.organization_id, archived_at: null, employment_status: { not: 'TERMINATED' },
            ...this.access.readWhere(ctx, P.leaveReadAll, P.leaveReadOwn),
            ...(query.team_id && { OR: [{ department_team_id: query.team_id }, { membership: { teams: { some: { team_id: query.team_id, ended_at: null } } } }] }),
            ...(query.branch_id && { primary_branch_id: query.branch_id }),
        };
        const employees = await this.prisma.employee.findMany({
            where: employeeWhere, orderBy: [{ department_team_id: 'asc' }, { preferred_name: 'asc' }],
            select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership_id: true, primary_branch_id: true, department: { select: { id: true, name: true } }, membership: { select: { user: { select: userSelect } } } },
        });
        const ids = employees.map((e) => e.id);
        const [days, holidays, availability] = await Promise.all([
            this.prisma.leaveRequestDay.findMany({
                where: { date: { gte: from, lte: to }, leave_request: { employee_id: { in: ids }, status: { in: [...OPEN] } } },
                include: { leave_request: { select: { id: true, status: true, employee_id: true, leave_type: { select: { id: true, name: true, color: true, category: true } } } } },
            }),
            this.access.holidays(ctx.organization_id, query.branch_id ?? null, from, to),
            this.prisma.employeeAvailabilityEntry.findMany({ where: { employee_id: { in: ids }, source: 'MANUAL', starts_at: { lte: addDays(to, 1) }, ends_at: { gte: from } }, select: { id: true, employee_id: true, status: true, starts_at: true, ends_at: true, note: true } }),
        ]);
        return {
            from: query.from, to: query.to,
            employees: employees.map((e) => ({ id: e.id, name: personName(e), photo_url: e.membership.user.profile_photo_url, department: e.department, is_me: this.access.isOwn(ctx, e) })),
            days: days.map((d) => ({ employee_id: d.leave_request.employee_id, date: isoDay(d.date), day_part: d.day_part, status: d.leave_request.status, request_id: d.leave_request.id, leave_type: d.leave_request.leave_type })),
            holidays: [...holidays.entries()].map(([date, h]) => ({ date, name: h.name, is_half_day: h.half })),
            availability,
        };
    }

    // ================================================================ helpers

    private shape(ctx: OrgContext, r: any) {
        return {
            ...r,
            employee: r.employee && { ...r.employee, name: personName(r.employee), photo_url: r.employee.membership?.user?.profile_photo_url ?? null, is_me: this.access.isOwn(ctx, r.employee) },
            covering_employee: r.covering_employee && { id: r.covering_employee.id, name: personName(r.covering_employee) },
            can_decide: r.status === 'PENDING' && ctx.can(P.leaveApprove) && !this.access.isOwn(ctx, r.employee),
        };
    }

    /** Requests for yourself need request_own; on behalf needs manage_balances within scope. */
    private async requester(ctx: OrgContext, employeeId?: string) {
        if (!employeeId) {
            if (!ctx.can(P.leaveRequestOwn)) throw new ForbiddenException({ message: 'You cannot request leave', code: 'forbidden' });
            return this.access.meOrThrow(ctx);
        }
        const e = await this.prisma.employee.findFirst({ where: { id: employeeId, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (this.access.isOwn(ctx, e)) {
            if (!ctx.can(P.leaveRequestOwn)) throw new ForbiddenException({ message: 'You cannot request leave', code: 'forbidden' });
            return e;
        }
        const scope = this.access.scopeWhere(ctx, P.leaveBalances);
        if (!scope || !(await this.prisma.employee.count({ where: { id: employeeId, ...scope } }))) {
            throw new ForbiddenException({ message: 'You cannot request leave for this person', code: 'forbidden' });
        }
        return e;
    }

    private async typeFor(ctx: OrgContext, typeId: string, employee: Employee) {
        await this.config.ensureDefaults(ctx.organization_id);
        const type = await this.prisma.leaveType.findFirst({ where: { id: typeId, organization_id: ctx.organization_id, archived_at: null } });
        if (!type) throw new NotFoundException({ message: 'Leave type not found', code: 'leave_type_not_found' });
        if (type.applies_to_types.length && !type.applies_to_types.includes(employee.employment_type)) {
            throw new BadRequestException({ message: `${type.name} is not available for this employment type`, code: 'leave_type_not_applicable' });
        }
        return type;
    }

    /** Working days of the request: schedule hours > 0, holidays removed (half holidays count half), half-day parts at the ends. */
    private async computeDays(employee: Employee, type: LeaveType, dto: Pick<LeaveRequestDto, 'start_date' | 'end_date' | 'start_day_part' | 'end_day_part'>) {
        const start = toDay(dto.start_date);
        const end = toDay(dto.end_date);
        if (end < start) throw new BadRequestException({ message: 'The end date is before the start date', code: 'invalid_range' });
        if ((end.getTime() - start.getTime()) / DAY_MS > 366) throw new BadRequestException({ message: 'A request can span at most one year', code: 'invalid_range' });
        const startPart = dto.start_day_part ?? 'FULL_DAY';
        const endPart = dto.end_day_part ?? 'FULL_DAY';
        if (!type.allows_half_day && (startPart !== 'FULL_DAY' || endPart !== 'FULL_DAY')) throw new BadRequestException({ message: `${type.name} cannot be taken in half days`, code: 'leave_half_day_not_allowed' });
        const calendar = await this.access.calendar(employee, start, end);
        const days: PreviewDay[] = [];
        const holidays: { date: string; name: string }[] = [];
        for (const d of calendar) {
            if (d.hours <= 0) continue;
            let fraction = 1;
            if (d.holiday) {
                holidays.push({ date: isoDay(d.date), name: d.holiday.name });
                if (!d.holiday.half) continue;
                fraction = 0.5;
            }
            let part: LeaveDayPart = 'FULL_DAY';
            const isStart = d.date.getTime() === start.getTime();
            const isEnd = d.date.getTime() === end.getTime();
            if (isStart && startPart !== 'FULL_DAY') part = startPart;
            else if (isEnd && endPart !== 'FULL_DAY') part = endPart;
            if (part !== 'FULL_DAY') fraction = Math.min(fraction, 0.5);
            days.push({ date: isoDay(d.date), day_part: part, days: fraction, hours: round2(d.hours * fraction) });
        }
        const total_days = round2(days.reduce((s, d) => s + d.days, 0));
        if (!total_days) throw new BadRequestException({ message: 'There are no working days in this range', code: 'leave_no_working_days', holidays });
        return { days, holidays, total_days, total_hours: round2(days.reduce((s, d) => s + d.hours, 0)) };
    }

    private async overlaps(employeeId: string, dates: string[]) {
        if (!dates.length) return [];
        const rows = await this.prisma.leaveRequestDay.findMany({
            where: { date: { in: dates.map((d) => toDay(d)) }, leave_request: { employee_id: employeeId, status: { in: [...OPEN] } } },
            select: { date: true, leave_request_id: true },
        });
        return rows.map((r) => ({ date: isoDay(r.date), leave_request_id: r.leave_request_id }));
    }

    /** Colleagues of the same department (or manager) who are off on overlapping days. */
    private async conflicts(employee: Employee, from: Date, to: Date) {
        if (!employee.department_team_id && !employee.manager_employee_id) return [];
        const rows = await this.prisma.leaveRequest.findMany({
            where: {
                organization_id: employee.organization_id, status: { in: [...OPEN] }, employee_id: { not: employee.id },
                start_date: { lte: to }, end_date: { gte: from },
                employee: employee.department_team_id ? { department_team_id: employee.department_team_id } : { manager_employee_id: employee.manager_employee_id },
            },
            include: { employee: { select: { id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: userSelect } } } } } },
            take: 20,
        });
        return rows.map((r) => ({ employee_id: r.employee_id, name: personName(r.employee), start_date: isoDay(r.start_date), end_date: isoDay(r.end_date), status: r.status }));
    }

    /** Effective policy for an employee and type: explicit assignment, else the default (branch-specific first). */
    private async policyFor(employee: Employee, type: LeaveType, on: Date): Promise<LeavePolicy | null> {
        const assigned = await this.prisma.employeeLeavePolicy.findFirst({
            where: { employee_id: employee.id, effective_from: { lte: on }, OR: [{ effective_to: null }, { effective_to: { gte: on } }], policy: { leave_type_id: type.id, archived_at: null } },
            orderBy: { effective_from: 'desc' }, include: { policy: true },
        });
        if (assigned) return assigned.policy;
        const defaults = await this.prisma.leavePolicy.findMany({ where: { leave_type_id: type.id, archived_at: null, is_default: true, OR: [{ branch_id: null }, { branch_id: employee.primary_branch_id ?? '__none__' }] } });
        const fits = defaults.filter((p) => !p.applies_to_types.length || p.applies_to_types.includes(employee.employment_type));
        return fits.find((p) => p.branch_id) ?? fits[0] ?? null;
    }

    /** Find-or-create the LeaveBalance row of the period containing `on`; MONTHLY accrual is refreshed each time. */
    private async balanceFor(employee: Employee, type: LeaveType, on: Date) {
        const policy = await this.policyFor(employee, type, on);
        const month = (policy?.period_start_month ?? 1) - 1;
        const day = policy?.period_start_day ?? 1;
        let start = new Date(Date.UTC(on.getUTCFullYear(), month, day));
        if (start > on) start = new Date(Date.UTC(on.getUTCFullYear() - 1, month, day));
        const end = addDays(new Date(Date.UTC(start.getUTCFullYear() + 1, month, day)), -1);
        const periodDays = (end.getTime() - start.getTime()) / DAY_MS + 1;

        let entitled = 0;
        let accrued = 0;
        if (policy) {
            let annual = num(policy.annual_entitlement_days);
            if (policy.seniority_bonus_days_per_year && employee.hire_date) {
                const years = Math.floor((on.getTime() - employee.hire_date.getTime()) / (365.25 * DAY_MS));
                annual += Math.max(0, years) * num(policy.seniority_bonus_days_per_year);
            }
            if (policy.max_entitlement_days) annual = Math.min(annual, num(policy.max_entitlement_days));
            let factor = 1;
            if (policy.prorate_first_year && employee.hire_date && employee.hire_date > start && employee.hire_date <= end) {
                factor = ((end.getTime() - employee.hire_date.getTime()) / DAY_MS + 1) / periodDays;
            }
            const half = (n: number) => Math.round(n * 2) / 2;
            if (policy.accrual_method === 'ANNUAL_UPFRONT') entitled = half(annual * factor);
            else if (policy.accrual_method === 'MONTHLY') {
                const months = Math.min(12, Math.max(0, (today().getUTCFullYear() - start.getUTCFullYear()) * 12 + today().getUTCMonth() - start.getUTCMonth() + 1));
                accrued = half((annual * months) / 12 * factor);
            }
        }
        let row = await this.prisma.leaveBalance.findUnique({ where: { employee_id_leave_type_id_period_start: { employee_id: employee.id, leave_type_id: type.id, period_start: start } } });
        if (!row) {
            row = await this.prisma.leaveBalance.upsert({
                where: { employee_id_leave_type_id_period_start: { employee_id: employee.id, leave_type_id: type.id, period_start: start } },
                update: {},
                create: { organization_id: employee.organization_id, employee_id: employee.id, leave_type_id: type.id, period_start: start, period_end: end, entitled_days: entitled, accrued_days: accrued, last_accrued_at: policy?.accrual_method === 'MONTHLY' ? new Date() : null },
            });
            if (entitled || accrued) {
                await this.prisma.leaveBalanceTransaction.create({ data: { leave_balance_id: row.id, type: 'ACCRUAL', days: entitled || accrued, effective_on: start, reason: policy ? `Policy: ${policy.name}` : null } });
            }
        } else if (policy?.accrual_method === 'MONTHLY' && num(row.accrued_days) !== accrued) {
            const delta = accrued - num(row.accrued_days);
            row = await this.prisma.leaveBalance.update({ where: { id: row.id }, data: { accrued_days: accrued, last_accrued_at: new Date() } });
            await this.prisma.leaveBalanceTransaction.create({ data: { leave_balance_id: row.id, type: 'ACCRUAL', days: delta, effective_on: today(), reason: 'Monthly accrual' } });
        }
        return { row, policy, available: this.available(row) };
    }

    private available(b: { entitled_days: Prisma.Decimal; accrued_days: Prisma.Decimal; carried_over_days: Prisma.Decimal; adjusted_days: Prisma.Decimal; used_days: Prisma.Decimal; pending_days: Prisma.Decimal }) {
        return round2(num(b.entitled_days) + num(b.accrued_days) + num(b.carried_over_days) + num(b.adjusted_days) - num(b.used_days) - num(b.pending_days));
    }

    private balanceShape(b: any) {
        return { ...b, available_days: this.available(b) };
    }

    /** First approval step per strategy: the direct manager (DIRECT_MANAGER / MANAGER_THEN_HR); HR = open to any HR approver. */
    private async firstApprovers(employee: Employee, strategy: string): Promise<string[]> {
        if (strategy === 'HR' || strategy === 'CUSTOM') return [];
        if (!employee.manager_employee_id) return [];
        const manager = await this.prisma.employee.findUnique({ where: { id: employee.manager_employee_id }, select: { membership_id: true, employment_status: true } });
        return manager && manager.employment_status !== 'TERMINATED' ? [manager.membership_id] : [];
    }

    /** Pending request the caller may decide: never their own; current approver, a manager in the chain, or HR scope. */
    private async decidable(ctx: OrgContext, id: string) {
        const request = await this.prisma.leaveRequest.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { employee: true, leave_type: true, approvals: true } });
        if (!request) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        const employee = request.employee;
        if (this.access.isOwn(ctx, employee)) throw new ForbiddenException({ message: 'You cannot decide your own leave request', code: 'self_approval' });
        const hrScope = this.access.scopeWhere(ctx, P.leaveReadAll);
        const allowed =
            request.current_approver_membership_id === ctx.membership_id ||
            (hrScope && (await this.prisma.employee.count({ where: { id: employee.id, ...hrScope } }))) ||
            (await this.access.isManagerOf(ctx, employee.id));
        if (!allowed) throw new NotFoundException({ message: 'Leave request not found', code: 'leave_request_not_found' });
        if (request.status !== 'PENDING') throw new ConflictException({ message: `Request is already ${request.status.toLowerCase()}`, code: 'leave_already_decided', status: request.status });
        return { request, employee };
    }

    private async recordDecision(tx: Prisma.TransactionClient, requestId: string, step: number, membershipId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) {
        await tx.leaveRequestApproval.upsert({
            where: { leave_request_id_step_approver_membership_id: { leave_request_id: requestId, step, approver_membership_id: membershipId } },
            update: { decision, decided_at: new Date(), comment },
            create: { leave_request_id: requestId, step, approver_membership_id: membershipId, decision, decided_at: new Date(), comment },
        });
        await tx.leaveRequestApproval.updateMany({ where: { leave_request_id: requestId, step, decision: 'PENDING' }, data: { decision: 'SKIPPED' } });
    }

    private async releasePending(tx: Prisma.TransactionClient, balance: { id: string; pending_days: Prisma.Decimal } | null, request: { total_days: Prisma.Decimal; status: string }) {
        if (!balance || request.status !== 'PENDING') return;
        await tx.leaveBalance.update({ where: { id: balance.id }, data: { pending_days: { decrement: Math.min(num(request.total_days), num(balance.pending_days)) } } });
    }

    /** Approved leave → availability entry (projected to 19 Calendar) and the current status when it covers today. */
    private async project(tx: Prisma.TransactionClient, requestId: string, employee: Employee, type: LeaveType, start: Date, end: Date) {
        const status = AVAILABILITY_BY_CATEGORY[type.category] ?? 'ON_LEAVE';
        await tx.employeeAvailabilityEntry.create({
            data: { organization_id: employee.organization_id, employee_id: employee.id, status, starts_at: start, ends_at: addDays(end, 1), all_day: true, source: 'LEAVE', leave_request_id: requestId, note: type.name },
        });
        const now = today();
        if (start <= now && end >= now) await tx.employee.update({ where: { id: employee.id }, data: { availability_status: status, availability_updated_at: new Date() } });
    }

    private async refreshAvailability(employeeId: string) {
        const now = new Date();
        const current = await this.prisma.employeeAvailabilityEntry.findFirst({ where: { employee_id: employeeId, starts_at: { lte: now }, ends_at: { gt: now } }, orderBy: { starts_at: 'desc' } });
        await this.prisma.employee.update({ where: { id: employeeId }, data: { availability_status: current?.status ?? 'AVAILABLE', availability_updated_at: now } });
    }
}
