import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InvitationPolicy, MembershipStatus, MfaPolicy, ModuleKey, OrganizationSecurityPolicy } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { ipMatches, sha256 } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { UpdateSecurityPolicyInput } from './dto/security-policy.dto';

/** Mirrors the column defaults of OrganizationSecurityPolicy: an organization without a row follows these. */
export const SECURITY_POLICY_DEFAULTS = {
    password_min_length: 10,
    password_require_symbols: false,
    password_max_age_days: null as number | null,
    mfa_policy: MfaPolicy.OPTIONAL as MfaPolicy,
    sso_required: false,
    session_duration_minutes: 43200,
    idle_timeout_minutes: null as number | null,
    allowed_email_domains: [] as string[],
    restrict_invitations_to_domains: false,
    allowed_ip_ranges: [] as string[],
    allowed_countries: [] as string[],
    invitation_policy: InvitationPolicy.PERMISSION_HOLDERS as InvitationPolicy,
    members_can_view_sessions: true,
    portal_mfa_policy: MfaPolicy.OPTIONAL as MfaPolicy,
};

/** Platform floor when no organization policy applies (e.g. signing up and creating a new organization). */
const PLATFORM_PASSWORD_RULES = { min_length: 8, require_symbols: false };

export interface PasswordRules {
    min_length: number;
    require_symbols: boolean;
}

type PolicyShape = Omit<OrganizationSecurityPolicy, 'updated_at'> & { updated_at: Date | null; is_default: boolean };

/**
 * Organization security policy (01 §72–74, mockup 01-admin `security`). Also the single place the auth module asks
 * for password rules, session lifetime and the IP allow-list, so enforcement and the admin screen never drift.
 */
