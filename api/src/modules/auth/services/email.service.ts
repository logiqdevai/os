import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateJwtService } from '@/shared/utils/jwt/jwt.service';
import { CredentialsService, sha256 } from '@/shared/authorization/credentials.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { AuditService } from '@/shared/audit/audit.service';
import { RegisterEmailDto } from '../dto/register-email.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { OrganizationSetupService } from './organization-setup.service';
import { SecurityPolicyService } from '../../admin/security/security-policy.service';
import { MfaRequirementService } from '@/shared/authorization/mfa-requirement.service';
import { MFA_CHALLENGE_TTL_SECONDS, MfaFactorInput, MfaService } from '../mfa/mfa.service';
import { AuthRateLimitService } from '../mfa/auth-rate-limit.service';

export interface ClientMeta {
    ip_address?: string | null;
    user_agent?: string | null;
}

const publicUser = <T extends { password?: string }>(user: T) => {
    const { password, ...rest } = user;
    return rest;
};

@Injectable()
export class EmailAuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: CreateJwtService,
        private readonly credentials: CredentialsService,
        private readonly authorization: AuthorizationService,
        private readonly audit: AuditService,
        private readonly organizations: OrganizationSetupService,
        private readonly securityPolicy: SecurityPolicyService,
        private readonly mfa: MfaService,
        private readonly mfaRequirement: MfaRequirementService,
        private readonly rateLimit: AuthRateLimitService,
    ) { }

    async registerWithEmail(dto: RegisterEmailDto, meta: ClientMeta) {
        await this.rateLimit.consume(`register:${meta.ip_address ?? 'unknown'}`, 10, 3600);
        const email = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException({ message: 'An account with this email already exists', code: 'email_taken' });
        if (!dto.organization_name && !dto.invitation_token) {
            throw new BadRequestException({ message: 'Enter your agency name or use an invitation link', code: 'organization_required' });
        }

        // Joining through an invitation follows that organization's password rules (01 §73); a new organization starts on defaults.
        if (dto.invitation_token) this.securityPolicy.assertPassword(dto.password, await this.securityPolicy.passwordRulesForInvitation(dto.invitation_token));
        const password = await bcrypt.hash(dto.password, 10);

        const { user, organizationId } = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password,
                    first_name: dto.first_name.trim(),
                    last_name: dto.last_name.trim(),
                    display_name: `${dto.first_name.trim()} ${dto.last_name.trim()}`,
                    password_changed_at: new Date(),
                },
            });
            let organizationId: string | null = null;
            if (dto.organization_name) {
                const { organization } = await this.organizations.createOrganization(tx, { name: dto.organization_name.trim(), owner_user_id: user.id });
                organizationId = organization.id;
            }
            await tx.user.update({ where: { id: user.id }, data: { default_organization_id: organizationId } });
            return { user, organizationId };
        });

        let activeOrg = organizationId;
        if (dto.invitation_token) {
            const accepted = await this.acceptInvitation(user.id, dto.invitation_token);
            activeOrg = activeOrg ?? accepted.organization_id;
        }

        const { password_max_age_days: _maxAge, ...session } = await this.issueSession(user.id, user.role, activeOrg, meta);
        await this.audit.record(null, 'user.registered', { resource_type: 'user', resource_id: user.id, metadata: { organization_id: activeOrg } });
        // Joining an organization that requires MFA for everyone: the app sends the person to enrolment first.
        const requirement = await this.mfaRequirement.requirementFor(user.id, activeOrg);
        return { ...session, mfa_enrollment_required: requirement.required, mfa_required_reason: requirement.reason, user: publicUser(user) };
    }

    /**
     * Step 1 of sign-in. Without MFA this returns a session. With MFA it returns `{ mfa_required, mfa_token }`
     * and the session is issued by `completeMfaLogin` (POST /auth/mfa/verify) after a valid code (01 §74).
     */
    async loginWithEmail(dto: LoginEmailDto, meta: ClientMeta) {
        const email = dto.email.trim().toLowerCase();
        await this.rateLimit.consume(`login-ip:${meta.ip_address ?? 'unknown'}`, 30, 300);
        await this.rateLimit.consume(`login-email:${email}`, 10, 300);
        const user = await this.prisma.user.findUnique({ where: { email } });
        const ok = !!user && !!user.password && (await bcrypt.compare(dto.password, user.password));
        if (!ok) {
            if (user) await this.audit.record(null, 'user.login_failed', { resource_type: 'user', resource_id: user.id, outcome: 'FAILURE', metadata: { ip: meta.ip_address } });
            throw new UnauthorizedException({ message: 'Invalid email or password', code: 'invalid_credentials' });
        }
        if (user.status !== 'ACTIVE') throw new ForbiddenException({ message: 'This account is not active', code: 'user_inactive' });

        if (user.mfa_enabled) {
            return { mfa_required: true as const, mfa_token: await this.mfa.createChallenge(user.id), mfa_methods: ['TOTP', 'RECOVERY_CODE'], expires_in_seconds: MFA_CHALLENGE_TTL_SECONDS };
        }
        return this.finishLogin(user, meta, null);
    }

    /** Step 2 of sign-in for users with MFA: the challenge token from step 1 plus a TOTP code or a recovery code. */
    async completeMfaLogin(input: { mfa_token: string } & MfaFactorInput, meta: ClientMeta) {
        const { user_id, method } = await this.mfa.verifyChallenge(input.mfa_token, input, meta.ip_address ?? null);
        const user = await this.prisma.user.findUnique({ where: { id: user_id } });
        if (!user || user.status !== 'ACTIVE') throw new ForbiddenException({ message: 'This account is not active', code: 'user_inactive' });
        const remaining = method === 'RECOVERY_CODE' ? (await this.mfa.status(user.id, null)).recovery_codes.remaining : null;
        return { ...(await this.finishLogin(user, meta, method)), recovery_codes_remaining: remaining };
    }

    private async finishLogin(user: { id: string; role: string; default_organization_id: string | null; password_changed_at: Date | null; mfa_enabled: boolean; password?: string }, meta: ClientMeta, mfaMethod: string | null) {
        const session = await this.issueSession(user.id, user.role, user.default_organization_id, meta);
        await this.prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
        await this.audit.record(null, 'user.login', { resource_type: 'user', resource_id: user.id, metadata: { ip: meta.ip_address, mfa: mfaMethod } });
        // 01 §73 password max age: the app asks the user to choose a new password (sign-in still succeeds).
        const maxAge = session.password_max_age_days;
        const password_change_required = !!maxAge && (!user.password_changed_at || user.password_changed_at.getTime() < Date.now() - maxAge * 86400_000);
        // 01 §74: members the policy requires to use MFA but who have not enrolled get a session that only reaches
        // /auth/* until they enrol (PermissionsGuard answers 403 mfa_enrollment_required elsewhere).
        const requirement = user.mfa_enabled ? null : await this.mfaRequirement.requirementFor(user.id, user.default_organization_id);
        const { password_max_age_days: _maxAge, ...rest } = session;
        return {
            ...rest,
            password_change_required,
            mfa_enrollment_required: !!requirement?.required,
            mfa_required_reason: requirement?.reason ?? null,
            user: publicUser(user),
        };
    }

    /** Session lifetime and IP allow-list come from the active organization's security policy (01 §72–73). */
    private async issueSession(userId: string, role: string, organizationId: string | null, meta: ClientMeta) {
        const policy = await this.securityPolicy.sessionPolicy(organizationId);
        this.securityPolicy.assertIpAllowed(policy.allowed_ip_ranges, meta.ip_address);
        const expires = new Date(Date.now() + policy.duration_minutes * 60_000);
        const session = await this.prisma.userSession.create({
            data: {
                user_id: userId,
                active_organization_id: organizationId,
                token_hash: sha256(`${userId}:${Date.now()}:${Math.random()}`),
                user_agent: meta.user_agent?.slice(0, 500) ?? null,
                ip_address: meta.ip_address ?? null,
                browser: browserName(meta.user_agent),
                expires_at: expires,
            },
        });
        const access_token = await this.jwtService.signToken({ id: userId, role, sid: session.id });
        return { access_token, expires_in: this.jwtService.getExpirationTime(access_token), session_id: session.id, password_max_age_days: policy.password_max_age_days };
    }

    async logout(userId: string, sessionId: string | null) {
        if (!sessionId) return { success: true };
        await this.prisma.userSession.updateMany({ where: { id: sessionId, user_id: userId }, data: { revoked_at: new Date(), revoked_reason: 'logout' } });
        await this.credentials.markSessionRevoked(sessionId);
        await this.audit.record(null, 'user.logout', { resource_type: 'user', resource_id: userId });
        return { success: true };
    }

    /** Session bootstrap for the app: user, organizations, active organization, effective permissions, enabled modules. */
    async me(userId: string, requestedOrgId: string | null) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { preferences: true } });
        if (!user) throw new UnauthorizedException({ message: 'User not found', code: 'invalid_token' });

        const memberships = await this.prisma.membership.findMany({
            where: { user_id: userId, organization: { deleted_at: null } },
            select: {
                id: true, status: true, job_title: true, organization_id: true, default_branch_id: true,
                organization: { select: { id: true, display_name: true, slug: true, logo_url: true, branding: true, default_currency: true, default_timezone: true } },
            },
            orderBy: { joined_at: 'asc' },
        });
        const customerMemberships = await this.prisma.customerPortalMembership.findMany({
            where: { user_id: userId },
            select: { id: true, organization_id: true, customer_id: true, status: true },
        });

        const activeMemberships = memberships.filter((m) => m.status === 'ACTIVE');
        const active =
            activeMemberships.find((m) => m.organization_id === requestedOrgId) ??
            activeMemberships.find((m) => m.organization_id === user.default_organization_id) ??
            activeMemberships[0] ??
            null;

        let permissions: string[] = [];
        let modules: string[] = [];
        let branches: { id: string; name: string; is_headquarters: boolean }[] = [];
        if (active) {
            const effective = await this.authorization.effectiveFor({ organization_id: active.organization_id, membership_id: active.id });
            permissions = Object.keys(effective.permissions).sort();
            modules = effective.modules;
            branches = await this.prisma.branch.findMany({
                where: { organization_id: active.organization_id, status: 'ACTIVE' },
                select: { id: true, name: true, is_headquarters: true },
                orderBy: [{ is_headquarters: 'desc' }, { name: 'asc' }],
            });
        }

        const requirement = await this.mfaRequirement.requirementFor(userId, active?.organization_id ?? null);

        return {
            user: publicUser(user),
            mfa: { enabled: user.mfa_enabled, required: requirement.required, required_reason: requirement.reason, enrollment_required: requirement.required && !user.mfa_enabled },
            organizations: activeMemberships.map((m) => ({ ...m.organization, membership_id: m.id, job_title: m.job_title })),
            active_organization: active ? { ...active.organization, membership_id: active.id, default_branch_id: active.default_branch_id } : null,
            customer_memberships: customerMemberships,
            permissions,
            modules,
            branches,
        };
    }

    async switchOrganization(userId: string, organizationId: string) {
        const membership = await this.prisma.membership.findUnique({ where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } } });
        if (!membership || membership.status !== 'ACTIVE') throw new NotFoundException({ message: 'Organization not found', code: 'organization_not_found' });
        await this.prisma.user.update({ where: { id: userId }, data: { default_organization_id: organizationId } });
        return this.me(userId, organizationId);
    }

    async createOrganization(userId: string, name: string) {
        const { organization } = await this.prisma.$transaction(async (tx) => {
            const result = await this.organizations.createOrganization(tx, { name: name.trim(), owner_user_id: userId });
            await tx.user.update({ where: { id: userId }, data: { default_organization_id: result.organization.id } });
            return result;
        });
        await this.audit.record(null, 'organization.created', { resource_type: 'organization', resource_id: organization.id });
        return this.me(userId, organization.id);
    }

    /** Preview an invitation before signing up / in (public, by token). */
    async invitationPreview(token: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { token_hash: sha256(token) },
            select: { email: true, status: true, expires_at: true, audience: true, organization: { select: { display_name: true, logo_url: true } }, role: { select: { name: true } } },
        });
        if (!invitation) throw new NotFoundException({ message: 'Invitation not found', code: 'invitation_not_found' });
        const expired = invitation.expires_at < new Date();
        const existing = await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
        return { ...invitation, status: expired && invitation.status === 'PENDING' ? 'EXPIRED' : invitation.status, has_account: !!existing };
    }

    /** Accept a MEMBER invitation for the signed-in user (01 §65–66). */
    async acceptInvitation(userId: string, token: string) {
        const invitation = await this.prisma.invitation.findUnique({ where: { token_hash: sha256(token) } });
        if (!invitation) throw new NotFoundException({ message: 'Invitation not found', code: 'invitation_not_found' });
        if (invitation.status !== 'PENDING') throw new BadRequestException({ message: `Invitation is ${invitation.status.toLowerCase()}`, code: 'invitation_not_pending' });
        if (invitation.expires_at < new Date()) {
            await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
            throw new BadRequestException({ message: 'Invitation has expired', code: 'invitation_expired' });
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new ForbiddenException({ message: 'This invitation was sent to a different email address', code: 'invitation_email_mismatch' });
        }

        if (invitation.audience === 'CUSTOMER_PORTAL') {
            const pm = await this.prisma.$transaction(async (tx) => {
                const portalMembership = await tx.customerPortalMembership.upsert({
                    where: { organization_id_customer_id_user_id: { organization_id: invitation.organization_id, customer_id: invitation.customer_id, user_id: userId } },
                    update: { status: 'ACTIVE', role_id: invitation.role_id ?? undefined },
                    create: { user_id: userId, organization_id: invitation.organization_id, customer_id: invitation.customer_id, role_id: invitation.role_id, status: 'ACTIVE' },
                });
                await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', accepted_at: new Date(), portal_membership_id: portalMembership.id } });
                return portalMembership;
            });
            return { organization_id: invitation.organization_id, portal_membership_id: pm.id };
        }

        const membership = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.membership.findUnique({ where: { user_id_organization_id: { user_id: userId, organization_id: invitation.organization_id } } });
            const membership = existing
                ? await tx.membership.update({ where: { id: existing.id }, data: { status: 'ACTIVE', deactivated_at: null } })
                : await tx.membership.create({
                    data: {
                        user_id: userId,
                        organization_id: invitation.organization_id,
                        type: invitation.type,
                        status: 'ACTIVE',
                        provisioning_source: 'INVITATION_LINK',
                        invited_by_user_id: invitation.invited_by_user_id,
                        default_branch_id: invitation.branch_id,
                        default_team_id: invitation.team_id,
                    },
                });
            if (invitation.branch_id) {
                await tx.membershipBranch.upsert({
                    where: { membership_id_branch_id: { membership_id: membership.id, branch_id: invitation.branch_id } },
                    update: {},
                    create: { membership_id: membership.id, branch_id: invitation.branch_id, is_primary: true },
                });
            }
            if (invitation.team_id) {
                await tx.teamMembership.upsert({
                    where: { team_id_membership_id: { team_id: invitation.team_id, membership_id: membership.id } },
                    update: {},
                    create: { team_id: invitation.team_id, membership_id: membership.id },
                });
            }
            if (invitation.role_id) {
                await tx.roleAssignment.create({
                    data: {
                        membership_id: membership.id,
                        role_id: invitation.role_id,
                        scope_type: invitation.scope_type,
                        scope_id: invitation.scope_id,
                        valid_until: invitation.valid_until,
                        granted_by_user_id: invitation.invited_by_user_id,
                        reason: 'Invitation accepted',
                    },
                });
            }
            await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', accepted_at: new Date(), membership_id: membership.id } });
            if (!user.default_organization_id) await tx.user.update({ where: { id: userId }, data: { default_organization_id: invitation.organization_id } });
            return membership;
        });
        await this.authorization.invalidate(invitation.organization_id);
        const ctx = await this.authorization.contextFor({ organization_id: invitation.organization_id, membership_id: membership.id, channel: 'ui' });
        await this.audit.record(ctx, 'invitation.accepted', { resource_type: 'invitation', resource_id: invitation.id, metadata: { membership_id: membership.id } });
        return { organization_id: invitation.organization_id, membership_id: membership.id };
    }

    async sessions(userId: string, currentSessionId: string | null) {
        const sessions = await this.prisma.userSession.findMany({
            where: { user_id: userId, revoked_at: null, expires_at: { gt: new Date() } },
            select: { id: true, browser: true, device: true, ip_address: true, last_activity_at: true, created_at: true, user_agent: true },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
        return sessions.map((s) => ({ ...s, current: s.id === currentSessionId }));
    }

    async revokeSession(userId: string, sessionId: string) {
        const res = await this.prisma.userSession.updateMany({ where: { id: sessionId, user_id: userId, revoked_at: null }, data: { revoked_at: new Date(), revoked_reason: 'user_revoked' } });
        if (!res.count) throw new NotFoundException({ message: 'Session not found', code: 'session_not_found' });
        await this.credentials.markSessionRevoked(sessionId);
        return { success: true };
    }

    async updateProfile(userId: string, data: { first_name?: string; last_name?: string; display_name?: string; timezone?: string; locale?: string; language?: string; profile_photo_url?: string }) {
        const user = await this.prisma.user.update({ where: { id: userId }, data });
        return publicUser(user);
    }

    async changePassword(userId: string, current: string, next: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!(await bcrypt.compare(current, user.password))) throw new BadRequestException({ message: 'Current password is incorrect', code: 'invalid_password' });
        this.securityPolicy.assertPassword(next, await this.securityPolicy.passwordRulesForUser(userId));
        await this.prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(next, 10), password_changed_at: new Date() } });
        await this.audit.record(null, 'user.password_changed', { resource_type: 'user', resource_id: userId });
        return { success: true };
    }

    async setPreferences(userId: string, data: { theme?: string; default_organization_id?: string; dashboard_layout?: any }) {
        return this.prisma.userPreference.upsert({ where: { user_id: userId }, update: data, create: { user_id: userId, ...data } });
    }
}

function browserName(ua?: string | null): string | null {
    if (!ua) return null;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Other';
}
