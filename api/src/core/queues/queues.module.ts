import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import type { RedisOptions } from 'ioredis';
import { REDIS_OPTIONS } from '../databases/redis/redis.constants';
import { QUEUE_NAMES } from './queues.constants';

/**
 * BullMQ on the app's Redis (REDIS_URL is required). Registers every queue once; feature modules add their
 * producers (@InjectQueue) and workers (@Processor) without registering the queue again.
 * Finished jobs are trimmed so Redis stays small: the database is the record of what was sent.
 */
@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            inject: [REDIS_OPTIONS],
            useFactory: (redisOptions: RedisOptions | null) => {
                if (!redisOptions) throw new Error('REDIS_URL is required: BullMQ queues need Redis');
                return {
                    connection: redisOptions,
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 10_000 },
                        removeOnComplete: { age: 24 * 3600, count: 10_000 },
                        removeOnFail: { age: 7 * 24 * 3600 },
                    },
                };
            },
        }),
        BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name }))),
    ],
    exports: [BullModule],
})
export class QueuesModule { }
