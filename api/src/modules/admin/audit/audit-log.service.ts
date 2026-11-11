import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, AuditOutcome, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AUDIT_EVENT_TYPES } from '@/shared/constants/audit-event-types';
import { BaseListQuerySchema, csv, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { USER_SELECT } from '../shared/admin-access.service';

const READ = 'organizations.audit.read';

export const AuditQuerySchema = BaseListQuerySchema.extend({
    event_type: csv(z.string().max(120)),
    actor_user_id: z.string().uuid().optional(),
    actor_type: z.nativeEnum(AuditActorType).optional(),
    resource_type: z.string().max(80).optional(),
    resource_id: z.string().max(80).optional(),
    outcome: z.nativeEnum(AuditOutcome).optional(),
    branch_id: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

/** Read side of the immutable audit log (01 §99–100, §139). Writes always go through AuditService. */
@Injectable()
export class AuditLogService {
    constructor(private readonly prisma: PrismaService) { }

    /** Branch-scoped readers only see events of their branches. */
    private scopeWhere(ctx: OrgContext): Prisma.AuditEventWhereInput {
        const scope = ctx.scopeOf(READ);
        if (!scope || scope.organization) return {};
        return { branch_id: { in: scope.branch_ids } };
    }

    async findAll(ctx: OrgContext, query: AuditQuery) {
        const where: Prisma.AuditEventWhereInput = {
            organization_id: ctx.organization_id,
            ...this.scopeWhere(ctx),
            ...(query.event_type?.length && { event_type: { in: query.event_type } }),
            ...(query.actor_user_id && { actor_user_id: query.actor_user_id }),
            ...(query.actor_type && { actor_type: query.actor_type }),
            ...(query.resource_type && { resource_type: query.resource_type }),
            ...(query.resource_id && { resource_id: query.resource_id }),
            ...(query.outcome && { outcome: query.outcome }),
            ...(query.branch_id && { branch_id: query.branch_id }),
            ...(query.search && { OR: [{ event_type: { contains: query.search, mode: 'insensitive' } }, { resource_id: { contains: query.search } }, { ip_address: { contains: query.search } }] }),
            ...((query.from || query.to) && { created_at: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.auditEvent.findMany({
                where,
                ...skipTake(query),
                orderBy: { created_at: query.order_direction === 'asc' ? 'asc' : 'desc' },
                include: { actor_user: { select: USER_SELECT } },
            }),
            this.prisma.auditEvent.count({ where }),
        ]);
        const saIds = [...new Set(items.map((i) => i.actor_service_account_id).filter(Boolean) as string[])];
        const accounts = saIds.length ? await this.prisma.serviceAccount.findMany({ where: { id: { in: saIds } }, select: { id: true, name: true } }) : [];
        return paginate(items.map((i) => ({ ...i, actor_service_account: accounts.find((a) => a.id === i.actor_service_account_id) ?? null })), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const event = await this.prisma.auditEvent.findFirst({ where: { id, organization_id: ctx.organization_id, ...this.scopeWhere(ctx) }, include: { actor_user: { select: USER_SELECT } } });
        if (!event) throw new NotFoundException({ message: 'Audit event not found', code: 'audit_event_not_found' });
        const related = event.resource_id
            ? await this.prisma.auditEvent.findMany({
                where: { organization_id: ctx.organization_id, resource_id: event.resource_id, id: { not: id }, ...this.scopeWhere(ctx) },
                orderBy: { created_at: 'desc' },
                take: 10,
                select: { id: true, event_type: true, created_at: true, outcome: true, actor_user: { select: USER_SELECT } },
            })
            : [];
        return { ...event, related };
    }

    types() {
        return Object.entries(AUDIT_EVENT_TYPES).map(([event_type, meta]) => ({ event_type, ...meta }));
    }
}
