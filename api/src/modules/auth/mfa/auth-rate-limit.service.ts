import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '@/core/databases/redis/redis.service';

/**
 * Fixed-window rate limits for public auth flows (sign-in, MFA verification, enrolment). Uses Redis when it is
 * available so limits hold across instances; falls back to an in-process counter otherwise.
 */
@Injectable()
export class AuthRateLimitService {
    private readonly local = new Map<string, { window: number; count: number }>();

    constructor(private readonly redis: RedisService) { }

    /** Throws 429 `rate_limited` once `limit` hits happen inside `windowSeconds` for this key. */
    async consume(key: string, limit: number, windowSeconds: number, message = 'Too many attempts. Wait a few minutes and try again.') {
        const window = Math.floor(Date.now() / 1000 / windowSeconds);
        let count = await this.redis.hit(`ratelimit:auth:${key}:${window}`, windowSeconds);
        if (count === null) {
            const hit = this.local.get(key);
            count = hit && hit.window === window ? hit.count + 1 : 1;
            this.local.set(key, { window, count });
            if (this.local.size > 20_000) this.local.clear();
        }
        if (count > limit) {
            throw new HttpException({ message, code: 'rate_limited', retry_after_seconds: windowSeconds }, HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
