import { Injectable } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';

export interface JobHandlerContext {
    job: { id: string; key: string; organization_id: string | null; branch_id: string | null; module: ModuleKey; rule_id: string | null };
    run_id: string;
    payload: Record<string, unknown>;
    /** Tick time the run was scheduled for. */
    scheduled_for: Date;
    triggered_by_membership_id: string | null;
}

export interface JobHandler {
    /** Stable key stored in `ScheduledJob.handler`, e.g. `finance.dunning.tick`. */
    key: string;
    module: ModuleKey;
    name: string;
    description: string;
    /** Members with automation.jobs.manage may create jobs with this handler from the UI / API. */
    user_creatable?: boolean;
    /** Returns counters stored as `ScheduledJobRun.output`. Throw to fail the run (retried with backoff). */
    run: (ctx: JobHandlerContext) => Promise<Record<string, unknown> | void>;
}

/**
 * 20 §7 — module-owned scheduled job handlers. A module registers its handler once (in `onModuleInit`) and then
 * creates a `ScheduledJob` row (or calls `SchedulerService.ensureJob`) — the engine schedules, runs, retries and logs it.
 */
@Injectable()
export class JobHandlerRegistry {
    private readonly handlers = new Map<string, JobHandler>();

    register(handler: JobHandler) {
        this.handlers.set(handler.key, handler);
    }

    get(key: string) {
        return this.handlers.get(key);
    }

    list() {
        return [...this.handlers.values()].map(({ run: _run, ...rest }) => rest);
    }
}
