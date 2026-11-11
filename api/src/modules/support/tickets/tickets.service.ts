import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, SupportChannelType, TaskPriority, TicketPriority, TicketSource } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { NumberingService } from '@/modules/numbering/numbering.service';
import { defaultStatus, ensureTaskStatuses } from '@/modules/tasks/utils/task-defaults.utils';
import { nextTaskNumber, taskIdentifier } from '@/modules/tasks/utils/task-number.utils';
import { SupportSetupService } from '../common/support-setup.service';
import { ticketScopeWhere } from '../common/support-scope.utils';
import { CLOSED_CATEGORIES, MEMBER_SELECT, OPEN_CATEGORIES, SUPPORT_PERMS, USER_PUBLIC_SELECT } from '../common/support.constants';
import { SlaService } from '../sla/sla.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CsatService } from '../csat/csat.service';
import { TicketWorkflowService } from './ticket-workflow.service';
import {
    AssignTicketDto,
    ChangeTicketStatusDto,
    ConvertToTaskDto,
    CreateTicketDto,
    EscalateTicketDto,
    MergeTicketDto,
    TicketQuery,
    TicketRelationDto,
    TicketReplyDto,
    UpdateTicketDto,
} from './dto/ticket.dto';

type Tx = Prisma.TransactionClient;

const READ = SUPPORT_PERMS.ticketsRead;

const SOURCE_CHANNEL: Partial<Record<TicketSource, SupportChannelType>> = {
    PORTAL: 'PORTAL',
    EMAIL: 'EMAIL',
    LIVE_CHAT: 'LIVE_CHAT',
    WIDGET: 'WIDGET',
    FORM: 'FORM',
    API: 'API',
};

const PRIORITY_TO_TASK: Record<TicketPriority, TaskPriority> = { LOW: 'LOW', NORMAL: 'MEDIUM', HIGH: 'HIGH', URGENT: 'URGENT' };

const STATUS_SELECT = { id: true, name: true, slug: true, category: true, color: true, customer_label: true, pauses_sla: true } as const;

const LIST_INCLUDE = {
    status: { select: STATUS_SELECT },
    category: { select: { id: true, name: true, color: true } },
    inbox: { select: { id: true, name: true } },
    team: { select: { id: true, name: true } },
    assignee: { select: MEMBER_SELECT },
    company: { select: { id: true, name: true } },
    requester: { select: { id: true, first_name: true, last_name: true, email: true } },
    requester_user: { select: USER_PUBLIC_SELECT },
    project: { select: { id: true, name: true, code: true } },
    _count: { select: { task_links: true, followers: true } },
} satisfies Prisma.TicketInclude;

export interface PortalRequester {
    user_id: string;
    customer_id: string;
    name: string | null;
    email: string;
}

/**
 * Support tickets (13 §2, §4, §5). Ticket threads are SupportConversations (primary + linked); replies on a ticket
 * go through the shared message engine. SLA timers are computed on create/update and swept by SlaService.
 */
