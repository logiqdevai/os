import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProposalsService } from './proposals.service';

/** Hourly housekeeping: live proposals past valid_until become EXPIRED (ProposalEvent EXPIRED). */
@Injectable()
export class ProposalsJobs {
    private readonly logger = new Logger(ProposalsJobs.name);

    constructor(private readonly proposals: ProposalsService) { }

    @Cron(CronExpression.EVERY_HOUR)
    async expire() {
        try {
            const n = await this.proposals.expireOverdue();
            if (n) this.logger.log(`expired ${n} proposals`);
        } catch (error) {
            this.logger.warn(`proposal expiry failed: ${(error as Error).message}`);
        }
    }
}
