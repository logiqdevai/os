import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { EmploymentStatus, ModuleKey, NumberResetPolicy, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { PeopleAccessService } from '../common/people-access.service';
import { EmployeeChecklistsService } from '../lifecycle/employee-checklists.service';
import { DIRECTORY_FIELDS, P, PERSONAL_FIELDS, SELF_SERVICE_FIELDS, dates, defined, personName, toDay, today, userSelect } from '../common/people.utils';
import {
    ChangePositionDto, CreateEmployeeDto, DecideChangeRequestDto, SetAvailabilityDto, StartOffboardingDto, UpdateEmployeeDto, UpdateOwnProfileDto,
} from './dto/employee.dto';
import { ChangeRequestQuery, DirectoryQuery, EmployeeQuery } from './dto/employee-query.schema';

const DATE_FIELDS = ['date_of_birth', 'hire_date', 'probation_end_date', 'contract_end_date', 'termination_date'];
const PROFICIENCY_ORDER = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

/** List row shape (HR table). */
const listInclude = {
    membership: { select: { id: true, status: true, user: { select: userSelect } } },
    department: { select: { id: true, name: true } },
    primary_branch: { select: { id: true, name: true } },
    manager: { select: { id: true, preferred_name: true, membership: { select: { user: { select: userSelect } } } } },
} satisfies Prisma.EmployeeInclude;

/**
 * 10 Employees — the HR record (1:1 with a Membership). Lists are narrowed to the caller's scope of
 * employees.employees.read; personal data, compensation, documents and HR notes are stripped per field (01 §60).
 */
@Injectable()
export class EmployeesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
        private readonly numbering: NumberingService,
        private readonly authorization: AuthorizationService,
        private readonly lifecycle: EmployeeChecklistsService,
    ) { }

    // ------------------------------------------------------------------ reads

    async findAll(ctx: OrgContext, query: EmployeeQuery) {
        const where: Prisma.EmployeeWhereInput = {
            organization_id: ctx.organization_id,
            ...this.access.readWhere(ctx, P.read),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status?.length && { employment_status: { in: query.status } }),
            ...(query.employment_type && { employment_type: query.employment_type }),
            ...(query.department_team_id && { department_team_id: query.department_team_id }),
            ...(query.branch_id && { primary_branch_id: query.branch_id }),
            ...(query.manager_employee_id && { manager_employee_id: query.manager_employee_id }),
            ...(query.availability && { availability_status: query.availability }),
            ...(query.work_location && { work_location: query.work_location }),
            ...(query.skill_id && {
                skills: {
                    some: {
                        skill_id: query.skill_id,
                        ...(query.min_proficiency && { proficiency: { in: PROFICIENCY_ORDER.slice(PROFICIENCY_ORDER.indexOf(query.min_proficiency)) as any } }),
                    },
                },
            }),
            ...(query.search && { AND: [this.searchWhere(query.search)] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employee.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['employee_number', 'job_title', 'hire_date', 'created_at', 'employment_status'], 'employee_number'),
                include: listInclude,
            }),
            this.prisma.employee.count({ where }),
        ]);
        return paginate(items.map((e) => this.access.present(ctx, this.withName(e))), total, query);
    }

    /** Company directory (employees.directory.read): only directory-visible fields of active, visible employees. */
    async directory(ctx: OrgContext, query: DirectoryQuery) {
        const settings = await this.access.settings(ctx.organization_id);
        const visible = settings.directory_visible_fields.length ? settings.directory_visible_fields.filter((f) => (DIRECTORY_FIELDS as readonly string[]).includes(f)) : [...DIRECTORY_FIELDS];
        const where: Prisma.EmployeeWhereInput = {
            organization_id: ctx.organization_id,
            archived_at: null,
            directory_visible: true,
            employment_status: { notIn: [EmploymentStatus.TERMINATED] },
            ...(query.department_team_id && { department_team_id: query.department_team_id }),
            ...(query.branch_id && { primary_branch_id: query.branch_id }),
            ...(query.availability && { availability_status: query.availability }),
            ...(query.skill_id && { skills: { some: { skill_id: query.skill_id } } }),
            ...(query.search && { AND: [this.searchWhere(query.search)] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employee.findMany({
                where,
                ...skipTake(query),
                orderBy: { preferred_name: 'asc' },
                include: {
                    membership: { select: { user: { select: userSelect } } },
                    department: { select: { id: true, name: true } },
                    primary_branch: { select: { id: true, name: true } },
                    skills: { where: { is_primary: true }, take: 4, include: { skill: { select: { id: true, name: true } } } },
                },
            }),
            this.prisma.employee.count({ where }),
        ]);
        const data = items.map((e) => {
            const card: Record<string, unknown> = {
                id: e.id,
                name: personName(e),
                photo_url: e.membership.user.profile_photo_url,
                department: e.department,
                primary_branch: e.primary_branch,
                manager_employee_id: e.manager_employee_id,
                skills: e.skills.map((s) => s.skill),
                is_me: this.access.isOwn(ctx, e),
            };
            for (const f of visible) card[f] = (e as any)[f];
            return card;
        });
        return paginate(data, total, query);
    }

    /** Org chart nodes (directory-level fields + status for the offboarding flag). The client builds the tree from manager_employee_id. */
    async orgChart(ctx: OrgContext) {
        const rows = await this.prisma.employee.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, employment_status: { not: EmploymentStatus.TERMINATED } },
            select: {
                id: true, preferred_name: true, legal_first_name: true, legal_last_name: true, job_title: true, manager_employee_id: true, availability_status: true,
                employment_status: true, employee_number: true,
                department: { select: { id: true, name: true } },
                primary_branch: { select: { id: true, name: true } },
                membership: { select: { id: true, user: { select: userSelect } } },
            },
            orderBy: { employee_number: 'asc' },
        });
        return rows.map((r) => ({
            id: r.id, name: personName(r), job_title: r.job_title, manager_employee_id: r.manager_employee_id, availability_status: r.availability_status,
            employment_status: r.employment_status, employee_number: r.employee_number, membership_id: r.membership.id, department: r.department, primary_branch: r.primary_branch, photo_url: r.membership.user.profile_photo_url, is_me: this.access.isOwn(ctx, { membership_id: r.membership.id }),
        }));
    }

    /** Members of the organization without an HR record (picker for "Add employee"). */
    async candidates(ctx: OrgContext, search?: string) {
        const rows = await this.prisma.membership.findMany({
            where: {
                organization_id: ctx.organization_id,
                status: { in: ['ACTIVE', 'INVITED'] },
                employee: null,
                ...(search && { user: { OR: [{ email: { contains: search, mode: 'insensitive' } }, { first_name: { contains: search, mode: 'insensitive' } }, { last_name: { contains: search, mode: 'insensitive' } }, { display_name: { contains: search, mode: 'insensitive' } }] } }),
            },
            select: { id: true, status: true, job_title: true, default_branch_id: true, default_team_id: true, user: { select: userSelect } },
            take: 50,
            orderBy: { created_at: 'asc' },
        });
        return rows;
    }

    async findOne(ctx: OrgContext, id: string) {
        const base = await this.access.employeeOrThrow(ctx, id, P.read, P.directoryRead);
        const own = this.access.isOwn(ctx, base);
        // A directory-only caller (not HR, not themselves) gets the directory card, not the HR record.
        if (!own && !this.access.scopeWhere(ctx, P.read)) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (!own) {
            const inScope = await this.prisma.employee.count({ where: { id, ...this.access.scopeWhere(ctx, P.read) } });
            if (!inScope) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        }
        const canPersonal = own || ctx.can(P.personalRead);
        const employee = await this.prisma.employee.findUniqueOrThrow({
            where: { id },
            include: {
                ...listInclude,
                direct_reports: { where: { archived_at: null }, select: { id: true, preferred_name: true, job_title: true, membership: { select: { user: { select: userSelect } } } } },
                positions: { orderBy: { effective_from: 'desc' }, include: { department: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, manager: { select: { id: true, preferred_name: true, membership: { select: { user: { select: userSelect } } } } } } },
                languages: { orderBy: { is_primary: 'desc' } },
                work_schedules: { orderBy: { effective_from: 'desc' }, take: 1, include: { days: { orderBy: { weekday: 'asc' } } } },
                ...(canPersonal && { emergency_contacts: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] } }),
                ...(ctx.can(P.compRead) && { compensations: { orderBy: { effective_from: 'desc' }, include: { components: { orderBy: { sort_order: 'asc' } } } } }),
                ...((ctx.can(P.docsRead) || own) && { documents: { orderBy: { created_at: 'desc' } } }),
                ...(ctx.can(P.notesRead) && {
                    hr_notes: { where: { deleted_at: null }, orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }], include: { author: { select: { id: true, user: { select: userSelect } } } } },
                }),
                ...((ctx.can(P.equipmentRead) || own) && { equipment: { orderBy: { assigned_on: 'desc' } } }),
            },
        });
        const result = this.access.present(ctx, {
            ...this.withName(employee),
            direct_reports: employee.direct_reports.map((r) => ({ id: r.id, name: personName(r), job_title: r.job_title, photo_url: r.membership.user.profile_photo_url })),
        });
        if (canPersonal && ctx.can(P.personalRead) && !own) {
            this.audit.recordAsync(ctx, 'employee.sensitive_field_read', { resource_type: 'employee', resource_id: id, metadata: { fields: ['personal_data'] } });
        }
        return result;
    }

    async me(ctx: OrgContext) {
        const me = await this.access.meOrThrow(ctx);
        return this.findOne(ctx, me.id);
    }

    // ------------------------------------------------------------------ writes

    async create(ctx: OrgContext, dto: CreateEmployeeDto) {
        if (!dto.membership_id && !dto.new_hire) throw new BadRequestException({ message: 'Pick an existing member or enter the new hire', code: 'employee_member_required' });
        this.assertFieldPermissions(ctx, dto);
        await this.assertRefs(ctx, dto);
        const { membership_id, new_hire, employee_number, ...fields } = dto;

        const employee = await this.prisma.$transaction(async (tx) => {
            let membershipId = membership_id;
            if (membershipId) {
                const membership = await tx.membership.findFirst({ where: { id: membershipId, organization_id: ctx.organization_id }, include: { employee: { select: { id: true } } } });
                if (!membership) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
                if (membership.employee) throw new ConflictException({ message: 'This member already has an employee record', code: 'employee_exists' });
            } else {
                membershipId = await this.createPendingMember(tx, ctx, new_hire);
            }
            const number = employee_number || (await this.numbering.next(tx, ctx.organization_id, 'employee', { prefix: 'EMP', reset_policy: NumberResetPolicy.NEVER }));
            const created = await tx.employee.create({
                data: {
                    ...(dates(fields, DATE_FIELDS) as any),
                    organization_id: ctx.organization_id,
                    membership_id: membershipId,
                    employee_number: number,
                    work_email: fields.work_email ?? new_hire?.email ?? undefined,
                    legal_first_name: fields.legal_first_name ?? new_hire?.first_name,
                    legal_last_name: fields.legal_last_name ?? new_hire?.last_name,
                    employment_status_since: today(),
                    created_by_user_id: ctx.user_id,
                },
            });
            await tx.employeePosition.create({
                data: {
                    employee_id: created.id,
                    job_title: created.job_title ?? 'Employee',
                    position: created.position,
                    role: created.role,
                    seniority_level: created.seniority_level,
                    employment_type: created.employment_type,
                    department_team_id: created.department_team_id,
                    branch_id: created.primary_branch_id,
                    manager_employee_id: created.manager_employee_id,
                    effective_from: created.hire_date ?? today(),
                    reason: 'HIRE',
                    created_by_user_id: ctx.user_id,
                },
            });
            if (created.job_title) await tx.membership.update({ where: { id: membershipId }, data: { job_title: created.job_title } });
            await this.audit.record(ctx, 'employee.created', { resource_type: 'employee', resource_id: created.id, branch_id: created.primary_branch_id, metadata: { membership_id: membershipId, after: this.auditSafe(dto) } }, tx);
            return created;
        }).catch((e) => this.rethrow(e));

        const manager = employee.manager_employee_id ? await this.prisma.employee.findUnique({ where: { id: employee.manager_employee_id }, select: { membership_id: true } }) : null;
        this.events.publish(ctx, {
            event_key: 'employees.employee.created', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: employee.id,
            payload: { employee_number: employee.employee_number, owner_membership_id: employee.membership_id, manager_membership_id: manager?.membership_id ?? null, employment_status: employee.employment_status },
            activity: { summary: `Added employee ${employee.employee_number}`, entity_label: employee.preferred_name ?? employee.employee_number, branch_id: employee.primary_branch_id },
        });
        // 15 checklists: start the matching onboarding checklists for a new hire (never blocks the create).
        if (employee.employment_status === EmploymentStatus.ONBOARDING) void this.lifecycle.autoStart(ctx, employee, 'ONBOARDING');
        return this.findOne(ctx, employee.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateEmployeeDto) {
        const before = await this.access.employeeOrThrow(ctx, id, P.update);
        this.assertFieldPermissions(ctx, dto);
        await this.assertRefs(ctx, dto, id);
        const data = dates(defined(dto as Record<string, unknown>), DATE_FIELDS) as Prisma.EmployeeUncheckedUpdateInput;
        if (dto.employment_status && dto.employment_status !== before.employment_status) data.employment_status_since = today();
        const updated = await this.prisma.employee.update({ where: { id }, data }).catch((e) => this.rethrow(e));
        if (dto.job_title && dto.job_title !== before.job_title) await this.prisma.membership.update({ where: { id: before.membership_id }, data: { job_title: dto.job_title } });
        await this.audit.record(ctx, 'employee.updated', { resource_type: 'employee', resource_id: id, branch_id: updated.primary_branch_id, metadata: { before: this.pick(before, Object.keys(dto)), after: this.auditSafe(dto) } });
        this.events.publish(ctx, {
            event_key: 'employees.employee.updated', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id,
            payload: { owner_membership_id: updated.membership_id, fields: Object.keys(dto) }, changes: this.auditSafe(dto),
        });
        if (dto.employment_status && dto.employment_status !== before.employment_status) {
            this.events.publish(ctx, { event_key: 'employees.employee.status_changed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id, payload: { from: before.employment_status, to: dto.employment_status, owner_membership_id: updated.membership_id } });
        }
        return this.findOne(ctx, id);
    }

    /**
     * Self-service profile edit (employees.profile.update_own). Fields are limited to the self-service list; when
     * EmployeeHrSettings.profile_changes_require_approval is on, a change request is created for HR instead.
     */
    async updateOwn(ctx: OrgContext, dto: UpdateOwnProfileDto) {
        const me = await this.access.meOrThrow(ctx);
        const settings = await this.access.settings(ctx.organization_id);
        const allowed = settings.self_service_editable_fields.length ? settings.self_service_editable_fields : [...SELF_SERVICE_FIELDS];
        const { employee_note, ...changes } = dto;
        const fields = Object.keys(defined(changes));
        const refused = fields.filter((f) => !allowed.includes(f));
        if (refused.length) throw new ForbiddenException({ message: `You cannot change: ${refused.join(', ')}`, code: 'self_service_field_not_allowed', fields: refused });
        if (!fields.length) throw new BadRequestException({ message: 'Nothing to change', code: 'no_changes' });
        const diff: Record<string, { from: unknown; to: unknown }> = {};
        for (const f of fields) diff[f] = { from: (me as any)[f] ?? null, to: (changes as any)[f] };

        if (settings.profile_changes_require_approval) {
            const request = await this.prisma.employeeProfileChangeRequest.create({
                data: { organization_id: ctx.organization_id, employee_id: me.id, changes: diff as Prisma.InputJsonValue, employee_note, submitted_by_user_id: ctx.user_id },
            });
            await this.audit.record(ctx, 'employee_change_request.submitted', { resource_type: 'employee', resource_id: me.id, metadata: { request_id: request.id, fields } });
            this.events.publish(ctx, {
                event_key: 'employees.change_request.submitted', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_change_request', entity_id: request.id,
                payload: { employee_id: me.id, owner_membership_id: me.membership_id, fields },
                activity: { summary: 'Requested a profile change', entity_label: personName(me as any) },
            });
            return { applied: false, change_request: request };
        }
        await this.prisma.employee.update({ where: { id: me.id }, data: defined(changes) as Prisma.EmployeeUpdateInput });
        await this.audit.record(ctx, 'employee.updated', { resource_type: 'employee', resource_id: me.id, metadata: { self_service: true, after: { fields } } });
        this.events.publish(ctx, { event_key: 'employees.employee.updated', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: me.id, payload: { owner_membership_id: me.membership_id, fields, self_service: true } });
        return { applied: true, employee: await this.findOne(ctx, me.id) };
    }

    async archive(ctx: OrgContext, id: string) {
        const e = await this.access.employeeOrThrow(ctx, id, P.archive);
        const updated = await this.prisma.employee.update({ where: { id }, data: { archived_at: new Date() } });
        await this.audit.record(ctx, 'employee.archived', { resource_type: 'employee', resource_id: id, branch_id: e.primary_branch_id });
        this.events.publish(ctx, { event_key: 'employees.employee.archived', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id, payload: { owner_membership_id: e.membership_id } });
        return updated;
    }

    async restore(ctx: OrgContext, id: string) {
        await this.access.employeeOrThrow(ctx, id, P.archive);
        const updated = await this.prisma.employee.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'employee.restored', { resource_type: 'employee', resource_id: id });
        return updated;
    }

    async remove(ctx: OrgContext, id: string) {
        const e = await this.access.employeeOrThrow(ctx, id, P.delete);
        await this.prisma.employee.delete({ where: { id } });
        await this.audit.record(ctx, 'employee.deleted', { resource_type: 'employee', resource_id: id, metadata: { employee_number: e.employee_number } });
        this.events.publish(ctx, { event_key: 'employees.employee.deleted', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id, payload: { employee_number: e.employee_number } });
        return { success: true };
    }

    /** Effective-dated position change: closes the open EmployeePosition, opens a new one and mirrors it onto Employee. */
    async changePosition(ctx: OrgContext, id: string, dto: ChangePositionDto) {
        const e = await this.access.employeeOrThrow(ctx, id, P.update);
        await this.assertRefs(ctx, { department_team_id: dto.department_team_id, primary_branch_id: dto.branch_id, manager_employee_id: dto.manager_employee_id ?? undefined }, id);
        const from = toDay(dto.effective_from);
        const position = await this.prisma.$transaction(async (tx) => {
            await tx.employeePosition.updateMany({ where: { employee_id: id, effective_to: null }, data: { effective_to: new Date(from.getTime() - 86_400_000) } });
            const p = await tx.employeePosition.create({
                data: {
                    employee_id: id, job_title: dto.job_title, position: dto.position, role: dto.role, seniority_level: dto.seniority_level ?? e.seniority_level,
                    employment_type: dto.employment_type ?? e.employment_type, department_team_id: dto.department_team_id ?? e.department_team_id,
                    branch_id: dto.branch_id ?? e.primary_branch_id, manager_employee_id: dto.manager_employee_id === undefined ? e.manager_employee_id : dto.manager_employee_id,
                    effective_from: from, reason: dto.reason ?? 'OTHER', note: dto.note, created_by_user_id: ctx.user_id,
                },
            });
            if (from <= today()) {
                await tx.employee.update({
                    where: { id },
                    data: {
                        job_title: p.job_title, position: p.position, role: p.role, seniority_level: p.seniority_level, employment_type: p.employment_type,
                        department_team_id: p.department_team_id, primary_branch_id: p.branch_id, manager_employee_id: p.manager_employee_id,
                    },
                });
                await tx.membership.update({ where: { id: e.membership_id }, data: { job_title: p.job_title } });
            }
            return p;
        });
        await this.audit.record(ctx, 'employee.position_changed', {
            resource_type: 'employee', resource_id: id, branch_id: position.branch_id,
            metadata: { before: { job_title: e.job_title, manager_employee_id: e.manager_employee_id, department_team_id: e.department_team_id }, after: dto },
        });
        this.events.publish(ctx, {
            event_key: 'employees.employee.position_changed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id,
            payload: { owner_membership_id: e.membership_id, reason: position.reason, job_title: position.job_title },
            activity: { summary: `Position changed to ${position.job_title}`, entity_label: personName(e as any) },
        });
        return position;
    }

    async completeOnboarding(ctx: OrgContext, id: string) {
        const e = await this.access.employeeOrThrow(ctx, id, P.update);
        if (e.employment_status !== EmploymentStatus.ONBOARDING) throw new ConflictException({ message: 'Employee is not onboarding', code: 'employee_not_onboarding' });
        const updated = await this.prisma.employee.update({ where: { id }, data: { employment_status: 'ACTIVE', employment_status_since: today(), onboarding_completed_at: new Date() } });
        await this.audit.record(ctx, 'employee.onboarding_completed', { resource_type: 'employee', resource_id: id });
        this.events.publish(ctx, { event_key: 'employees.employee.onboarding_completed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id, payload: { owner_membership_id: e.membership_id } });
        return updated;
    }

    async startOffboarding(ctx: OrgContext, id: string, dto: StartOffboardingDto) {
        const e = await this.access.employeeOrThrow(ctx, id, P.offboard);
        if (e.employment_status === EmploymentStatus.TERMINATED) throw new ConflictException({ message: 'Employee is already terminated', code: 'employee_terminated' });
        const date = toDay(dto.termination_date);
        if (date < today() && !dto.termination_reason) throw new BadRequestException({ message: 'A termination date in the past needs a reason', code: 'termination_reason_required' });
        const updated = await this.prisma.employee.update({
            where: { id },
            data: { employment_status: 'OFFBOARDING', employment_status_since: today(), termination_date: date, termination_kind: dto.termination_kind, termination_reason: dto.termination_reason, rehire_eligible: dto.rehire_eligible },
        });
        await this.audit.record(ctx, 'employee.offboarding_started', { resource_type: 'employee', resource_id: id, metadata: { after: dto } });
        this.events.publish(ctx, {
            event_key: 'employees.employee.offboarding_started', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id,
            payload: { owner_membership_id: e.membership_id, termination_date: dto.termination_date, termination_kind: dto.termination_kind },
        });
        void this.lifecycle.autoStart(ctx, updated, 'OFFBOARDING');
        return updated;
    }

    /** Completes offboarding: TERMINATED, open position and compensation closed, future pending/approved leave cancelled, open equipment listed. */
    async completeOffboarding(ctx: OrgContext, id: string) {
        const e = await this.access.employeeOrThrow(ctx, id, P.offboard);
        if (e.employment_status !== EmploymentStatus.OFFBOARDING) throw new ConflictException({ message: 'Start offboarding first', code: 'employee_not_offboarding' });
        const end = e.termination_date ?? today();
        const openEquipment = await this.prisma.employeeEquipment.count({ where: { employee_id: id, returned_on: null } });
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.employeePosition.updateMany({ where: { employee_id: id, effective_to: null }, data: { effective_to: end } });
            await tx.employeeCompensation.updateMany({ where: { employee_id: id, effective_to: null }, data: { effective_to: end } });
            await tx.leaveRequest.updateMany({ where: { employee_id: id, status: { in: ['PENDING', 'DRAFT'] }, start_date: { gt: end } }, data: { status: 'CANCELLED', cancelled_at: new Date(), cancellation_reason: 'Employee offboarded' } });
            return tx.employee.update({ where: { id }, data: { employment_status: 'TERMINATED', employment_status_since: today(), offboarding_completed_at: new Date(), directory_visible: false, availability_status: 'AVAILABLE' } });
        });
        await this.audit.record(ctx, 'employee.offboarding_completed', { resource_type: 'employee', resource_id: id, metadata: { open_equipment: openEquipment } });
        this.events.publish(ctx, {
            event_key: 'employees.employee.terminated', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id,
            payload: { owner_membership_id: e.membership_id, termination_date: end.toISOString().slice(0, 10), open_equipment: openEquipment },
            activity: { summary: 'Offboarding completed', entity_label: personName(e as any) },
        });
        return { ...updated, open_equipment: openEquipment };
    }

    /** Availability status (own: employees.profile.update_own; others: employees.availability.manage). */
    async setAvailability(ctx: OrgContext, id: string, dto: SetAvailabilityDto) {
        const e = await this.prisma.employee.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        const own = this.access.isOwn(ctx, e);
        if (!own && !this.access.scopeWhere(ctx, P.availability)) throw new ForbiddenException({ message: 'You cannot change this person’s availability', code: 'forbidden' });
        if (own && !ctx.can(P.profileOwn) && !ctx.can(P.availability)) throw new ForbiddenException({ message: 'You cannot change your availability', code: 'forbidden' });
        let entry = null;
        if (dto.starts_at && dto.ends_at) {
            if (new Date(dto.ends_at) < new Date(dto.starts_at)) throw new BadRequestException({ message: 'End must be after start', code: 'invalid_range' });
            entry = await this.prisma.employeeAvailabilityEntry.create({
                data: { organization_id: ctx.organization_id, employee_id: id, status: dto.status, starts_at: new Date(dto.starts_at), ends_at: new Date(dto.ends_at), all_day: dto.all_day ?? true, note: dto.note, created_by_user_id: ctx.user_id },
            });
        }
        const now = new Date();
        const current = !entry || (entry.starts_at <= now && entry.ends_at >= now);
        if (current) await this.prisma.employee.update({ where: { id }, data: { availability_status: dto.status, availability_note: dto.note ?? null, availability_updated_at: now } });
        await this.audit.record(ctx, 'employee.availability_changed', { resource_type: 'employee', resource_id: id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.availability.changed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: id, payload: { status: dto.status, owner_membership_id: e.membership_id } });
        return { entry, availability_status: current ? dto.status : e.availability_status };
    }

    // ------------------------------------------------------------------ change requests (self-service approvals)

    async listChangeRequests(ctx: OrgContext, query: ChangeRequestQuery) {
        const scope = this.access.scopeWhere(ctx, P.update);
        const where: Prisma.EmployeeProfileChangeRequestWhereInput = {
            organization_id: ctx.organization_id,
            ...(scope ? { employee: scope } : { employee: { membership_id: ctx.membership_id ?? '__none__' } }),
            ...(query.status && { status: query.status }),
            ...(query.employee_id && { employee_id: query.employee_id }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employeeProfileChangeRequest.findMany({
                where, ...skipTake(query), orderBy: { created_at: 'desc' },
                include: { employee: { select: { id: true, employee_number: true, preferred_name: true, membership_id: true, membership: { select: { user: { select: userSelect } } } } } },
            }),
            this.prisma.employeeProfileChangeRequest.count({ where }),
        ]);
        return paginate(items.map((r) => {
            const own = !!ctx.membership_id && r.employee.membership_id === ctx.membership_id;
            // Personal values stay masked for callers without the field key (01 §60); the field names are always shown.
            const changes = ctx.can(P.personalRead) || own ? r.changes : this.maskChanges(r.changes as Record<string, { from: unknown; to: unknown }>);
            return { ...r, changes, is_mine: own, employee: { ...r.employee, name: personName(r.employee) } };
        }), total, query);
    }

    async decideChangeRequest(ctx: OrgContext, requestId: string, approve: boolean, dto: DecideChangeRequestDto) {
        const request = await this.prisma.employeeProfileChangeRequest.findFirst({ where: { id: requestId, organization_id: ctx.organization_id } });
        if (!request) throw new NotFoundException({ message: 'Change request not found', code: 'change_request_not_found' });
        const employee = await this.access.employeeOrThrow(ctx, request.employee_id, P.update);
        if (request.status !== 'PENDING') throw new ConflictException({ message: `Request is already ${request.status.toLowerCase()}`, code: 'change_request_decided', status: request.status });
        if (this.access.isOwn(ctx, employee)) throw new ForbiddenException({ message: 'You cannot decide your own change request', code: 'self_decision' });
        const changes = request.changes as Record<string, { from: unknown; to: unknown }>;
        const result = await this.prisma.$transaction(async (tx) => {
            if (approve) {
                const data: Record<string, unknown> = {};
                for (const [field, v] of Object.entries(changes)) data[field] = v.to;
                await tx.employee.update({ where: { id: employee.id }, data: data as Prisma.EmployeeUpdateInput });
            }
            return tx.employeeProfileChangeRequest.update({
                where: { id: requestId },
                data: { status: approve ? 'APPROVED' : 'REJECTED', decided_by_membership_id: ctx.membership_id, decided_at: new Date(), decision_note: dto.decision_note },
            });
        });
        await this.audit.record(ctx, approve ? 'employee_change_request.approved' : 'employee_change_request.rejected', { resource_type: 'employee', resource_id: employee.id, metadata: { request_id: requestId, fields: Object.keys(changes) } });
        this.events.publish(ctx, {
            event_key: approve ? 'employees.change_request.approved' : 'employees.change_request.rejected', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_change_request', entity_id: requestId,
            payload: { employee_id: employee.id, owner_membership_id: employee.membership_id },
        });
        return result;
    }

    async cancelOwnChangeRequest(ctx: OrgContext, requestId: string) {
        const me = await this.access.meOrThrow(ctx);
        const request = await this.prisma.employeeProfileChangeRequest.findFirst({ where: { id: requestId, employee_id: me.id } });
        if (!request) throw new NotFoundException({ message: 'Change request not found', code: 'change_request_not_found' });
        if (request.status !== 'PENDING') throw new ConflictException({ message: 'Only pending requests can be cancelled', code: 'change_request_decided' });
        const updated = await this.prisma.employeeProfileChangeRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
        await this.audit.record(ctx, 'employee_change_request.cancelled', { resource_type: 'employee', resource_id: me.id, metadata: { request_id: requestId } });
        return updated;
    }

    // ------------------------------------------------------------------ export

    async exportCsv(ctx: OrgContext, query: EmployeeQuery) {
        const page = await this.findAll(ctx, { ...query, page: 1, limit: 200 });
        const rows = [['employee_number', 'name', 'email', 'job_title', 'department', 'branch', 'manager', 'status', 'type', 'location', 'hire_date']];
        for (const e of page.data as any[]) {
            rows.push([
                e.employee_number, e.name, e.work_email ?? e.membership?.user?.email ?? '', e.job_title ?? '', e.department?.name ?? '', e.primary_branch?.name ?? '',
                e.manager ? personName(e.manager) : '', e.employment_status, e.employment_type, e.work_location, e.hire_date ? new Date(e.hire_date).toISOString().slice(0, 10) : '',
            ]);
        }
        await this.audit.record(ctx, 'employee.exported', { resource_type: 'employee', metadata: { format: 'csv', rows: rows.length - 1, filter: query } });
        return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    // ------------------------------------------------------------------ helpers

    private searchWhere(search: string): Prisma.EmployeeWhereInput {
        const s = { contains: search, mode: 'insensitive' as const };
        return {
            OR: [
                { employee_number: s }, { preferred_name: s }, { legal_first_name: s }, { legal_last_name: s }, { job_title: s }, { work_email: s },
                { membership: { user: { OR: [{ email: s }, { first_name: s }, { last_name: s }, { display_name: s }] } } },
            ],
        };
    }

    private withName<T extends Record<string, any>>(e: T) {
        return { ...e, name: personName(e as any), photo_url: e.membership?.user?.profile_photo_url ?? null, manager: e.manager ? { ...e.manager, name: personName(e.manager) } : e.manager };
    }

    /** Personal fields need employees.personal_data.manage. */
    private assertFieldPermissions(ctx: OrgContext, dto: Record<string, any>) {
        const personal = PERSONAL_FIELDS.filter((f) => dto[f] !== undefined && !['legal_first_name', 'legal_last_name'].includes(f));
        if (personal.length && !ctx.can(P.personalManage)) {
            throw new ForbiddenException({ message: `You cannot set personal data: ${personal.join(', ')}`, code: 'personal_data_forbidden', fields: personal });
        }
    }

    private async assertRefs(ctx: OrgContext, dto: { department_team_id?: string; primary_branch_id?: string; manager_employee_id?: string }, selfId?: string) {
        const org = ctx.organization_id;
        if (dto.department_team_id && !(await this.prisma.team.count({ where: { id: dto.department_team_id, organization_id: org } }))) throw new NotFoundException({ message: 'Department not found', code: 'department_not_found' });
        if (dto.primary_branch_id && !(await this.prisma.branch.count({ where: { id: dto.primary_branch_id, organization_id: org } }))) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        if (dto.manager_employee_id) {
            if (dto.manager_employee_id === selfId) throw new ConflictException({ message: 'An employee cannot report to themselves', code: 'reporting_cycle' });
            const manager = await this.prisma.employee.findFirst({ where: { id: dto.manager_employee_id, organization_id: org } });
            if (!manager) throw new NotFoundException({ message: 'Manager not found', code: 'manager_not_found' });
            if (selfId) {
                // Walk up from the new manager: reaching selfId would create a cycle.
                let cursor = manager.manager_employee_id;
                for (let i = 0; cursor && i < 50; i++) {
                    if (cursor === selfId) throw new ConflictException({ message: 'This reporting line would create a cycle', code: 'reporting_cycle' });
                    cursor = (await this.prisma.employee.findUnique({ where: { id: cursor }, select: { manager_employee_id: true } }))?.manager_employee_id;
                }
            }
        }
    }

    /** New hire who is not a member yet: a pending User + Membership (INVITED). The admin sends the invitation from 01. */
    private async createPendingMember(tx: Prisma.TransactionClient, ctx: OrgContext, hire: { email: string; first_name: string; last_name: string }) {
        const email = hire.email.trim().toLowerCase();
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
            user = await tx.user.create({
                data: { email, first_name: hire.first_name, last_name: hire.last_name, status: 'INVITED', password: await bcrypt.hash(randomBytes(24).toString('hex'), 10) },
            });
        }
        const existing = await tx.membership.findUnique({ where: { user_id_organization_id: { user_id: user.id, organization_id: ctx.organization_id } }, include: { employee: { select: { id: true } } } });
        if (existing?.employee) throw new ConflictException({ message: 'This person already has an employee record', code: 'employee_exists' });
        const membership = existing ?? (await tx.membership.create({ data: { user_id: user.id, organization_id: ctx.organization_id, status: 'INVITED', type: 'INTERNAL', provisioning_source: 'MANUAL', invited_by_user_id: ctx.user_id } }));
        await this.audit.record(ctx, 'membership.created', { resource_type: 'membership', resource_id: membership.id, metadata: { source: 'employee_new_hire', email } }, tx);
        setImmediate(() => this.authorization.invalidate(ctx.organization_id).catch(() => undefined));
        return membership.id;
    }

    private maskChanges(changes: Record<string, { from: unknown; to: unknown }>) {
        const out: Record<string, { from: unknown; to: unknown; masked?: boolean }> = {};
        for (const [k, v] of Object.entries(changes)) out[k] = (PERSONAL_FIELDS as readonly string[]).includes(k) ? { from: null, to: null, masked: true } : v;
        return out;
    }

    private auditSafe(dto: Record<string, any>) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(dto)) out[k] = (PERSONAL_FIELDS as readonly string[]).includes(k) ? '[masked]' : v;
        return out;
    }

    private pick(obj: Record<string, any>, keys: string[]) {
        const out: Record<string, unknown> = {};
        for (const k of keys) out[k] = (PERSONAL_FIELDS as readonly string[]).includes(k) ? '[masked]' : obj[k];
        return out;
    }

    private rethrow(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'Employee number or member is already used', code: 'employee_conflict' });
        }
        throw error;
    }
}
