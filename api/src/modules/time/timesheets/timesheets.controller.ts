import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TimesheetsService } from './timesheets.service';
import { BulkTimesheetDto, CommentDto, RequiredCommentDto, SubmitTimesheetDto, TimesheetQuery, TimesheetQuerySchema, WeekQuery, WeekQuerySchema } from './dto/timesheet.dto';
import { TIME_ANY_READ } from '../common/time-permissions';
import { ReasonDto } from '../entries/dto/time-entry.dto';

@ApiTags('Time · Timesheets')
@ApiBearerAuth()
@Controller('time')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimesheetsController {
    constructor(private readonly sheets: TimesheetsService) { }

    @Get('timesheets/current')
    @RequireAnyPermission(...TIME_ANY_READ)
    @ApiOperation({ summary: 'Week grid data: a member\'s week (own by default), its timesheet and entries' })
    week(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(WeekQuerySchema)) query: WeekQuery) {
        return this.sheets.week(ctx, query);
    }

    @Get('timesheets/team')
    @RequireAnyPermission('time.entries.read_team', 'time.entries.read_all')
    @ApiOperation({ summary: 'Team timesheet compliance for one week (members without a timesheet show NOT_STARTED)' })
    team(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(WeekQuerySchema)) query: WeekQuery) {
        return this.sheets.team(ctx, query);
    }

    @Get('timesheets')
    @RequireAnyPermission(...TIME_ANY_READ)
    @ApiOperation({ summary: 'List timesheets in the caller\'s scope' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimesheetQuerySchema)) query: TimesheetQuery) {
        return this.sheets.findAll(ctx, query);
    }

    @Get('approvals')
    @RequirePermission('time.timesheets.approve')
    @ApiOperation({ summary: 'Submitted timesheets waiting for the caller' })
    approvals(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimesheetQuerySchema)) query: TimesheetQuery) {
        return this.sheets.approvals(ctx, query);
    }

    @Post('timesheets/submit')
    @RequirePermission('time.timesheets.submit_own')
    @ApiOperation({ summary: 'Submit the caller\'s week for approval' })
    submit(@CurrentOrg() ctx: OrgContext, @Body() dto: SubmitTimesheetDto) {
        return this.sheets.submit(ctx, dto.period_start, dto.comment);
    }

    @Post('timesheets/bulk')
    @RequirePermission('time.timesheets.approve')
    @ApiOperation({ summary: 'Approve or reject several timesheets' })
    bulk(@CurrentOrg() ctx: OrgContext, @Body() dto: BulkTimesheetDto) {
        return this.sheets.bulk(ctx, dto);
    }

    @Get('timesheets/:id')
    @RequireAnyPermission(...TIME_ANY_READ, 'time.timesheets.approve')
    @ApiOperation({ summary: 'Timesheet with entries and history' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.sheets.findOne(ctx, id);
    }

    @Post('timesheets/:id/approve')
    @RequirePermission('time.timesheets.approve')
    @ApiOperation({ summary: 'Approve a submitted timesheet' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto) {
        return this.sheets.approve(ctx, id, dto.comment);
    }

    @Post('timesheets/:id/reject')
    @RequirePermission('time.timesheets.approve')
    @ApiOperation({ summary: 'Reject a submitted timesheet (comment required)' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequiredCommentDto) {
        return this.sheets.reject(ctx, id, dto.comment);
    }

    @Post('timesheets/:id/reopen')
    @RequireAnyPermission('time.timesheets.submit_own', 'time.timesheets.approve')
    @ApiOperation({ summary: 'Withdraw / reopen a timesheet' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto) {
        return this.sheets.reopen(ctx, id, dto.comment);
    }

    @Post('timesheets/:id/unlock')
    @RequirePermission('time.entries.unlock')
    @ApiOperation({ summary: 'Unlock an approved / locked timesheet (reason required)' })
    unlock(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
        return this.sheets.unlock(ctx, id, dto.reason);
    }
}
