import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { SecurityPolicyService } from './security-policy.service';
import { UpdateSecurityPolicySchema } from './dto/security-policy.dto';

@Injectable()
export class SecurityPolicyMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly policy: SecurityPolicyService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            {
                name: 'organizations_security_policy_get',
                description: 'Read the organization security policy: password rules, MFA policy, session lifetime, idle timeout, IP / country / domain restrictions.',
                permission: 'organizations.security.manage',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'organization_security_policy',
                input: z.object({}),
                handler: (ctx) => this.policy.get(ctx),
            },
            {
                name: 'organizations_security_policy_update',
                description: 'Change the organization security policy (partial update; durations in minutes). Always needs human confirmation.',
                permission: 'organizations.security.manage',
                module: ModuleKey.ADMINISTRATION,
                resource_type: 'organization_security_policy',
                sensitive: true,
                input: UpdateSecurityPolicySchema,
                handler: (ctx, args) => this.policy.update(ctx, args),
            },
        ]);
    }
}
