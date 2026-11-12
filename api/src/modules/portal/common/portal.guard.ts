import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext, RequestPrincipal } from '@/shared/authorization/interfaces/org-context.interface';
import { MfaRequirementService } from '@/shared/authorization/mfa-requirement.service';
import { PORTAL_FEATURES, PORTAL_PERMISSIONS_METADATA, PortalContext, PortalFeature } from './portal-context';

const toFeatures = (raw: unknown): Partial<Record<PortalFeature, boolean>> => {
    const out: Partial<Record<PortalFeature, boolean>> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const f of PORTAL_FEATURES) {
            const v = (raw as Record<string, unknown>)[f];
            if (typeof v === 'boolean') out[f] = v;
        }
    }
    return out;
};

/**
 * Customer portal guard (07, 01 §79). Order: JwtGuard → PortalGuard. Resolves the caller's active
 * CustomerPortalMembership (header `X-Portal-Membership-Id`, or the only active one), checks that the portal
 * is enabled for the organization and the client, and evaluates `portal.*` keys from the membership's customer
 * role on every request (no cache, so revocations apply immediately). Agency permissions never apply here.
 */
@Injectable()
export class PortalGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly mfa: MfaRequirementService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const required = this.reflector.getAllAndOverride<string[] | undefined>(PORTAL_PERMISSIONS_METADATA, [context.getHandler(), context.getClass()]);
        if (!required) throw new ForbiddenException({ message: 'Endpoint has no portal permission declared', code: 'permission_not_declared' });

        const principal: RequestPrincipal | undefined = request.user;
        if (!principal || principal.kind !== 'user' || !principal.id) throw new UnauthorizedException({ message: 'Sign in to the portal', code: 'authentication_required' });

        const header = request.headers['x-portal-membership-id'];
        const requested = typeof header === 'string' && header ? header : null;
        const memberships = await this.prisma.customerPortalMembership.findMany({
            where: { user_id: principal.id, status: 'ACTIVE', ...(requested ? { id: requested } : {}), organization: { deleted_at: null } },
            include: { role: { select: { id: true, name: true, slug: true, status: true, permissions: { select: { effect: true, permission: { select: { key: true } } } } } } },
            take: 2,
        });
        if (!memberships.length) throw new NotFoundException({ message: 'Portal access not found', code: 'portal_membership_not_found' });
        if (!requested && memberships.length > 1) throw new ForbiddenException({ message: 'Choose which company to open', code: 'portal_membership_required' });
        const m = memberships[0];
        // 01 §74, §79: the organization's portal MFA policy; the portal app sends the person to enrolment first.
        if (await this.mfa.portalMustEnroll(principal.id, m.organization_id)) {
            throw new ForbiddenException({ message: 'Two-step verification is required. Set it up to continue.', code: 'mfa_enrollment_required' });
        }

        const [module, orgSettings, clientSettings] = await Promise.all([
            this.prisma.organizationModule.findUnique({ where: { organization_id_module: { organization_id: m.organization_id, module: 'CUSTOMER_PORTAL' } }, select: { enabled: true } }),
            this.prisma.customerPortalSettings.findUnique({ where: { organization_id: m.organization_id }, select: { enabled: true, features: true } }),
            this.prisma.customerPortalClientSettings.findUnique({ where: { organization_id_company_id: { organization_id: m.organization_id, company_id: m.customer_id } }, select: { enabled: true, features: true } }),
        ]);
        if (module && !module.enabled) throw new ForbiddenException({ message: 'The customer portal is not available', code: 'portal_disabled' });
        if (orgSettings && !orgSettings.enabled) throw new ForbiddenException({ message: 'The customer portal is not available', code: 'portal_disabled' });
        if (clientSettings && !clientSettings.enabled) throw new ForbiddenException({ message: 'Portal access for your company is switched off', code: 'portal_client_disabled' });

        const allow = new Set<string>();
        const deny = new Set<string>();
        if (m.role && m.role.status !== 'DRAFT') {
            for (const rp of m.role.permissions) {
                if (!rp.permission.key.startsWith('portal.')) continue;
                (rp.effect === 'DENY' ? deny : allow).add(rp.permission.key);
            }
        }
        deny.forEach((k) => allow.delete(k));
        const permissions = [...allow].sort();

        const features = { ...toFeatures(orgSettings?.features), ...toFeatures(clientSettings?.features) };
        const resolvedFeatures = Object.fromEntries(PORTAL_FEATURES.map((f) => [f, features[f] ?? true])) as Record<PortalFeature, boolean>;
        const can = (key: string) => allow.has(key);

        const actor = {
            organization_id: m.organization_id,
            user_id: principal.id,
            membership_id: null,
            service_account_id: null,
            api_key_id: null,
            actor_type: 'USER',
            channel: 'ui',
            ip_address: request.ip ?? null,
            user_agent: request.headers['user-agent'] ?? null,
            effective: { permissions: {}, modules: [] },
            can: () => false,
            scopeOf: () => null,
        } as OrgContext;

        const portal: PortalContext = {
            organization_id: m.organization_id,
            customer_id: m.customer_id,
            portal_membership_id: m.id,
            user_id: principal.id,
            role: m.role ? { id: m.role.id, name: m.role.name, slug: m.role.slug } : null,
            permissions,
            features: resolvedFeatures,
            can,
            actor,
        };
        request.portal = portal;

        if (required.length && !required.some(can)) {
            this.audit.recordAsync(actor, 'authorization.denied', { outcome: 'DENIED', metadata: { permissions: required, route: `${request.method} ${request.route?.path ?? request.url}`, portal_membership_id: m.id } });
            throw new ForbiddenException({ message: `Your portal role cannot do this (${required.join(' or ')})`, code: 'permission_denied', permissions: required });
        }

        // Activity heartbeat (01 §79 last_active_at), at most once a minute.
        if (!m.last_active_at || Date.now() - m.last_active_at.getTime() > 60_000) {
            this.prisma.customerPortalMembership.update({ where: { id: m.id }, data: { last_active_at: new Date() } }).catch(() => undefined);
        }
        return true;
    }
}
