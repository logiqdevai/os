import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmLeadsService } from './leads.service';
import { ConvertLeadSchema, CreateLeadSchema, LeadQuerySchema, UpdateLeadSchema } from './dto/lead.dto';

@Injectable()
export class CrmLeadsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly leads: CrmLeadsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_lead' };
        this.registry.registerMany([
            {
                ...base, name: 'crm_leads_list', permission: 'crm.leads.read',
                description: 'List leads (state open|converted|lost|all; search by name/company/email; filter by status_id, lead_source_id, owner "me").',
                input: LeadQuerySchema,
                handler: (ctx, args) => this.leads.findAll(ctx, args),
            },
            {
                ...base, name: 'crm_leads_get', permission: 'crm.leads.read',
                description: 'Get one lead with status, source, owner and conversion links.',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.leads.findOne(ctx, args.id),
            },
            {
                ...base, name: 'crm_leads_create', permission: 'crm.leads.create',
                description: 'Create a lead. Fails with possible_duplicates on an existing email unless allow_duplicate is true.',
                input: CreateLeadSchema,
                handler: (ctx, args) => this.leads.create(ctx, args),
            },
            {
                ...base, name: 'crm_leads_update', permission: 'crm.leads.update',
                description: 'Update lead fields by id.',
                input: UpdateLeadSchema,
                handler: (ctx, { id, ...dto }) => this.leads.update(ctx, id, dto),
            },
            {
                ...base, name: 'crm_leads_convert', permission: 'crm.leads.convert', sensitive: true,
                description: 'Convert a lead: company {existing_id | new{...}}, contact {existing_id | new{...}}, optional deal {name, value, pipeline_id, stage_id}. Needs the create key of each new record.',
                input: ConvertLeadSchema,
                handler: (ctx, { id, ...dto }) => this.leads.convert(ctx, id, dto),
            },
        ]);
    }
}
