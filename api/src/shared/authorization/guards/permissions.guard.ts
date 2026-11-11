import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../authorization.service';
import { PERMISSIONS_METADATA, PermissionRequirement } from '../decorators/require-permission.decorator';
import { AccessChannel, RequestPrincipal } from '../interfaces/org-context.interface';
import { AuditService } from '@/shared/audit/audit.service';

/**
 * Organization permission guard. Order: JwtGuard → PermissionsGuard.
 * Default deny: an organization endpoint without @RequirePermission / @RequireAnyPermission / @RequireOrgMember is rejected.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
    private readonly logger = new Logger(PermissionsGuard.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly authorization: AuthorizationService,
        private readonly audit: AuditService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSIONS_METADATA, [context.getHandler(), context.getClass()]);

        if (!requirement) {
            this.logger.error(`No permission declared on ${context.getClass().name}.${context.getHandler().name}`);
            throw new ForbiddenException({ message: 'Endpoint has no permission declared', code: 'permission_not_declared' });
        }

        const principal: RequestPrincipal = request.user;
        const header = request.headers['x-organization-id'];
        const channel: AccessChannel = request.lqChannel ?? (principal?.kind === 'api_key' ? 'api' : 'ui');

        const ctx = request.org ?? (await this.authorization.buildContext(principal, typeof header === 'string' && header ? header : null, channel, {
            ip_address: request.ip ?? null,
            user_agent: request.headers['user-agent'] ?? null,
        }));
        request.org = ctx;

        if (requirement.mode === 'member') return true;

        const ok = requirement.mode === 'all' ? requirement.keys.every((k) => ctx.can(k)) : requirement.keys.some((k) => ctx.can(k));
        if (ok) return true;

        const missing = requirement.keys.filter((k) => !ctx.can(k));
        this.audit.recordDenied(ctx, missing, `${request.method} ${request.route?.path ?? request.url}`);
        throw new ForbiddenException({
            message: `You do not have permission to do this (${missing.join(requirement.mode === 'all' ? ', ' : ' or ')})`,
            code: 'permission_denied',
            permissions: missing,
        });
    }
}
