import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmMergeService, MergePreviewQuerySchema, MergeSchema } from './merge.service';
import { CrmDuplicatesService, DismissSchema, DuplicatesQuerySchema } from './duplicates.service';

/** MCP tools for the duplicates inbox and merges (merges are irreversible → sensitive). */
@Injectable()
export class CrmMergeMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly merges: CrmMergeService, private readonly duplicates: CrmDuplicatesService) { }

    onModuleInit() {
        const m = ModuleKey.CRM;
        this.registry.registerMany([
            {
                name: 'crm_duplicates_read', module: m, resource_type: 'crm_duplicate', permission: 'crm.companies.read',
                description: 'Possible duplicate pairs for CRM_COMPANY | CRM_CONTACT | CRM_LEAD with a score and the matching keys (email, phone, domain, vat, name). Suggestions only.',
                input: DuplicatesQuerySchema,
                handler: (ctx, args) => this.duplicates.find(ctx, args),
            },
            {
                name: 'crm_duplicates_dismiss', module: m, resource_type: 'crm_duplicate', permission: 'crm.companies.update',
                description: 'Mark two records as "not a duplicate" so the pair is not suggested again.',
                input: DismissSchema,
                handler: (ctx, args) => this.duplicates.dismiss(ctx, args),
            },
            {
                name: 'crm_records_merge_preview', module: m, resource_type: 'crm_merge', permission: 'crm.companies.merge',
                description: 'Compare 2–5 records field by field before a merge and count the related records that would move.',
                input: MergePreviewQuerySchema,
                handler: (ctx, args) => this.merges.preview(ctx, args),
            },
            {
                name: 'crm_records_merge', module: m, resource_type: 'crm_merge', permission: 'crm.companies.merge', sensitive: true,
                description: 'Merge records into survivor_id (irreversible). field_choices { field: record_id } picks values; related contacts, deals, activities, notes, tags, custom fields, invoices, tickets… move to the survivor; merged records are archived as redirects.',
                input: MergeSchema,
                handler: (ctx, args) => this.merges.merge(ctx, args),
            },
        ]);
    }
}
