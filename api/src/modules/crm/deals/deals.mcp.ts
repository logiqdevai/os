import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmDealsService } from './deals.service';
import { BoardQuerySchema, ChangeStageSchema, CreateDealSchema, DealQuerySchema, UpdateDealSchema } from './dto/deal.dto';

@Injectable()
export class CrmDealsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly deals: CrmDealsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'crm_deal' };
        this.registry.registerMany([
            {
                ...base, name: 'crm_deals_list', permission: 'crm.deals.read',
                description: 'List deals (search by name/company; filter by pipeline_id, stage_id, status OPEN|WON|LOST|ABANDONED, owner "me", company_id, contact_id, close_from/close_to YYYY-MM-DD). Money fields are null without crm.financials.read.',
                input: DealQuerySchema,
                handler: (ctx, args) => this.deals.findAll(ctx, args),
            },
            {
                ...base, name: 'crm_deals_board', permission: 'crm.deals.read',
                description: 'Pipeline board: every stage with its deals, count, total and weighted value.',
                input: BoardQuerySchema,
                handler: (ctx, args) => this.deals.board(ctx, args),
            },
            {
                ...base, name: 'crm_deals_get', permission: 'crm.deals.read',
                description: 'Get one deal with pipeline stages, contacts, line items and stage history.',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.deals.findOne(ctx, args.id),
            },
            {
                ...base, name: 'crm_deals_create', permission: 'crm.deals.create',
                description: 'Create a deal. Defaults: default pipeline, its first stage, the caller as owner, the pipeline currency.',
                input: CreateDealSchema,
                handler: (ctx, args) => this.deals.create(ctx, args),
            },
            {
                ...base, name: 'crm_deals_update', permission: 'crm.deals.update',
                description: 'Update deal fields by id (name, company, contact, value, close date, next step…). Use crm_deals_change_stage for stages.',
                input: UpdateDealSchema,
                handler: (ctx, { id, ...dto }) => this.deals.update(ctx, id, dto),
            },
            {
                ...base, name: 'crm_deals_change_stage', permission: 'crm.deals.change_stage', sensitive: true,
                description: 'Move a deal to a stage of its pipeline. The lost stage needs lost_reason_id (see crm_settings_list). Won/lost need human confirmation for AI callers.',
                input: ChangeStageSchema,
                handler: (ctx, { id, ...dto }) => this.deals.changeStage(ctx, id, dto),
            },
            {
                ...base, name: 'crm_deals_assign', permission: 'crm.deals.assign',
                description: 'Change the owner of a deal.',
                input: z.object({ id: z.string().uuid(), owner_membership_id: z.string().uuid() }),
                handler: (ctx, args) => this.deals.assign(ctx, args.id, args.owner_membership_id),
            },
        ]);
    }
}
