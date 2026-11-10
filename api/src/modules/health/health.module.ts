import { Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { RedisModule } from '@/core/databases/redis/redis.module';
import { PostgresHealthChecker } from './checkers/postgres.health';
import { RedisHealthChecker } from './checkers/redis.health';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
    imports: [PrismaModule, RedisModule],
    controllers: [HealthController],
    providers: [HealthService, PostgresHealthChecker, RedisHealthChecker],
})
export class HealthModule {}
