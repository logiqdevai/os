import { Body, Controller, Get, Injectable, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AttendanceSource, LeaveApproverStrategy, ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { PeopleAccessService } from '../common/people-access.service';
import { ANY_PEOPLE_KEY, DIRECTORY_FIELDS, P, SELF_SERVICE_FIELDS, defined } from '../common/people.utils';

export class UpdateHrSettingsDto {
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(80) default_weekly_hours?: number;
    @ApiPropertyOptional({ enum: LeaveApproverStrategy }) @IsOptional() @IsEnum(LeaveApproverStrategy) leave_approver_strategy?: LeaveApproverStrategy;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) leave_conflict_threshold_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() attendance_required?: boolean;
    @ApiPropertyOptional({ enum: AttendanceSource, isArray: true }) @IsOptional() @IsArray() @IsEnum(AttendanceSource, { each: true }) allowed_clock_sources?: AttendanceSource[];
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(240) late_tolerance_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(600) overtime_threshold_minutes?: number;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() overtime_requires_approval?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() prefill_time_entries_from_attendance?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(200) target_utilization_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(300) overload_threshold_percent?: number;
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(200) underutilized_threshold_percent?: number;
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) self_service_editable_fields?: string[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() profile_changes_require_approval?: boolean;
    @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) directory_visible_fields?: string[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() notify_birthdays?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsBoolean() notify_anniversaries?: boolean;
}

@Injectable()
export class HrSettingsService {
    constructor(private readonly prisma: PrismaService, private readonly access: PeopleAccessService, private readonly audit: AuditService, private readonly events: EventsService) { }

    async get(ctx: OrgContext) {
        const settings = await this.access.settings(ctx.organization_id);
        return { ...settings, options: { self_service_fields: SELF_SERVICE_FIELDS, directory_fields: DIRECTORY_FIELDS } };
    }

    async update(ctx: OrgContext, dto: UpdateHrSettingsDto) {
        const before = await this.access.settings(ctx.organization_id);
        if (dto.self_service_editable_fields) dto.self_service_editable_fields = dto.self_service_editable_fields.filter((f) => (SELF_SERVICE_FIELDS as readonly string[]).includes(f));
        if (dto.directory_visible_fields) dto.directory_visible_fields = dto.directory_visible_fields.filter((f) => (DIRECTORY_FIELDS as readonly string[]).includes(f));
        const row = await this.prisma.employeeHrSettings.update({ where: { organization_id: ctx.organization_id }, data: defined(dto) });
        const changed = Object.keys(defined(dto));
        await this.audit.record(ctx, 'employee_settings.updated', { resource_type: 'employee_hr_settings', resource_id: ctx.organization_id, metadata: { before: Object.fromEntries(changed.map((k) => [k, (before as any)[k]])), after: dto } });
        this.events.publish(ctx, { event_key: 'employees.settings.updated', module: ModuleKey.EMPLOYEES, entity_kind: 'employee_hr_settings', entity_id: ctx.organization_id, payload: { fields: changed } });
        return row;
    }
}

@ApiTags('People · Settings')
@ApiBearerAuth()
@Controller('people/settings')
@UseGuards(JwtGuard, PermissionsGuard)
export class HrSettingsController {
    constructor(private readonly settings: HrSettingsService) { }

    @Get()
    @RequireAnyPermission(...ANY_PEOPLE_KEY)
    @ApiOperation({ summary: 'HR settings (created with defaults on first read)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.settings.get(ctx);
    }

    @Put()
    @RequirePermission(P.settings)
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateHrSettingsDto) {
        return this.settings.update(ctx, dto);
    }
}
