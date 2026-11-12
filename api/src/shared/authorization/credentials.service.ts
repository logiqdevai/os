import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RequestPrincipal } from './interfaces/org-context.interface';

export const API_KEY_PREFIX = 'lqk_';
const API_KEY_RATE_LIMIT_PER_MINUTE = 600;
/** How long a session check is trusted before the database is asked again. */
const SESSION_CHECK_MS = 30_000;
/** `last_activity_at` is written at most this often per session. */
const ACTIVITY_WRITE_MS = 60_000;
export const IDLE_REVOKE_REASON = 'idle_timeout';
type SessionState = 'ok' | 'revoked' | 'idle';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Resolves bearer credentials (user JWTs and API keys) into a RequestPrincipal. */
@Injectable()
export class CredentialsService {
    private sessionCache = new Map<string, { at: number; state: SessionState; touched: number }>();
    private idleCache = new Map<string, { at: number; minutes: number | null }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    /**
     * `activity: false` marks a background request (the app's polling) that must not count as user activity for the
     * idle timeout. Anything else (interactive app requests, other clients) keeps the session alive.
     */
    async resolve(token: string, ip?: string, opts: { activity?: boolean } = {}): Promise<RequestPrincipal> {
        if (token.startsWith(API_KEY_PREFIX)) return this.resolveApiKey(token, ip);
        return this.resolveJwt(token, opts.activity !== false);
    }

    private async resolveJwt(token: string, activity: boolean): Promise<RequestPrincipal> {
        let payload: { id: string; role: string; sid?: string };
        try {
            payload = await this.jwt.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') });
        } catch {
            throw new UnauthorizedException({ message: 'Invalid or expired token', code: 'invalid_token' });
        }
        if (!payload?.id) throw new UnauthorizedException({ message: 'Invalid token', code: 'invalid_token' });

        if (payload.sid) {
            const state = await this.sessionState(payload.sid, activity);
            if (state === 'idle') throw new UnauthorizedException({ message: 'You were signed out after a period of inactivity', code: 'session_idle_timeout' });
            if (state !== 'ok') throw new UnauthorizedException({ message: 'Session has ended', code: 'session_revoked' });
        }
        return { kind: 'user', id: payload.id, role: payload.role, session_id: payload.sid ?? null };
    }

    /**
     * Session state with the organization's idle timeout (01 §73). Checked against the database at most every
     * SESSION_CHECK_MS per session; `last_activity_at` is written at most once per ACTIVITY_WRITE_MS (throttled).
     * A session idle for longer than `idle_timeout_minutes` is revoked with reason `idle_timeout`.
     */
    private async sessionState(sessionId: string, activity: boolean): Promise<SessionState> {
        const now = Date.now();
        const hit = this.sessionCache.get(sessionId);
        if (hit && now - hit.at < SESSION_CHECK_MS && (hit.state !== 'ok' || !activity || now - hit.touched < ACTIVITY_WRITE_MS)) return hit.state;

        let state: SessionState = (await this.redis.get<boolean>(`session:revoked:${sessionId}`)) ? 'revoked' : 'ok';
        let touched = hit?.touched ?? 0;
        if (state === 'ok') {
            const session = await this.prisma.userSession.findUnique({
                where: { id: sessionId },
                select: { revoked_at: true, revoked_reason: true, expires_at: true, last_activity_at: true, active_organization_id: true, user: { select: { status: true, default_organization_id: true } } },
            });
            if (!session || session.user.status !== 'ACTIVE' || session.expires_at.getTime() <= now) state = 'revoked';
            else if (session.revoked_at) state = session.revoked_reason === IDLE_REVOKE_REASON ? 'idle' : 'revoked';
            else {
                const idleMinutes = await this.idleTimeoutMinutes(session.active_organization_id ?? session.user.default_organization_id);
                if (idleMinutes && now - session.last_activity_at.getTime() > idleMinutes * 60_000) {
                    state = 'idle';
                    await this.prisma.userSession.updateMany({ where: { id: sessionId, revoked_at: null }, data: { revoked_at: new Date(), revoked_reason: IDLE_REVOKE_REASON } });
                    await this.redis.set(`session:revoked:${sessionId}`, true, 60 * 60 * 24 * 31);
                } else if (activity && now - session.last_activity_at.getTime() >= ACTIVITY_WRITE_MS) {
                    touched = now;
                    await this.prisma.userSession.update({ where: { id: sessionId }, data: { last_activity_at: new Date(now) } }).catch(() => undefined);
                } else if (activity) {
                    touched = session.last_activity_at.getTime();
                }
            }
        } else {
            // Revoked through markSessionRevoked: tell idle sign-outs apart for the app's message.
            const session = await this.prisma.userSession.findUnique({ where: { id: sessionId }, select: { revoked_reason: true } });
            if (session?.revoked_reason === IDLE_REVOKE_REASON) state = 'idle';
        }
        this.sessionCache.set(sessionId, { at: now, state, touched });
        if (this.sessionCache.size > 10_000) this.sessionCache.clear();
        return state;
    }

