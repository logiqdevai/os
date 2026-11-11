import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequireOrgMember, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import { EmployeesService } from './employees.service';
import { EmployeeRecordsService } from './employee-records.service';
import {
    ChangePositionDto, CreateEmployeeDto, DecideChangeRequestDto, SetAvailabilityDto, StartOffboardingDto, UpdateEmployeeDto, UpdateOwnProfileDto,
} from './dto/employee.dto';
import {
    ChangeRequestQuery, ChangeRequestQuerySchema, DirectoryQuery, DirectoryQuerySchema, EmployeeQuery, EmployeeQuerySchema,
} from './dto/employee-query.schema';
import {
    CompensationDto, EmergencyContactDto, EmployeeDocumentDto, EquipmentDto, HrNoteDto, LanguageDto, UpdateEmergencyContactDto, UpdateEmployeeDocumentDto,
    UpdateEquipmentDto, UpdateHrNoteDto, WorkScheduleDto,
} from './dto/employee-records.dto';

type Id = string;
const uuid = new ParseUUIDPipe();

@ApiTags('People · Employees')
@ApiBearerAuth()
@Controller('people')
@UseGuards(JwtGuard, PermissionsGuard)
export class EmployeesController {
    constructor(private readonly employees: EmployeesService, private readonly records: EmployeeRecordsService) { }

    // ------------------------------------------------------------ lists

    @Get('employees')
    @RequirePermission(P.read)
    @ApiOperation({ summary: 'HR employee list (scoped; personal fields stripped per permission)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(EmployeeQuerySchema)) query: EmployeeQuery) {
        return this.employees.findAll(ctx, query);
    }

    @Get('employees/export')
    @RequirePermission(P.export)
    @Header('content-type', 'text/csv; charset=utf-8')
    @Header('content-disposition', 'attachment; filename="employees.csv"')
    @ApiOperation({ summary: 'Export the employee list as CSV (sensitive, audited)' })
    exportCsv(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(EmployeeQuerySchema)) query: EmployeeQuery) {
        return this.employees.exportCsv(ctx, query);
    }

    @Get('employees/candidates')
    @RequirePermission(P.create)
    @ApiOperation({ summary: 'Members without an employee record (Add employee picker)' })
    candidates(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.employees.candidates(ctx, search);
    }

