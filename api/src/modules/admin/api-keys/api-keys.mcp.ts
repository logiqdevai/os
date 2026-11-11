import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyQuerySchema } from './dto/api-key.dto';

/** Agents may list and revoke keys; creating keys (which returns a secret) is UI/REST only. */
@Injectable()
export class ApiKeysMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly keys: ApiKeysService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'api_key', permission: 'organizations.api_keys.manage' };
        this.registry.registerMany([
            { ...base, name: 'organizations_api_keys_list', description: 'List API keys (metadata only, never secrets).', input: ApiKeyQuerySchema, handler: (ctx, a) => this.keys.findAll(ctx, a) },
            { ...base, name: 'organizations_api_keys_revoke', description: 'Revoke an API key.', sensitive: true, input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.keys.revoke(ctx, a.id) },
        ]);
    }
}