@Injectable()
export class SecurityPolicyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Admin screen
    // ---------------------------------------------------------------------------------------------

    async get(ctx: OrgContext) {
        const policy = await this.forOrganization(ctx.organization_id);
        const [ssoEnabled, verifiedDomains] = await Promise.all([
            this.prisma.ssoConfiguration.count({ where: { organization_id: ctx.organization_id, enabled: true } }),
            this.prisma.organizationDomain.count({ where: { organization_id: ctx.organization_id, status: 'VERIFIED' } }),
        ]);
        return {
            ...policy,
            // Helps the UI explain lock-out risks and why "Require SSO" may be unavailable.
            context: { caller_ip: ctx.ip_address ?? null, sso_enabled: ssoEnabled > 0, verified_domains: verifiedDomains },
        };
    }

    async update(ctx: OrgContext, dto: UpdateSecurityPolicyInput) {
        const before = await this.forOrganization(ctx.organization_id);
        const after = { ...before, ...dto };

        // Lock-out guard (mockup @note): the caller's own address must stay allowed.
        if (dto.allowed_ip_ranges && after.allowed_ip_ranges.length && ctx.ip_address) {
            if (!after.allowed_ip_ranges.some((r) => ipMatches(ctx.ip_address as string, r))) {
                throw new BadRequestException({
                    message: `Your current address (${ctx.ip_address}) is not in the allowed IP ranges. Add it first so you do not lock yourself out.`,
                    code: 'ip_lockout',
                });
            }
        }
        if (dto.sso_required && !before.sso_required) {
            const [ssoEnabled, verified] = await Promise.all([
                this.prisma.ssoConfiguration.count({ where: { organization_id: ctx.organization_id, enabled: true } }),
                this.prisma.organizationDomain.count({ where: { organization_id: ctx.organization_id, status: 'VERIFIED' } }),
            ]);
            if (!ssoEnabled || !verified) {
                throw new ConflictException({ message: 'Requiring SSO needs an enabled identity provider and a verified domain', code: 'sso_not_ready' });
            }
        }
        if (dto.restrict_invitations_to_domains && !after.allowed_email_domains.length) {
            throw new BadRequestException({ message: 'Add at least one allowed email domain before restricting invitations', code: 'domains_required' });
        }

        const data = { ...dto, allowed_email_domains: dto.allowed_email_domains ? [...new Set(dto.allowed_email_domains)] : undefined };
        const saved = await this.prisma.organizationSecurityPolicy.upsert({
            where: { organization_id: ctx.organization_id },
            update: data,
            create: { organization_id: ctx.organization_id, ...data },
        });

        const changed = Object.keys(dto).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((saved as Record<string, unknown>)[k]));
        if (changed.length) {
            const pick = (src: object) => Object.fromEntries(changed.map((k) => [k, (src as Record<string, unknown>)[k]]));
            await this.audit.record(ctx, 'organization.security_policy_changed', {
                resource_type: 'organization_security_policy',
                resource_id: ctx.organization_id,
                metadata: { before: pick(before), after: pick(saved), fields: changed },
            });
            this.events.publish(ctx, {
                event_key: 'organizations.security_policy.changed',
                module: ModuleKey.ADMINISTRATION,
                entity_kind: 'organization_security_policy',
                entity_id: ctx.organization_id,
                payload: { fields: changed },
            });
        }
        return this.get(ctx);
    }

    // ---------------------------------------------------------------------------------------------
    // Enforcement helpers (auth module)
    // ---------------------------------------------------------------------------------------------

    async forOrganization(organizationId: string): Promise<PolicyShape> {
        const row = await this.prisma.organizationSecurityPolicy.findUnique({ where: { organization_id: organizationId } });
        if (row) return { ...row, is_default: false };
        return { organization_id: organizationId, ...SECURITY_POLICY_DEFAULTS, updated_at: null, is_default: true };
    }

    private rulesOf(policies: { password_min_length: number; password_require_symbols: boolean }[]): PasswordRules {
        if (!policies.length) return { ...PLATFORM_PASSWORD_RULES };
        return {
            min_length: Math.max(PLATFORM_PASSWORD_RULES.min_length, ...policies.map((p) => p.password_min_length)),
            require_symbols: policies.some((p) => p.password_require_symbols),
        };
    }

    /** Strictest password rules across every organization the user is an active member of. */
    async passwordRulesForUser(userId: string): Promise<PasswordRules> {
        const memberships = await this.prisma.membership.findMany({ where: { user_id: userId, status: MembershipStatus.ACTIVE }, select: { organization_id: true } });
        const policies = await Promise.all(memberships.map((m) => this.forOrganization(m.organization_id)));
        return this.rulesOf(policies);
    }

    /** Rules of the organization behind an invitation token (sign-up through an invitation). */
    async passwordRulesForInvitation(token: string): Promise<PasswordRules> {
        const invitation = await this.prisma.invitation.findUnique({ where: { token_hash: sha256(token) }, select: { organization_id: true } });
        if (!invitation) return { ...PLATFORM_PASSWORD_RULES };
        return this.rulesOf([await this.forOrganization(invitation.organization_id)]);
    }

    /** Throw 400 with a clear message when the password breaks the rules. */
    assertPassword(password: string, rules: PasswordRules) {
        if (password.length < rules.min_length) {
            throw new BadRequestException({ message: `Use at least ${rules.min_length} characters`, code: 'password_policy', rules });
        }
        if (rules.require_symbols && !/[^A-Za-z0-9]/.test(password)) {
            throw new BadRequestException({ message: 'Include at least one symbol (for example ! or #)', code: 'password_policy', rules });
        }
    }

    /** Session lifetime and IP allow-list of the organization a new session starts in. */
    async sessionPolicy(organizationId: string | null) {
        if (!organizationId) return { duration_minutes: SECURITY_POLICY_DEFAULTS.session_duration_minutes, allowed_ip_ranges: [] as string[], password_max_age_days: null as number | null };
        const p = await this.forOrganization(organizationId);
        return { duration_minutes: p.session_duration_minutes, allowed_ip_ranges: p.allowed_ip_ranges, password_max_age_days: p.password_max_age_days };
    }

    /** 403 when the organization restricts sign-in to IP ranges and this address is outside them. */
    assertIpAllowed(allowedRanges: string[], ip: string | null | undefined) {
        if (!allowedRanges.length) return;
        if (!ip || !allowedRanges.some((r) => ipMatches(ip, r))) {
            throw new ForbiddenException({ message: 'Your organization does not allow sign-in from this network', code: 'ip_not_allowed' });
        }
    }
}
