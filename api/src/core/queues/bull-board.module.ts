import { Module } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { BULL_BOARD_ADAPTER, QUEUE_NAMES } from './queues.constants';

export const BULL_BOARD_PATH = '/admin/queues';

/** Bull Board UI for every queue, mounted in main.ts at /admin/queues behind basic auth (BULL_BOARD_USER / BULL_BOARD_PASSWORD). */
@Module({
    providers: [
        {
            provide: BULL_BOARD_ADAPTER,
            inject: QUEUE_NAMES.map((name) => getQueueToken(name)),
            useFactory: (...queues: Queue[]) => {
                const serverAdapter = new ExpressAdapter();
                serverAdapter.setBasePath(BULL_BOARD_PATH);
                createBullBoard({ queues: queues.map((q) => new BullMQAdapter(q)), serverAdapter });
                return serverAdapter;
            },
        },
    ],
    exports: [BULL_BOARD_ADAPTER],
})
export class BullBoardModule { }
