import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ActivityQuery, MyActivityQuery } from './dto/activity-query.schema';
import { memberUserSelect } from './utils/system-context';

const READ = 'notifications.activity.read';

/**
 * 14 §7 — activity feed read model (ActivityEvent rows written by the owning modules through EventsService.publish).
 * The feed never creates activity; audit_events stays the compliance trail.
 */
@Injectable()
export class ActivityService {
    constructor(private readonly prisma: PrismaService) { }

    /** Scope: organization-wide holders see everything; others see their branches / projects / customers and their own actions. */
    private scopeWhere(ctx: OrgContext): Prisma.ActivityEventWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return {
            OR: [
                { branch_id: { in: scope.branch_ids } },
                { project_id: { in: scope.project_ids } },
                { company_id: { in: scope.customer_ids } },
                ...(ctx.membership_id ? [{ actor_membership_id: ctx.membership_id }] : []),
            ],
        };
    }

    async findAll(ctx: OrgContext, query: ActivityQuery) {
        if (query.scope === 'project' && !query.project_id) throw new BadRequestException({ message: 'project_id is required for the project scope', code: 'project_required' });
        if (query.scope === 'customer' && !query.company_id) throw new BadRequestException({ message: 'company_id is required for the customer scope', code: 'company_required' });
        const where: Prisma.ActivityEventWhereInput = {
            AND: [
                { organization_id: ctx.organization_id },
                this.scopeWhere(ctx),
                ...(query.project_id ? [{ project_id: query.project_id }] : []),
                ...(query.company_id ? [{ company_id: query.company_id }] : []),
                ...(query.module ? [{ module: query.module }] : []),
                ...(query.actor_membership_id ? [{ actor_membership_id: query.actor_membership_id }] : []),
                ...(query.entity_type ? [{ entity_type: query.entity_type }] : []),
                ...(query.entity_id ? [{ entity_id: query.entity_id }] : []),
                ...(query.from || query.to ? [{ occurred_at: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }] : []),
                ...(query.search ? [{ OR: [{ summary: { contains: query.search, mode: 'insensitive' as const } }, { entity_label: { contains: query.search, mode: 'insensitive' as const } }] }] : []),
            ],
        };
        const [items, total] = await Promise.all([
            this.prisma.activityEvent.findMany({ where, ...skipTake(query), orderBy: { occurred_at: 'desc' } }),
            this.prisma.activityEvent.count({ where }),
        ]);
        return paginate(await this.withActors(ctx, items), total, query);
    }

    /** The caller's own recent actions (Home "Recent"); never visible to others. */
    async mine(ctx: OrgContext, query: MyActivityQuery) {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Only organization members have recent activity', code: 'activity_requires_membership' });
        const where: Prisma.ActivityEventWhereInput = {
            organization_id: ctx.organization_id,
            actor_membership_id: ctx.membership_id,
            ...(query.module && { module: query.module }),
            ...(query.search && { summary: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.activityEvent.findMany({ where, ...skipTake(query), orderBy: { occurred_at: 'desc' } }),
            this.prisma.activityEvent.count({ where }),
        ]);
        return paginate(await this.withActors(ctx, items), total, query);
    }

    /** Feed rows keep plain actor ids (they outlive members); resolve names in one query. */
    private async withActors<T extends { actor_membership_id: string | null }>(ctx: OrgContext, rows: T[]) {
        const ids = [...new Set(rows.map((r) => r.actor_membership_id).filter(Boolean))] as string[];
        const actors = ids.length
            ? await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id }, select: { id: true, user: { select: memberUserSelect } } })
            : [];
        const byId = new Map(actors.map((a) => [a.id, a]));
        return rows.map((r) => ({ ...r, actor: r.actor_membership_id ? byId.get(r.actor_membership_id) ?? null : null }));
    }
}
