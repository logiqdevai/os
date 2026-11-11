import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey, ServiceAccountStatus } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ServiceAccountsService } from './service-accounts.service';
import { ServiceAccountQuerySchema } from './dto/service-account.dto';

@Injectable()
export class ServiceAccountsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly accounts: ServiceAccountsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'service_account', permission: 'organizations.service_accounts.manage' };
        this.registry.registerMany([
            { ...base, name: 'organizations_service_accounts_list', description: 'List service accounts with their roles.', input: ServiceAccountQuerySchema, handler: (ctx, a) => this.accounts.findAll(ctx, a) },
            { ...base, name: 'organizations_service_accounts_suspend', description: 'Suspend a service account.', sensitive: true, input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.accounts.setStatus(ctx, a.id, ServiceAccountStatus.SUSPENDED) },
        ]);
    }
}
