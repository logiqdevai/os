import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { RolesService } from './roles.service';
import { CreateRoleSchema, RoleQuerySchema } from './dto/role.dto';

@Injectable()
export class RolesMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly roles: RolesService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'role' };
        this.registry.registerMany([
            { ...base, name: 'users_roles_list', description: 'List role templates and custom roles.', permission: 'users.roles.read', input: RoleQuerySchema, handler: (ctx, a) => this.roles.findAll(ctx, a) },
            { ...base, name: 'users_roles_get', description: 'Get a role with its permissions and versions.', permission: 'users.roles.read', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.roles.findOne(ctx, a.id) },
            { ...base, name: 'users_roles_create', description: 'Create a draft custom role, optionally cloned from a template.', permission: 'users.roles.manage', sensitive: true, input: CreateRoleSchema, handler: (ctx, a) => this.roles.create(ctx, a) },
            { ...base, name: 'users_roles_publish', description: 'Publish a custom role so it takes effect.', permission: 'users.roles.manage', sensitive: true, input: z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }), handler: (ctx, a) => this.roles.publish(ctx, a.id, a.note) },
        ]);
    }
}
