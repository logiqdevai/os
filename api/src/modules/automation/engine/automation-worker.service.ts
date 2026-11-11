import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { SchedulerService } from '../jobs/scheduler.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { AutomationEngineService } from './automation-engine.service';

const DEFAULTS = { run: 365, event: 90, job: 90 };

/**
 * Background worker (20 §6–8): resumes waiting / retrying runs, retries webhook deliveries and failed job runs,
 * expires approvals, re-processes missed events, and applies retention once an hour.
 */
@Injectable()
export class AutomationWorkerService {
    private readonly logger = new Logger(AutomationWorkerService.name);
    private busy = false;
    private lastRetention = 0;

    constructor(
        private readonly prisma: PrismaService,
        private readonly engine: AutomationEngineService,
        private readonly deliveries: WebhookDeliveryService,
        private readonly scheduler: SchedulerService,
    ) { }

    @Interval('automation-worker', 15_000)
    async tick() {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.engine.tick();
            await this.deliveries.retryDue();
            await this.scheduler.retryDue();
            if (Date.now() - this.lastRetention > 3600_000) {
                this.lastRetention = Date.now();
                await this.retention();
            }
        } catch (error) {
            this.logger.warn(`worker tick failed: ${(error as Error).message}`);
        } finally {
            this.busy = false;
        }
    }

    /** 20 §8 — delete runs, events and job runs older than the organization's retention (null = keep forever). */
    private async retention() {
        const day = 86_400_000;
        const settings = await this.prisma.automationSettings.findMany({ select: { organization_id: true, run_retention_days: true, event_retention_days: true, job_run_retention_days: true } });
        const custom = settings.map((s) => s.organization_id);
        for (const s of settings) {
            if (s.run_retention_days) await this.prisma.automationRun.deleteMany({ where: { organization_id: s.organization_id, created_at: { lt: new Date(Date.now() - s.run_retention_days * day) } } });
            if (s.event_retention_days) await this.prisma.platformEvent.deleteMany({ where: { organization_id: s.organization_id, occurred_at: { lt: new Date(Date.now() - s.event_retention_days * day) } } });
            if (s.job_run_retention_days) await this.prisma.scheduledJobRun.deleteMany({ where: { organization_id: s.organization_id, created_at: { lt: new Date(Date.now() - s.job_run_retention_days * day) } } });
        }
        await this.prisma.automationRun.deleteMany({ where: { organization_id: { notIn: custom }, created_at: { lt: new Date(Date.now() - DEFAULTS.run * day) } } });
        await this.prisma.platformEvent.deleteMany({ where: { organization_id: { notIn: custom }, occurred_at: { lt: new Date(Date.now() - DEFAULTS.event * day) } } });
        await this.prisma.scheduledJobRun.deleteMany({ where: { OR: [{ organization_id: null }, { organization_id: { notIn: custom } }], created_at: { lt: new Date(Date.now() - DEFAULTS.job * day) } } });
    }
}
