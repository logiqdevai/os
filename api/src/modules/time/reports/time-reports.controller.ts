import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TimeReportsService } from './time-reports.service';
import { TimeReportQuery, TimeReportQuerySchema, UnbilledQuery, UnbilledQuerySchema } from './dto/time-report.dto';

@ApiTags('Time · Reports')
@ApiBearerAuth()
@Controller('time')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeReportsController {
    constructor(private readonly reports: TimeReportsService) { }

    @Get('reports/summary')
    @RequirePermission('time.reports.read')
    @ApiOperation({ summary: 'Hours grouped by project / member / customer / activity / task / day (amounts need time.rates.read)' })
    summary(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimeReportQuerySchema)) q: TimeReportQuery) {
        return this.reports.summary(ctx, q);
    }

    @Get('reports/utilization')
    @RequirePermission('time.reports.read')
    @ApiOperation({ summary: 'Utilization per member (logged / expected)' })
    utilization(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimeReportQuerySchema)) q: TimeReportQuery) {
        return this.reports.utilization(ctx, q);
    }

    @Get('reports/export')
    @RequirePermission('time.entries.export')
    @ApiOperation({ summary: 'Export entries in scope as CSV (logged as a TimeExport)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TimeReportQuerySchema)) q: TimeReportQuery, @Res({ passthrough: true }) res: Response) {
        const out = await this.reports.exportCsv(ctx, q);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
        res.setHeader('X-Row-Count', String(out.row_count));
        return `﻿${out.csv}`;
    }

    @Get('exports')
    @RequirePermission('time.entries.export')
    @ApiOperation({ summary: 'Export history' })
    exports(@CurrentOrg() ctx: OrgContext) {
        return this.reports.exports(ctx);
    }

    @Get('unbilled')
    @RequirePermission('time.entries.read_all', 'time.reports.read')
    @ApiOperation({ summary: 'Approved, billable, uninvoiced time grouped by customer and project (pulled by 08 Billing)' })
    unbilled(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(UnbilledQuerySchema)) q: UnbilledQuery) {
        return this.reports.unbilled(ctx, q);
    }
}
