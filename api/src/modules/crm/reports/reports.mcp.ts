import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmReportsService, REPORT_KEYS, ReportQuerySchema } from './reports.service';

/** MCP tool for CRM reports (same service as REST). */
@Injectable()
export class CrmReportsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly reports: CrmReportsService) { }

    onModuleInit() {
        this.registry.register({
            name: 'crm_reports_read', module: ModuleKey.CRM, resource_type: 'crm_report', permission: 'crm.dashboards.read',
            description: 'CRM report: pipeline (open deals by stage and owner), win-loss (win rate, lost reasons, by owner/month), conversion (leads by source, funnel, days to convert) or activity (completed by type/owner/week). Optional from/to (YYYY-MM-DD), pipeline_id, owner ("me" or membership id), team_id.',
            input: ReportQuerySchema.extend({ report: z.enum(REPORT_KEYS) }),
            handler: (ctx, { report, ...q }) => this.reports.run(ctx, report, q),
        });
    }
}
