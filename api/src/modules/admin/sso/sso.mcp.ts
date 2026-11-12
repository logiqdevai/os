import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { SsoService } from './sso.service';
import { GroupMappingSchema } from './dto/sso.dto';

/** Read + group mappings for agents. Creating / editing an IdP (secrets) stays a human task in the UI or REST API. */
@Injectable()
export class SsoMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly sso: SsoService,
    ) { }

    onModuleInit() {
        const base = { permission: 'organizations.sso.manage', module: ModuleKey.ADMINISTRATION, resource_type: 'sso_configuration' } as const;
        this.registry.registerMany([
            { ...base, name: 'organizations_sso_list', description: 'List SSO identity providers (SAML / OIDC public settings, status, group mappings). Secrets are never returned.', input: z.object({}), handler: (ctx) => this.sso.findAll(ctx) },
            {
                ...base,
                name: 'organizations_sso_group_mappings_create',
                description: 'Map an identity-provider group to a role, team, branch and modules.',
                sensitive: true,
                input: GroupMappingSchema.extend({ sso_configuration_id: z.string().uuid() }),
                handler: (ctx, { sso_configuration_id, ...dto }) => this.sso.addMapping(ctx, sso_configuration_id, dto),
            },
            {
                ...base,
                name: 'organizations_sso_group_mappings_delete',
                description: 'Remove an identity-provider group mapping.',
                sensitive: true,
                input: z.object({ sso_configuration_id: z.string().uuid(), mapping_id: z.string().uuid() }),
                handler: (ctx, args) => this.sso.removeMapping(ctx, args.sso_configuration_id, args.mapping_id),
            },
        ]);
    }
}
