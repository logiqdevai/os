import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmActivitiesService } from './activities.service';
import { ActivityQuerySchema, CreateActivitySchema } from './dto/activity.dto';

@Injectable()
export class CrmActivitiesMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly activities: CrmActivitiesService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_activity' };
        this.registry.registerMany([
            {
                ...base, name: 'crm_activities_list', permission: 'crm.activities.read',
                description: 'List CRM activities (calls, meetings, emails, follow-ups). Use owner "me" with due "overdue"/"today"/"open" for a to-do list; filter by deal_id, company_id, contact_id, lead_id.',
                input: ActivityQuerySchema,
                handler: (ctx, args) => this.activities.findAll(ctx, args),
            },
            {
                ...base, name: 'crm_activities_create', permission: 'crm.activities.create',
                description: 'Schedule (status PLANNED with starts_at as due time) or log (status COMPLETED) a call, meeting, email or follow-up on a deal, company, contact or lead.',
                input: CreateActivitySchema,
                handler: (ctx, args) => this.activities.create(ctx, args),
            },
            {
                ...base, name: 'crm_activities_complete', permission: 'crm.activities.update',
                description: 'Mark an activity completed with an optional outcome.',
                input: z.object({ id: z.string().uuid(), outcome: z.string().max(2000).optional() }),
                handler: (ctx, args) => this.activities.complete(ctx, args.id, args.outcome),
            },
        ]);
    }
}
