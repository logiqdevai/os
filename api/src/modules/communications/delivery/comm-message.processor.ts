import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CampaignStatus, CommMessageStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { COMM_MESSAGES_QUEUE } from '@/core/queues/queues.constants';
import { CommDispatchService } from './comm-dispatch.service';
import { CommQueueService, dueAt, SendJobData } from './comm-queue.service';

/** Sends running in parallel per API instance. */
const CONCURRENCY = 10;
/** Global ceiling across all instances, to stay under provider rate limits (per-campaign throttling is send_rate_per_hour). */
const MAX_PER_SECOND = 10;

/**
 * Worker of the comm-messages queue: sends one CommMessage per job through CommDispatchService (which enforces consent and
 * suppression, and re-queues retryable failures with backoff). The row decides, not the job:
 *  - not QUEUED / SCHEDULED any more (sent, cancelled) → nothing to do;
 *  - due later than this job (rescheduled, re-paced on resume) → a newer job exists for it;
 *  - its campaign is not SENDING (paused, cancelled) → skipped; resume queues the messages again.
 */
@Processor(COMM_MESSAGES_QUEUE, { concurrency: CONCURRENCY, limiter: { max: MAX_PER_SECOND, duration: 1000 } })
export class CommMessageProcessor extends WorkerHost {
    private readonly logger = new Logger(CommMessageProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly dispatch: CommDispatchService,
        private readonly queue: CommQueueService,
    ) {
        super();
    }

    async process(job: Job<SendJobData>): Promise<string> {
        const m = await this.prisma.commMessage.findUnique({
            where: { id: job.data.message_id },
            select: { status: true, deleted_at: true, scheduled_at: true, next_attempt_at: true, campaign_id: true, campaign: { select: { status: true } } },
        });
        if (!m || m.deleted_at || (m.status !== CommMessageStatus.QUEUED && m.status !== CommMessageStatus.SCHEDULED)) return 'skipped:not_open';
        if (dueAt(m) > Date.now() + 1000) return 'skipped:not_due';
        if (m.campaign && m.campaign.status !== CampaignStatus.SENDING) return `skipped:campaign_${m.campaign.status.toLowerCase()}`;

        const status = await this.dispatch.dispatch(job.data.message_id);
        if (m.campaign_id) await this.queue.enqueueFinalize(m.campaign_id);
        return status;
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<SendJobData> | undefined, error: Error) {
        this.logger.warn(`send job ${job?.id ?? '?'} failed (attempt ${job?.attemptsMade ?? '?'}): ${error.message}`);
    }
}
