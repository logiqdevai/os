import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmNotesService } from './notes/notes.service';
import { CreateNoteSchema, NoteQuerySchema } from './notes/dto/note.dto';
import { CrmSettingsService } from './settings/settings.service';
import { CrmPipelinesService } from './pipelines/pipelines.service';
import { CreatePipelineSchema } from './pipelines/dto/pipeline.dto';
import { CrmInsightsService, DashboardQuerySchema, ForecastQuerySchema } from './insights/insights.service';

/** MCP tools for CRM configuration, notes, dashboards and forecast (same services as REST). */
@Injectable()
export class CrmMiscMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly notes: CrmNotesService,
        private readonly settings: CrmSettingsService,
        private readonly pipelines: CrmPipelinesService,
        private readonly insights: CrmInsightsService,
    ) { }

    onModuleInit() {
        const m = ModuleKey.CRM;
        this.registry.registerMany([
            {
                name: 'crm_pipelines_list', module: m, resource_type: 'crm_pipeline', permission: 'crm.deals.read',
                description: 'List pipelines with their ordered stages (ids, probabilities, won/lost flags). Needed to pick stage_id for deals.',
                input: z.object({}),
                handler: (ctx) => this.pipelines.findAll(ctx),
            },
            {
                name: 'crm_pipelines_manage', module: m, resource_type: 'crm_pipeline', permission: 'crm.pipelines.manage', sensitive: true,
                description: 'Create a pipeline (the standard 8 stages are used when stages are omitted; exactly one won and one lost stage).',
                input: CreatePipelineSchema,
                handler: (ctx, args) => this.pipelines.create(ctx, args),
            },
            {
                name: 'crm_settings_list', module: m, resource_type: 'crm_settings', permission: 'crm.leads.read',
                description: 'Lead sources, lead statuses, lifecycle stages and loss reasons (ids for lead/deal fields).',
                input: z.object({}),
                handler: (ctx) => this.settings.all(ctx),
            },
            {
                name: 'crm_members_list', module: m, resource_type: 'membership', permission: 'crm.deals.read',
                description: 'Active members (membership ids) for owner and assignee fields.',
                input: z.object({ search: z.string().optional() }),
                handler: (ctx, args) => this.settings.members(ctx, args.search),
            },
            {
                name: 'crm_notes_list', module: m, resource_type: 'crm_note', permission: 'crm.deals.read',
                description: 'Notes of a company, contact, lead or deal (private notes only with crm.notes.private.read).',
                input: NoteQuerySchema,
                handler: (ctx, args) => this.notes.findAll(ctx, args),
            },
            {
                name: 'crm_notes_create', module: m, resource_type: 'crm_note', permission: 'crm.deals.update',
                description: 'Add a markdown note to a company, contact, lead or deal (needs that record type update key).',
                input: CreateNoteSchema,
                handler: (ctx, args) => this.notes.create(ctx, args),
            },
            {
                name: 'crm_dashboards_read', module: m, resource_type: 'crm_dashboard', permission: 'crm.dashboards.read',
                description: 'CRM KPIs: open deals, pipeline and weighted value, won this month, win rate, lead conversion, stage breakdown, deals closing soon.',
                input: DashboardQuerySchema,
                handler: (ctx, args) => this.insights.dashboard(ctx, args),
            },
            {
                name: 'crm_forecast_read', module: m, resource_type: 'crm_forecast', permission: 'crm.forecast.read',
                description: 'Forecast: open deals by expected close month with total, weighted, commit and best-case values.',
                input: ForecastQuerySchema,
                handler: (ctx, args) => this.insights.forecast(ctx, args),
            },
        ]);
    }
}
