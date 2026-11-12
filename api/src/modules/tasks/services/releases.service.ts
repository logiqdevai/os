import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeploymentStatus, ModuleKey, Prisma, ReleaseStatus, TaskStatusCategory } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { compact, toDate } from '@/modules/projects/utils/projects.utils';
import { CreateDeploymentDto, CreateReleaseDto, ReleaseTasksDto, UpdateReleaseDto } from '../dto/task-config.dto';
import { ReleaseQuery } from '../dto/task-query.schema';
import { serializeTask, TASK_LIST_INCLUDE } from '../utils/task-serialize.utils';
import { TasksService } from './tasks.service';

/** Releases and deployments (06 §9). Changes need tasks.releases.manage. */
@Injectable()
export class ReleasesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly tasks: TasksService,
    ) { }

    async list(ctx: OrgContext, query: ReleaseQuery) {
        const where: Prisma.ReleaseWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.team_id && { team_id: query.team_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { version: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.release.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ target_date: { sort: 'desc', nulls: 'first' } }, { created_at: 'desc' }],
                include: {
                    team: { select: { id: true, name: true, task_key: true } },
                    project: { select: { id: true, name: true, color: true } },
                    deployments: { orderBy: { created_at: 'desc' }, take: 5 },
                },
            }),
            this.prisma.release.count({ where }),
        ]);
        const ids = items.map((r) => r.id);
        const [totals, done] = ids.length
            ? await Promise.all([
                this.prisma.task.groupBy({ by: ['release_id'], where: { release_id: { in: ids }, archived_at: null }, _count: { _all: true } }),
                this.prisma.task.groupBy({ by: ['release_id'], where: { release_id: { in: ids }, archived_at: null, status: { category: TaskStatusCategory.DONE } }, _count: { _all: true } }),
            ])
            : [[], []];
        const totalBy = new Map(totals.map((r) => [r.release_id, r._count._all]));
        const doneBy = new Map(done.map((r) => [r.release_id, r._count._all]));
        return paginate(items.map((r) => ({ ...r, progress: { total: totalBy.get(r.id) ?? 0, done: doneBy.get(r.id) ?? 0 } })), total, query);
    }

    async get(ctx: OrgContext, id: string) {
        const release = await this.find(ctx, id);
        const tasks = await this.prisma.task.findMany({
            where: { AND: [{ release_id: id, archived_at: null }, this.tasks.scopeWhere(ctx)] },
            include: TASK_LIST_INCLUDE,
            orderBy: [{ completed_at: { sort: 'desc', nulls: 'last' } }, { number: 'desc' }],
        });
        return { ...release, tasks: tasks.map(serializeTask) };
    }

    async create(ctx: OrgContext, dto: CreateReleaseDto) {
        await this.assertRefs(ctx, dto);
        const release = await this.prisma.release.create({
            data: {
                ...dto, organization_id: ctx.organization_id, target_date: toDate(dto.target_date) ?? null, created_by_user_id: ctx.user_id,
                ...(dto.status === ReleaseStatus.RELEASED && { released_at: new Date() }),
            },
        });
        await this.audit.record(ctx, 'release.created', { resource_type: 'release', resource_id: release.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'tasks.release.created', module: ModuleKey.TASKS, entity_kind: 'release', entity_id: release.id, payload: { name: release.name, version: release.version, project_id: release.project_id } });
        return release;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateReleaseDto) {
        const before = await this.find(ctx, id);
        await this.assertRefs(ctx, dto);
        const released = dto.status === ReleaseStatus.RELEASED && before.status !== ReleaseStatus.RELEASED;
        const data = compact({ ...dto, target_date: toDate(dto.target_date) }) as Prisma.ReleaseUncheckedUpdateInput;
        if (released) data.released_at = new Date();
        if (dto.status && dto.status !== ReleaseStatus.RELEASED) data.released_at = null;
        // Editing the notes outside "Publish" turns them back into a draft until someone publishes again.
        if (dto.notes !== undefined && dto.notes !== before.notes) { data.notes_published_at = null; data.notes_published_by_membership_id = null; }
        const release = await this.prisma.release.update({ where: { id }, data });
        await this.audit.record(ctx, released ? 'release.released' : 'release.updated', {
            resource_type: 'release', resource_id: id, metadata: { before: { name: before.name, status: before.status, target_date: before.target_date }, after: dto },
        });
        if (released) {
            const tasks = await this.prisma.task.count({ where: { release_id: id } });
            this.events.publish(ctx, {
                event_key: 'tasks.release.released', module: ModuleKey.TASKS, entity_kind: 'release', entity_id: id,
                payload: { name: release.name, version: release.version, project_id: release.project_id, task_count: tasks, customer_visible: release.customer_visible },
                activity: { summary: `released ${release.name}${release.version ? ` ${release.version}` : ''}`, entity_label: release.name, project_id: release.project_id, customer_visible: release.customer_visible },
            });
        }
        return release;
    }

    async setTasks(ctx: OrgContext, id: string, dto: ReleaseTasksDto, add: boolean) {
        await this.find(ctx, id);
        const visible = await this.prisma.task.findMany({ where: { AND: [{ id: { in: dto.task_ids }, organization_id: ctx.organization_id }, this.tasks.scopeWhere(ctx, 'tasks.tasks.update')] }, select: { id: true } });
        if (visible.length !== new Set(dto.task_ids).size) throw new BadRequestException({ message: 'Some tasks were not found', code: 'task_not_found' });
        await this.prisma.task.updateMany({ where: { id: { in: visible.map((t) => t.id) }, ...(add ? {} : { release_id: id }) }, data: { release_id: add ? id : null } });
        await this.audit.record(ctx, add ? 'release.tasks_added' : 'release.tasks_removed', { resource_type: 'release', resource_id: id, metadata: { task_ids: dto.task_ids } });
        return { updated: visible.length };
    }

    async addDeployment(ctx: OrgContext, id: string, dto: CreateDeploymentDto) {
        const release = await this.find(ctx, id);
        const finished = dto.status === DeploymentStatus.SUCCEEDED || dto.status === DeploymentStatus.FAILED || dto.status === DeploymentStatus.ROLLED_BACK;
        const deployment = await this.prisma.releaseDeployment.create({
            data: { ...dto, release_id: id, deployed_by_user_id: ctx.user_id, ...(finished && { deployed_at: new Date() }) },
        });
        await this.audit.record(ctx, 'release.deployment_recorded', { resource_type: 'release', resource_id: id, metadata: { environment: dto.environment, status: deployment.status } });
        this.events.publish(ctx, {
            event_key: 'tasks.release.deployment_recorded', module: ModuleKey.TASKS, entity_kind: 'release', entity_id: id,
            payload: { name: release.name, environment: dto.environment, status: deployment.status, url: dto.url ?? null },
        });
        return deployment;
    }

    private async find(ctx: OrgContext, id: string) {
        const release = await this.prisma.release.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                team: { select: { id: true, name: true, task_key: true } },
                project: { select: { id: true, name: true, color: true } },
                deployments: { orderBy: { created_at: 'desc' } },
            },
        });
        if (!release) throw new NotFoundException({ message: 'Release not found', code: 'release_not_found' });
        return release;
    }

    private async assertRefs(ctx: OrgContext, dto: Partial<CreateReleaseDto>) {
        const org = ctx.organization_id;
        const [team, project, milestone] = await Promise.all([
            dto.team_id ? this.prisma.team.count({ where: { id: dto.team_id, organization_id: org } }) : 1,
            dto.project_id ? this.prisma.project.count({ where: { id: dto.project_id, organization_id: org } }) : 1,
            dto.milestone_id ? this.prisma.projectMilestone.count({ where: { id: dto.milestone_id, project: { organization_id: org } } }) : 1,
        ]);
        if (!team || !project || !milestone) throw new BadRequestException({ message: 'Team, project or milestone not found', code: 'reference_not_found' });
    }
}
