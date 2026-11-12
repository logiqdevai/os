import { Controller, Get, Param, ParseEnumPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { sendCsv } from '../common/send-csv';
import { CrmReportsService, REPORT_KEYS, ReportKey, ReportQuery, ReportQuerySchema } from './reports.service';

const ReportParam = new ParseEnumPipe(Object.fromEntries(REPORT_KEYS.map((k) => [k, k])));

/** 02 §32–33 — CRM reports (pipeline, win-loss, conversion, activity) and their CSV export. */
@ApiTags('CRM · Reports')
@ApiBearerAuth()
@Controller('crm/reports')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmReportsController {
    constructor(private readonly reports: CrmReportsService) { }

    @Get(':report/export')
    @RequirePermission('crm.dashboards.read', 'crm.records.export')
    @ApiOperation({ summary: 'Report tables as CSV (sensitive, audited)' })
    async export(@CurrentOrg() ctx: OrgContext, @Param('report', ReportParam) report: ReportKey, @Query(new ZodValidationPipe(ReportQuerySchema)) q: ReportQuery, @Res() res: Response) {
        sendCsv(res, await this.reports.export(ctx, report, q));
    }

    @Get(':report')
    @RequirePermission('crm.dashboards.read')
    @ApiOperation({ summary: 'pipeline | win-loss | conversion | activity (from/to YYYY-MM-DD, pipeline_id, owner, team_id; money needs crm.financials.read)' })
    run(@CurrentOrg() ctx: OrgContext, @Param('report', ReportParam) report: ReportKey, @Query(new ZodValidationPipe(ReportQuerySchema)) q: ReportQuery) {
        return this.reports.run(ctx, report, q);
    }
}