    private async idleTimeoutMinutes(organizationId: string | null): Promise<number | null> {
        if (!organizationId) return null;
        const hit = this.idleCache.get(organizationId);
        if (hit && Date.now() - hit.at < 60_000) return hit.minutes;
        const policy = await this.prisma.organizationSecurityPolicy.findUnique({ where: { organization_id: organizationId }, select: { idle_timeout_minutes: true } });
        const minutes = policy?.idle_timeout_minutes ?? null;
        this.idleCache.set(organizationId, { at: Date.now(), minutes });
        if (this.idleCache.size > 5000) this.idleCache.clear();
        return minutes;
    }

    /** Drop the cached idle timeout after the security policy changes. */
    forgetIdleTimeout(organizationId: string) {
        this.idleCache.delete(organizationId);
    }

    /** Called when a session is revoked so every instance rejects it quickly. */
    async markSessionRevoked(sessionId: string) {
        this.sessionCache.set(sessionId, { at: Date.now(), state: 'revoked', touched: 0 });
        await this.redis.set(`session:revoked:${sessionId}`, true, 60 * 60 * 24 * 31);
    }

    private async resolveApiKey(token: string, ip?: string): Promise<RequestPrincipal> {
        const key = await this.prisma.apiKey.findUnique({
            where: { key_hash: sha256(token) },
            select: {
                id: true, organization_id: true, membership_id: true, service_account_id: true, scopes: true,
                revoked_at: true, expires_at: true, allowed_ip_ranges: true,
                membership: { select: { user_id: true, status: true } },
            },
        });
        if (!key || key.revoked_at || (key.expires_at && key.expires_at < new Date())) {
            throw new UnauthorizedException({ message: 'Invalid or expired API key', code: 'invalid_api_key' });
        }
        if (key.allowed_ip_ranges.length && ip && !key.allowed_ip_ranges.some((range) => ipMatches(ip, range))) {
            throw new UnauthorizedException({ message: 'API key not allowed from this address', code: 'api_key_ip_denied' });
        }
        const count = await this.redis.hit(`ratelimit:apikey:${key.id}:${Math.floor(Date.now() / 60000)}`, 60);
        if (count && count > API_KEY_RATE_LIMIT_PER_MINUTE) {
            throw new HttpException({ message: 'Rate limit exceeded for this API key', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        }

        setImmediate(() => {
            this.prisma.apiKey.update({ where: { id: key.id }, data: { last_used_at: new Date() } }).catch(() => undefined);
        });

        return {
            kind: 'api_key',
            id: key.membership?.user_id ?? null,
            api_key_id: key.id,
            organization_id: key.organization_id,
            membership_id: key.membership_id,
            service_account_id: key.service_account_id,
            api_key_scopes: key.scopes,
        };
    }

    /** Generate a new API key secret. Only the hash is stored; the plain value is shown once. */
    generateApiKey(): { plain: string; hash: string; prefix: string } {
        const plain = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
        return { plain, hash: sha256(plain), prefix: plain.slice(0, 12) };
    }
}

/** IPv4 address vs exact IP or CIDR range (also used by the organization security policy IP allow-list). */
export function ipMatches(ip: string, range: string): boolean {
    const clean = ip.replace(/^::ffff:/, '');
    if (!range.includes('/')) return clean === range;
    const [base, bitsRaw] = range.split('/');
    const bits = Number(bitsRaw);
    const toInt = (v: string) => v.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(clean) || !/^\d+\.\d+\.\d+\.\d+$/.test(base)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(clean) & mask) === (toInt(base) & mask);
}
