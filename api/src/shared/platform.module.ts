import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { AuthorizationService } from './authorization/authorization.service';
import { CredentialsService } from './authorization/credentials.service';
import { MfaRequirementService } from './authorization/mfa-requirement.service';
import { PermissionsGuard } from './authorization/guards/permissions.guard';
import { AuditService } from './audit/audit.service';
import { EventsService } from './events/events.service';
import { JwtGuard } from './guards/jwt.guard';
import { McpRegistry } from '@/core/mcp/mcp.registry';

/**
 * Cross-cutting platform services available to every feature module without importing:
 * authorization (01 §136), credentials, audit, event bus, MCP registry, and the guards.
 */
@Global()
@Module({
    imports: [PrismaModule, JwtModule.register({})],
    providers: [AuthorizationService, CredentialsService, MfaRequirementService, PermissionsGuard, JwtGuard, AuditService, EventsService, McpRegistry],
    exports: [PrismaModule, JwtModule, AuthorizationService, CredentialsService, MfaRequirementService, PermissionsGuard, JwtGuard, AuditService, EventsService, McpRegistry],
})
export class PlatformModule { }
