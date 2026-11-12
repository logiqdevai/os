import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { DelegationsService } from './delegations.service';
import { CreateDelegationSchema, DelegationQuerySchema } from './dto/delegation.dto';

@Injectable()
export class DelegationsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly delegations: DelegationsService,
    ) { }

    onModuleInit() {
        const base = { permission: 'users.delegations.manage', module: ModuleKey.ADMINISTRATION, resource_type: 'delegation' } as const;
        this.registry.registerMany([
            { ...base, name: 'users_delegations_list', description: 'List delegations (who temporarily holds whose permissions, scope, period, status).', input: DelegationQuerySchema, handler: (ctx, args) => this.delegations.findAll(ctx, args) },
            {
                ...base,
                name: 'users_delegations_create',
                description: 'Delegate selected permission keys or roles to a member for a period (only keys the delegator holds). Needs human confirmation.',
                sensitive: true,
                input: CreateDelegationSchema,
                handler: (ctx, args) => this.delegations.create(ctx, args),
            },
            {
                ...base,
                name: 'users_delegations_revoke',
                description: 'End a delegation now.',
                sensitive: true,
                input: z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }),
                handler: (ctx, args) => this.delegations.revoke(ctx, args.id, { reason: args.reason }),
            },
        ]);
    }
}
