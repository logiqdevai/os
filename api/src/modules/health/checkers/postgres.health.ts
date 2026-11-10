import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    HealthCheckResult,
    HealthCheckStatus,
} from '../interfaces/health.interface';

@Injectable()
export class PostgresHealthChecker {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    async check(): Promise<HealthCheckResult> {
        const databaseUrl = this.configService.get<string>('DATABASE_URL');

        if (!databaseUrl) {
            return {
                status: HealthCheckStatus.NOT_CONFIGURED,
                message: 'DATABASE_URL is not set',
            };
        }

        const startedAt = Date.now();

        try {
            await this.prisma.$queryRaw`SELECT 1`;

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
                        : 'Postgres health check failed',
            };
        }
    }
}
