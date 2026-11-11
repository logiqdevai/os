import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import { RequestPrincipal } from './interfaces/org-context.interface';

export const API_KEY_PREFIX = 'lqk_';
const API_KEY_RATE_LIMIT_PER_MINUTE = 600;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Resolves bearer credentials (user JWTs and API keys) into a RequestPrincipal. */
@Injectable()
export class CredentialsService {
    private sessionCache = new Map<string, { at: number; ok: boolean }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    async resolve(token: string, ip?: string): Promise<RequestPrincipal> {
        if (token.startsWith(API_KEY_PREFIX)) return this.resolveApiKey(token, ip);
        return this.resolveJwt(token);
    }

    private async resolveJwt(token: string): Promise<RequestPrincipal> {
        let payload: { id: string; role: string; sid?: string };
        try {
            payload = await this.jwt.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') });
        } catch {
            throw new UnauthorizedException({ message: 'Invalid or expired token', code: 'invalid_token' });
        }
        if (!payload?.id) throw new UnauthorizedException({ message: 'Invalid token', code: 'invalid_token' });

        if (payload.sid && !(await this.sessionActive(payload.sid))) {
            throw new UnauthorizedException({ message: 'Session has ended', code: 'session_revoked' });
        }
        return { kind: 'user', id: payload.id, role: payload.role, session_id: payload.sid ?? null };
    }

    private async sessionActive(sessionId: string): Promise<boolean> {
        const hit = this.sessionCache.get(sessionId);
        if (hit && Date.now() - hit.at < 30_000) return hit.ok;
        const revoked = await this.redis.get<boolean>(`session:revoked:${sessionId}`);
        let ok = !revoked;
        if (ok) {
            const session = await this.prisma.userSession.findUnique({ where: { id: sessionId }, select: { revoked_at: true, expires_at: true, user: { select: { status: true } } } });
            ok = !!session && !session.revoked_at && session.expires_at > new Date() && session.user.status === 'ACTIVE';
        }
        this.sessionCache.set(sessionId, { at: Date.now(), ok });
        if (this.sessionCache.size > 10_000) this.sessionCache.clear();
        return ok;
    }

    /** Called when a session is revoked so every instance rejects it quickly. */
    async markSessionRevoked(sessionId: string) {
        this.sessionCache.set(sessionId, { at: Date.now(), ok: false });
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

function ipMatches(ip: string, range: string): boolean {
    const clean = ip.replace(/^::ffff:/, '');
    if (!range.includes('/')) return clean === range;
    const [base, bitsRaw] = range.split('/');
    const bits = Number(bitsRaw);
    const toInt = (v: string) => v.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(clean) || !/^\d+\.\d+\.\d+\.\d+$/.test(base)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(clean) & mask) === (toInt(base) & mask);
}
