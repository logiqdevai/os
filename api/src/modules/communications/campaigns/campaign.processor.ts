import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { COMM_CAMPAIGNS_QUEUE } from '@/core/queues/queues.constants';
import { CampaignJob, CampaignJobData, CommQueueService } from '../delivery/comm-queue.service';
import { CampaignRunnerService } from './campaign-runner.service';

const SWEEP_EVERY_MS = 60_000;

/**
 * Worker of the comm-campaigns queue. Campaign steps are few but heavy (a start resolves the whole audience and writes
 * one message per recipient), so they run a couple at a time; the sends themselves fan out on the comm-messages queue.
 */
@Processor(COMM_CAMPAIGNS_QUEUE, { concurrency: 2 })
export class CampaignProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly logger = new Logger(CampaignProcessor.name);

    constructor(
        private readonly runner: CampaignRunnerService,
        private readonly queue: CommQueueService,
    ) {
        super();
    }

    async onApplicationBootstrap() {
        await this.queue.scheduleSweep(SWEEP_EVERY_MS);
    }

    async process(job: Job<CampaignJobData>): Promise<string> {
        switch (job.name) {
            case CampaignJob.START:
                return this.runner.start(job.data.campaign_id);
            case CampaignJob.RELEASE_WINNER:
                return this.runner.releaseWinner(job.data.campaign_id);
            case CampaignJob.FINALIZE:
                return this.runner.finalize(job.data.campaign_id);
            case CampaignJob.SWEEP:
                return this.runner.sweep();
            default:
                throw new Error(`Unknown campaign job "${job.name}"`);
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<CampaignJobData> | undefined, error: Error) {
        this.logger.error(`campaign job ${job?.name ?? '?'} ${job?.id ?? ''} failed (attempt ${job?.attemptsMade ?? '?'}): ${error.message}`);
    }
}
