import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { CrmCustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldSchema, CustomFieldQuerySchema, UpdateCustomFieldSchema } from './dto/custom-field.dto';

/** MCP tools for custom field definitions. Values are set with each record's create/update tool (`custom_fields`). */
@Injectable()
export class CrmCustomFieldsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly fields: CrmCustomFieldsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.CRM, resource_type: 'custom_field_definition' };
        this.registry.registerMany([
            {
                ...base, name: 'platform_custom_fields_list', permission: 'crm.companies.read',
                description: 'Custom field definitions (key, label, type, options, required) for CRM_COMPANY | CRM_CONTACT | CRM_LEAD | CRM_DEAL. Set values with the record tools via custom_fields: { <key>: value }.',
                input: CustomFieldQuerySchema,
                handler: (ctx, args) => this.fields.findAll(ctx, args),
            },
            {
                ...base, name: 'platform_custom_fields_create', permission: 'platform.custom_fields.manage', sensitive: true,
                description: 'Create a custom field. key = immutable snake_case id; type TEXT|LONG_TEXT|NUMBER|DECIMAL|CURRENCY|PERCENTAGE|BOOLEAN|DATE|DATETIME|EMAIL|PHONE|URL|DROPDOWN|MULTI_SELECT|RADIO|USER; options [{value,label}] for DROPDOWN/MULTI_SELECT/RADIO.',
                input: CreateCustomFieldSchema,
                handler: (ctx, args) => this.fields.create(ctx, args),
            },
            {
                ...base, name: 'platform_custom_fields_update', permission: 'platform.custom_fields.manage', sensitive: true,
                description: 'Update a custom field by id (label, options, required, entity types, group). The type is locked once values exist.',
                input: UpdateCustomFieldSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id, ...dto }) => this.fields.update(ctx, id, dto),
            },
            {
                ...base, name: 'platform_custom_fields_archive', permission: 'platform.custom_fields.manage', sensitive: true,
                description: 'Archive a custom field (values are kept but hidden from forms, filters and exports).',
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.fields.archive(ctx, args.id, true),
            },
        ]);
    }
}