@Injectable()
export class TicketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
        private readonly numbering: NumberingService,
        private readonly sla: SlaService,
        private readonly workflow: TicketWorkflowService,
        private readonly conversations: ConversationsService,
        private readonly csat: CsatService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    private listWhere(ctx: OrgContext, q: Partial<TicketQuery>): Prisma.TicketWhereInput {
        const assignee =
            q.assignee === 'me' ? { assignee_membership_id: ctx.membership_id ?? '__none__' }
                : q.assignee === 'unassigned' ? { assignee_membership_id: null }
                    : q.assignee ? { assignee_membership_id: q.assignee } : {};
        const state =
            q.state === 'open' ? { status: { category: { in: OPEN_CATEGORIES } } }
                : q.state === 'closed' ? { status: { category: { in: CLOSED_CATEGORIES } } } : {};
        const sla =
            q.sla === 'breached' ? { sla_breached: true }
                : q.sla === 'at_risk' ? { sla_at_risk: true, sla_breached: false }
                    : q.sla === 'ok' ? { sla_at_risk: false, sla_breached: false } : {};
        const search = q.search?.trim();
        return {
            AND: [
                { organization_id: ctx.organization_id, merged_into_ticket_id: null, archived_at: q.archived ? { not: null } : null },
                ticketScopeWhere(ctx, READ),
                assignee,
                state,
                sla,
                q.status_id ? { status_id: q.status_id } : {},
                q.status_category?.length ? { status: { category: { in: q.status_category } } } : {},
                q.priority?.length ? { priority: { in: q.priority } } : {},
                q.type ? { type: q.type } : {},
                q.source ? { source: q.source } : {},
                q.inbox_id ? { inbox_id: q.inbox_id } : {},
                q.team_id ? { team_id: q.team_id } : {},
                q.category_id ? { category_id: q.category_id } : {},
                q.company_id ? { company_id: q.company_id } : {},
                q.project_id ? { project_id: q.project_id } : {},
                q.incident_id ? { incident_id: q.incident_id } : {},
                search
                    ? {
                        OR: [
                            { reference: { contains: search, mode: 'insensitive' } },
                            { subject: { contains: search, mode: 'insensitive' } },
                            { description: { contains: search, mode: 'insensitive' } },
                            { requester_email: { contains: search, mode: 'insensitive' } },
                            { company: { name: { contains: search, mode: 'insensitive' } } },
                        ],
                    }
                    : {},
            ],
        };
    }

    async findAll(ctx: OrgContext, q: TicketQuery) {
        const where = this.listWhere(ctx, q);
        const [rows, total] = await Promise.all([
            this.prisma.ticket.findMany({
                where,
                ...skipTake(q),
                orderBy: [orderBy(q, ['created_at', 'updated_at', 'priority', 'resolution_due_at', 'first_response_due_at', 'number'], 'created_at'), { number: 'desc' }],
                include: LIST_INCLUDE,
            }),
            this.prisma.ticket.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    /** Counts for the saved views of the tickets list. */
    async counts(ctx: OrgContext) {
        const c = (q: Partial<TicketQuery>) => this.prisma.ticket.count({ where: this.listWhere(ctx, q) });
        const [open, mine, unassigned, breached, at_risk, resolved] = await Promise.all([
            c({ state: 'open' }),
            c({ state: 'open', assignee: 'me' }),
            c({ state: 'open', assignee: 'unassigned' }),
            c({ state: 'open', sla: 'breached' }),
            c({ state: 'open', sla: 'at_risk' }),
            c({ state: 'closed' }),
        ]);
        return { open, mine, unassigned, breached, at_risk, resolved };
    }

    async findOne(ctx: OrgContext, idOrRef: string) {
        const isUuid = /^[0-9a-f-]{36}$/i.test(idOrRef);
        const ticket = await this.prisma.ticket.findFirst({
            where: { AND: [{ organization_id: ctx.organization_id }, isUuid ? { id: idOrRef } : { reference: { equals: idOrRef, mode: 'insensitive' } }, ticketScopeWhere(ctx, READ)] },
            include: {
                ...LIST_INCLUDE,
                branch: { select: { id: true, name: true } },
                sla_policy: { select: { id: true, name: true, use_business_hours: true } },
                sla_timers: { orderBy: { created_at: 'asc' } },
                followers: { include: { membership: { select: MEMBER_SELECT } } },
                task_links: { include: { task: { select: { id: true, number: true, title: true, priority: true, customer_visible: true, team: { select: { task_key: true } }, status: { select: { name: true, category: true, color: true } }, assignee: { select: MEMBER_SELECT } } } } },
                relations_from: { include: { target: { select: { id: true, reference: true, subject: true, status: { select: STATUS_SELECT } } } } },
                relations_to: { include: { source: { select: { id: true, reference: true, subject: true, status: { select: STATUS_SELECT } } } } },
                incident: { select: { id: true, title: true, status: true, severity: true } },
                merged_into: { select: { id: true, reference: true, subject: true } },
                conversation: { select: { id: true, channel_type: true, status: true, customer_name: true, customer_email: true } },
                conversations: { include: { conversation: { select: { id: true, subject: true, channel_type: true, status: true, last_message_at: true } } } },
                status_history: { orderBy: { changed_at: 'desc' }, take: 50, include: { from_status: { select: STATUS_SELECT }, to_status: { select: STATUS_SELECT } } },
                csat_ratings: { select: { id: true, rating: true, comment: true, submitted_at: true, requested_at: true }, orderBy: { requested_at: 'desc' }, take: 3 },
                attachments: true,
            },
        });
        if (!ticket) throw new NotFoundException({ message: 'Ticket not found', code: 'ticket_not_found' });
        return {
            ...ticket,
            task_links: ticket.task_links.map((l) => ({ ...l, task: { ...l.task, identifier: taskIdentifier(l.task) } })),
            following: !!ctx.membership_id && ticket.followers.some((f) => f.membership_id === ctx.membership_id),
        };
    }

    /** Thread of the ticket: primary conversation plus linked conversations, oldest first. */
    async messages(ctx: OrgContext, id: string) {
        const ticket = await this.findBase(ctx, id);
        const links = await this.prisma.ticketConversation.findMany({ where: { ticket_id: ticket.id }, select: { conversation_id: true } });
        const ids = [ticket.conversation_id, ...links.map((l) => l.conversation_id)].filter(Boolean) as string[];
        if (!ids.length) return [];
        return this.prisma.supportMessage.findMany({
            where: { conversation_id: { in: ids }, deleted_at: null },
            orderBy: { created_at: 'asc' },
            include: { author: { select: MEMBER_SELECT }, author_user: { select: USER_PUBLIC_SELECT }, attachments: true },
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateTicketDto, portal?: PortalRequester) {
        await this.setup.ensureDefaults(ctx.organization_id);
        if (dto.assignee_membership_id && dto.assignee_membership_id !== ctx.membership_id && !portal && !ctx.can(SUPPORT_PERMS.ticketsAssign)) {
            throw new ForbiddenException({ message: 'Assigning to someone else needs support.tickets.assign', code: 'permission_denied', permissions: [SUPPORT_PERMS.ticketsAssign] });
        }
        await this.assertRefs(ctx, dto);
        const settings = await this.setup.settings(ctx.organization_id);

        // From a conversation: requester and channel come from the thread.
        let conv: Awaited<ReturnType<ConversationsService['findBase']>> | null = null;
        if (dto.conversation_id) conv = await this.conversations.findBase(ctx, dto.conversation_id);

        const category = dto.category_id ? await this.prisma.ticketCategory.findFirst({ where: { id: dto.category_id, organization_id: ctx.organization_id } }) : null;
        const source: TicketSource = portal ? 'PORTAL' : dto.source ?? (conv ? 'CONVERSATION' : ctx.channel === 'mcp' ? 'AI_AGENT' : ctx.channel === 'api' ? 'API' : 'MANUAL');
        const channel = conv?.channel_type ?? SOURCE_CHANNEL[source] ?? null;
        const priority = dto.priority ?? category?.default_priority ?? conv?.priority ?? 'NORMAL';
        const inboxId = dto.inbox_id ?? category?.default_inbox_id ?? conv?.inbox_id ?? settings.default_inbox_id;
        const teamId = dto.team_id ?? category?.default_team_id ?? conv?.team_id ?? null;
        const projectId = dto.project_id ?? null;

        let companyId = portal?.customer_id ?? dto.company_id ?? conv?.company_id ?? null;
        let requesterEmail = portal?.email ?? dto.requester_email?.toLowerCase() ?? conv?.customer_email ?? null;
        let requesterName = portal?.name ?? dto.requester_name ?? conv?.customer_name ?? null;
        const contactId = dto.requester_contact_id ?? conv?.contact_id ?? null;
        if (contactId && !portal) {
            const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, organization_id: ctx.organization_id } });
            companyId = companyId ?? contact?.company_id ?? null;
            requesterEmail = requesterEmail ?? contact?.email?.toLowerCase() ?? null;
            requesterName = requesterName ?? ([contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || null);
        }
        if (projectId && companyId) {
            const project = await this.prisma.project.findFirst({ where: { id: projectId, organization_id: ctx.organization_id }, select: { company_id: true } });
            if (project?.company_id && project.company_id !== companyId) throw new BadRequestException({ message: 'The project belongs to another customer', code: 'ticket_project_customer_mismatch' });
        }
        const inbox = inboxId ? await this.prisma.supportInbox.findFirst({ where: { id: inboxId, organization_id: ctx.organization_id }, select: { branch_id: true, default_assignee_membership_id: true, team_id: true } }) : null;
        const assignee = dto.assignee_membership_id ?? inbox?.default_assignee_membership_id ?? null;

        const ticket = await this.prisma.$transaction(async (tx) => {
            const seq = await this.numbering.next(tx, ctx.organization_id, 'ticket', { reset_policy: 'NEVER', padding: 1 });
            const number = Number(/(\d+)$/.exec(seq)?.[1] ?? 0);
            const status = dto.status_id ? await tx.ticketStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id } }) : await this.workflow.defaultStatus(tx, ctx.organization_id);
            const created = await tx.ticket.create({
                data: {
                    organization_id: ctx.organization_id,
                    number,
                    reference: `${settings.ticket_prefix}-${number}`,
                    branch_id: dto.branch_id ?? inbox?.branch_id ?? null,
                    inbox_id: inboxId,
                    conversation_id: conv?.id ?? null,
                    subject: dto.subject,
                    description: dto.description,
                    type: dto.type ?? 'QUESTION',
                    source,
                    channel_type: channel,
                    status_id: status?.id ?? null,
                    priority,
                    category_id: dto.category_id ?? null,
                    requester_contact_id: contactId,
                    company_id: companyId,
                    requester_user_id: portal?.user_id ?? conv?.customer_user_id ?? null,
                    requester_email: requesterEmail,
                    requester_name: requesterName,
                    assignee_membership_id: assignee,
                    team_id: teamId ?? inbox?.team_id ?? null,
                    project_id: projectId,
                    due_at: dto.due_at ? new Date(dto.due_at) : null,
                    customer_visible: dto.customer_visible ?? true,
                    created_by_membership_id: portal ? null : ctx.membership_id,
                    created_by_user_id: ctx.user_id,
                    last_customer_reply_at: portal ? new Date() : null,
                },
            });
            await tx.ticketStatusHistory.create({ data: { ticket_id: created.id, to_status_id: status?.id ?? null, to_category: status?.category ?? null, changed_by_membership_id: ctx.membership_id, changed_by_user_id: ctx.user_id, changed_via: portal ? 'customer' : 'manual', reason: 'Created' } });

            // Portal requests open a PORTAL conversation with the request body as the first customer message.
            if (portal) {
                const c = await tx.supportConversation.create({
                    data: {
                        organization_id: ctx.organization_id,
                        inbox_id: inboxId,
                        channel_type: 'PORTAL',
                        subject: dto.subject,
                        priority,
                        company_id: companyId,
                        customer_user_id: portal.user_id,
                        customer_name: requesterName,
                        customer_email: requesterEmail,
                        assignee_membership_id: assignee,
                        team_id: teamId,
                    },
                });
                await tx.ticket.update({ where: { id: created.id }, data: { conversation_id: c.id } });
                await this.conversations.addMessage(tx, c.id, { kind: 'CUSTOMER', body: dto.description || dto.subject, author_user_id: portal.user_id, author_name: requesterName, author_email: requesterEmail, channel_type: 'PORTAL' });
            }

            const policy = await this.sla.resolvePolicy(tx, ctx.organization_id, { sla_policy_id: dto.sla_policy_id, category_id: dto.category_id, inbox_id: inboxId, priority, channel_type: channel, company_id: companyId, type: dto.type });
            await this.sla.applyPolicy(tx, created.id, policy, { paused: !!status?.pauses_sla, firstRespondedAt: conv?.first_agent_response_at ?? null });
            if (conv?.first_agent_response_at) await tx.ticket.update({ where: { id: created.id }, data: { first_responded_at: conv.first_agent_response_at } });

            const followers = [...new Set([portal ? null : ctx.membership_id, assignee].filter(Boolean) as string[])];
            if (followers.length) await tx.ticketFollower.createMany({ data: followers.map((m) => ({ ticket_id: created.id, membership_id: m })), skipDuplicates: true });
            return created;
        });

        await this.audit.record(ctx, 'ticket.created', { resource_type: 'ticket', resource_id: ticket.id, branch_id: ticket.branch_id, metadata: { reference: ticket.reference, source, priority, company_id: companyId, conversation_id: conv?.id } });
        this.events.publish(ctx, {
            event_key: 'support.ticket.created',
            module: ModuleKey.SUPPORT,
            entity_type: 'TICKET',
            entity_id: ticket.id,
            payload: { reference: ticket.reference, subject: ticket.subject, priority, source, type: ticket.type, company_id: companyId, assignee_membership_id: assignee, requester_user_id: ticket.requester_user_id },
            activity: { summary: `Ticket ${ticket.reference} opened: ${ticket.subject}`, entity_label: ticket.reference, company_id: companyId, project_id: projectId, branch_id: ticket.branch_id, customer_visible: ticket.customer_visible },
        });
        return ticket;
    }

    // ---------------------------------------------------------------------------------------------
    // Update
    // ---------------------------------------------------------------------------------------------

    async update(ctx: OrgContext, id: string, dto: UpdateTicketDto) {
        const before = await this.findBase(ctx, id);
        await this.assertRefs(ctx, dto);
        const updated = await this.prisma.$transaction(async (tx) => {
            const row = await tx.ticket.update({
                where: { id },
                data: { ...dto, ...(dto.due_at !== undefined && { due_at: dto.due_at ? new Date(dto.due_at) : null }), ...(dto.requester_email && { requester_email: dto.requester_email.toLowerCase() }) },
            });
            if (dto.sla_policy_id && dto.sla_policy_id !== before.sla_policy_id) {
                const policy = await tx.slaPolicy.findFirst({ where: { id: dto.sla_policy_id, organization_id: ctx.organization_id }, include: { targets: true } });
                const status = row.status_id ? await tx.ticketStatus.findUnique({ where: { id: row.status_id } }) : null;
                await this.sla.applyPolicy(tx, id, policy, { paused: !!status?.pauses_sla, firstRespondedAt: row.first_responded_at });
            } else if (dto.priority && dto.priority !== before.priority) {
                await this.sla.onPriorityChange(tx, id);
            }
            return row;
        });
        const changes = this.diff(before as Record<string, unknown>, dto as Record<string, unknown>);
        await this.audit.record(ctx, 'ticket.updated', { resource_type: 'ticket', resource_id: id, branch_id: updated.branch_id, metadata: { changes } });
        this.events.publish(ctx, { event_key: dto.priority && dto.priority !== before.priority ? 'support.ticket.priority_changed' : 'support.ticket.updated', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: id, payload: { reference: updated.reference }, changes });
        return this.findOne(ctx, id);
    }

    async changeStatus(ctx: OrgContext, id: string, dto: ChangeTicketStatusDto) {
        const before = await this.findBase(ctx, id);
        const to = await this.prisma.ticketStatus.findFirst({ where: { id: dto.status_id, organization_id: ctx.organization_id, archived_at: null } });
        if (!to) throw new NotFoundException({ message: 'Status not found', code: 'ticket_status_not_found' });
        const result = await this.prisma.$transaction((tx) => this.workflow.transition(tx, id, to, { membership_id: ctx.membership_id, user_id: ctx.user_id }, { via: ctx.channel === 'mcp' ? 'ai' : ctx.channel === 'automation' ? 'automation' : 'manual', reason: dto.reason, enforce: true, resolution: dto.resolution ?? undefined }));
        await this.afterStatusChange(ctx, before, to, result.previous_status?.category ?? null);
        return this.findOne(ctx, id);
    }

    /** Audit, events and CSAT after any status transition. */
    async afterStatusChange(ctx: OrgContext, before: { id: string; reference: string; subject: string; company_id: string | null; project_id: string | null; branch_id: string | null; requester_contact_id: string | null; requester_user_id: string | null; assignee_membership_id: string | null; customer_visible: boolean; status_id: string | null }, to: { id: string; name: string; category: string }, fromCategory: string | null) {
        await this.audit.record(ctx, 'ticket.status_changed', { resource_type: 'ticket', resource_id: before.id, branch_id: before.branch_id, metadata: { from: before.status_id, to: to.id, to_category: to.category } });
        const resolved = to.category === 'RESOLVED';
        const closed = to.category === 'CLOSED';
        const reopened = !!fromCategory && CLOSED_CATEGORIES.includes(fromCategory as never) && !resolved && !closed;
        this.events.publish(ctx, {
            event_key: resolved ? 'support.ticket.resolved' : closed ? 'support.ticket.closed' : reopened ? 'support.ticket.reopened' : 'support.ticket.status_changed',
            module: ModuleKey.SUPPORT,
            entity_type: 'TICKET',
            entity_id: before.id,
            payload: { reference: before.reference, subject: before.subject, from_category: fromCategory, to_category: to.category, status: to.name, requester_user_id: before.requester_user_id },
            activity: { summary: `${before.reference} moved to ${to.name}`, entity_label: before.reference, company_id: before.company_id, project_id: before.project_id, customer_visible: before.customer_visible },
        });
        if (resolved) {
            setImmediate(async () => {
                try {
                    await this.csat.request(ctx, { ticket_id: before.id, contact_id: before.requester_contact_id, rated_by_user_id: before.requester_user_id, agent_membership_id: before.assignee_membership_id });
                } catch { /* never surfaces */ }
            });
        }
    }

    async assign(ctx: OrgContext, id: string, dto: AssignTicketDto) {
        const before = await this.findBase(ctx, id);
        if (dto.assignee_membership_id) {
            const m = await this.prisma.membership.findFirst({ where: { id: dto.assignee_membership_id, organization_id: ctx.organization_id, status: 'ACTIVE' } });
            if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        if (dto.team_id) await this.assertRefs(ctx, { team_id: dto.team_id });
        await this.prisma.$transaction(async (tx) => {
            await tx.ticket.update({ where: { id }, data: { assignee_membership_id: dto.assignee_membership_id, ...(dto.team_id !== undefined && { team_id: dto.team_id }) } });
            if (dto.assignee_membership_id) await tx.ticketFollower.createMany({ data: [{ ticket_id: id, membership_id: dto.assignee_membership_id }], skipDuplicates: true });
            if (before.conversation_id && dto.assignee_membership_id) await tx.supportConversation.update({ where: { id: before.conversation_id }, data: { assignee_membership_id: dto.assignee_membership_id } });
        });
        await this.audit.record(ctx, 'ticket.assigned', { resource_type: 'ticket', resource_id: id, branch_id: before.branch_id, metadata: { before: before.assignee_membership_id, after: dto.assignee_membership_id, team_id: dto.team_id } });
        this.events.publish(ctx, { event_key: 'support.ticket.assigned', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: id, payload: { reference: before.reference, subject: before.subject, assignee_membership_id: dto.assignee_membership_id, previous_assignee_membership_id: before.assignee_membership_id } });
        return this.findOne(ctx, id);
    }

    async escalate(ctx: OrgContext, id: string, dto: EscalateTicketDto) {
        const before = await this.findBase(ctx, id);
        if (dto.to_membership_id) {
            const m = await this.prisma.membership.findFirst({ where: { id: dto.to_membership_id, organization_id: ctx.organization_id, status: 'ACTIVE' } });
            if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.ticket.update({
                where: { id },
                data: { escalation_level: { increment: 1 }, escalated_at: new Date(), escalated_to_membership_id: dto.to_membership_id ?? null, ...(dto.to_membership_id && { assignee_membership_id: dto.to_membership_id }) },
            });
            if (dto.to_membership_id) await tx.ticketFollower.createMany({ data: [{ ticket_id: id, membership_id: dto.to_membership_id }], skipDuplicates: true });
            if (dto.note) {
                const convId = await this.ensureConversation(tx, ctx, id);
                await this.conversations.addMessage(tx, convId, { kind: 'INTERNAL_NOTE', body: `Escalated: ${dto.note}`, author_membership_id: ctx.membership_id, mentions: dto.to_membership_id ? [dto.to_membership_id] : [] });
            }
        });
        await this.audit.record(ctx, 'ticket.escalated', { resource_type: 'ticket', resource_id: id, branch_id: before.branch_id, metadata: { to_membership_id: dto.to_membership_id, level: before.escalation_level + 1 } });
        this.events.publish(ctx, { event_key: 'support.ticket.escalated', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: id, payload: { reference: before.reference, subject: before.subject, to_membership_id: dto.to_membership_id, level: before.escalation_level + 1 } });
        return this.findOne(ctx, id);
    }

    async merge(ctx: OrgContext, id: string, dto: MergeTicketDto) {
        if (id === dto.into_ticket_id) throw new BadRequestException({ message: 'Pick a different ticket', code: 'merge_same' });
        const [source, target] = await Promise.all([this.findBase(ctx, id), this.findBase(ctx, dto.into_ticket_id)]);
        if (target.merged_into_ticket_id) throw new ConflictException({ message: 'The target ticket was itself merged', code: 'merge_target_merged' });
        await this.prisma.$transaction(async (tx) => {
            const closed = await this.workflow.statusByCategory(tx, ctx.organization_id, 'CLOSED');
            if (closed) await this.workflow.transition(tx, id, closed, { membership_id: ctx.membership_id }, { via: 'merge', reason: `Merged into ${target.reference}` });
            await tx.ticket.update({ where: { id }, data: { merged_into_ticket_id: target.id } });
            await tx.ticketRelation.upsert({
                where: { source_ticket_id_target_ticket_id_type: { source_ticket_id: id, target_ticket_id: target.id, type: 'DUPLICATE_OF' } },
                update: {},
                create: { source_ticket_id: id, target_ticket_id: target.id, type: 'DUPLICATE_OF', created_by_membership_id: ctx.membership_id },
            });
            const convIds = [source.conversation_id, ...(await tx.ticketConversation.findMany({ where: { ticket_id: id } })).map((l) => l.conversation_id)].filter(Boolean) as string[];
            for (const c of convIds) await tx.ticketConversation.upsert({ where: { ticket_id_conversation_id: { ticket_id: target.id, conversation_id: c } }, update: {}, create: { ticket_id: target.id, conversation_id: c } });
            const followers = await tx.ticketFollower.findMany({ where: { ticket_id: id } });
            if (followers.length) await tx.ticketFollower.createMany({ data: followers.map((f) => ({ ticket_id: target.id, membership_id: f.membership_id })), skipDuplicates: true });
        });
        await this.audit.record(ctx, 'ticket.merged', { resource_type: 'ticket', resource_id: id, metadata: { into_ticket_id: target.id, into_reference: target.reference } });
        this.events.publish(ctx, { event_key: 'support.ticket.merged', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: id, payload: { reference: source.reference, into_ticket_id: target.id, into_reference: target.reference } });
        return this.findOne(ctx, target.id);
    }

    async reply(ctx: OrgContext, id: string, dto: TicketReplyDto) {
        const ticket = await this.findBase(ctx, id);
        const thenStatus = dto.then_status_id ? await this.prisma.ticketStatus.findFirst({ where: { id: dto.then_status_id, organization_id: ctx.organization_id, archived_at: null } }) : null;
        if (dto.then_status_id && !thenStatus) throw new NotFoundException({ message: 'Status not found', code: 'ticket_status_not_found' });
        if (thenStatus && !ctx.can(SUPPORT_PERMS.ticketsUpdate)) throw new ForbiddenException({ message: 'Changing status needs support.tickets.update', code: 'permission_denied', permissions: [SUPPORT_PERMS.ticketsUpdate] });
        const convId = await this.prisma.$transaction((tx) => this.ensureConversation(tx, ctx, id));
        const message = await this.conversations.postMessage(ctx, convId, { kind: dto.kind, body: dto.body, mentions: dto.mentions, canned_response_id: dto.canned_response_id });
        if (thenStatus && thenStatus.id !== ticket.status_id) {
            const fresh = await this.findBase(ctx, id);
            const result = await this.prisma.$transaction((tx) => this.workflow.transition(tx, id, thenStatus, { membership_id: ctx.membership_id, user_id: ctx.user_id }, { via: 'reply', enforce: true }));
            await this.afterStatusChange(ctx, fresh, thenStatus, result.previous_status?.category ?? null);
        }
        return message;
    }

    /** The ticket's primary conversation, created on first reply for tickets opened manually. */
    private async ensureConversation(tx: Tx, ctx: OrgContext, ticketId: string) {
        const t = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
        if (t.conversation_id) return t.conversation_id;
        const c = await tx.supportConversation.create({
            data: {
                organization_id: t.organization_id,
                inbox_id: t.inbox_id,
                channel_type: t.channel_type ?? (t.requester_user_id ? 'PORTAL' : 'EMAIL'),
                subject: t.subject,
                priority: t.priority,
                contact_id: t.requester_contact_id,
                company_id: t.company_id,
                customer_user_id: t.requester_user_id,
                customer_name: t.requester_name,
                customer_email: t.requester_email,
                assignee_membership_id: t.assignee_membership_id,
                team_id: t.team_id,
                created_by_membership_id: ctx.membership_id,
            },
        });
        await tx.ticket.update({ where: { id: ticketId }, data: { conversation_id: c.id } });
        return c.id;
    }

    // --- Followers, relations, conversations ----------------------------------------------------

    async follow(ctx: OrgContext, id: string, membershipId?: string) {
        await this.findBase(ctx, id);
        const target = membershipId ?? ctx.membership_id;
        if (!target) throw new BadRequestException({ message: 'Pick a member to add as follower', code: 'follower_required' });
        if (target !== ctx.membership_id && !ctx.can(SUPPORT_PERMS.ticketsUpdate)) throw new ForbiddenException({ message: 'Adding other followers needs support.tickets.update', code: 'permission_denied', permissions: [SUPPORT_PERMS.ticketsUpdate] });
        const m = await this.prisma.membership.findFirst({ where: { id: target, organization_id: ctx.organization_id } });
        if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        await this.prisma.ticketFollower.createMany({ data: [{ ticket_id: id, membership_id: target }], skipDuplicates: true });
        await this.audit.record(ctx, 'ticket.follower_added', { resource_type: 'ticket', resource_id: id, metadata: { membership_id: target } });
        return { success: true };
    }

    async unfollow(ctx: OrgContext, id: string, membershipId?: string) {
        await this.findBase(ctx, id);
        const target = membershipId ?? ctx.membership_id;
        if (target !== ctx.membership_id && !ctx.can(SUPPORT_PERMS.ticketsUpdate)) throw new ForbiddenException({ message: 'Removing other followers needs support.tickets.update', code: 'permission_denied', permissions: [SUPPORT_PERMS.ticketsUpdate] });
        await this.prisma.ticketFollower.deleteMany({ where: { ticket_id: id, membership_id: target ?? '' } });
        await this.audit.record(ctx, 'ticket.follower_removed', { resource_type: 'ticket', resource_id: id, metadata: { membership_id: target } });
        return { success: true };
    }

    async addRelation(ctx: OrgContext, id: string, dto: TicketRelationDto) {
        if (id === dto.target_ticket_id) throw new BadRequestException({ message: 'A ticket cannot relate to itself', code: 'relation_self' });
        await Promise.all([this.findBase(ctx, id), this.findBase(ctx, dto.target_ticket_id)]);
        const row = await this.prisma.ticketRelation.upsert({
            where: { source_ticket_id_target_ticket_id_type: { source_ticket_id: id, target_ticket_id: dto.target_ticket_id, type: dto.type } },
            update: {},
            create: { source_ticket_id: id, target_ticket_id: dto.target_ticket_id, type: dto.type, created_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'ticket.relation_added', { resource_type: 'ticket', resource_id: id, metadata: { target_ticket_id: dto.target_ticket_id, type: dto.type } });
        return row;
    }

    async removeRelation(ctx: OrgContext, id: string, relationId: string) {
        await this.findBase(ctx, id);
        const res = await this.prisma.ticketRelation.deleteMany({ where: { id: relationId, OR: [{ source_ticket_id: id }, { target_ticket_id: id }] } });
        if (!res.count) throw new NotFoundException({ message: 'Relation not found', code: 'relation_not_found' });
        await this.audit.record(ctx, 'ticket.relation_removed', { resource_type: 'ticket', resource_id: id, metadata: { relation_id: relationId } });
        return { success: true };
    }

    async linkConversation(ctx: OrgContext, id: string, conversationId: string) {
        const ticket = await this.findBase(ctx, id);
        await this.conversations.findBase(ctx, conversationId);
        if (ticket.conversation_id === conversationId) return { success: true };
        await this.prisma.$transaction(async (tx) => {
            if (!ticket.conversation_id) await tx.ticket.update({ where: { id }, data: { conversation_id: conversationId } });
            else await tx.ticketConversation.upsert({ where: { ticket_id_conversation_id: { ticket_id: id, conversation_id: conversationId } }, update: {}, create: { ticket_id: id, conversation_id: conversationId } });
        });
        await this.audit.record(ctx, 'ticket.conversation_linked', { resource_type: 'ticket', resource_id: id, metadata: { conversation_id: conversationId } });
        return { success: true };
    }

    // --- Tasks (06) -------------------------------------------------------------------------------

    /** Convert to a Task (13 §4): idempotent per ticket, TicketTaskLink CONVERTED + TaskLink(TICKET) on the task side. */
    async convertToTask(ctx: OrgContext, id: string, dto: ConvertToTaskDto) {
        if (!ctx.can('tasks.tasks.create')) throw new ForbiddenException({ message: 'Creating the task needs tasks.tasks.create', code: 'permission_denied', permissions: ['tasks.tasks.create'] });
        const ticket = await this.findBase(ctx, id);
        const existing = await this.prisma.ticketTaskLink.findFirst({ where: { ticket_id: id, kind: 'CONVERTED' }, include: { task: { include: { team: { select: { task_key: true } } } } } });
        if (existing) throw new ConflictException({ message: `Already converted to ${taskIdentifier(existing.task)}`, code: 'ticket_already_converted', task_id: existing.task_id });
        const category = ticket.category_id ? await this.prisma.ticketCategory.findUnique({ where: { id: ticket.category_id }, select: { default_project_id: true } }) : null;
        const projectId = dto.project_id ?? ticket.project_id ?? category?.default_project_id ?? null;
        const teamId = dto.team_id ?? ticket.team_id ?? null;
        if (projectId) await this.assertRefs(ctx, { project_id: projectId });
        if (teamId) await this.assertRefs(ctx, { team_id: teamId });
        if (dto.assignee_membership_id) {
            const m = await this.prisma.membership.findFirst({ where: { id: dto.assignee_membership_id, organization_id: ctx.organization_id } });
            if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        const settings = await this.setup.settings(ctx.organization_id);
        const mapping = (settings.task_priority_mapping ?? {}) as Record<string, TaskPriority>;
        const priority = mapping[ticket.priority] ?? PRIORITY_TO_TASK[ticket.priority];

        const task = await this.prisma.$transaction(async (tx) => {
            const statuses = await ensureTaskStatuses(tx, ctx.organization_id, teamId);
            const status = defaultStatus(statuses);
            const number = await nextTaskNumber(tx, ctx.organization_id);
            const created = await tx.task.create({
                data: {
                    organization_id: ctx.organization_id,
                    number,
                    team_id: teamId,
                    project_id: projectId,
                    type_id: settings.default_task_type_id ?? null,
                    status_id: status?.id ?? null,
                    title: dto.title ?? ticket.subject,
                    description: dto.description ?? `${ticket.description ?? ''}\n\n— From support ticket ${ticket.reference}`.trim(),
                    priority,
                    assignee_membership_id: dto.assignee_membership_id ?? null,
                    reporter_membership_id: ctx.membership_id,
                    customer_visible: dto.customer_visible ?? false,
                    created_by_user_id: ctx.user_id,
                },
                include: { team: { select: { task_key: true } } },
            });
            if (dto.assignee_membership_id) await tx.taskAssignee.createMany({ data: [{ task_id: created.id, membership_id: dto.assignee_membership_id }], skipDuplicates: true }).catch(() => undefined);
            await tx.taskLink.create({ data: { task_id: created.id, entity_type: 'TICKET', entity_id: id, relation: 'created_from', created_by_user_id: ctx.user_id } });
            await tx.ticketTaskLink.create({ data: { ticket_id: id, task_id: created.id, kind: 'CONVERTED', idempotency_key: `convert:${id}`, created_by_membership_id: ctx.membership_id } });
            const convId = await this.ensureConversation(tx, ctx, id);
            await tx.supportMessage.create({ data: { conversation_id: convId, organization_id: ctx.organization_id, kind: 'SYSTEM', body: `Converted to task ${taskIdentifier(created)}`, author_membership_id: ctx.membership_id } });
            return created;
        });
        const identifier = taskIdentifier(task);
        await this.audit.record(ctx, 'ticket.converted_to_task', { resource_type: 'ticket', resource_id: id, metadata: { task_id: task.id, identifier } });
        this.events.publish(ctx, {
            event_key: 'support.ticket.converted_to_task',
            module: ModuleKey.SUPPORT,
            entity_type: 'TICKET',
            entity_id: id,
            payload: { reference: ticket.reference, task_id: task.id, identifier },
            activity: { summary: `${ticket.reference} converted to task ${identifier}`, entity_label: ticket.reference, project_id: projectId, company_id: ticket.company_id },
        });
        this.events.publish(ctx, { event_key: 'tasks.task.created', module: ModuleKey.TASKS, entity_type: 'TASK', entity_id: task.id, payload: { identifier, title: task.title, source: 'support_ticket', ticket_id: id } });
        return { ...task, identifier };
    }

    async linkTask(ctx: OrgContext, id: string, taskId: string) {
        await this.findBase(ctx, id);
        const task = await this.prisma.task.findFirst({ where: { id: taskId, organization_id: ctx.organization_id }, include: { team: { select: { task_key: true } } } });
        if (!task) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
        await this.prisma.$transaction(async (tx) => {
            await tx.ticketTaskLink.upsert({ where: { ticket_id_task_id: { ticket_id: id, task_id: taskId } }, update: {}, create: { ticket_id: id, task_id: taskId, kind: 'LINKED', created_by_membership_id: ctx.membership_id } });
            await tx.taskLink.upsert({ where: { task_id_entity_type_entity_id: { task_id: taskId, entity_type: 'TICKET', entity_id: id } }, update: {}, create: { task_id: taskId, entity_type: 'TICKET', entity_id: id, created_by_user_id: ctx.user_id } });
        });
        await this.audit.record(ctx, 'ticket.task_linked', { resource_type: 'ticket', resource_id: id, metadata: { task_id: taskId, identifier: taskIdentifier(task) } });
        return { success: true };
    }

    async unlinkTask(ctx: OrgContext, id: string, taskId: string) {
        await this.findBase(ctx, id);
        await this.prisma.$transaction([
            this.prisma.ticketTaskLink.deleteMany({ where: { ticket_id: id, task_id: taskId } }),
            this.prisma.taskLink.deleteMany({ where: { task_id: taskId, entity_type: 'TICKET', entity_id: id } }),
        ]);
        await this.audit.record(ctx, 'ticket.task_unlinked', { resource_type: 'ticket', resource_id: id, metadata: { task_id: taskId } });
        return { success: true };
    }

    // --- Archive ---------------------------------------------------------------------------------

    async archive(ctx: OrgContext, id: string) {
        const t = await this.findBase(ctx, id);
        await this.prisma.ticket.update({ where: { id }, data: { archived_at: new Date() } });
        await this.prisma.ticketSlaTimer.updateMany({ where: { ticket_id: id, status: { in: ['RUNNING', 'PAUSED'] } }, data: { status: 'CANCELLED', completed_at: new Date() } });
        await this.audit.record(ctx, 'ticket.archived', { resource_type: 'ticket', resource_id: id, branch_id: t.branch_id });
        this.events.publish(ctx, { event_key: 'support.ticket.archived', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: id, payload: { reference: t.reference } });
        return { success: true };
    }

    async restore(ctx: OrgContext, id: string) {
        const t = await this.prisma.ticket.findFirst({ where: { AND: [{ id, organization_id: ctx.organization_id }, ticketScopeWhere(ctx, READ)] } });
        if (!t) throw new NotFoundException({ message: 'Ticket not found', code: 'ticket_not_found' });
        await this.prisma.ticket.update({ where: { id }, data: { archived_at: null } });
        await this.audit.record(ctx, 'ticket.restored', { resource_type: 'ticket', resource_id: id });
        return this.findOne(ctx, id);
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    async findBase(ctx: OrgContext, id: string) {
        const t = await this.prisma.ticket.findFirst({ where: { AND: [{ id, organization_id: ctx.organization_id, archived_at: null }, ticketScopeWhere(ctx, READ)] } });
        if (!t) throw new NotFoundException({ message: 'Ticket not found', code: 'ticket_not_found' });
        return t;
    }

    private diff(before: Record<string, unknown>, after: Record<string, unknown>) {
        const out: Record<string, { from: unknown; to: unknown }> = {};
        for (const [k, v] of Object.entries(after)) if (v !== undefined && before[k] !== v) out[k] = { from: before[k] ?? null, to: v };
        return out;
    }

    private async assertRefs(ctx: OrgContext, dto: Partial<CreateTicketDto>) {
        const org = ctx.organization_id;
        const checks: [string, Promise<unknown>][] = [];
        if (dto.status_id) checks.push(['status', this.prisma.ticketStatus.findFirstOrThrow({ where: { id: dto.status_id, organization_id: org, archived_at: null } })]);
        if (dto.category_id) checks.push(['category', this.prisma.ticketCategory.findFirstOrThrow({ where: { id: dto.category_id, organization_id: org, archived_at: null } })]);
        if (dto.inbox_id) checks.push(['inbox', this.prisma.supportInbox.findFirstOrThrow({ where: { id: dto.inbox_id, organization_id: org, archived_at: null } })]);
        if (dto.team_id) checks.push(['team', this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: org } })]);
        if (dto.assignee_membership_id) checks.push(['assignee', this.prisma.membership.findFirstOrThrow({ where: { id: dto.assignee_membership_id, organization_id: org, status: 'ACTIVE' } })]);
        if (dto.branch_id) checks.push(['branch', this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: org } })]);
        if (dto.requester_contact_id) checks.push(['contact', this.prisma.crmContact.findFirstOrThrow({ where: { id: dto.requester_contact_id, organization_id: org } })]);
        if (dto.company_id) checks.push(['company', this.prisma.crmCompany.findFirstOrThrow({ where: { id: dto.company_id, organization_id: org } })]);
        if (dto.project_id) checks.push(['project', this.prisma.project.findFirstOrThrow({ where: { id: dto.project_id, organization_id: org } })]);
        if (dto.sla_policy_id) checks.push(['SLA policy', this.prisma.slaPolicy.findFirstOrThrow({ where: { id: dto.sla_policy_id, organization_id: org, archived_at: null } })]);
        const results = await Promise.allSettled(checks.map((c) => c[1]));
        const missing = results.map((r, i) => (r.status === 'rejected' ? checks[i][0] : null)).filter(Boolean);
        if (missing.length) throw new NotFoundException({ message: `Not found: ${missing.join(', ')}`, code: 'reference_not_found' });
    }
}
