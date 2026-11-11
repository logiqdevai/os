import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob, validateCronExpression } from 'cron';
import { hostname } from 'os';
import { ModuleKey, Prisma, ScheduledJob, ScheduledJobKind, ScheduledJobRunStatus, ScheduledJobStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { backoffSeconds } from '../engine/engine.utils';
import { JobHandlerRegistry } from './job-handler.registry';

const DEFAULT_LEASE_SECONDS = 600;
const name = (id: string) => `automation-job:${id}`;

export interface EnsureJobInput {
    organization_id: string;
    module: ModuleKey;
    key: string;
    name: string;
    description?: string | null;
    handler: string;
    kind: ScheduledJobKind;
    cron_expression?: string | null;
    interval_seconds?: number | null;
    run_at?: Date | null;
    timezone?: string;
    payload?: Record<string, unknown> | null;
    rule_id?: string | null;
    branch_id?: string | null;
    status?: ScheduledJobStatus;
}

/**
 * 20 §7 — hosts module-owned scheduled jobs and the schedules of SCHEDULE rules. Each ACTIVE job is registered in
 * Nest's SchedulerRegistry (cron / interval / timeout); a DB lease (`locked_by`, `lock_expires_at`) makes sure one
 * worker runs a tick even with several API instances. Every tick is a ScheduledJobRun with retries and backoff.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(SchedulerService.name);
    private readonly worker = `${hostname()}:${process.pid}`;

    constructor(
        private readonly prisma: PrismaService,
        private readonly registry: SchedulerRegistry,
        private readonly handlers: JobHandlerRegistry,
    ) { }

    onApplicationBootstrap() {
        setImmediate(async () => {
            try {
                const jobs = await this.prisma.scheduledJob.findMany({ where: { status: ScheduledJobStatus.ACTIVE } });
                for (const job of jobs) await this.schedule(job);
                this.logger.log(`scheduled ${jobs.length} automation job(s)`);
            } catch (error) {
                this.logger.error(`could not load scheduled jobs: ${(error as Error).message}`);
            }
        });
    }

    onModuleDestroy() {
        for (const key of this.registry.getCronJobs().keys()) if (key.startsWith('automation-job:')) this.unscheduleByName(key);
    }

    // ---------------------------------------------------------------------------------------------
    // Schedule computation
    // ---------------------------------------------------------------------------------------------

    static validate(kind: ScheduledJobKind, input: { cron_expression?: string | null; interval_seconds?: number | null; run_at?: Date | string | null; timezone?: string | null }) {
        if (kind === ScheduledJobKind.CRON) {
            if (!input.cron_expression) throw new BadRequestException({ message: 'A cron expression is required', code: 'cron_required' });
            const v = validateCronExpression(input.cron_expression);
            if (!v.valid) throw new BadRequestException({ message: `Invalid cron expression: ${v.error?.message ?? 'syntax error'}`, code: 'cron_invalid' });
            try {
                CronJob.from({ cronTime: input.cron_expression, onTick: () => undefined, start: false, timeZone: input.timezone || 'UTC' });
            } catch (e) {
                throw new BadRequestException({ message: `Invalid timezone or cron: ${(e as Error).message}`, code: 'cron_invalid' });
            }
        } else if (kind === ScheduledJobKind.INTERVAL) {
            if (!input.interval_seconds || input.interval_seconds < 30) throw new BadRequestException({ message: 'The interval must be at least 30 seconds', code: 'interval_too_short' });
        } else if (kind === ScheduledJobKind.ONCE) {
            if (!input.run_at || new Date(input.run_at).getTime() <= Date.now()) throw new BadRequestException({ message: 'The run time must be in the future', code: 'run_at_past' });
        }
    }

    /** Next N execution times (preview in the job form and the rule builder). */
    static nextRuns(kind: ScheduledJobKind, input: { cron_expression?: string | null; interval_seconds?: number | null; run_at?: Date | string | null; timezone?: string | null }, count = 5): Date[] {
        SchedulerService.validate(kind, input);
        if (kind === ScheduledJobKind.CRON) {
            const job = CronJob.from({ cronTime: input.cron_expression as string, onTick: () => undefined, start: false, timeZone: input.timezone || 'UTC' });
            return job.nextDates(count).map((d) => d.toJSDate());
        }
        if (kind === ScheduledJobKind.INTERVAL) return Array.from({ length: count }, (_, i) => new Date(Date.now() + (i + 1) * (input.interval_seconds as number) * 1000));
        return [new Date(input.run_at as string)];
    }

    // ---------------------------------------------------------------------------------------------
    // Registration
    // ---------------------------------------------------------------------------------------------

    /** (Re)register a job in the SchedulerRegistry according to its status and schedule; updates next_run_at. */
    async schedule(job: ScheduledJob) {
        this.unschedule(job.id);
        if (job.status !== ScheduledJobStatus.ACTIVE) {
            if (job.next_run_at) await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { next_run_at: null } }).catch(() => undefined);
            return;
        }
        let next: Date | null = null;
        try {
            if (job.kind === ScheduledJobKind.CRON && job.cron_expression) {
                const cron = CronJob.from({ cronTime: job.cron_expression, onTick: () => void this.tick(job.id), start: true, timeZone: job.timezone || 'UTC' });
                this.registry.addCronJob(name(job.id), cron as never);
                next = cron.nextDate().toJSDate();
            } else if (job.kind === ScheduledJobKind.INTERVAL && job.interval_seconds) {
                const handle = setInterval(() => void this.tick(job.id), job.interval_seconds * 1000);
                this.registry.addInterval(name(job.id), handle);
                next = new Date(Date.now() + job.interval_seconds * 1000);
            } else if (job.kind === ScheduledJobKind.ONCE && job.run_at) {
                const delay = job.run_at.getTime() - Date.now();
                if (delay > 0 && delay < 2 ** 31 - 1) {
                    this.registry.addTimeout(name(job.id), setTimeout(() => void this.tick(job.id), delay));
                    next = job.run_at;
                }
            }
        } catch (error) {
            this.logger.warn(`job ${job.key} not scheduled: ${(error as Error).message}`);
        }
        await this.prisma.scheduledJob.update({ where: { id: job.id }, data: { next_run_at: next } }).catch(() => undefined);
    }

    unschedule(jobId: string) {
        this.unscheduleByName(name(jobId));
    }

    private unscheduleByName(key: string) {
        if (this.registry.doesExist('cron', key)) this.registry.deleteCronJob(key);
        if (this.registry.doesExist('interval', key)) this.registry.deleteInterval(key);
        if (this.registry.doesExist('timeout', key)) this.registry.deleteTimeout(key);
    }

    /** Create or update a job by (organization, module, key) and schedule it. Used by modules and SCHEDULE rules. */
    async ensureJob(input: EnsureJobInput) {
        SchedulerService.validate(input.kind, input);
        const data = {
            name: input.name,
            description: input.description ?? null,
            handler: input.handler,
            kind: input.kind,
            cron_expression: input.kind === ScheduledJobKind.CRON ? input.cron_expression ?? null : null,
            interval_seconds: input.kind === ScheduledJobKind.INTERVAL ? input.interval_seconds ?? null : null,
            run_at: input.kind === ScheduledJobKind.ONCE ? input.run_at ?? null : null,
            timezone: input.timezone ?? 'UTC',
            payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
            rule_id: input.rule_id ?? null,
            branch_id: input.branch_id ?? null,
            status: input.status ?? ScheduledJobStatus.ACTIVE,
            paused_at: input.status === ScheduledJobStatus.PAUSED ? new Date() : null,
        };
        const job = await this.prisma.scheduledJob.upsert({
            where: { organization_id_module_key: { organization_id: input.organization_id, module: input.module, key: input.key } },
            update: data,
            create: { ...data, organization_id: input.organization_id, module: input.module, key: input.key },
        });
        await this.schedule(job);
        return job;
    }

    // ---------------------------------------------------------------------------------------------
    // Execution
    // ---------------------------------------------------------------------------------------------

    /** One tick: lease → run row → handler (with timeout) → result, retries and rollups. */
    async tick(jobId: string, opts: { manual?: boolean; membership_id?: string | null; attempt?: number; scheduled_for?: Date } = {}) {
        const job = await this.prisma.scheduledJob.findUnique({ where: { id: jobId } });
        if (!job) return null;
        if (!opts.manual && job.status !== ScheduledJobStatus.ACTIVE) return null;

        const now = new Date();
        const leaseSeconds = job.timeout_seconds ?? DEFAULT_LEASE_SECONDS;
        const leased = await this.prisma.scheduledJob.updateMany({
            where: { id: job.id, ...(job.allow_overlap ? {} : { OR: [{ lock_expires_at: null }, { lock_expires_at: { lt: now } }] }) },
            data: { locked_by: this.worker, locked_at: now, lock_expires_at: new Date(now.getTime() + leaseSeconds * 1000) },
        });
        const attempt = opts.attempt ?? 1;
        const maxAttempts = job.max_retries + 1;
        if (!leased.count) {
            return this.prisma.scheduledJobRun.create({
                data: { job_id: job.id, organization_id: job.organization_id, status: ScheduledJobRunStatus.SKIPPED, scheduled_for: opts.scheduled_for ?? now, finished_at: now, error_code: 'overlap', error_message: 'The previous run is still running', worker_id: this.worker, triggered_by_membership_id: opts.membership_id ?? null },
            });
        }

        const run = await this.prisma.scheduledJobRun.create({
            data: {
                job_id: job.id,
                organization_id: job.organization_id,
                status: ScheduledJobRunStatus.RUNNING,
                scheduled_for: opts.scheduled_for ?? now,
                started_at: now,
                attempt,
                max_attempts: maxAttempts,
                input: (job.payload ?? undefined) as Prisma.InputJsonValue | undefined,
                worker_id: this.worker,
                triggered_by_membership_id: opts.membership_id ?? null,
            },
        });

        const handler = this.handlers.get(job.handler);
        let status: ScheduledJobRunStatus = ScheduledJobRunStatus.SUCCEEDED;
        let output: Record<string, unknown> | null = null;
        let errorCode: string | null = null;
        let errorMessage: string | null = null;
        if (!handler) {
            status = ScheduledJobRunStatus.FAILED;
            errorCode = 'handler_not_found';
            errorMessage = `No handler registered for "${job.handler}"`;
        } else {
            let timer: NodeJS.Timeout | undefined;
            try {
                const result = await Promise.race([
                    handler.run({
                        job: { id: job.id, key: job.key, organization_id: job.organization_id, branch_id: job.branch_id, module: job.module, rule_id: job.rule_id },
                        run_id: run.id,
                        payload: (job.payload as Record<string, unknown>) ?? {},
                        scheduled_for: run.scheduled_for,
                        triggered_by_membership_id: opts.membership_id ?? null,
                    }),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => reject(Object.assign(new Error(`Timed out after ${leaseSeconds}s`), { code: 'timeout' })), leaseSeconds * 1000);
                    }),
                ]);
                output = (result as Record<string, unknown>) ?? null;
            } catch (e) {
                const err = e as Error & { code?: string };
                status = err.code === 'timeout' ? ScheduledJobRunStatus.TIMED_OUT : ScheduledJobRunStatus.FAILED;
                errorCode = err.code ?? 'handler_error';
                errorMessage = err.message;
            } finally {
                if (timer) clearTimeout(timer);
            }
        }

        const finished = new Date();
        const failed = status !== ScheduledJobRunStatus.SUCCEEDED;
        const retry = failed && handler && attempt < maxAttempts;
        await this.prisma.scheduledJobRun.update({
            where: { id: run.id },
            data: {
                status,
                finished_at: finished,
                duration_ms: finished.getTime() - now.getTime(),
                output: (output ?? undefined) as Prisma.InputJsonValue | undefined,
                error_code: errorCode,
                error_message: errorMessage,
                next_retry_at: retry ? new Date(finished.getTime() + backoffSeconds(job.retry_backoff_seconds, attempt) * 1000) : null,
            },
        });

        const nextRun = this.nextRunFor(job);
        await this.prisma.scheduledJob.update({
            where: { id: job.id },
            data: {
                last_run_at: now,
                last_run_status: status,
                last_error: errorMessage,
                last_duration_ms: finished.getTime() - now.getTime(),
                run_count: { increment: 1 },
                ...(failed ? { failure_count: { increment: 1 }, consecutive_failures: { increment: 1 } } : { consecutive_failures: 0 }),
                locked_by: null,
                locked_at: null,
                lock_expires_at: null,
                next_run_at: nextRun,
                ...(job.kind === ScheduledJobKind.ONCE && !opts.manual && !retry ? { status: ScheduledJobStatus.COMPLETED } : {}),
            },
        });
        return this.prisma.scheduledJobRun.findUnique({ where: { id: run.id } });
    }

    private nextRunFor(job: ScheduledJob): Date | null {
        if (job.status !== ScheduledJobStatus.ACTIVE) return null;
        if (job.kind === ScheduledJobKind.CRON && this.registry.doesExist('cron', name(job.id))) {
            try {
                return (this.registry.getCronJob(name(job.id)) as unknown as CronJob).nextDate().toJSDate();
            } catch {
                return null;
            }
        }
        if (job.kind === ScheduledJobKind.INTERVAL && job.interval_seconds) return new Date(Date.now() + job.interval_seconds * 1000);
        return null;
    }

    /** Worker tick: re-run failed job runs whose backoff passed. */
    async retryDue(limit = 10) {
        const due = await this.prisma.scheduledJobRun.findMany({
            where: { status: { in: [ScheduledJobRunStatus.FAILED, ScheduledJobRunStatus.TIMED_OUT] }, next_retry_at: { lte: new Date() } },
            take: limit,
            orderBy: { next_retry_at: 'asc' },
        });
        for (const run of due) {
            const claimed = await this.prisma.scheduledJobRun.updateMany({ where: { id: run.id, next_retry_at: { not: null } }, data: { next_retry_at: null } });
            if (claimed.count) await this.tick(run.job_id, { manual: true, attempt: run.attempt + 1, scheduled_for: run.scheduled_for });
        }
        return due.length;
    }
}
