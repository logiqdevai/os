import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import { LeaveService } from './leave.service';
import { LeaveConfigService } from './leave-config.service';
import {
    AdjustBalanceDto, AssignPolicyDto, CancelLeaveDto, DecideLeaveDto, HolidayDto, HolidayQuerySchema, LeaveBalanceQuery, LeaveBalanceQuerySchema, LeaveCalendarQuery,
    LeaveCalendarQuerySchema, LeavePolicyDto, LeaveRequestDto, LeaveRequestQuery, LeaveRequestQuerySchema, LeaveTypeDto, UpdateLeavePolicyDto, UpdateLeaveTypeDto,
} from './dto/leave.dto';

const uuid = new ParseUUIDPipe();
const LEAVE_READ = [P.leaveReadOwn, P.leaveReadAll, P.leaveApprove, P.leaveRequestOwn, P.leavePolicies, P.leaveBalances];

@ApiTags('People · Leave')
@ApiBearerAuth()
@Controller('people')
@UseGuards(JwtGuard, PermissionsGuard)
export class LeaveController {
    constructor(private readonly leave: LeaveService, private readonly config: LeaveConfigService) { }

    // ------------------------------------------------------------ requests

    @Get('leave-requests')
    @RequireAnyPermission(P.leaveReadOwn, P.leaveReadAll, P.leaveApprove)
    @ApiOperation({ summary: 'Leave requests (scope: own / all in scope / assigned to me). to_approve=true = my approval queue' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LeaveRequestQuerySchema)) query: LeaveRequestQuery) {
        return this.leave.list(ctx, query);
    }

    @Post('leave-requests/preview')
    @RequireAnyPermission(P.leaveRequestOwn, P.leaveBalances)
    @ApiOperation({ summary: 'Working days, balance impact and conflicts of a request before saving' })
    preview(@CurrentOrg() ctx: OrgContext, @Body() dto: LeaveRequestDto) {
        return this.leave.preview(ctx, dto);
    }

    @Get('leave-requests/:id')
    @RequireAnyPermission(P.leaveReadOwn, P.leaveReadAll, P.leaveApprove)
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.leave.findOne(ctx, id);
    }

    @Post('leave-requests')
    @RequireAnyPermission(P.leaveRequestOwn, P.leaveBalances)
    @ApiOperation({ summary: 'Request leave (own, or on behalf with manage_balances)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: LeaveRequestDto) {
        return this.leave.create(ctx, dto);
    }

    @Post('leave-requests/:id/submit')
    @RequireAnyPermission(P.leaveRequestOwn, P.leaveBalances)
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.leave.submit(ctx, id);
    }

    @Post('leave-requests/:id/approve')
    @RequirePermission(P.leaveApprove)
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: DecideLeaveDto) {
        return this.leave.approve(ctx, id, dto);
    }

    @Post('leave-requests/:id/reject')
    @RequirePermission(P.leaveApprove)
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: DecideLeaveDto) {
        return this.leave.reject(ctx, id, dto);
    }

    @Post('leave-requests/:id/cancel')
    @RequireAnyPermission(P.leaveRequestOwn, P.leaveBalances)
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: CancelLeaveDto) {
        return this.leave.cancel(ctx, id, dto);
    }

    @Get('leave-calendar')
    @RequireAnyPermission(P.leaveReadOwn, P.leaveReadAll)
    calendar(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LeaveCalendarQuerySchema)) query: LeaveCalendarQuery) {
        return this.leave.calendar(ctx, query);
    }

    // ------------------------------------------------------------ balances

    @Get('leave-balances')
    @RequireAnyPermission(P.leaveReadOwn, P.leaveReadAll)
    balances(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LeaveBalanceQuerySchema)) query: LeaveBalanceQuery) {
        return this.leave.balances(ctx, query);
    }

    @Get('leave-balances/:id/transactions')
    @RequireAnyPermission(P.leaveReadOwn, P.leaveReadAll)
    transactions(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.leave.transactions(ctx, id);
    }

    @Post('leave-balances/:id/adjust')
    @RequirePermission(P.leaveBalances)
    adjust(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: AdjustBalanceDto) {
        return this.leave.adjust(ctx, id, dto);
    }

    // ------------------------------------------------------------ configuration

    @Get('leave-types')
    @RequireAnyPermission(...LEAVE_READ)
    types(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.config.listTypes(ctx, archived === 'true');
    }

    @Post('leave-types')
    @RequirePermission(P.leavePolicies)
    createType(@CurrentOrg() ctx: OrgContext, @Body() dto: LeaveTypeDto) {
        return this.config.createType(ctx, dto);
    }

    @Patch('leave-types/:id')
    @RequirePermission(P.leavePolicies)
    updateType(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateLeaveTypeDto) {
        return this.config.updateType(ctx, id, dto);
    }

    @Post('leave-types/:id/archive')
    @RequirePermission(P.leavePolicies)
    archiveType(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.config.archiveType(ctx, id, true);
    }

    @Post('leave-types/:id/restore')
    @RequirePermission(P.leavePolicies)
    restoreType(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.config.archiveType(ctx, id, false);
    }

    @Get('leave-policies')
    @RequireAnyPermission(P.leavePolicies, P.leaveBalances, P.leaveReadAll)
    policies(@CurrentOrg() ctx: OrgContext) {
        return this.config.listPolicies(ctx);
    }

    @Post('leave-policies')
    @RequirePermission(P.leavePolicies)
    createPolicy(@CurrentOrg() ctx: OrgContext, @Body() dto: LeavePolicyDto) {
        return this.config.createPolicy(ctx, dto);
    }

    @Patch('leave-policies/:id')
    @RequirePermission(P.leavePolicies)
    updatePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: UpdateLeavePolicyDto) {
        return this.config.updatePolicy(ctx, id, dto);
    }

    @Post('leave-policies/:id/archive')
    @RequirePermission(P.leavePolicies)
    archivePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.config.archivePolicy(ctx, id);
    }

    @Post('leave-policies/:id/assign')
    @RequirePermission(P.leavePolicies)
    assignPolicy(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: AssignPolicyDto) {
        return this.config.assignPolicy(ctx, id, dto);
    }

    @Get('holidays')
    @RequireAnyPermission(...LEAVE_READ, P.attReadOwn, P.attReadAll, P.capacity)
    holidays(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(HolidayQuerySchema)) query: { year?: number }) {
        return this.config.listHolidays(ctx, query.year);
    }

    @Post('holidays')
    @RequirePermission(P.leavePolicies)
    createHoliday(@CurrentOrg() ctx: OrgContext, @Body() dto: HolidayDto) {
        return this.config.createHoliday(ctx, dto);
    }

    @Delete('holidays/:id')
    @RequirePermission(P.leavePolicies)
    removeHoliday(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.config.removeHoliday(ctx, id);
    }
}
