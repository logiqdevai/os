import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { OrganizationService } from './organization.service';
import { UpdateOrganizationSchema } from './dto/organization.dto';

@Injectable()
export class OrganizationMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly organization: OrganizationService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'organization' };
        this.registry.registerMany([
            { ...base, name: 'organizations_settings_get', description: 'Get the organization profile, defaults and branding.', permission: 'organizations.settings.manage', input: z.object({}), handler: (ctx) => this.organization.get(ctx) },
            { ...base, name: 'organizations_settings_update', description: 'Update the organization profile and defaults.', permission: 'organizations.settings.manage', sensitive: true, input: UpdateOrganizationSchema, handler: (ctx, a) => this.organization.update(ctx, a) },
            { ...base, resource_type: 'organization_module', name: 'organizations_modules_list', description: 'List modules and whether each is enabled.', permission: 'organizations.modules.manage', input: z.object({}), handler: (ctx) => this.organization.modules(ctx) },
        ]);
    }
}
