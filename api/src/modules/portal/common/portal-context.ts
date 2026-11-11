import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/** Portal feature toggles (CustomerPortalSettings.features, 07 §14). Missing key = enabled. */
export const PORTAL_FEATURES = ['projects', 'requests', 'conversations', 'documents', 'proposals', 'contracts', 'billing', 'knowledge'] as const;
export type PortalFeature = (typeof PORTAL_FEATURES)[number];

/**
 * The customer-side request context (07, 01 §79), built by PortalGuard from the JWT user and the
 * `X-Portal-Membership-Id` header. Only `portal.*` keys of the membership's customer role count.
 * `customer_id` is the CRM Company the user belongs to — every read filters by it.
 */
export interface PortalContext {
    organization_id: string;
    customer_id: string;
    portal_membership_id: string;
    user_id: string;
    role: { id: string; name: string; slug: string } | null;
    permissions: string[];
    features: Record<PortalFeature, boolean>;
    can(key: string): boolean;
    /** OrgContext-shaped actor for audit/events (actor = the portal user, channel ui). Holds no agency permissions. */
    actor: OrgContext;
}

export const PORTAL_PERMISSIONS_METADATA = 'lq:portal-permissions';

/** Caller's customer role must hold at least one of these portal.* keys. No keys = any active portal member. */
export const RequirePortalPermission = (...keys: string[]) => SetMetadata(PORTAL_PERMISSIONS_METADATA, keys);
export const PortalMember = () => SetMetadata(PORTAL_PERMISSIONS_METADATA, [] as string[]);

export const CurrentPortal = createParamDecorator((_: unknown, ctx: ExecutionContext): PortalContext => ctx.switchToHttp().getRequest().portal);
