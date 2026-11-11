import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { PortalAdminService } from './admin/portal-admin.service';
import { PortalClientQuerySchema, PortalUserQuerySchema, ProfileChangeQuerySchema } from './admin/dto/portal-admin.dto';

const M = ModuleKey.CUSTOMER_PORTAL;

/** MCP adapter for the agency side of 07 Client portal — same service and validation as REST. */
@Injectable()
export class PortalMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly admin: PortalAdminService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'portal_overview_read', description: 'Client portal overview: enabled clients, active users, pending invitations and profile changes.', permission: 'portal.users.read', module: M, input: z.object({}), handler: (ctx) => this.admin.overview(ctx) },
            { name: 'portal_clients_read', description: 'Customers with their portal status and user counts.', permission: 'portal.users.read', module: M, resource_type: 'crm_company', input: PortalClientQuerySchema, handler: (ctx, a) => this.admin.clients(ctx, a) },
            { name: 'portal_users_read', description: 'Portal users across clients (filter by company, role, status).', permission: 'portal.users.read', module: M, resource_type: 'customer_portal_membership', input: PortalUserQuerySchema, handler: (ctx, a) => this.admin.users(ctx, a) },
            {
                name: 'portal_invitations_manage',
                description: 'Invite people of a client company to the customer portal.',
                permission: 'portal.users.manage',
                module: M,
                resource_type: 'invitation',
                sensitive: true,
                input: z.object({ company_id: z.string().uuid(), emails: z.array(z.string().email()).min(1).max(50), role_id: z.string().uuid().optional(), message: z.string().max(2000).optional() }),
                handler: (ctx, a) => this.admin.invite(ctx, a),
            },
            { name: 'portal_profile_changes_read', description: 'Customer profile change requests.', permission: 'portal.profile_changes.review', module: M, input: ProfileChangeQuerySchema, handler: (ctx, a) => this.admin.profileChanges(ctx, a) },
            {
                name: 'portal_profile_changes_review',
                description: 'Approve (and apply to CRM) or reject a customer profile change.',
                permission: 'portal.profile_changes.review',
                module: M,
                sensitive: true,
                input: z.object({ id: z.string().uuid(), approve: z.boolean(), review_note: z.string().max(2000).optional() }),
                handler: (ctx, a) => this.admin.reviewProfileChange(ctx, a.id, a.approve, a.review_note),
            },
        ]);
    }
}