    @Get('directory')
    @RequirePermission(P.directoryRead)
    @ApiOperation({ summary: 'Company directory (limited fields)' })
    directory(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DirectoryQuerySchema)) query: DirectoryQuery) {
        return this.employees.directory(ctx, query);
    }

    @Get('org-chart')
    @RequirePermission(P.directoryRead)
    @ApiOperation({ summary: 'Org chart nodes (manager_employee_id tree)' })
    orgChart(@CurrentOrg() ctx: OrgContext) {
        return this.employees.orgChart(ctx);
    }

    // ------------------------------------------------------------ self-service

    @Get('me')
    @RequireOrgMember()
    @ApiOperation({ summary: 'My employee record (404 when I have none)' })
    me(@CurrentOrg() ctx: OrgContext) {
        return this.employees.me(ctx);
    }

    @Patch('me')
    @RequirePermission(P.profileOwn)
    @ApiOperation({ summary: 'Edit my profile (applied or sent to HR for approval)' })
    updateMe(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateOwnProfileDto) {
        return this.employees.updateOwn(ctx, dto);
    }

    @Post('me/change-requests/:id/cancel')
    @RequirePermission(P.profileOwn)
    cancelOwnChangeRequest(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.cancelOwnChangeRequest(ctx, id);
    }

    @Post('me/hr-notes/:id/acknowledge')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Acknowledge an HR note shared with me' })
    acknowledge(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.acknowledgeNote(ctx, id);
    }

    @Get('change-requests')
    @RequireAnyPermission(P.update, P.profileOwn)
    @ApiOperation({ summary: 'Profile change requests (HR: scoped; employee: own)' })
    changeRequests(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ChangeRequestQuerySchema)) query: ChangeRequestQuery) {
        return this.employees.listChangeRequests(ctx, query);
    }

    @Post('change-requests/:id/approve')
    @RequirePermission(P.update)
    approveChange(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: DecideChangeRequestDto) {
        return this.employees.decideChangeRequest(ctx, id, true, dto);
    }

    @Post('change-requests/:id/reject')
    @RequirePermission(P.update)
    rejectChange(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: DecideChangeRequestDto) {
        return this.employees.decideChangeRequest(ctx, id, false, dto);
    }

    // ------------------------------------------------------------ employee record

    @Get('employees/:id')
    @RequireAnyPermission(P.read, P.directoryRead)
    @ApiOperation({ summary: 'Employee profile (restricted_fields lists what was stripped)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.findOne(ctx, id);
    }

    @Post('employees')
    @RequirePermission(P.create)
    @ApiOperation({ summary: 'Create an employee from a member or a new hire' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateEmployeeDto) {
        return this.employees.create(ctx, dto);
    }

    @Patch('employees/:id')
    @RequirePermission(P.update)
    update(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: UpdateEmployeeDto) {
        return this.employees.update(ctx, id, dto);
    }

    @Post('employees/:id/archive')
    @RequirePermission(P.archive)
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.archive(ctx, id);
    }

    @Post('employees/:id/restore')
    @RequirePermission(P.archive)
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.restore(ctx, id);
    }

    @Delete('employees/:id')
    @RequirePermission(P.delete)
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.remove(ctx, id);
    }

    @Post('employees/:id/position')
    @RequirePermission(P.update)
    @ApiOperation({ summary: 'Change position / manager / department (effective-dated)' })
    changePosition(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: ChangePositionDto) {
        return this.employees.changePosition(ctx, id, dto);
    }

    @Post('employees/:id/onboarding/complete')
    @RequirePermission(P.update)
    completeOnboarding(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.completeOnboarding(ctx, id);
    }

    @Post('employees/:id/offboarding')
    @RequirePermission(P.offboard)
    startOffboarding(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: StartOffboardingDto) {
        return this.employees.startOffboarding(ctx, id, dto);
    }

    @Post('employees/:id/offboarding/complete')
    @RequirePermission(P.offboard)
    completeOffboarding(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.employees.completeOffboarding(ctx, id);
    }

    @Post('employees/:id/availability')
    @RequireAnyPermission(P.availability, P.profileOwn)
    setAvailability(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: SetAvailabilityDto) {
        return this.employees.setAvailability(ctx, id, dto);
    }

    // ------------------------------------------------------------ sub-records

    @Get('employees/:id/emergency-contacts')
    @RequireAnyPermission(P.personalRead, P.profileOwn)
    listContacts(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.listContacts(ctx, id);
    }

    @Post('employees/:id/emergency-contacts')
    @RequireAnyPermission(P.personalManage, P.profileOwn)
    addContact(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: EmergencyContactDto) {
        return this.records.addContact(ctx, id, dto);
    }

    @Patch('employees/:id/emergency-contacts/:contactId')
    @RequireAnyPermission(P.personalManage, P.profileOwn)
    updateContact(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('contactId', uuid) contactId: Id, @Body() dto: UpdateEmergencyContactDto) {
        return this.records.updateContact(ctx, id, contactId, dto);
    }

    @Delete('employees/:id/emergency-contacts/:contactId')
    @RequireAnyPermission(P.personalManage, P.profileOwn)
    removeContact(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('contactId', uuid) contactId: Id) {
        return this.records.removeContact(ctx, id, contactId);
    }

    @Post('employees/:id/languages')
    @RequireAnyPermission(P.update, P.profileOwn)
    addLanguage(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: LanguageDto) {
        return this.records.addLanguage(ctx, id, dto);
    }

    @Delete('employees/:id/languages/:languageId')
    @RequireAnyPermission(P.update, P.profileOwn)
    removeLanguage(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('languageId', uuid) languageId: Id) {
        return this.records.removeLanguage(ctx, id, languageId);
    }

    @Get('employees/:id/compensation')
    @RequirePermission(P.compRead)
    @ApiOperation({ summary: 'Compensation history (sensitive, read is audited)' })
    listCompensation(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.listCompensation(ctx, id);
    }

    @Post('employees/:id/compensation')
    @RequirePermission(P.compManage)
    addCompensation(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: CompensationDto) {
        return this.records.addCompensation(ctx, id, dto);
    }

    @Get('employees/:id/equipment')
    @RequireAnyPermission(P.equipmentRead, P.directoryRead)
    listEquipment(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.listEquipment(ctx, id);
    }

    @Post('employees/:id/equipment')
    @RequirePermission(P.equipmentManage)
    addEquipment(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: EquipmentDto) {
        return this.records.addEquipment(ctx, id, dto);
    }

    @Patch('employees/:id/equipment/:equipmentId')
    @RequirePermission(P.equipmentManage)
    updateEquipment(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('equipmentId', uuid) equipmentId: Id, @Body() dto: UpdateEquipmentDto) {
        return this.records.updateEquipment(ctx, id, equipmentId, dto);
    }

    @Get('employees/:id/documents')
    @RequireAnyPermission(P.docsRead, P.directoryRead)
    listDocuments(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.listDocuments(ctx, id);
    }

    @Post('employees/:id/documents')
    @RequirePermission(P.docsManage)
    addDocument(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: EmployeeDocumentDto) {
        return this.records.addDocument(ctx, id, dto);
    }

    @Patch('employees/:id/documents/:documentId')
    @RequirePermission(P.docsManage)
    updateDocument(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('documentId', uuid) documentId: Id, @Body() dto: UpdateEmployeeDocumentDto) {
        return this.records.updateDocument(ctx, id, documentId, dto);
    }

    @Delete('employees/:id/documents/:documentId')
    @RequirePermission(P.docsManage)
    removeDocument(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('documentId', uuid) documentId: Id) {
        return this.records.removeDocument(ctx, id, documentId);
    }

    @Get('employees/:id/hr-notes')
    @RequireAnyPermission(P.notesRead, P.directoryRead)
    listNotes(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.listNotes(ctx, id);
    }

    @Post('employees/:id/hr-notes')
    @RequirePermission(P.notesManage)
    addNote(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: HrNoteDto) {
        return this.records.addNote(ctx, id, dto);
    }

    @Patch('employees/:id/hr-notes/:noteId')
    @RequirePermission(P.notesManage)
    updateNote(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('noteId', uuid) noteId: Id, @Body() dto: UpdateHrNoteDto) {
        return this.records.updateNote(ctx, id, noteId, dto);
    }

    @Delete('employees/:id/hr-notes/:noteId')
    @RequirePermission(P.notesManage)
    removeNote(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Param('noteId', uuid) noteId: Id) {
        return this.records.removeNote(ctx, id, noteId);
    }

    @Get('employees/:id/work-schedules')
    @RequireAnyPermission(P.read, P.directoryRead)
    getSchedule(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id) {
        return this.records.getSchedule(ctx, id);
    }

    @Put('employees/:id/work-schedule')
    @RequirePermission(P.update)
    @ApiOperation({ summary: 'Set a new effective-dated work schedule' })
    setSchedule(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: Id, @Body() dto: WorkScheduleDto) {
        return this.records.setSchedule(ctx, id, dto);
    }
}
