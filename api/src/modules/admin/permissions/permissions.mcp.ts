import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { PermissionsService } from './permissions.service';
import { CreateGrantSchema, PermissionQuerySchema, SimulateSchema } from './dto/permission.dto';

@Injectable()
export class PermissionsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly permissions: PermissionsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'permission' };
        this.registry.registerMany([
            { ...base, name: 'users_permissions_list', description: 'Search the permission catalog (filter by module or sensitive).', permission: 'users.permissions.read', input: PermissionQuerySchema, handler: (ctx, a) => this.permissions.catalog(ctx, a) },
            { ...base, name: 'users_permissions_simulate', description: 'Explain whether a member holds a permission and why (read-only).', permission: 'users.permissions.simulate', input: SimulateSchema, handler: (ctx, a) => this.permissions.simulate(ctx, a) },
            { ...base, resource_type: 'permission_grant', name: 'users_permissions_grant', description: 'Allow or deny one permission for a member.', permission: 'users.permissions.grant', sensitive: true, input: CreateGrantSchema, handler: (ctx, a) => this.permissions.createGrant(ctx, a) },
        ]);
    }
}
