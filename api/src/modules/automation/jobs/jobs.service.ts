import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ScheduledJobKind, ScheduledJobStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { CreateJobDto, JobQuery, JobRunQuery, PreviewScheduleDto, UpdateJobDto } from './dto/job.dto';
import { JobHandlerRegistry } from './job-handler.registry';
import { SchedulerService } from './scheduler.service';

const READ = 'automation.jobs.read';

/** 20 §7 — scheduled jobs of the organization (module-owned and user-created) with their run log. */
@Injectable()
export class JobsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly scheduler: SchedulerService,
        private readonly handlers: JobHandlerRegistry,
    ) { }

    private scopeWhere(ctx: OrgContext): Prisma.ScheduledJobWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return { OR: [{ branch_id: null }, { branch_id: { in: scope.branch_ids } }] };
    }

    handlerList() {
        return this.handlers.list();
    }

    async findAll(ctx: OrgContext, query: JobQuery) {
        const where: Prisma.ScheduledJobWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.scopeWhere(ctx)],
            ...(query.status && { status: query.status }),
            ...(query.module && { module: query.module }),
            ...(query.kind && { kind: query.kind }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { key: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.scheduledJob.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['name', 'next_run_at', 'last_run_at', 'created_at'], 'name'), include: { rule: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } } }),
            this.prisma.scheduledJob.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const job = await this.prisma.scheduledJob.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [this.scopeWhere(ctx)] },
            include: { rule: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
        });
        if (!job) throw new NotFoundException({ message: 'Scheduled job not found', code: 'job_not_found' });
        return { ...job, handler_info: this.handlers.list().find((h) => h.key === job.handler) ?? null };
    }

    async runs(ctx: OrgContext, id: string, query: JobRunQuery) {
        await this.findOne(ctx, id);
        const where: Prisma.ScheduledJobRunWhereInput = { job_id: id, ...(query.status && { status: query.status }) };
        const [items, total] = await Promise.all([
            this.prisma.scheduledJobRun.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' }, include: { triggered_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } }),
            this.prisma.scheduledJobRun.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async create(ctx: OrgContext, dto: CreateJobDto) {
        const handler = this.handlers.get(dto.handler);
        if (!handler?.user_creatable) throw new BadRequestException({ message: `Handler "${dto.handler}" cannot be scheduled from the API`, code: 'handler_not_allowed' });
        SchedulerService.validate(dto.kind, dto);
        if (dto.branch_id) await this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: ctx.organization_id } }).catch(() => { throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' }); });
        try {
            const job = await this.prisma.scheduledJob.create({
                data: {
                    ...this.scheduleColumns(dto),
                    organization_id: ctx.organization_id,
                    module: handler.module,
                    key: dto.key,
                    name: dto.name,
                    description: dto.description ?? null,
                    handler: dto.handler,
                    payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined,
                    branch_id: dto.branch_id ?? null,
                    max_retries: dto.max_retries ?? 3,
                    retry_backoff_seconds: dto.retry_backoff_seconds ?? 60,
                    timeout_seconds: dto.timeout_seconds ?? null,
                    allow_overlap: dto.allow_overlap ?? false,
                    catch_up_missed: dto.catch_up_missed ?? false,
                },
            });
            await this.scheduler.schedule(job);
            await this.audit.record(ctx, 'automation.job.created', { resource_type: 'scheduled_job', resource_id: job.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'automation.job.created', module: ModuleKey.AUTOMATION, entity_type: 'SCHEDULED_JOB', entity_id: job.id, payload: { name: job.name, key: job.key } });
            return this.findOne(ctx, job.id);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'A job with this key already exists', code: 'job_key_taken' });
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateJobDto) {
        const before = await this.findOne(ctx, id);
        if (before.rule_id) throw new ConflictException({ message: 'This job follows its workflow schedule; edit the workflow trigger instead', code: 'job_owned_by_rule' });
        if (dto.handler && dto.handler !== before.handler && !this.handlers.get(dto.handler)?.user_creatable) throw new BadRequestException({ message: 'Handler not allowed', code: 'handler_not_allowed' });
        const kind = dto.kind ?? before.kind;
        const schedule = { cron_expression: dto.cron_expression ?? before.cron_expression, interval_seconds: dto.interval_seconds ?? before.interval_seconds, run_at: dto.run_at ?? before.run_at, timezone: dto.timezone ?? before.timezone };
        SchedulerService.validate(kind, schedule);
        const { key: _key, ...rest } = dto;
        const job = await this.prisma.scheduledJob.update({
            where: { id },
            data: {
                ...rest,
                ...this.scheduleColumns({ kind, ...schedule, run_at: schedule.run_at ? new Date(schedule.run_at).toISOString() : undefined }),
                payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined,
            },
        });
        await this.scheduler.schedule(job);
        await this.audit.record(ctx, 'automation.job.updated', { resource_type: 'scheduled_job', resource_id: id, metadata: { before: { kind: before.kind, cron_expression: before.cron_expression, interval_seconds: before.interval_seconds, payload: before.payload }, after: dto } });
        return this.findOne(ctx, id);
    }

    async setStatus(ctx: OrgContext, id: string, status: ScheduledJobStatus) {
        const before = await this.findOne(ctx, id);
        if (before.rule_id) throw new ConflictException({ message: 'Enable or disable the workflow instead', code: 'job_owned_by_rule' });
        const job = await this.prisma.scheduledJob.update({ where: { id }, data: { status, paused_at: status === ScheduledJobStatus.PAUSED ? new Date() : null, ...(status === ScheduledJobStatus.ACTIVE ? { consecutive_failures: 0 } : {}) } });
        await this.scheduler.schedule(job);
        await this.audit.record(ctx, status === ScheduledJobStatus.PAUSED ? 'automation.job.paused' : 'automation.job.resumed', { resource_type: 'scheduled_job', resource_id: id });
        return this.findOne(ctx, id);
    }

    async runNow(ctx: OrgContext, id: string) {
        await this.findOne(ctx, id);
        await this.audit.record(ctx, 'automation.job.run_now', { resource_type: 'scheduled_job', resource_id: id });
        return this.scheduler.tick(id, { manual: true, membership_id: ctx.membership_id });
    }

    async remove(ctx: OrgContext, id: string) {
        const job = await this.findOne(ctx, id);
        if (job.rule_id) throw new ConflictException({ message: 'This job belongs to a workflow; delete or change the workflow instead', code: 'job_owned_by_rule' });
        this.scheduler.unschedule(id);
        await this.prisma.scheduledJob.delete({ where: { id } });
        await this.audit.record(ctx, 'automation.job.deleted', { resource_type: 'scheduled_job', resource_id: id, metadata: { before: { key: job.key, name: job.name } } });
        return { success: true };
    }

    preview(dto: PreviewScheduleDto) {
        return { next_runs: SchedulerService.nextRuns(dto.kind, dto, 5) };
    }

    private scheduleColumns(dto: { kind: ScheduledJobKind; cron_expression?: string | null; interval_seconds?: number | null; run_at?: string | null; timezone?: string | null }) {
        return {
            kind: dto.kind,
            cron_expression: dto.kind === ScheduledJobKind.CRON ? dto.cron_expression ?? null : null,
            interval_seconds: dto.kind === ScheduledJobKind.INTERVAL ? dto.interval_seconds ?? null : null,
            run_at: dto.kind === ScheduledJobKind.ONCE && dto.run_at ? new Date(dto.run_at) : null,
            timezone: dto.timezone || 'UTC',
        };
    }
}
