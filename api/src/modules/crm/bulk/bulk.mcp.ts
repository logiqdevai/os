import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { BulkActionSchema, CrmBulkService } from './bulk.service';

/** MCP tool for bulk actions (same service as REST; every record checked). */
@Injectable()
export class CrmBulkMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly bulk: CrmBulkService) { }

    onModuleInit() {
        this.registry.register({
            name: 'crm_records_bulk_update', module: ModuleKey.CRM, resource_type: 'crm_record', permission: 'crm.deals.read', sensitive: true,
            description: 'Apply one action to up to 200 CRM records of one type: assign (owner_membership_id), add_tag / remove_tag (tag_id), set_status (leads, status_id), set_stage (deals, stage_id), set_lifecycle (companies/contacts), set_type (companies), archive, restore. Each record needs the matching key and scope; returns succeeded and failed ids.',
            input: BulkActionSchema,
            handler: (ctx, args) => this.bulk.run(ctx, args),
        });
    }
}
