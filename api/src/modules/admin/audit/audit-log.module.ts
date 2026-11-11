import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService, AuditQuerySchema } from './audit-log.service';

@Injectable()
export class AuditLogMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly audit: AuditLogService) { }

    onModuleInit() {
        this.registry.register({
            name: 'organizations_audit_read',
            description: 'Search the audit log (event type, actor, resource, outcome, date range).',
            permission: 'organizations.audit.read',
            module: ModuleKey.ADMINISTRATION,
            resource_type: 'audit_event',
            input: AuditQuerySchema,
            handler: (ctx, a) => this.audit.findAll(ctx, a),
        });
    }
}

@Module({
    controllers: [AuditLogController],
    providers: [AuditLogService, AuditLogMcp],
})
export class AuditLogModule { }
