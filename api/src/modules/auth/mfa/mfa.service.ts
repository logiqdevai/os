import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditOutcome, AuthMethodType, MembershipStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService, AuditRecordInput } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { sha256 } from '@/shared/authorization/credentials.service';
import { MfaRequirementService } from '@/shared/authorization/mfa-requirement.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { decryptSecret, encryptSecret } from '@/shared/utils/crypto/secret-box.utils';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { generateRecoveryCodes, generateTotpSecret, normalizeRecoveryCode, otpauthUri, RECOVERY_CODE_COUNT, verifyTotp } from './totp.utils';

/** The single TOTP factor per user (authenticator app). */
const TOTP_IDENTIFIER = 'authenticator';
const ISSUER = 'Logiqdev OS';
const CHALLENGE_PURPOSE = 'mfa_challenge';
export const MFA_CHALLENGE_TTL_SECONDS = 300;

export interface MfaFactorInput {
    code?: string | null;
    recovery_code?: string | null;
}

const recoveryHash = (code: string) => sha256(`logiqdev:recovery:${normalizeRecoveryCode(code)}`);

/**
 * Multi-factor authentication with TOTP (RFC 6238) and one-time recovery codes (01 §74).
 * - The TOTP seed is stored encrypted (secret-box) in UserAuthMethod.secret_ciphertext; recovery codes are one
 *   UserAuthMethod row each (type RECOVERY_CODES, sha256 in secret_hash, `disabled_at` once used).
 * - `User.mfa_enabled` is true while a verified TOTP factor exists.
 * - Every verification is rate limited per user; failures are audited.
 */
