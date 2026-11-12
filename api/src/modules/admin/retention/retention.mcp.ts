import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { RetentionService } from './retention.service';
import { DataClassParamSchema, UpdateRetentionPolicySchema } from './dto/retention.dto';

@Injectable()
export class RetentionMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly retention: RetentionService,
    ) { }

    onModuleInit() {
        const base = { permission: 'organizations.retention.manage', module: ModuleKey.ADMINISTRATION, resource_type: 'organization_retention_policy' } as const;
        this.registry.registerMany([
            { ...base, name: 'organizations_retention_list', description: 'Retention policies of platform data (audit events, sessions, invitations, webhook deliveries) with the rows eligible now.', input: z.object({}), handler: (ctx) => this.retention.findAll(ctx) },
            {
                ...base,
                name: 'organizations_retention_update',
                description: 'Change the retention period, action or legal hold of one data class. Needs human confirmation.',
                sensitive: true,
                input: UpdateRetentionPolicySchema.extend({ data_class: DataClassParamSchema }),
                handler: (ctx, { data_class, ...dto }) => this.retention.update(ctx, data_class, dto),
            },
        ]);
    }
}
