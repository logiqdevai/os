import { Module } from '@nestjs/common';
import { OverviewModule } from './overview/overview.module';
import { MembersModule } from './members/members.module';
import { InvitationsModule } from './invitations/invitations.module';
import { BranchesModule } from './branches/branches.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganizationModule } from './organization/organization.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { ServiceAccountsModule } from './service-accounts/service-accounts.module';
import { McpCallsModule } from './mcp-calls/mcp-calls.module';
import { AuditLogModule } from './audit/audit-log.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SessionsModule } from './sessions/sessions.module';
import { SecurityPolicyModule } from './security/security-policy.module';
import { DomainsModule } from './domains/domains.module';

/**
 * Module 01 Administration (docs/features/01-users-organizations-permissions.md). Teams is registered on its own
 * (reference module); everything else in the admin area is bundled here so feature-modules.ts needs one line.
 */
@Module({
    imports: [
        OverviewModule,
        MembersModule,
        InvitationsModule,
        BranchesModule,
        RolesModule,
        PermissionsModule,
        OrganizationModule,
        ApiKeysModule,
        ServiceAccountsModule,
        McpCallsModule,
        AuditLogModule,
        IntegrationsModule,
        SessionsModule,
        SecurityPolicyModule,
        DomainsModule,
    ],
})
export class AdminModule { }
