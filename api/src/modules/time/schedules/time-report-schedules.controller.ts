import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ScheduleInput, ScheduleSchema, TimeReportSchedulesService, UpdateScheduleSchema } from './time-report-schedules.service';

@ApiTags('Time · Scheduled reports')
@ApiBearerAuth()
@Controller('time')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeReportSchedulesController {
    constructor(private readonly schedules: TimeReportSchedulesService) { }

    @Get('report-schedules')
    @RequirePermission('time.reports.read', 'time.entries.export')
    @ApiOperation({ summary: 'Scheduled e-mailed reports (mine; all with time.entries.read_all) with the last runs' })
    list(@CurrentOrg() ctx: OrgContext) {
        return this.schedules.list(ctx);
    }

    @Get('report-schedules/reports')
    @RequirePermission('time.reports.read', 'time.entries.export')
    reports() {
        return this.schedules.reportKeys();
    }

    @Post('report-schedules')
    @RequirePermission('time.reports.read', 'time.entries.export')
    @ApiOperation({ summary: 'Create a schedule; it runs as you, with your scope at send time' })
    create(@CurrentOrg() ctx: OrgContext, @Body(new ZodValidationPipe(ScheduleSchema)) dto: ScheduleInput) {
        return this.schedules.create(ctx, dto);
    }

    @Patch('report-schedules/:id')
    @RequirePermission('time.reports.read', 'time.entries.export')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateScheduleSchema)) dto: z.infer<typeof UpdateScheduleSchema>) {
        return this.schedules.update(ctx, id, dto as Partial<ScheduleInput>);
    }

    @Delete('report-schedules/:id')
    @RequirePermission('time.reports.read', 'time.entries.export')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.schedules.remove(ctx, id);
    }

    @Post('report-schedules/:id/run')
    @RequirePermission('time.reports.read', 'time.entries.export')
    @ApiOperation({ summary: 'Send the report now (sensitive: e-mails data; audited)' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.schedules.runNow(ctx, id);
    }

    @Get('exports/:id/download')
    @RequirePermission('time.entries.export')
    @ApiOperation({ summary: 'Download the stored CSV of an export (scheduled runs)' })
    async download(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
        const { stream, filename } = await this.schedules.download(ctx, id);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        stream.pipe(res);
    }
}
