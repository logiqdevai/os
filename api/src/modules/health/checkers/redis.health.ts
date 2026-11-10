import { Inject, Injectable } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { REDIS_OPTIONS } from '@/core/databases/redis/redis.constants';
import {
    HealthCheckResult,
    HealthCheckStatus,
} from '../interfaces/health.interface';

@Injectable()
export class RedisHealthChecker {
    constructor(
        @Inject(REDIS_OPTIONS)
        private readonly redisOptions: RedisOptions | null,
    ) {}

    async check(): Promise<HealthCheckResult> {
        if (!this.redisOptions) {
            return {
                status: HealthCheckStatus.NOT_CONFIGURED,
                message: 'REDIS_URL is not set',
            };
        }

        const startedAt = Date.now();
        const client = new Redis({
            ...this.redisOptions,
            lazyConnect: true,
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
        });

        try {
            await client.connect();
            await client.ping();

            return {
                status: HealthCheckStatus.OK,
                ms: Date.now() - startedAt,
            };
        } catch (error) {
            return {
                status: HealthCheckStatus.DOWN,
                ms: Date.now() - startedAt,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Redis health check failed',
            };
        } finally {
            client.disconnect();
        }
    }
}
