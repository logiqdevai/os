import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { InvitationsService } from './invitations.service';
import { CreateInvitationSchema, InvitationQuerySchema } from './dto/invitation.dto';

@Injectable()
export class InvitationsMcp implements OnModuleInit {
    constructor(private readonly registry: McpRegistry, private readonly invitations: InvitationsService) { }

    onModuleInit() {
        const base = { module: ModuleKey.ADMINISTRATION, resource_type: 'invitation' };
        this.registry.registerMany([
            { ...base, name: 'users_invitations_list', description: 'List member invitations (filter by status, search by email).', permission: 'users.members.read', input: InvitationQuerySchema, handler: (ctx, a) => this.invitations.findAll(ctx, a) },
            { ...base, name: 'users_members_invite', description: 'Invite people by email with an optional role, scope, branch and team.', permission: 'users.members.invite', sensitive: true, input: CreateInvitationSchema, handler: (ctx, a) => this.invitations.create(ctx, a) },
            { ...base, name: 'users_invitations_cancel', description: 'Cancel a pending invitation.', permission: 'users.members.invite', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.invitations.cancel(ctx, a.id) },
        ]);
    }
}