@Injectable()
export class MfaService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly requirement: MfaRequirementService,
        private readonly rateLimit: AuthRateLimitService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Self-service (/auth/mfa)
    // ---------------------------------------------------------------------------------------------

    async status(userId: string, organizationId: string | null) {
        const [user, methods, requirement] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId }, select: { mfa_enabled: true } }),
            this.prisma.userAuthMethod.findMany({
                where: { user_id: userId, type: { in: [AuthMethodType.TOTP, AuthMethodType.RECOVERY_CODES] } },
                select: { type: true, verified_at: true, last_used_at: true, disabled_at: true, created_at: true },
            }),
            this.requirement.requirementFor(userId, organizationId),
        ]);
        const totp = methods.find((m) => m.type === AuthMethodType.TOTP && m.verified_at && !m.disabled_at) ?? null;
        const codes = methods.filter((m) => m.type === AuthMethodType.RECOVERY_CODES);
        return {
            enabled: !!user?.mfa_enabled,
            totp: totp ? { verified_at: totp.verified_at, last_used_at: totp.last_used_at } : null,
            recovery_codes: { total: codes.length, remaining: codes.filter((c) => !c.disabled_at).length },
            required: requirement.required,
            required_reason: requirement.reason,
        };
    }

    /** Step 1 of enrolment: a fresh secret (pending until confirmed). Returns the otpauth:// URI for the QR code. */
    async startTotp(userId: string) {
        await this.rateLimit.consume(`mfa-setup:${userId}`, 10, 600);
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, mfa_enabled: true } });
        if (user.mfa_enabled) throw new ConflictException({ message: 'Two-step verification is already on. Turn it off first to use a new authenticator.', code: 'mfa_already_enabled' });
        const secret = generateTotpSecret();
        await this.prisma.userAuthMethod.upsert({
            where: { user_id_type_identifier: { user_id: userId, type: AuthMethodType.TOTP, identifier: TOTP_IDENTIFIER } },
            update: { secret_ciphertext: encryptSecret(secret), verified_at: null, disabled_at: null, last_used_at: null, metadata: Prisma.JsonNull },
            create: { user_id: userId, type: AuthMethodType.TOTP, identifier: TOTP_IDENTIFIER, label: 'Authenticator app', secret_ciphertext: encryptSecret(secret) },
        });
        return { secret, otpauth_uri: otpauthUri({ issuer: ISSUER, account: user.email, secret }), issuer: ISSUER, account: user.email };
    }

    /** Step 2: the first code proves the app is set up; MFA turns on and 10 recovery codes are returned once. */
    async confirmTotp(userId: string, code: string) {
        await this.rateLimit.consume(`mfa-verify:${userId}`, 6, 300);
        const method = await this.prisma.userAuthMethod.findUnique({ where: { user_id_type_identifier: { user_id: userId, type: AuthMethodType.TOTP, identifier: TOTP_IDENTIFIER } } });
        if (!method?.secret_ciphertext) throw new BadRequestException({ message: 'Start the setup again', code: 'mfa_setup_not_started' });
        if (method.verified_at && !method.disabled_at) throw new ConflictException({ message: 'Two-step verification is already on', code: 'mfa_already_enabled' });
        const step = verifyTotp(decryptSecret(method.secret_ciphertext), code);
        if (step === null) {
            await this.auditForUser(userId, 'user.mfa_challenge_failed', { outcome: AuditOutcome.FAILURE, metadata: { stage: 'enrolment' } });
            throw new BadRequestException({ message: 'That code is not right. Check the time on your phone and try the newest code.', code: 'invalid_mfa_code' });
        }
        const codes = generateRecoveryCodes();
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.userAuthMethod.update({ where: { id: method.id }, data: { verified_at: now, last_used_at: now, disabled_at: null, metadata: { last_step: step } } });
            await this.replaceRecoveryCodes(tx, userId, codes);
            await tx.user.update({ where: { id: userId }, data: { mfa_enabled: true } });
        });
        this.requirement.forget(userId);
        await this.auditForUser(userId, 'user.mfa_enabled', { resource_type: 'user_auth_method', resource_id: method.id, metadata: { type: AuthMethodType.TOTP, user_id: userId } });
        return { enabled: true, recovery_codes: codes };
    }

    /** New set of recovery codes (old ones stop working). Needs a current code. */
    async regenerateRecoveryCodes(userId: string, factor: MfaFactorInput) {
        await this.verifyFactor(userId, factor, 'recovery_codes');
        const codes = generateRecoveryCodes();
        await this.prisma.$transaction((tx) => this.replaceRecoveryCodes(tx, userId, codes));
        await this.auditForUser(userId, 'user.mfa_recovery_codes_regenerated', { resource_type: 'user', resource_id: userId });
        return { recovery_codes: codes };
    }

    /** Turn MFA off. Refused while any organization the user belongs to requires it (an admin can still reset it). */
    async disable(userId: string, factor: MfaFactorInput) {
        const blocking = await this.requiringOrganizations(userId);
        if (blocking.length) {
            throw new ForbiddenException({ message: `${blocking.join(', ')} requires two-step verification, so it cannot be turned off.`, code: 'mfa_required_by_policy' });
        }
        await this.verifyFactor(userId, factor, 'disable');
        await this.removeFactors(userId);
        await this.auditForUser(userId, 'user.mfa_disabled', { resource_type: 'user', resource_id: userId, metadata: { type: AuthMethodType.TOTP, user_id: userId, by: 'self' } });
        return { enabled: false };
    }

    // ---------------------------------------------------------------------------------------------
    // Sign-in challenge
    // ---------------------------------------------------------------------------------------------

    /** Short-lived token proving the password step passed; exchanged at POST /auth/mfa/verify. Not an access token. */
    createChallenge(userId: string) {
        return this.jwt.signAsync({ sub: userId, purpose: CHALLENGE_PURPOSE }, { secret: this.config.get<string>('JWT_SECRET'), expiresIn: MFA_CHALLENGE_TTL_SECONDS });
    }

    /** Returns the user id behind a valid challenge token after checking the code (or a recovery code). */
    async verifyChallenge(token: string, factor: MfaFactorInput, ip: string | null) {
        await this.rateLimit.consume(`mfa-ip:${ip ?? 'unknown'}`, 30, 300);
        let payload: { sub?: string; purpose?: string };
        try {
            payload = await this.jwt.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') });
        } catch {
            throw new UnauthorizedException({ message: 'The sign-in took too long. Enter your password again.', code: 'mfa_challenge_expired' });
        }
        if (payload?.purpose !== CHALLENGE_PURPOSE || !payload.sub) throw new UnauthorizedException({ message: 'Invalid sign-in challenge', code: 'mfa_challenge_invalid' });
        const method = await this.verifyFactor(payload.sub, factor, 'sign_in');
        return { user_id: payload.sub, method };
    }

    // ---------------------------------------------------------------------------------------------
    // Admin (01-admin member detail: "Reset MFA")
    // ---------------------------------------------------------------------------------------------

    /** Remove a member's factors so they enrol again. Never reveals secrets. Audited as user.mfa_disabled with the admin as actor. */
    async adminReset(ctx: OrgContext, userId: string, membershipId: string) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mfa_enabled: true } });
        const factors = await this.prisma.userAuthMethod.count({ where: { user_id: userId, type: { in: [AuthMethodType.TOTP, AuthMethodType.RECOVERY_CODES] } } });
        if (!user.mfa_enabled && !factors) throw new ConflictException({ message: 'This member has not set up two-step verification', code: 'mfa_not_enabled' });
        await this.removeFactors(userId);
        await this.audit.record(ctx, 'user.mfa_disabled', { resource_type: 'membership', resource_id: membershipId, metadata: { type: AuthMethodType.TOTP, user_id: userId, by: 'admin_reset' } });
        this.events.publish(ctx, {
            event_key: 'users.member.mfa_reset',
            module: ModuleKey.ADMINISTRATION,
            entity_type: 'MEMBERSHIP',
            entity_id: membershipId,
            // Tell the member (14 fan-out); never in the org activity feed.
            payload: {
                user_id: userId,
                recipient_membership_ids: [membershipId],
                notification_title: 'Your two-step verification was reset by an administrator',
                notification_body: 'Set it up again in Settings → Security.',
                notification_priority: 'IMPORTANT',
                link: '/settings/security',
            },
        });
        return { success: true, mfa_enabled: false };
    }

    // ---------------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------------

    /** Checks a TOTP code (with replay protection) or burns one recovery code. Throws 401 `invalid_mfa_code`. */
    async verifyFactor(userId: string, factor: MfaFactorInput, stage: string): Promise<'TOTP' | 'RECOVERY_CODE'> {
        await this.rateLimit.consume(`mfa-verify:${userId}`, 6, 300);
        if (!factor.code && !factor.recovery_code) throw new BadRequestException({ message: 'Enter the code from your authenticator app or a recovery code', code: 'mfa_code_required' });
        const now = new Date();

        if (factor.code) {
            const method = await this.prisma.userAuthMethod.findUnique({ where: { user_id_type_identifier: { user_id: userId, type: AuthMethodType.TOTP, identifier: TOTP_IDENTIFIER } } });
            if (method?.verified_at && !method.disabled_at && method.secret_ciphertext) {
                const step = verifyTotp(decryptSecret(method.secret_ciphertext), factor.code);
                const lastStep = Number((method.metadata as { last_step?: number } | null)?.last_step ?? -1);
                if (step !== null && step > lastStep) {
                    // Conditional write: a parallel request with the same code loses.
                    const won = await this.prisma.userAuthMethod.updateMany({ where: { id: method.id, updated_at: method.updated_at }, data: { last_used_at: now, metadata: { last_step: step } } });
                    if (won.count) return 'TOTP';
                }
            }
        } else if (factor.recovery_code) {
            const used = await this.prisma.userAuthMethod.updateMany({
                where: { user_id: userId, type: AuthMethodType.RECOVERY_CODES, secret_hash: recoveryHash(factor.recovery_code), disabled_at: null },
                data: { disabled_at: now, last_used_at: now },
            });
            if (used.count) {
                const remaining = await this.prisma.userAuthMethod.count({ where: { user_id: userId, type: AuthMethodType.RECOVERY_CODES, disabled_at: null } });
                await this.auditForUser(userId, 'user.mfa_recovery_code_used', { resource_type: 'user', resource_id: userId, metadata: { remaining, stage } });
                return 'RECOVERY_CODE';
            }
        }

        await this.auditForUser(userId, 'user.mfa_challenge_failed', { outcome: AuditOutcome.FAILURE, resource_type: 'user', resource_id: userId, metadata: { stage, kind: factor.code ? 'totp' : 'recovery_code' } });
        throw new UnauthorizedException({ message: factor.code ? 'That code is not right. Try the newest code from your app.' : 'That recovery code is not valid or was already used.', code: 'invalid_mfa_code' });
    }

    private async replaceRecoveryCodes(tx: Prisma.TransactionClient, userId: string, codes: string[]) {
        await tx.userAuthMethod.deleteMany({ where: { user_id: userId, type: AuthMethodType.RECOVERY_CODES } });
        const now = new Date();
        await tx.userAuthMethod.createMany({
            data: codes.slice(0, RECOVERY_CODE_COUNT).map((code, i) => ({
                user_id: userId,
                type: AuthMethodType.RECOVERY_CODES,
                identifier: `recovery-${i + 1}`,
                secret_hash: recoveryHash(code),
                label: 'Recovery code',
                verified_at: now,
            })),
        });
    }

    private async removeFactors(userId: string) {
        await this.prisma.$transaction([
            this.prisma.userAuthMethod.deleteMany({ where: { user_id: userId, type: { in: [AuthMethodType.TOTP, AuthMethodType.RECOVERY_CODES] } } }),
            this.prisma.user.update({ where: { id: userId }, data: { mfa_enabled: false } }),
        ]);
        this.requirement.forget(userId);
    }

    /** Display names of organizations whose policy requires MFA for this user. */
    private async requiringOrganizations(userId: string): Promise<string[]> {
        const memberships = await this.prisma.membership.findMany({
            where: { user_id: userId, status: MembershipStatus.ACTIVE, organization: { deleted_at: null } },
            select: { organization_id: true, organization: { select: { display_name: true } } },
        });
        const names: string[] = [];
        for (const m of memberships) {
            if ((await this.requirement.requirementFor(userId, m.organization_id)).required) names.push(m.organization.display_name);
        }
        if (!names.length && (await this.requirement.portalRequirement(userId)).required) names.push('Your customer portal');
        return names;
    }

    /**
     * Personal security events belong to the person, but admins must see them in their organization's audit log
     * (mockup: "Sofia Jensen disabled TOTP"). One event per active membership, with the user as actor.
     */
    private async auditForUser(userId: string, eventType: string, input: AuditRecordInput) {
        const memberships = await this.prisma.membership.findMany({ where: { user_id: userId, status: MembershipStatus.ACTIVE }, select: { id: true, organization_id: true } });
        if (!memberships.length) {
            await this.audit.record(null, eventType, { resource_type: 'user', resource_id: userId, ...input });
            return;
        }
        for (const m of memberships) {
            const ctx = await this.authorization.contextFor({ organization_id: m.organization_id, membership_id: m.id, channel: 'ui' });
            await this.audit.record(ctx, eventType, { resource_type: 'user', resource_id: userId, ...input });
        }
    }
}
