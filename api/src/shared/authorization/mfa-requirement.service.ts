import { Injectable } from '@nestjs/common';
import { MembershipStatus, MfaPolicy } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from './authorization.service';

/**
 * Permission keys that make a member an "administrator" for MfaPolicy.REQUIRED_FOR_ADMINS (01 §74). Checked as
 * permissions, never role names: anyone who can change security, settings, roles, grants or members counts.
 */
export const MFA_ADMIN_PERMISSION_KEYS = [
    'organizations.security.manage',
    'organizations.settings.manage',
    'organizations.sso.manage',
    'users.roles.manage',
    'users.permissions.grant',
    'users.members.manage',
];

export type MfaRequirementReason = 'ALL' | 'ADMIN' | 'SENSITIVE' | 'PORTAL';
export interface MfaRequirement {
    required: boolean;
    reason: MfaRequirementReason | null;
}

const CACHE_MS = 60_000;
const NOT_REQUIRED: MfaRequirement = { required: false, reason: null };

/**
 * Decides whether a person must use MFA under the organization security policy (01 §73–74):
 * `mfa_policy` for members (OPTIONAL | REQUIRED_FOR_ADMINS | REQUIRED_FOR_ALL | REQUIRED_FOR_SENSITIVE_MODULES —
 * "sensitive" = holds any `is_sensitive` permission key) and `portal_mfa_policy` for customer portal users.
 * Used by the auth flows (enrolment flag) and by PermissionsGuard (blocks members who must enrol but have not).
 */
@Injectable()
export class MfaRequirementService {
    private readonly blockCache = new Map<string, { at: number; blocked: boolean }>();
    private sensitive: { at: number; keys: Set<string> } | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly authorization: AuthorizationService,
    ) { }

    /** Requirement for a user in one organization (member policy) plus any customer portal policy that applies. */
    async requirementFor(userId: string, organizationId: string | null): Promise<MfaRequirement> {
        if (organizationId) {
            const membership = await this.prisma.membership.findUnique({
                where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
                select: { id: true, status: true },
            });
            if (membership?.status === MembershipStatus.ACTIVE) {
                const effective = await this.authorization.effectiveFor({ organization_id: organizationId, membership_id: membership.id });
                const member = await this.memberRequirement(organizationId, Object.keys(effective.permissions));
                if (member.required) return member;
            }
        }
        return this.portalRequirement(userId);
    }

    /** Member policy given the member's effective permission keys. */
    async memberRequirement(organizationId: string, permissionKeys: string[]): Promise<MfaRequirement> {
        const policy = await this.prisma.organizationSecurityPolicy.findUnique({ where: { organization_id: organizationId }, select: { mfa_policy: true } });
        switch (policy?.mfa_policy ?? MfaPolicy.OPTIONAL) {
            case MfaPolicy.REQUIRED_FOR_ALL:
                return { required: true, reason: 'ALL' };
            case MfaPolicy.REQUIRED_FOR_ADMINS:
                return permissionKeys.some((k) => MFA_ADMIN_PERMISSION_KEYS.includes(k)) ? { required: true, reason: 'ADMIN' } : NOT_REQUIRED;
            case MfaPolicy.REQUIRED_FOR_SENSITIVE_MODULES: {
                const sensitive = await this.sensitiveKeys();
                return permissionKeys.some((k) => sensitive.has(k)) ? { required: true, reason: 'SENSITIVE' } : NOT_REQUIRED;
            }
            default:
                return NOT_REQUIRED;
        }
    }

    /** Customer portal users follow `portal_mfa_policy` of each organization they have an active portal membership in. */
    async portalRequirement(userId: string): Promise<MfaRequirement> {
        const portal = await this.prisma.customerPortalMembership.findMany({ where: { user_id: userId, status: 'ACTIVE' }, select: { organization_id: true } });
        if (!portal.length) return NOT_REQUIRED;
        const strict = await this.prisma.organizationSecurityPolicy.count({
            where: { organization_id: { in: [...new Set(portal.map((p) => p.organization_id))] }, portal_mfa_policy: { not: MfaPolicy.OPTIONAL } },
        });
        return strict ? { required: true, reason: 'PORTAL' } : NOT_REQUIRED;
    }

    /**
     * True when this member must have MFA but has not enrolled. Cached per user + organization for a minute;
     * `forget(userId)` after enrolment / reset and `clear()` after a policy change.
     */
    async mustEnroll(userId: string, organizationId: string, permissionKeys: string[]): Promise<boolean> {
        const key = `${userId}:${organizationId}`;
        const hit = this.blockCache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) return hit.blocked;
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfa_enabled: true } });
        const blocked = !user?.mfa_enabled && (await this.memberRequirement(organizationId, permissionKeys)).required;
        this.blockCache.set(key, { at: Date.now(), blocked });
        if (this.blockCache.size > 10_000) this.blockCache.clear();
        return blocked;
    }

    forget(userId: string) {
        for (const key of [...this.blockCache.keys()]) if (key.startsWith(`${userId}:`)) this.blockCache.delete(key);
    }

    clear() {
        this.blockCache.clear();
    }

    private async sensitiveKeys(): Promise<Set<string>> {
        if (this.sensitive && Date.now() - this.sensitive.at < 10 * CACHE_MS) return this.sensitive.keys;
        const rows = await this.prisma.permission.findMany({ where: { is_sensitive: true }, select: { key: true } });
        this.sensitive = { at: Date.now(), keys: new Set(rows.map((r) => r.key)) };
        return this.sensitive.keys;
    }
}
