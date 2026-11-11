import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { PeopleAccessService } from '../common/people-access.service';
import { P, addDays, dates, defined, num, round2, toDay, today, userSelect } from '../common/people.utils';
import {
    CompensationDto, EmergencyContactDto, EmployeeDocumentDto, EquipmentDto, HrNoteDto, LanguageDto, UpdateEmergencyContactDto, UpdateEmployeeDocumentDto,
    UpdateEquipmentDto, UpdateHrNoteDto, WorkScheduleDto,
} from './dto/employee-records.dto';

/**
 * Sub-records of an employee: emergency contacts and languages (personal data), compensation (field-level),
 * equipment, HR documents, HR notes and the work schedule. Each section has its own read/manage key.
 */
@Injectable()
export class EmployeeRecordsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
    ) { }

    private log(ctx: OrgContext, type: string, employeeId: string, metadata?: Record<string, unknown>) {
        return this.audit.record(ctx, type, { resource_type: 'employee', resource_id: employeeId, metadata });
    }

    /** Own record or the HR key (scope-checked). */
    private async target(ctx: OrgContext, employeeId: string, key: string, allowOwn = false) {
        const e = await this.prisma.employee.findFirst({ where: { id: employeeId, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (allowOwn && this.access.isOwn(ctx, e)) return e;
        const scope = this.access.scopeWhere(ctx, key);
        if (!scope || !(await this.prisma.employee.count({ where: { id: employeeId, ...scope } }))) {
            throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        }
        return e;
    }

    // ------------------------------------------------------------ emergency contacts (personal data)

    async listContacts(ctx: OrgContext, employeeId: string) {
        await this.target(ctx, employeeId, P.personalRead, true);
        return this.prisma.employeeEmergencyContact.findMany({ where: { employee_id: employeeId }, orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] });
    }

    async addContact(ctx: OrgContext, employeeId: string, dto: EmergencyContactDto) {
        const e = await this.target(ctx, employeeId, P.personalManage, ctx.can(P.profileOwn));
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_primary) await tx.employeeEmergencyContact.updateMany({ where: { employee_id: e.id }, data: { is_primary: false } });
            return tx.employeeEmergencyContact.create({ data: { ...dto, employee_id: e.id } });
        });
        await this.log(ctx, 'employee.emergency_contact_added', e.id, { contact_id: row.id });
        return row;
    }

    async updateContact(ctx: OrgContext, employeeId: string, contactId: string, dto: UpdateEmergencyContactDto) {
        const e = await this.target(ctx, employeeId, P.personalManage, ctx.can(P.profileOwn));
        await this.own(this.prisma.employeeEmergencyContact.findFirst({ where: { id: contactId, employee_id: e.id } }), 'Contact');
        const row = await this.prisma.$transaction(async (tx) => {
            if (dto.is_primary) await tx.employeeEmergencyContact.updateMany({ where: { employee_id: e.id, id: { not: contactId } }, data: { is_primary: false } });
            return tx.employeeEmergencyContact.update({ where: { id: contactId }, data: defined(dto) });
        });
        await this.log(ctx, 'employee.emergency_contact_updated', e.id, { contact_id: contactId });
        return row;
    }

    async removeContact(ctx: OrgContext, employeeId: string, contactId: string) {
        const e = await this.target(ctx, employeeId, P.personalManage, ctx.can(P.profileOwn));
        await this.own(this.prisma.employeeEmergencyContact.findFirst({ where: { id: contactId, employee_id: e.id } }), 'Contact');
        await this.prisma.employeeEmergencyContact.delete({ where: { id: contactId } });
        await this.log(ctx, 'employee.emergency_contact_removed', e.id, { contact_id: contactId });
        return { success: true };
    }

    // ------------------------------------------------------------ languages (profile)

    async addLanguage(ctx: OrgContext, employeeId: string, dto: LanguageDto) {
        const e = await this.target(ctx, employeeId, P.update, ctx.can(P.profileOwn));
        const row = await this.prisma.employeeLanguage.upsert({
            where: { employee_id_language: { employee_id: e.id, language: dto.language } },
            update: { proficiency: dto.proficiency, is_primary: dto.is_primary },
            create: { employee_id: e.id, language: dto.language, proficiency: dto.proficiency, is_primary: dto.is_primary ?? false },
        });
        await this.log(ctx, 'employee.language_set', e.id, { language: dto.language });
        return row;
    }

    async removeLanguage(ctx: OrgContext, employeeId: string, languageId: string) {
        const e = await this.target(ctx, employeeId, P.update, ctx.can(P.profileOwn));
        await this.own(this.prisma.employeeLanguage.findFirst({ where: { id: languageId, employee_id: e.id } }), 'Language');
        await this.prisma.employeeLanguage.delete({ where: { id: languageId } });
        await this.log(ctx, 'employee.language_removed', e.id, { language_id: languageId });
        return { success: true };
    }

    // ------------------------------------------------------------ compensation (field-level, sensitive)

    async listCompensation(ctx: OrgContext, employeeId: string) {
        await this.target(ctx, employeeId, P.compRead);
        const rows = await this.prisma.employeeCompensation.findMany({ where: { employee_id: employeeId }, orderBy: { effective_from: 'desc' }, include: { components: { orderBy: { sort_order: 'asc' } } } });
        this.audit.recordAsync(ctx, 'employee.sensitive_field_read', { resource_type: 'employee', resource_id: employeeId, metadata: { fields: ['compensation'] } });
        return rows;
    }

    /** New effective-dated record: the open one is closed the day before. Totals and the hourly cost rate are derived when omitted. */
    async addCompensation(ctx: OrgContext, employeeId: string, dto: CompensationDto) {
        const e = await this.target(ctx, employeeId, P.compManage);
        const from = toDay(dto.effective_from);
        const { components = [], ...fields } = dto;
        const monthlyBase = dto.pay_type === 'MONTHLY_SALARY' ? dto.base_amount : dto.pay_type === 'HOURLY' ? dto.base_amount * num(dto.contracted_weekly_hours ?? 40) * 52 / 12 : dto.base_amount;
        const componentCost = components.filter((c) => !c.paid_to_employee).reduce((s, c) => s + (c.amount ?? (c.percent_of_base ? monthlyBase * c.percent_of_base / 100 : 0)), 0);
        const employerCost = dto.employer_cost_monthly ?? round2(componentCost);
        const total = round2(monthlyBase + employerCost);
        const hoursPerMonth = num(dto.contracted_weekly_hours ?? e.weekly_capacity_hours ?? 40) * 52 / 12;
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.employeeCompensation.updateMany({ where: { employee_id: e.id, effective_to: null, effective_from: { lt: from } }, data: { effective_to: addDays(from, -1) } });
            return tx.employeeCompensation.create({
                data: {
                    ...fields,
                    employee_id: e.id,
                    effective_from: from,
                    employer_cost_monthly: employerCost,
                    total_cost_monthly: total,
                    cost_rate_hourly: dto.cost_rate_hourly ?? (hoursPerMonth ? round2(total / hoursPerMonth) : null),
                    approved_by_membership_id: ctx.membership_id,
                    approved_at: new Date(),
                    created_by_user_id: ctx.user_id,
                    components: { create: components.map((c, i) => ({ ...c, sort_order: i })) },
                },
                include: { components: true },
            });
        });
        await this.log(ctx, 'employee.compensation_created', e.id, { compensation_id: row.id, effective_from: dto.effective_from });
        this.events.publish(ctx, { event_key: 'employees.compensation.changed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: e.id, payload: { compensation_id: row.id, effective_from: dto.effective_from } });
        return row;
    }

    // ------------------------------------------------------------ equipment

    async listEquipment(ctx: OrgContext, employeeId: string) {
        await this.target(ctx, employeeId, P.equipmentRead, true);
        return this.prisma.employeeEquipment.findMany({ where: { employee_id: employeeId }, orderBy: [{ returned_on: { sort: 'asc', nulls: 'first' } }, { assigned_on: 'desc' }] });
    }

    async addEquipment(ctx: OrgContext, employeeId: string, dto: EquipmentDto) {
        const e = await this.target(ctx, employeeId, P.equipmentManage);
        const row = await this.prisma.employeeEquipment.create({
            data: { ...(dates(dto, ['assigned_on', 'expected_return_on']) as any), organization_id: ctx.organization_id, employee_id: e.id, assigned_by_user_id: ctx.user_id },
        });
        await this.log(ctx, 'employee.equipment_assigned', e.id, { equipment_id: row.id, name: row.name });
        this.events.publish(ctx, { event_key: 'employees.equipment.assigned', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_equipment', entity_id: row.id, payload: { employee_id: e.id, owner_membership_id: e.membership_id, name: row.name } });
        return row;
    }

    async updateEquipment(ctx: OrgContext, employeeId: string, equipmentId: string, dto: UpdateEquipmentDto) {
        const e = await this.target(ctx, employeeId, P.equipmentManage);
        await this.own(this.prisma.employeeEquipment.findFirst({ where: { id: equipmentId, employee_id: e.id } }), 'Equipment');
        const row = await this.prisma.employeeEquipment.update({ where: { id: equipmentId }, data: dates(defined(dto), ['assigned_on', 'expected_return_on', 'returned_on']) as any });
        await this.log(ctx, dto.returned_on ? 'employee.equipment_returned' : 'employee.equipment_updated', e.id, { equipment_id: equipmentId, after: dto });
        return row;
    }

    // ------------------------------------------------------------ documents (sensitive)

    async listDocuments(ctx: OrgContext, employeeId: string) {
        const e = await this.target(ctx, employeeId, P.docsRead, true);
        const own = this.access.isOwn(ctx, e) && !ctx.can(P.docsRead);
        return this.prisma.employeeDocument.findMany({
            where: { employee_id: employeeId, ...(own && { employee_visible: true, is_confidential: false }) },
            orderBy: { created_at: 'desc' },
        });
    }

    async addDocument(ctx: OrgContext, employeeId: string, dto: EmployeeDocumentDto) {
        const e = await this.target(ctx, employeeId, P.docsManage);
        const status = dto.status ?? (dto.document_id ? 'UPLOADED' : 'REQUESTED');
        const row = await this.prisma.employeeDocument.create({
            data: {
                ...(dates(dto, ['due_date', 'valid_from', 'expires_on']) as any),
                status,
                organization_id: ctx.organization_id,
                employee_id: e.id,
                ...(status === 'REQUESTED' ? { requested_by_membership_id: ctx.membership_id, requested_at: new Date() } : { uploaded_by_user_id: ctx.user_id, uploaded_at: new Date() }),
            },
        });
        await this.log(ctx, status === 'REQUESTED' ? 'employee.document_requested' : 'employee.document_added', e.id, { document_id: row.id, category: row.category });
        this.events.publish(ctx, {
            event_key: status === 'REQUESTED' ? 'employees.document.requested' : 'employees.document.added', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_document', entity_id: row.id,
            payload: { employee_id: e.id, owner_membership_id: e.membership_id, title: row.title, due_date: dto.due_date ?? null },
        });
        return row;
    }

    async updateDocument(ctx: OrgContext, employeeId: string, documentId: string, dto: UpdateEmployeeDocumentDto) {
        const e = await this.target(ctx, employeeId, P.docsManage);
        const before = await this.own(this.prisma.employeeDocument.findFirst({ where: { id: documentId, employee_id: e.id } }), 'Document');
        const data: Prisma.EmployeeDocumentUncheckedUpdateInput = dates(defined(dto), ['due_date', 'valid_from', 'expires_on']) as any;
        if (dto.status === 'VERIFIED' && before.status !== 'VERIFIED') Object.assign(data, { verified_by_membership_id: ctx.membership_id, verified_at: new Date() });
        if (dto.status === 'UPLOADED' && !before.uploaded_at) Object.assign(data, { uploaded_by_user_id: ctx.user_id, uploaded_at: new Date() });
        const row = await this.prisma.employeeDocument.update({ where: { id: documentId }, data });
        await this.log(ctx, 'employee.document_updated', e.id, { document_id: documentId, before: { status: before.status }, after: dto });
        return row;
    }

    async removeDocument(ctx: OrgContext, employeeId: string, documentId: string) {
        const e = await this.target(ctx, employeeId, P.docsManage);
        await this.own(this.prisma.employeeDocument.findFirst({ where: { id: documentId, employee_id: e.id } }), 'Document');
        await this.prisma.employeeDocument.update({ where: { id: documentId }, data: { status: 'ARCHIVED' } });
        await this.log(ctx, 'employee.document_archived', e.id, { document_id: documentId });
        return { success: true };
    }

    // ------------------------------------------------------------ HR notes (sensitive)

    async listNotes(ctx: OrgContext, employeeId: string) {
        const e = await this.target(ctx, employeeId, P.notesRead, true);
        const asEmployee = this.access.isOwn(ctx, e) && !ctx.can(P.notesRead);
        const isManager = !asEmployee && (await this.access.isManagerOf(ctx, employeeId));
        const notes = await this.prisma.employeeHrNote.findMany({
            where: {
                employee_id: employeeId, deleted_at: null,
                ...(asEmployee && { visibility: 'EMPLOYEE_VISIBLE' }),
            },
            orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }],
            include: { author: { select: { id: true, user: { select: userSelect } } } },
        });
        // HR_ONLY notes are hidden from managers who read through their reporting line; restricted lists narrow further.
        return notes.filter((n) => {
            if (n.restricted_to_membership_ids.length && !n.restricted_to_membership_ids.includes(ctx.membership_id ?? '') && n.author_membership_id !== ctx.membership_id) return false;
            if (n.visibility === 'HR_ONLY' && isManager && !ctx.can(P.notesManage)) return false;
            return true;
        });
    }

    async addNote(ctx: OrgContext, employeeId: string, dto: HrNoteDto) {
        const e = await this.target(ctx, employeeId, P.notesManage);
        const row = await this.prisma.employeeHrNote.create({
            data: { ...(dates(dto, ['occurred_on']) as any), organization_id: ctx.organization_id, employee_id: e.id, author_membership_id: ctx.membership_id },
        });
        await this.log(ctx, 'employee.hr_note_created', e.id, { note_id: row.id, category: row.category, visibility: row.visibility });
        if (row.visibility === 'EMPLOYEE_VISIBLE' && row.requires_acknowledgement) {
            this.events.publish(ctx, { event_key: 'employees.hr_note.acknowledgement_requested', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_hr_note', entity_id: row.id, payload: { employee_id: e.id, owner_membership_id: e.membership_id } });
        }
        return row;
    }

    async updateNote(ctx: OrgContext, employeeId: string, noteId: string, dto: UpdateHrNoteDto) {
        const e = await this.target(ctx, employeeId, P.notesManage);
        const before = await this.own(this.prisma.employeeHrNote.findFirst({ where: { id: noteId, employee_id: e.id, deleted_at: null } }), 'Note');
        const history = Array.isArray(before.edit_history) ? (before.edit_history as unknown[]) : [];
        const row = await this.prisma.employeeHrNote.update({
            where: { id: noteId },
            data: {
                ...(dates(defined(dto), ['occurred_on']) as any),
                edited_at: new Date(),
                edit_history: [...history, { at: new Date().toISOString(), by: ctx.membership_id, body: before.body, title: before.title }] as Prisma.InputJsonValue,
            },
        });
        await this.log(ctx, 'employee.hr_note_updated', e.id, { note_id: noteId });
        return row;
    }

    async removeNote(ctx: OrgContext, employeeId: string, noteId: string) {
        const e = await this.target(ctx, employeeId, P.notesManage);
        await this.own(this.prisma.employeeHrNote.findFirst({ where: { id: noteId, employee_id: e.id, deleted_at: null } }), 'Note');
        await this.prisma.employeeHrNote.update({ where: { id: noteId }, data: { deleted_at: new Date() } });
        await this.log(ctx, 'employee.hr_note_deleted', e.id, { note_id: noteId });
        return { success: true };
    }

    /** The employee acknowledges an EMPLOYEE_VISIBLE note (e.g. a warning). */
    async acknowledgeNote(ctx: OrgContext, noteId: string) {
        const me = await this.access.meOrThrow(ctx);
        const note = await this.own(this.prisma.employeeHrNote.findFirst({ where: { id: noteId, employee_id: me.id, visibility: 'EMPLOYEE_VISIBLE', deleted_at: null } }), 'Note');
        if (note.acknowledged_at) throw new ConflictException({ message: 'Already acknowledged', code: 'already_acknowledged' });
        const row = await this.prisma.employeeHrNote.update({ where: { id: noteId }, data: { acknowledged_at: new Date() } });
        await this.log(ctx, 'employee.hr_note_acknowledged', me.id, { note_id: noteId });
        return row;
    }

    // ------------------------------------------------------------ work schedule

    async getSchedule(ctx: OrgContext, employeeId: string) {
        await this.target(ctx, employeeId, P.read, true);
        return this.prisma.employeeWorkSchedule.findMany({ where: { employee_id: employeeId }, orderBy: { effective_from: 'desc' }, include: { days: { orderBy: { weekday: 'asc' } } } });
    }

    /** New effective-dated schedule (closes the open one). weekly_hours = sum of the day hours. */
    async setSchedule(ctx: OrgContext, employeeId: string, dto: WorkScheduleDto) {
        const e = await this.target(ctx, employeeId, P.update);
        const weekdays = new Set(dto.days.map((d) => d.weekday));
        if (weekdays.size !== dto.days.length) throw new ConflictException({ message: 'Each weekday may appear once', code: 'duplicate_weekday' });
        const from = toDay(dto.effective_from);
        const weekly = round2(dto.days.reduce((s, d) => s + d.hours, 0));
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.employeeWorkSchedule.deleteMany({ where: { employee_id: e.id, effective_from: from } });
            await tx.employeeWorkSchedule.updateMany({ where: { employee_id: e.id, effective_to: null, effective_from: { lt: from } }, data: { effective_to: addDays(from, -1) } });
            const s = await tx.employeeWorkSchedule.create({
                data: {
                    employee_id: e.id, name: dto.name, schedule_type: dto.schedule_type ?? 'FIXED', effective_from: from, timezone: dto.timezone, weekly_hours: weekly,
                    work_location: dto.work_location ?? 'OFFICE', days: { create: dto.days.map((d) => ({ ...d, break_minutes: d.break_minutes ?? 0 })) },
                },
                include: { days: { orderBy: { weekday: 'asc' } } },
            });
            if (from <= today()) await tx.employee.update({ where: { id: e.id }, data: { weekly_capacity_hours: weekly } });
            return s;
        });
        await this.log(ctx, 'employee.schedule_changed', e.id, { schedule_id: row.id, weekly_hours: weekly, effective_from: dto.effective_from });
        this.events.publish(ctx, { event_key: 'employees.schedule.changed', module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: e.id, payload: { weekly_hours: weekly, owner_membership_id: e.membership_id } });
        return row;
    }

    private async own<T>(promise: Promise<T | null>, label: string): Promise<T> {
        const row = await promise;
        if (!row) throw new NotFoundException({ message: `${label} not found`, code: 'not_found' });
        return row;
    }

    /** Guard used by controllers when only the employee themselves may act. */
    assertSelf(ctx: OrgContext, employee: { membership_id: string }) {
        if (!this.access.isOwn(ctx, employee)) throw new ForbiddenException({ message: 'Only the employee can do this', code: 'not_self' });
    }
}
