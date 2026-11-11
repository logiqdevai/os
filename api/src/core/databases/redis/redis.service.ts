import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_OPTIONS } from './redis.constants';

/**
 * Thin key/value facade over ioredis. When REDIS_URL is not configured every call is a no-op
 * (get returns null) so callers fall back to the database.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly client: Redis | null;

    constructor(@Inject(REDIS_OPTIONS) options: RedisOptions | null) {
        if (!options) {
            this.client = null;
            return;
        }
        this.client = new Redis({ ...options, maxRetriesPerRequest: 2, lazyConnect: false, reconnectOnError: () => true });
        this.client.on('error', (error) => this.logger.warn(`redis: ${error.message}`));
    }

    get available(): boolean {
        return !!this.client && this.client.status === 'ready';
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.available) return null;
        try {
            const raw = await this.client.get(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        if (!this.available) return;
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch {
            /* cache write failures never break a request */
        }
    }

    async del(...keys: string[]): Promise<void> {
        if (!this.available || !keys.length) return;
        try {
            await this.client.del(...keys);
        } catch {
            /* ignore */
        }
    }

    async incr(key: string): Promise<number | null> {
        if (!this.available) return null;
        try {
            return await this.client.incr(key);
        } catch {
            return null;
        }
    }

    /** Fixed-window counter used for per-credential rate limits. Returns the count in the current window. */
    async hit(key: string, windowSeconds: number): Promise<number | null> {
        if (!this.available) return null;
        try {
            const count = await this.client.incr(key);
            if (count === 1) await this.client.expire(key, windowSeconds);
            return count;
        } catch {
            return null;
        }
    }

    async publish(channel: string, message: unknown): Promise<void> {
        if (!this.available) return;
        try {
            await this.client.publish(channel, JSON.stringify(message));
        } catch {
            /* ignore */
        }
    }

    async onModuleDestroy() {
        await this.client?.quit().catch(() => undefined);
    }
}
