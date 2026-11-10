import { Injectable } from '@nestjs/common';
import { PostgresHealthChecker } from './checkers/postgres.health';
import { RedisHealthChecker } from './checkers/redis.health';
import type { HealthQueryType } from './dto/health-query.schema';
import {
    HealthCheckStatus,
    HealthServiceName,
    type HealthResponse,
} from './interfaces/health.interface';

@Injectable()
export class HealthService {
    private readonly startedAt = Date.now();

    constructor(
        private readonly postgresHealthChecker: PostgresHealthChecker,
        private readonly redisHealthChecker: RedisHealthChecker,
    ) {}

    async check(query: HealthQueryType): Promise<HealthResponse> {
        const timestamp = new Date().toISOString();

        if (query.postgres) {
            const result = await this.postgresHealthChecker.check();

            return {
                service: HealthServiceName.POSTGRES,
                status: result.status,
                timestamp,
                ms: result.ms,
                message: result.message,
            };
        }

        if (query.redis) {
            const result = await this.redisHealthChecker.check();

            return {
                service: HealthServiceName.REDIS,
                status: result.status,
                timestamp,
                ms: result.ms,
                message: result.message,
            };
        }

        return {
            service: HealthServiceName.API,
            status: HealthCheckStatus.OK,
            timestamp,
            uptime_ms: Date.now() - this.startedAt,
        };
    }
}
