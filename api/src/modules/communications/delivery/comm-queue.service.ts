import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { COMM_CAMPAIGNS_QUEUE, COMM_MESSAGES_QUEUE } from '@/core/queues/queues.constants';

export const MessageJob = { SEND: 'send' } as const;
export const CampaignJob = { START: 'start', RELEASE_WINNER: 'release-winner', FINALIZE: 'finalize', SWEEP: 'sweep' } as const;

export interface SendJobData { message_id: string }
export interface CampaignJobData { campaign_id: string }

/** What decides when a message may be sent: the later of its scheduled time and its next attempt (retry backoff or campaign throttling). */
export interface MessageDue {
    id: string;
    attempt_count: number;
    scheduled_at: Date | null;
    next_attempt_at: Date | null;
}

export const dueAt = (m: Pick<MessageDue, 'scheduled_at' | 'next_attempt_at'>) => Math.max(m.scheduled_at?.getTime() ?? 0, m.next_attempt_at?.getTime() ?? 0);

/** How long completion checks are batched: one finalize job per campaign per window, however many messages finish in it. */
const FINALIZE_WINDOW_MS = 15_000;
const BULK = 1000;

/**
 * Producer for the 11 Communication Center queues (BullMQ on Redis). The database stays the source of truth: a job only
 * says "look at this message / campaign now", and every worker re-checks the row and claims it with a status transition.
 * So duplicate or stale jobs are harmless, and the sweep can re-add a job for anything Redis lost.
 *
 * Job ids are deterministic (message + attempt + due time, campaign + step + time), so adding the same work twice is a no-op.
 */
@Injectable()
export class CommQueueService {
    constructor(
        @InjectQueue(COMM_MESSAGES_QUEUE) private readonly messages: Queue<SendJobData>,
        @InjectQueue(COMM_CAMPAIGNS_QUEUE) private readonly campaigns: Queue<CampaignJobData>,
    ) { }

    private messageJob(m: MessageDue) {
        const due = dueAt(m);
        return {
            name: MessageJob.SEND,
            data: { message_id: m.id },
            opts: { jobId: `msg-${m.id}-${m.attempt_count}-${due}`, delay: Math.max(0, due - Date.now()) } satisfies JobsOptions,
        };
    }

    /** Send these messages when they are due (now, their scheduled time, or their paced / retry time). */
    async enqueueMessages(messages: MessageDue[]) {
        for (let i = 0; i < messages.length; i += BULK) {
            await this.messages.addBulk(messages.slice(i, i + BULK).map((m) => this.messageJob(m)));
        }
    }

    enqueueMessage(m: MessageDue) {
        return this.enqueueMessages([m]);
    }

    /** Sweep: re-add a message job unless an equivalent one is still waiting. */
    async ensureMessages(messages: MessageDue[]) {
        const fresh: MessageDue[] = [];
        for (const m of messages) if (await this.vacant(this.messages, this.messageJob(m).opts.jobId)) fresh.push(m);
        await this.enqueueMessages(fresh);
        return fresh.length;
    }

    /** Start a campaign run at its claim time (campaign.next_run_at). */
    async enqueueCampaignStart(c: { id: string; next_run_at: Date | null }, ensure = false) {
        const at = c.next_run_at?.getTime() ?? Date.now();
        const jobId = `start-${c.id}-${at}`;
        if (ensure && !(await this.vacant(this.campaigns, jobId))) return;
        await this.campaigns.add(CampaignJob.START, { campaign_id: c.id }, { jobId, delay: Math.max(0, at - Date.now()), attempts: 1 });
    }

    /** Pick the A/B winner and send it to the holdout group at `at` (now for a manual pick or the next holdout batch). */
    async enqueueWinnerRelease(campaignId: string, at: Date, ensure = false) {
        const jobId = `ab-${campaignId}-${at.getTime()}`;
        if (ensure && !(await this.vacant(this.campaigns, jobId))) return;
        await this.campaigns.add(CampaignJob.RELEASE_WINNER, { campaign_id: campaignId }, { jobId, delay: Math.max(0, at.getTime() - Date.now()) });
    }

    /** Check soon whether the campaign has finished (complete it, or schedule its next recurring run). */
    async enqueueFinalize(campaignId: string) {
        const window = Math.floor(Date.now() / FINALIZE_WINDOW_MS) + 1;
        await this.campaigns.add(CampaignJob.FINALIZE, { campaign_id: campaignId }, { jobId: `finalize-${campaignId}-${window}`, delay: Math.max(0, window * FINALIZE_WINDOW_MS - Date.now()) });
    }

    /** Register the repeating reconciliation sweep (one job per interval across all API instances). */
    async scheduleSweep(everyMs: number) {
        await this.campaigns.upsertJobScheduler(CampaignJob.SWEEP, { every: everyMs }, { name: CampaignJob.SWEEP, data: { campaign_id: '' }, opts: { attempts: 1 } });
    }

    /**
     * True when no live (waiting / delayed / active) job has this id. A finished one (completed or failed) is removed so the
     * id can be used again: the sweep only asks for overdue work whose row says it is still open, so that job did not do it.
     */
    private async vacant(queue: Queue, jobId: string) {
        const job = await queue.getJob(jobId);
        if (!job) return true;
        const state = await job.getState();
        if (state !== 'completed' && state !== 'failed') return false;
        await job.remove().catch(() => undefined);
        return true;
    }
}
