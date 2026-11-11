import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationQuerySchema } from './dto/integration.dto';
import { AdminAccessService } from '../shared/admin-access.service';

/** Agents may only list connections (status, hints); credentials are entered by humans in the UI. */
@Injectable()
export class IntegrationsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly integrations: IntegrationsService) { }

    onModuleInit() {
        this.registry.register({
            name: 'organizations_integrations_list',
            description: 'List connected integrations with status and key hints (never secrets).',
            permission: 'organizations.integrations.read',
            module: ModuleKey.ADMINISTRATION,
            resource_type: 'integration_connection',
            input: IntegrationQuerySchema,
            handler: (ctx, a) => this.integrations.findAll(ctx, a),
        });
    }
}

@Module({
    controllers: [IntegrationsController],
    providers: [IntegrationsService, IntegrationsMcp, AdminAccessService],
})
export class IntegrationsModule { }
