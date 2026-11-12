import { Body, Controller, Get, Injectable, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { AttendanceSource, LeaveApproverStrategy, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { PeopleAccessService } from '../common/people-access.service';
import { ANY_PEOPLE_KEY, DIRECTORY_FIELDS, P, SELF_SERVICE_FIELDS, defined } from '../common/people.utils';

/** One working weekday of the organization's default schedule (0 = Sunday … 6 = Saturday, like EmployeeWorkScheduleDay). */
export class DefaultScheduleDayDto {
    @ApiPropertyOptional() @IsInt() @Min(0) @Max(6) weekday: number;
    @ApiPropertyOptional({ example: '09:00' }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start?: string;
    @ApiPropertyOptional({ example: '17:30' }) @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end?: string;
    @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(480) break_minutes?: number;
    @ApiPropertyOptional({ description: 'Working hours that day; computed from start/end/break when omitted' }) @IsOptional() @IsNumber() @Min(0) @Max(24) hours?: number;
}

export class UpdateHrSettingsDto {
    @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(80) default_weekly_hours?: number;
    @ApiPropertyOptional({ type: [DefaultScheduleDayDto], description: 'Default schedule for employees without their own work schedule; [] clears it' })
    @IsOptional() @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => DefaultScheduleDayDto) default_schedule?: DefaultScheduleDayDto[];
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

/** Sorted, de-duplicated days with hours computed from start/end minus the break. */
export function normalizeSchedule(days: DefaultScheduleDayDto[]) {
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const byDay = new Map<number, { weekday: number; start: string | null; end: string | null; break_minutes: number; hours: number }>();
    for (const d of days) {
        const span = d.start && d.end ? Math.max(0, mins(d.end) - mins(d.start) - (d.break_minutes ?? 0)) / 60 : 0;
        byDay.set(d.weekday, { weekday: d.weekday, start: d.start ?? null, end: d.end ?? null, break_minutes: d.break_minutes ?? 0, hours: Math.round((d.hours ?? span) * 100) / 100 });
    }
    return [...byDay.values()].filter((d) => d.hours > 0).sort((a, b) => a.weekday - b.weekday);
}

@Injectable()
export class HrSettingsService {
    constructor(private readonly prisma: PrismaService, private readonly access: PeopleAccessService, private readonly audit: AuditService, private readonly events: EventsService) { }

    async get(ctx: OrgContext) {
        const [settings, branches] = await Promise.all([
            this.access.settings(ctx.organization_id),
            this.prisma.branch.findMany({ where: { organization_id: ctx.organization_id, archived_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        ]);
        return { ...settings, options: { self_service_fields: SELF_SERVICE_FIELDS, directory_fields: DIRECTORY_FIELDS, branches } };
    }

    async update(ctx: OrgContext, dto: UpdateHrSettingsDto) {
        const before = await this.access.settings(ctx.organization_id);
        if (dto.self_service_editable_fields) dto.self_service_editable_fields = dto.self_service_editable_fields.filter((f) => (SELF_SERVICE_FIELDS as readonly string[]).includes(f));
        if (dto.directory_visible_fields) dto.directory_visible_fields = dto.directory_visible_fields.filter((f) => (DIRECTORY_FIELDS as readonly string[]).includes(f));
        const { default_schedule, ...rest } = dto;
        const data: Prisma.EmployeeHrSettingsUpdateInput = defined(rest);
        if (default_schedule) {
            const days = normalizeSchedule(default_schedule);
            data.default_schedule = days.length ? (days as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
            // The weekly default follows the schedule so capacity and leave math stay consistent.
            if (days.length && dto.default_weekly_hours === undefined) data.default_weekly_hours = days.reduce((s, d) => s + d.hours, 0);
        }
        const row = await this.prisma.employeeHrSettings.update({ where: { organization_id: ctx.organization_id }, data });
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
