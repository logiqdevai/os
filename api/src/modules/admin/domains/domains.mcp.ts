import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { DomainsService } from './domains.service';
import { CreateDomainSchema, DomainQuerySchema, UpdateDomainSchema } from './dto/domain.dto';

@Injectable()
export class DomainsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly domains: DomainsService,
    ) { }

    onModuleInit() {
        const base = { permission: 'organizations.domains.manage', module: ModuleKey.ADMINISTRATION, resource_type: 'organization_domain' } as const;
        this.registry.registerMany([
            { ...base, name: 'organizations_domains_list', description: 'List the organization’s email domains with verification status and the DNS TXT record to publish.', input: DomainQuerySchema, handler: (ctx, args) => this.domains.findAll(ctx, args) },
            { ...base, name: 'organizations_domains_create', description: 'Add an email domain; returns the TXT record that proves ownership.', sensitive: true, input: CreateDomainSchema, handler: (ctx, args) => this.domains.create(ctx, args) },
            { ...base, name: 'organizations_domains_verify', description: 'Check the domain’s DNS TXT record now and update its status.', input: z.object({ id: z.string().uuid() }), handler: (ctx, args) => this.domains.verify(ctx, args.id) },
            { ...base, name: 'organizations_domains_update', description: 'Turn discovery or auto-provisioning on or off for a domain.', sensitive: true, input: UpdateDomainSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id, ...dto }) => this.domains.update(ctx, id, dto) },
            { ...base, name: 'organizations_domains_delete', description: 'Remove a domain from the organization.', sensitive: true, input: z.object({ id: z.string().uuid() }), handler: (ctx, args) => this.domains.remove(ctx, args.id) },
        ]);
    }
}
