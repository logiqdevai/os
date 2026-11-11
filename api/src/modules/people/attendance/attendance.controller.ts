import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import { AttendanceService } from './attendance.service';
import {
    AttendanceBoardQuery, AttendanceBoardQuerySchema, AttendanceQuery, AttendanceQuerySchema, BreakDto, ClockInDto, ClockOutDto, EditRecordDto, EditSessionDto, ManualAttendanceDto,
} from './attendance.dto';

const uuid = new ParseUUIDPipe();

@ApiTags('People · Attendance')
@ApiBearerAuth()
@Controller('people/attendance')
@UseGuards(JwtGuard, PermissionsGuard)
export class AttendanceController {
    constructor(private readonly attendance: AttendanceService) { }

    @Get('me')
    @RequireAnyPermission(P.attReadOwn, P.attRecordOwn)
    @ApiOperation({ summary: 'My clock card (today, open session/break, this week)' })
    me(@CurrentOrg() ctx: OrgContext) {
        return this.attendance.me(ctx);
    }

    @Post('clock-in')
    @RequirePermission(P.attRecordOwn)
    clockIn(@CurrentOrg() ctx: OrgContext, @Body() dto: ClockInDto) {
        return this.attendance.clockIn(ctx, dto);
    }

    @Post('clock-out')
    @RequirePermission(P.attRecordOwn)
    clockOut(@CurrentOrg() ctx: OrgContext, @Body() dto: ClockOutDto) {
        return this.attendance.clockOut(ctx, dto);
    }

    @Post('break/start')
    @RequirePermission(P.attRecordOwn)
    startBreak(@CurrentOrg() ctx: OrgContext, @Body() dto: BreakDto) {
        return this.attendance.startBreak(ctx, dto);
    }

    @Post('break/end')
    @RequirePermission(P.attRecordOwn)
    endBreak(@CurrentOrg() ctx: OrgContext) {
        return this.attendance.endBreak(ctx);
    }

    @Get('records')
    @RequireAnyPermission(P.attReadOwn, P.attReadAll)
    records(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AttendanceQuerySchema)) query: AttendanceQuery) {
        return this.attendance.records(ctx, query);
    }

    @Get('board')
    @RequirePermission(P.attReadAll)
    @ApiOperation({ summary: 'Who is in on a day (scoped)' })
    board(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AttendanceBoardQuerySchema)) query: AttendanceBoardQuery) {
        return this.attendance.board(ctx, query);
    }

    @Post('records')
    @RequirePermission(P.attManage)
    @ApiOperation({ summary: 'Enter a missed clock-in/out by hand (reason required, audited)' })
    addManual(@CurrentOrg() ctx: OrgContext, @Body() dto: ManualAttendanceDto) {
        return this.attendance.addManual(ctx, dto);
    }

    @Patch('records/:id')
    @RequirePermission(P.attManage)
    editRecord(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: EditRecordDto) {
        return this.attendance.editRecord(ctx, id, dto);
    }

    @Patch('sessions/:id')
    @RequirePermission(P.attManage)
    editSession(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string, @Body() dto: EditSessionDto) {
        return this.attendance.editSession(ctx, id, dto);
    }

    @Post('records/:id/approve-overtime')
    @RequirePermission(P.attManage)
    approveOvertime(@CurrentOrg() ctx: OrgContext, @Param('id', uuid) id: string) {
        return this.attendance.approveOvertime(ctx, id);
    }
}
