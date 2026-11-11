import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';
import { ticketScopeWhere } from '../common/support-scope.utils';
import { CreateIncidentDto, IncidentQuery, IncidentUpdateDto, UpdateIncidentDto } from './dto/incident.dto';

/** Grouped incidents across tickets with a status-page style timeline (13 §3, §5, §9). */
@Injectable()
export class IncidentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async findAll(ctx: OrgContext, q: IncidentQuery) {
        const where: Prisma.SupportIncidentWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.status && { status: q.status }),
            ...(q.severity && { severity: q.severity }),
            ...(q.search && { title: { contains: q.search, mode: 'insensitive' } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.supportIncident.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ resolved_at: { sort: 'desc', nulls: 'first' } }, { created_at: 'desc' }],
                include: { updates: { orderBy: { created_at: 'desc' }, take: 1 }, _count: { select: { tickets: true } } },
            }),
            this.prisma.supportIncident.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    async findOne(ctx: OrgContext, id: string) {
        const inc = await this.prisma.supportIncident.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                updates: { orderBy: { created_at: 'desc' }, include: { author: { select: MEMBER_SELECT } } },
                tickets: {
                    where: ticketScopeWhere(ctx, SUPPORT_PERMS.ticketsRead),
                    select: { id: true, reference: true, subject: true, priority: true, created_at: true, company: { select: { id: true, name: true } }, status: { select: { name: true, category: true, color: true } } },
                    orderBy: { created_at: 'desc' },
                },
            },
        });
        if (!inc) throw new NotFoundException({ message: 'Incident not found', code: 'incident_not_found' });
        const owner = inc.owner_membership_id ? await this.prisma.membership.findUnique({ where: { id: inc.owner_membership_id }, select: MEMBER_SELECT }) : null;
        return { ...inc, owner };
    }

    async create(ctx: OrgContext, dto: CreateIncidentDto) {
        const ticketIds = await this.validTickets(ctx, dto.ticket_ids ?? []);
        const firstReported = ticketIds.length ? await this.prisma.ticket.aggregate({ where: { id: { in: ticketIds } }, _min: { created_at: true } }) : null;
        const inc = await this.prisma.$transaction(async (tx) => {
            const row = await tx.supportIncident.create({
                data: {
                    organization_id: ctx.organization_id,
                    title: dto.title,
                    description: dto.description,
                    severity: dto.severity ?? 'MINOR',
                    affected_services: dto.affected_services ?? [],
                    owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                    project_id: dto.project_id ?? null,
                    status: 'CONFIRMED',
                    ticket_count: ticketIds.length,
                    first_reported_at: firstReported?._min.created_at ?? new Date(),
                },
            });
            if (ticketIds.length) await tx.ticket.updateMany({ where: { id: { in: ticketIds } }, data: { incident_id: row.id } });
            return row;
        });
        await this.audit.record(ctx, 'support_incident.created', { resource_type: 'support_incident', resource_id: inc.id, metadata: { title: inc.title, severity: inc.severity, ticket_ids: ticketIds } });
        this.events.publish(ctx, { event_key: 'support.incident.created', module: ModuleKey.SUPPORT, entity_kind: 'support_incident', entity_id: inc.id, payload: { title: inc.title, severity: inc.severity, ticket_count: ticketIds.length } });
        return this.findOne(ctx, inc.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateIncidentDto) {
        const before = await this.findOne(ctx, id);
        const { ticket_ids, ...rest } = dto;
        await this.prisma.$transaction(async (tx) => {
            await tx.supportIncident.update({
                where: { id },
                data: { ...rest, ...(dto.status === 'RESOLVED' && !before.resolved_at ? { resolved_at: new Date() } : {}), ...(dto.status && dto.status !== 'RESOLVED' ? { resolved_at: null } : {}) },
            });
            if (ticket_ids) {
                const valid = await this.validTickets(ctx, ticket_ids);
                await tx.ticket.updateMany({ where: { id: { in: valid } }, data: { incident_id: id } });
                await tx.supportIncident.update({ where: { id }, data: { ticket_count: await tx.ticket.count({ where: { incident_id: id } }) } });
            }
        });
        const statusChanged = dto.status && dto.status !== before.status;
        await this.audit.record(ctx, statusChanged ? 'support_incident.status_changed' : 'support_incident.updated', { resource_type: 'support_incident', resource_id: id, metadata: { before: { status: before.status, severity: before.severity }, after: dto } });
        this.events.publish(ctx, { event_key: statusChanged && dto.status === 'RESOLVED' ? 'support.incident.resolved' : 'support.incident.updated', module: ModuleKey.SUPPORT, entity_kind: 'support_incident', entity_id: id, payload: { title: before.title, status: dto.status ?? before.status }, changes: dto as Record<string, unknown> });
        return this.findOne(ctx, id);
    }

    async attachTickets(ctx: OrgContext, id: string, ticketIds: string[]) {
        return this.update(ctx, id, { ticket_ids: ticketIds });
    }

    async detachTicket(ctx: OrgContext, id: string, ticketId: string) {
        await this.findOne(ctx, id);
        await this.prisma.ticket.updateMany({ where: { id: ticketId, incident_id: id, organization_id: ctx.organization_id }, data: { incident_id: null } });
        await this.prisma.supportIncident.update({ where: { id }, data: { ticket_count: await this.prisma.ticket.count({ where: { incident_id: id } }) } });
        await this.audit.record(ctx, 'support_incident.ticket_removed', { resource_type: 'support_incident', resource_id: id, metadata: { ticket_id: ticketId } });
        return this.findOne(ctx, id);
    }

    async postUpdate(ctx: OrgContext, id: string, dto: IncidentUpdateDto) {
        const inc = await this.findOne(ctx, id);
        if (dto.customer_visible && !ctx.can(SUPPORT_PERMS.incidentsPublish)) {
            throw new ForbiddenException({ message: 'Customer-visible updates need support.incidents.publish', code: 'permission_denied', permissions: [SUPPORT_PERMS.incidentsPublish] });
        }
        const row = await this.prisma.$transaction(async (tx) => {
            const u = await tx.supportIncidentUpdate.create({ data: { organization_id: ctx.organization_id, incident_id: id, status: dto.status, body: dto.body, customer_visible: dto.customer_visible ?? false, author_membership_id: ctx.membership_id } });
            if (dto.status === 'RESOLVED' && inc.status !== 'RESOLVED') await tx.supportIncident.update({ where: { id }, data: { status: 'RESOLVED', resolved_at: new Date() } });
            return u;
        });
        await this.audit.record(ctx, dto.customer_visible ? 'support_incident.update_published' : 'support_incident.update_added', { resource_type: 'support_incident', resource_id: id, metadata: { status: dto.status, customer_visible: !!dto.customer_visible } });
        this.events.publish(ctx, {
            event_key: dto.customer_visible ? 'support.incident.update_published' : 'support.incident.update_added',
            module: ModuleKey.SUPPORT,
            entity_kind: 'support_incident',
            entity_id: id,
            payload: { title: inc.title, status: dto.status, body: dto.body, customer_visible: !!dto.customer_visible, affected_company_ids: [...new Set(inc.tickets.map((t) => t.company?.id).filter(Boolean))] },
            ...(dto.customer_visible && { activity: { summary: `Incident update: ${inc.title} — ${dto.status.toLowerCase()}`, customer_visible: true } }),
        });
        return row;
    }

    private async validTickets(ctx: OrgContext, ids: string[]) {
        if (!ids.length) return [];
        const rows = await this.prisma.ticket.findMany({ where: { AND: [{ id: { in: ids }, organization_id: ctx.organization_id }, ticketScopeWhere(ctx, SUPPORT_PERMS.ticketsRead)] }, select: { id: true } });
        if (rows.length !== new Set(ids).size) throw new NotFoundException({ message: 'One or more tickets were not found', code: 'ticket_not_found' });
        return rows.map((r) => r.id);
    }
}
