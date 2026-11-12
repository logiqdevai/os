import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { dates, defined, personName, toDay } from '../common/people.utils';
import { AssignPolicyDto, BranchHolidayDto, HolidayDto, LeavePolicyDto, LeaveTypeDto, UpdateHolidayDto, UpdateLeavePolicyDto, UpdateLeaveTypeDto } from './dto/leave.dto';

/** Sensible defaults created the first time an organization opens Leave (10 "Leave Management"). */
const DEFAULT_TYPES = [
    { code: 'VAC', name: 'Vacation', category: 'VACATION', color: 'info', min_notice_days: 7, entitlement: 22, carry: 5 },
    { code: 'SICK', name: 'Sick leave', category: 'SICK', color: 'danger', allows_half_day: true, requires_approval: true, entitlement: 10 },
    { code: 'PER', name: 'Personal day', category: 'PERSONAL', color: 'violet', entitlement: 3 },
    { code: 'UNP', name: 'Unpaid leave', category: 'UNPAID', color: 'neutral', is_paid: false, deducts_balance: false, min_notice_days: 14 },
] as const;

@Injectable()
export class LeaveConfigService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** Creates the default leave types and default policies once per organization. */
    async ensureDefaults(orgId: string) {
        if (await this.prisma.leaveType.count({ where: { organization_id: orgId } })) return;
        await this.prisma.$transaction(async (tx) => {
            for (const [i, t] of DEFAULT_TYPES.entries()) {
                const type = await tx.leaveType.create({
                    data: {
                        organization_id: orgId, code: t.code, name: t.name, category: t.category, color: t.color, sort_order: i,
                        is_paid: 'is_paid' in t ? t.is_paid : true,
                        deducts_balance: 'deducts_balance' in t ? t.deducts_balance : true,
                        min_notice_days: 'min_notice_days' in t ? t.min_notice_days : null,
                    },
                });
                if ('entitlement' in t) {
                    await tx.leavePolicy.create({
                        data: {
                            organization_id: orgId, leave_type_id: type.id, name: `${t.name} — standard`, annual_entitlement_days: t.entitlement, is_default: true,
                            carry_over_max_days: 'carry' in t ? t.carry : null, carry_over_expiry_months: 'carry' in t ? 3 : null,
                        },
                    });
                }
            }
        }).catch((error) => {
            // Two first requests at once: the unique (organization_id, code) keeps one set.
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        });
    }

    // ------------------------------------------------------------ types

    async listTypes(ctx: OrgContext, includeArchived = false) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.leaveType.findMany({
            where: { organization_id: ctx.organization_id, ...(!includeArchived && { archived_at: null }) },
            orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
            include: { policies: { where: { archived_at: null }, select: { id: true, name: true, annual_entitlement_days: true, is_default: true, branch_id: true } } },
        });
    }

    async createType(ctx: OrgContext, dto: LeaveTypeDto) {
        const row = await this.prisma.leaveType.create({ data: { ...dto, organization_id: ctx.organization_id } }).catch((e) => this.rethrow(e, 'A leave type with this code already exists'));
        await this.audit.record(ctx, 'leave_type.created', { resource_type: 'leave_type', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.leave_type.created', module: ModuleKey.EMPLOYEES, entity_kind: 'leave_type', entity_id: row.id, payload: { code: row.code } });
        return row;
    }

    async updateType(ctx: OrgContext, id: string, dto: UpdateLeaveTypeDto) {
        const before = await this.type(ctx, id);
        const row = await this.prisma.leaveType.update({ where: { id }, data: defined(dto) }).catch((e) => this.rethrow(e, 'A leave type with this code already exists'));
        await this.audit.record(ctx, 'leave_type.updated', { resource_type: 'leave_type', resource_id: id, metadata: { before: { name: before.name, code: before.code }, after: dto } });
        return row;
    }

    async archiveType(ctx: OrgContext, id: string, archived: boolean) {
        await this.type(ctx, id);
        const row = await this.prisma.leaveType.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'leave_type.archived' : 'leave_type.restored', { resource_type: 'leave_type', resource_id: id });
        return row;
    }

    // ------------------------------------------------------------ policies

    async listPolicies(ctx: OrgContext) {
        await this.ensureDefaults(ctx.organization_id);
        return this.prisma.leavePolicy.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null },
            orderBy: [{ leave_type: { sort_order: 'asc' } }, { name: 'asc' }],
            include: { leave_type: { select: { id: true, name: true, code: true, color: true } }, branch: { select: { id: true, name: true } }, _count: { select: { assignments: true } } },
        });
    }

    async createPolicy(ctx: OrgContext, dto: LeavePolicyDto) {
        await this.type(ctx, dto.leave_type_id);
        await this.assertBranch(ctx, dto.branch_id);
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.leavePolicy.updateMany({ where: { organization_id: ctx.organization_id, leave_type_id: dto.leave_type_id, branch_id: dto.branch_id ?? null }, data: { is_default: false } });
            return tx.leavePolicy.create({ data: { ...dto, organization_id: ctx.organization_id } });
        });
        await this.audit.record(ctx, 'leave_policy.created', { resource_type: 'leave_policy', resource_id: row.id, metadata: { after: dto } });
        return row;
    }

    async updatePolicy(ctx: OrgContext, id: string, dto: UpdateLeavePolicyDto) {
        const before = await this.policy(ctx, id);
        await this.assertBranch(ctx, dto.branch_id);
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.leavePolicy.updateMany({ where: { organization_id: ctx.organization_id, leave_type_id: before.leave_type_id, branch_id: (dto.branch_id ?? before.branch_id) ?? null, id: { not: id } }, data: { is_default: false } });
            return tx.leavePolicy.update({ where: { id }, data: defined(dto) });
        });
        await this.audit.record(ctx, 'leave_policy.updated', { resource_type: 'leave_policy', resource_id: id, metadata: { before: { annual_entitlement_days: before.annual_entitlement_days, is_default: before.is_default }, after: dto } });
        return row;
    }

    async archivePolicy(ctx: OrgContext, id: string) {
        await this.policy(ctx, id);
        const row = await this.prisma.leavePolicy.update({ where: { id }, data: { archived_at: new Date(), is_default: false } });
        await this.audit.record(ctx, 'leave_policy.archived', { resource_type: 'leave_policy', resource_id: id });
        return row;
    }

    async assignPolicy(ctx: OrgContext, id: string, dto: AssignPolicyDto) {
        await this.policy(ctx, id);
        const employee = await this.prisma.employee.findFirst({ where: { id: dto.employee_id, organization_id: ctx.organization_id } });
        if (!employee) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        const row = await this.prisma.employeeLeavePolicy.upsert({
            where: { employee_id_leave_policy_id_effective_from: { employee_id: dto.employee_id, leave_policy_id: id, effective_from: toDay(dto.effective_from) } },
            update: { effective_to: null },
            create: { employee_id: dto.employee_id, leave_policy_id: id, effective_from: toDay(dto.effective_from) },
        });
        await this.audit.record(ctx, 'leave_policy.assigned', { resource_type: 'leave_policy', resource_id: id, metadata: { employee_id: dto.employee_id, effective_from: dto.effective_from } });
        return row;
    }

    /** Employees explicitly assigned to a policy (EmployeeLeavePolicy), newest first. */
    async policyAssignments(ctx: OrgContext, id: string) {
        await this.policy(ctx, id);
        const rows = await this.prisma.employeeLeavePolicy.findMany({
            where: { leave_policy_id: id },
            orderBy: { effective_from: 'desc' },
            include: { employee: { select: { id: true, employee_number: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } } },
        });
        return rows.map((r) => ({ ...r, employee: { id: r.employee.id, employee_number: r.employee.employee_number, name: personName(r.employee) } }));
    }

    // ------------------------------------------------------------ company holidays

    listHolidays(ctx: OrgContext, year?: number) {
        const where: Prisma.CompanyHolidayWhereInput = { organization_id: ctx.organization_id };
        if (year) where.OR = [{ date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } }, { recurring: true }];
        return this.prisma.companyHoliday.findMany({ where, orderBy: { date: 'asc' } });
    }

    async createHoliday(ctx: OrgContext, dto: HolidayDto) {
        const row = await this.prisma.companyHoliday.create({ data: { ...(dates(dto, ['date']) as any), organization_id: ctx.organization_id } }).catch((e) => this.rethrow(e, 'This holiday already exists'));
        await this.audit.record(ctx, 'company_holiday.created', { resource_type: 'company_holiday', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.holiday.created', module: ModuleKey.EMPLOYEES, entity_kind: 'company_holiday', entity_id: row.id, payload: { name: row.name, date: dto.date } });
        return row;
    }

    async updateHoliday(ctx: OrgContext, id: string, dto: UpdateHolidayDto) {
        const before = await this.prisma.companyHoliday.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Holiday not found', code: 'holiday_not_found' });
        if (dto.applies_to_branch_ids?.length) {
            const n = await this.prisma.branch.count({ where: { id: { in: dto.applies_to_branch_ids }, organization_id: ctx.organization_id } });
            if (n !== dto.applies_to_branch_ids.length) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        }
        const row = await this.prisma.companyHoliday.update({ where: { id }, data: dates(defined(dto), ['date']) as Prisma.CompanyHolidayUpdateInput }).catch((e) => this.rethrow(e, 'This holiday already exists'));
        await this.audit.record(ctx, 'company_holiday.updated', { resource_type: 'company_holiday', resource_id: id, metadata: { before: { name: before.name, date: before.date, is_half_day: before.is_half_day }, after: dto } });
        this.events.publish(ctx, { event_key: 'employees.holiday.updated', module: ModuleKey.EMPLOYEES, entity_kind: 'company_holiday', entity_id: id, payload: { name: row.name }, changes: dto as Record<string, unknown> });
        return row;
    }

    // ------------------------------------------------------------ branch holidays (BranchHoliday, 01 §122)

    listBranchHolidays(ctx: OrgContext, year?: number, branchId?: string) {
        const where: Prisma.BranchHolidayWhereInput = { branch: { organization_id: ctx.organization_id }, ...(branchId && { branch_id: branchId }) };
        if (year) where.OR = [{ date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } }, { recurring: true }];
        return this.prisma.branchHoliday.findMany({ where, orderBy: { date: 'asc' }, include: { branch: { select: { id: true, name: true } } } });
    }

    async createBranchHoliday(ctx: OrgContext, dto: BranchHolidayDto) {
        await this.assertBranch(ctx, dto.branch_id);
        const row = await this.prisma.branchHoliday.create({ data: { branch_id: dto.branch_id, name: dto.name, date: toDay(dto.date), recurring: dto.recurring ?? false }, include: { branch: { select: { id: true, name: true } } } })
            .catch((e) => this.rethrow(e, 'This holiday already exists for the branch'));
        await this.audit.record(ctx, 'branch_holiday.created', { resource_type: 'branch_holiday', resource_id: row.id, branch_id: dto.branch_id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.holiday.created', module: ModuleKey.EMPLOYEES, entity_kind: 'branch_holiday', entity_id: row.id, payload: { name: row.name, date: dto.date, branch_id: dto.branch_id } });
        return row;
    }

    async removeBranchHoliday(ctx: OrgContext, id: string) {
        const row = await this.prisma.branchHoliday.findFirst({ where: { id, branch: { organization_id: ctx.organization_id } } });
        if (!row) throw new NotFoundException({ message: 'Holiday not found', code: 'holiday_not_found' });
        await this.prisma.branchHoliday.delete({ where: { id } });
        await this.audit.record(ctx, 'branch_holiday.deleted', { resource_type: 'branch_holiday', resource_id: id, branch_id: row.branch_id, metadata: { name: row.name } });
        return { success: true };
    }

    async removeHoliday(ctx: OrgContext, id: string) {
        const row = await this.prisma.companyHoliday.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Holiday not found', code: 'holiday_not_found' });
        await this.prisma.companyHoliday.delete({ where: { id } });
        await this.audit.record(ctx, 'company_holiday.deleted', { resource_type: 'company_holiday', resource_id: id, metadata: { name: row.name } });
        return { success: true };
    }

    // ------------------------------------------------------------ helpers

    async type(ctx: OrgContext, id: string) {
        const t = await this.prisma.leaveType.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!t) throw new NotFoundException({ message: 'Leave type not found', code: 'leave_type_not_found' });
        return t;
    }

    private async policy(ctx: OrgContext, id: string) {
        const p = await this.prisma.leavePolicy.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!p) throw new NotFoundException({ message: 'Leave policy not found', code: 'leave_policy_not_found' });
        return p;
    }

    private async assertBranch(ctx: OrgContext, branchId?: string) {
        if (branchId && !(await this.prisma.branch.count({ where: { id: branchId, organization_id: ctx.organization_id } }))) {
            throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        }
    }

    private rethrow(error: unknown, message: string): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message, code: 'conflict' });
        throw error;
    }
}
