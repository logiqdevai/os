import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { MembersService } from './members.service';
import { MemberQuerySchema } from './dto/member-query.schema';
import { AssignRoleSchema } from './dto/member.dto';

const id = z.object({ id: z.string().uuid() });

@Injectable()
export class MembersMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly members: MembersService,
    ) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'membership' };
        this.registry.registerMany([
            { ...base, name: 'users_members_list', description: 'List members (search by name or email; filter by status, type, branch, team, role).', permission: 'users.members.read', input: MemberQuerySchema, handler: (ctx, a) => this.members.findAll(ctx, a) },
            { ...base, name: 'users_members_get', description: 'Get one member with roles, branches, teams and module access.', permission: 'users.members.read', input: id, handler: (ctx, a) => this.members.findOne(ctx, a.id) },
            { ...base, name: 'users_members_suspend', description: 'Suspend a member.', permission: 'users.members.manage', sensitive: true, input: id, handler: (ctx, a) => this.members.suspend(ctx, a.id) },
            { ...base, name: 'users_members_mfa_reset', description: 'Reset a member’s two-step verification (removes their authenticator and recovery codes; they must enrol again). Needs human confirmation.', permission: 'users.members.manage', sensitive: true, input: id, handler: (ctx, a) => this.members.resetMfa(ctx, a.id) },
            { ...base, name: 'users_members_reactivate', description: 'Reactivate a suspended member.', permission: 'users.members.manage', sensitive: true, input: id, handler: (ctx, a) => this.members.reactivate(ctx, a.id) },
            {
                ...base, resource_type: 'role_assignment', name: 'users_roles_assign', description: 'Assign a role to a member with an optional scope and end date.', permission: 'users.roles.assign', sensitive: true,
                input: AssignRoleSchema, handler: (ctx, { membership_id, ...dto }) => this.members.assignRole(ctx, membership_id, dto),
            },
        ]);
    }
}
