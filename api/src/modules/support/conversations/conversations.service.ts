import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, SupportChannelType, SupportMessageKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { SupportSetupService } from '../common/support-setup.service';
import { conversationScopeWhere } from '../common/support-scope.utils';
import { MEMBER_SELECT, SUPPORT_PERMS, USER_PUBLIC_SELECT } from '../common/support.constants';
import { SlaService } from '../sla/sla.service';
import { TicketWorkflowService } from '../tickets/ticket-workflow.service';
import { CsatService } from '../csat/csat.service';
import {
    AddParticipantDto,
    AssignConversationDto,
    ConversationQuery,
    CreateConversationDto,
    MergeConversationDto,
    PostMessageDto,
    UpdateConversationDto,
} from './dto/conversation.dto';

type Tx = Prisma.TransactionClient;

const READ = SUPPORT_PERMS.conversationsRead;

export interface AddMessageInput {
    kind: SupportMessageKind;
    body: string;
    author_membership_id?: string | null;
    author_user_id?: string | null;
    author_name?: string | null;
    author_email?: string | null;
    mentions?: string[];
    canned_response_id?: string | null;
    channel_type?: SupportChannelType | null;
    /** AI_AGENT only: false for notices (e.g. "passing you to the team") that must not count as a response for SLA / metrics. */
    counts_as_response?: boolean;
}

const LIST_INCLUDE = {
    inbox: { select: { id: true, name: true, color: true } },
    assignee: { select: MEMBER_SELECT },
    company: { select: { id: true, name: true } },
    contact: { select: { id: true, first_name: true, last_name: true, email: true } },
    customer: { select: USER_PUBLIC_SELECT },
    primary_tickets: { select: { id: true, reference: true, sla_breached: true, sla_at_risk: true }, take: 3 },
    messages: { where: { deleted_at: null }, orderBy: { created_at: 'desc' as const }, take: 1, select: { id: true, kind: true, body: true, created_at: true, author_name: true } },
} satisfies Prisma.SupportConversationInclude;

/**
 * Unified inbox conversations (13 §1, §14). Public replies and private internal notes live in the same thread;
 * internal notes are never returned by the customer portal. Linked tickets get their SLA and status updated
 * by every reply (first response, next response, customer replied → reopen).
 */
@Injectable()
export class ConversationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
        private readonly sla: SlaService,
        private readonly workflow: TicketWorkflowService,
        private readonly csat: CsatService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------------------------------

    private viewWhere(ctx: OrgContext, view: ConversationQuery['view']): Prisma.SupportConversationWhereInput {
        switch (view) {
            case 'mine':
                return { assignee_membership_id: ctx.membership_id ?? '__none__' };
            case 'unassigned':
                return { assignee_membership_id: null };
            case 'mentions':
                return { messages: { some: { mentions: { has: ctx.membership_id ?? '__none__' } } } };
            case 'participating':
                return { participants: { some: { membership_id: ctx.membership_id ?? '__none__' } } };
            default:
                return {};
        }
    }

    async findAll(ctx: OrgContext, query: ConversationQuery) {
        const where: Prisma.SupportConversationWhereInput = {
            AND: [
                { organization_id: ctx.organization_id, merged_into_conversation_id: null },
                conversationScopeWhere(ctx, READ),
                this.viewWhere(ctx, query.view),
                query.status?.length ? { status: { in: query.status } } : {},
                query.inbox_id ? { inbox_id: query.inbox_id } : {},
                query.channel_type ? { channel_type: query.channel_type } : {},
                query.priority ? { priority: query.priority } : {},
                query.assignee_membership_id ? { assignee_membership_id: query.assignee_membership_id } : {},
                query.company_id ? { company_id: query.company_id } : {},
                query.contact_id ? { contact_id: query.contact_id } : {},
                query.team_id ? { team_id: query.team_id } : {},
                query.search
                    ? {
                        OR: [
                            { subject: { contains: query.search, mode: 'insensitive' } },
                            { customer_name: { contains: query.search, mode: 'insensitive' } },
                            { customer_email: { contains: query.search, mode: 'insensitive' } },
                            { company: { name: { contains: query.search, mode: 'insensitive' } } },
                            { messages: { some: { body: { contains: query.search, mode: 'insensitive' }, deleted_at: null } } },
                        ],
                    }
                    : {},
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.supportConversation.findMany({
                where,
                ...skipTake(query),
                orderBy: [orderBy(query, ['last_message_at', 'created_at', 'priority', 'updated_at'], 'last_message_at'), { created_at: 'desc' }],
                include: { ...LIST_INCLUDE, participants: ctx.membership_id ? { where: { membership_id: ctx.membership_id }, select: { last_read_at: true } } : false },
            }),
            this.prisma.supportConversation.count({ where }),
        ]);
        const data = rows.map(({ participants, messages, ...c }) => {
            const lastRead = (participants as { last_read_at: Date | null }[] | undefined)?.[0]?.last_read_at ?? null;
            const last = messages[0] ?? null;
            return {
                ...c,
                last_message: last ? { ...last, body: last.body.slice(0, 200) } : null,
                unread: !!c.last_customer_message_at && (!lastRead || lastRead < c.last_customer_message_at),
            };
        });
        return paginate(data, total, query);
    }

    /** Badge counts for the inbox views (open + pending only). */
    async counts(ctx: OrgContext) {
        const base: Prisma.SupportConversationWhereInput = { AND: [{ organization_id: ctx.organization_id, merged_into_conversation_id: null, status: { in: ['OPEN', 'PENDING'] } }, conversationScopeWhere(ctx, READ)] };
        const count = (extra: Prisma.SupportConversationWhereInput) => this.prisma.supportConversation.count({ where: { AND: [base, extra] } });
        const [all, mine, unassigned, mentions, snoozed] = await Promise.all([
            count({}),
            count(this.viewWhere(ctx, 'mine')),
            count(this.viewWhere(ctx, 'unassigned')),
            count(this.viewWhere(ctx, 'mentions')),
            this.prisma.supportConversation.count({ where: { AND: [{ organization_id: ctx.organization_id, status: 'SNOOZED' }, conversationScopeWhere(ctx, READ)] } }),
        ]);
        return { all, mine, unassigned, mentions, snoozed };
    }

    async findOne(ctx: OrgContext, id: string) {
        const conv = await this.prisma.supportConversation.findFirst({
            where: { AND: [{ id, organization_id: ctx.organization_id }, conversationScopeWhere(ctx, READ)] },
            include: {
                inbox: { select: { id: true, name: true, signature: true } },
                channel: { select: { id: true, name: true, type: true, email_address: true } },
                assignee: { select: MEMBER_SELECT },
                team: { select: { id: true, name: true } },
                company: { select: { id: true, name: true, website: true, email: true, phone: true, type: true } },
                contact: { select: { id: true, first_name: true, last_name: true, email: true, phone: true, job_title: true } },
                customer: { select: USER_PUBLIC_SELECT },
                merged_into: { select: { id: true, subject: true } },
                participants: { include: { membership: { select: MEMBER_SELECT } } },
                primary_tickets: { select: { id: true, reference: true, subject: true, priority: true, sla_breached: true, sla_at_risk: true, resolution_due_at: true, first_response_due_at: true, status: { select: { id: true, name: true, category: true, color: true } } } },
                ticket_links: { include: { ticket: { select: { id: true, reference: true, subject: true, status: { select: { id: true, name: true, category: true, color: true } } } } } },
                csat_ratings: { select: { id: true, rating: true, comment: true, submitted_at: true, requested_at: true }, orderBy: { requested_at: 'desc' }, take: 3 },
                messages: {
                    where: { deleted_at: null },
                    orderBy: { created_at: 'asc' },
                    include: { author: { select: MEMBER_SELECT }, author_user: { select: USER_PUBLIC_SELECT }, attachments: true },
                },
            },
        });
        if (!conv) throw new NotFoundException({ message: 'Conversation not found', code: 'conversation_not_found' });
        // Customer history (13 §8): other conversations of the same customer.
        const history = conv.company_id || conv.contact_id || conv.customer_email
            ? await this.prisma.supportConversation.findMany({
                where: {
                    organization_id: ctx.organization_id,
                    id: { not: id },
                    OR: [
                        ...(conv.contact_id ? [{ contact_id: conv.contact_id }] : []),
                        ...(conv.company_id ? [{ company_id: conv.company_id }] : []),
                        ...(conv.customer_email ? [{ customer_email: conv.customer_email }] : []),
                    ],
                },
                select: { id: true, subject: true, status: true, channel_type: true, last_message_at: true, created_at: true },
                orderBy: { created_at: 'desc' },
                take: 10,
            })
            : [];
        return { ...conv, customer_history: history };
    }

    // ---------------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------------

    async create(ctx: OrgContext, dto: CreateConversationDto) {
        await this.setup.ensureDefaults(ctx.organization_id);
        const settings = await this.setup.settings(ctx.organization_id);
        const inboxId = dto.inbox_id ?? settings.default_inbox_id;
        await this.assertRefs(ctx, { inbox_id: inboxId, company_id: dto.company_id, contact_id: dto.contact_id });
        let companyId = dto.company_id ?? null;
        let customerName = dto.customer_name ?? null;
        let customerEmail = dto.customer_email?.toLowerCase() ?? null;
        if (dto.contact_id) {
            const contact = await this.prisma.crmContact.findFirst({ where: { id: dto.contact_id, organization_id: ctx.organization_id } });
            companyId = companyId ?? contact?.company_id ?? null;
            customerName = customerName ?? ([contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || null);
            customerEmail = customerEmail ?? contact?.email?.toLowerCase() ?? null;
        }
        const kind = dto.first_message_kind === 'CUSTOMER' ? 'CUSTOMER' : 'AGENT';
        const conv = await this.prisma.$transaction(async (tx) => {
            const created = await tx.supportConversation.create({
                data: {
                    organization_id: ctx.organization_id,
                    inbox_id: inboxId,
                    channel_type: dto.channel_type,
                    subject: dto.subject,
                    priority: dto.priority ?? 'NORMAL',
                    contact_id: dto.contact_id,
                    company_id: companyId,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    assignee_membership_id: kind === 'AGENT' ? ctx.membership_id : null,
                    created_by_membership_id: ctx.membership_id,
                },
            });
            if (ctx.membership_id && kind === 'AGENT') {
                await tx.supportConversationParticipant.create({ data: { conversation_id: created.id, membership_id: ctx.membership_id, role: 'ASSIGNEE', last_read_at: new Date() } });
            }
            await this.addMessage(tx, created.id, {
                kind,
                body: dto.body,
                author_membership_id: kind === 'AGENT' ? ctx.membership_id : null,
                author_name: kind === 'CUSTOMER' ? customerName : null,
                author_email: kind === 'CUSTOMER' ? customerEmail : null,
                channel_type: dto.channel_type,
            });
            return created;
        });
        await this.audit.record(ctx, 'support_conversation.created', { resource_type: 'support_conversation', resource_id: conv.id, metadata: { channel_type: conv.channel_type, company_id: companyId } });
        this.events.publish(ctx, {
            event_key: 'support.conversation.created',
            module: ModuleKey.SUPPORT,
            entity_type: 'SUPPORT_CONVERSATION',
            entity_id: conv.id,
            payload: { subject: conv.subject, channel_type: conv.channel_type, company_id: companyId, inbox_id: inboxId },
            activity: { summary: `Conversation started${conv.subject ? `: ${conv.subject}` : ''}`, company_id: companyId },
        });
        return this.findOne(ctx, conv.id);
    }

    async postMessage(ctx: OrgContext, id: string, dto: PostMessageDto) {
        const conv = await this.findBase(ctx, id);
        if (conv.merged_into_conversation_id) throw new ConflictException({ message: 'This conversation was merged; reply in the target conversation', code: 'conversation_merged' });
        if (dto.then_status === 'RESOLVED' && !ctx.can(SUPPORT_PERMS.conversationsClose)) {
            throw new ForbiddenException({ message: 'Resolving needs support.conversations.close', code: 'permission_denied', permissions: [SUPPORT_PERMS.conversationsClose] });
        }
        if (dto.canned_response_id) {
            const canned = await this.prisma.supportCannedResponse.findFirst({ where: { id: dto.canned_response_id, organization_id: ctx.organization_id } });
            if (!canned) throw new NotFoundException({ message: 'Canned response not found', code: 'canned_response_not_found' });
        }
        const mentions = dto.kind === 'INTERNAL_NOTE' ? await this.validMembers(ctx, dto.mentions ?? []) : [];
        const message = await this.prisma.$transaction(async (tx) => {
            const msg = await this.addMessage(tx, id, {
                kind: dto.kind,
                body: dto.body,
                author_membership_id: ctx.membership_id,
                mentions,
                canned_response_id: dto.canned_response_id ?? null,
                channel_type: conv.channel_type,
            });
            if (ctx.membership_id) {
                await tx.supportConversationParticipant.upsert({
                    where: { conversation_id_membership_id: { conversation_id: id, membership_id: ctx.membership_id } },
                    update: { last_read_at: new Date() },
                    create: { conversation_id: id, membership_id: ctx.membership_id, role: 'COLLABORATOR', last_read_at: new Date() },
                });
            }
            for (const m of mentions) {
                await tx.supportConversationParticipant.upsert({
                    where: { conversation_id_membership_id: { conversation_id: id, membership_id: m } },
                    update: {},
                    create: { conversation_id: id, membership_id: m, role: 'MENTIONED' },
                });
            }
            // Replying to an unassigned conversation takes ownership (Intercom-style).
            if (dto.kind === 'AGENT' && !conv.assignee_membership_id && ctx.membership_id) {
                await tx.supportConversation.update({ where: { id }, data: { assignee_membership_id: ctx.membership_id } });
            }
            if (dto.canned_response_id) {
                await tx.supportCannedResponse.update({ where: { id: dto.canned_response_id }, data: { usage_count: { increment: 1 }, last_used_at: new Date() } });
            }
            if (dto.then_status) await this.setStatus(tx, id, dto.then_status, ctx);
            return msg;
        });
        await this.audit.record(ctx, dto.kind === 'AGENT' ? 'support_message.reply_sent' : 'support_message.note_added', {
            resource_type: 'support_conversation',
            resource_id: id,
            metadata: { message_id: message.id, kind: dto.kind, mentions, then_status: dto.then_status },
        });
        this.events.publish(ctx, {
            event_key: dto.kind === 'AGENT' ? 'support.conversation.replied' : 'support.conversation.note_added',
            module: ModuleKey.SUPPORT,
            entity_type: 'SUPPORT_CONVERSATION',
            entity_id: id,
            payload: { message_id: message.id, kind: dto.kind, mentions, channel_type: conv.channel_type, customer_email: conv.customer_email, customer_user_id: conv.customer_user_id },
        });
        if (dto.then_status === 'RESOLVED') this.afterResolve(ctx, id);
        return message;
    }

    /**
     * Shared message engine (agents, customers through the portal, AI). Updates conversation counters, linked
     * ticket timestamps, SLA timers and the automatic ticket transitions. Must run inside a transaction.
     */
    async addMessage(tx: Tx, conversationId: string, input: AddMessageInput) {
        const conv = await tx.supportConversation.findUniqueOrThrow({ where: { id: conversationId } });
        const now = new Date();
        const isPublicReply = input.kind === 'AGENT' || input.kind === 'AI_AGENT';
        const isAgentPublic = isPublicReply && input.counts_as_response !== false;
        const isCustomer = input.kind === 'CUSTOMER';
        const channel = input.channel_type ?? conv.channel_type;
        const firstResponse = isAgentPublic && !conv.first_agent_response_at;

        const message = await tx.supportMessage.create({
            data: {
                conversation_id: conversationId,
                organization_id: conv.organization_id,
                kind: input.kind,
                channel_type: channel,
                author_membership_id: input.author_membership_id ?? null,
                author_user_id: input.author_user_id ?? null,
                author_name: input.author_name ?? null,
                author_email: input.author_email ?? null,
                body: input.body,
                mentions: input.mentions ?? [],
                canned_response_id: input.canned_response_id ?? null,
                is_first_response: firstResponse,
                // Portal / widget / chat replies are delivered in-app; email goes out through 11 (PENDING until sent).
                delivery_status: isPublicReply ? (channel === 'EMAIL' ? 'PENDING' : 'DELIVERED') : null,
                delivered_at: isPublicReply && channel !== 'EMAIL' ? now : null,
            },
            include: { author: { select: MEMBER_SELECT }, author_user: { select: USER_PUBLIC_SELECT } },
        });

        const convData: Prisma.SupportConversationUpdateInput = { message_count: { increment: 1 }, last_message_at: now };
        if (isCustomer) {
            convData.last_customer_message_at = now;
            convData.first_customer_message_at = conv.first_customer_message_at ?? now;
            if (conv.status !== 'OPEN') {
                convData.status = 'OPEN';
                convData.snoozed_until = null;
                if (conv.status === 'RESOLVED') convData.reopened_at = now;
            }
        }
        if (isAgentPublic) {
            convData.last_agent_message_at = now;
            if (firstResponse) convData.first_agent_response_at = now;
        }
        await tx.supportConversation.update({ where: { id: conversationId }, data: convData });

        // Linked tickets (primary conversation + extra links).
        const tickets = await tx.ticket.findMany({
            where: { organization_id: conv.organization_id, archived_at: null, merged_into_ticket_id: null, OR: [{ conversation_id: conversationId }, { conversations: { some: { conversation_id: conversationId } } }] },
            include: { status: true },
        });
        for (const t of tickets) {
            if (isAgentPublic) {
                await tx.ticket.update({ where: { id: t.id }, data: { last_agent_reply_at: now, first_responded_at: t.first_responded_at ?? now } });
                await this.sla.onAgentReply(tx, t.id, now);
                if (t.status?.category === 'NEW') {
                    const open = await this.workflow.statusByCategory(tx, conv.organization_id, 'OPEN');
                    if (open) await this.workflow.transition(tx, t.id, open, { membership_id: input.author_membership_id }, { via: 'reply' });
                }
            } else if (isCustomer) {
                await tx.ticket.update({ where: { id: t.id }, data: { last_customer_reply_at: now } });
                await this.sla.onCustomerReply(tx, t.id, now);
                if (t.status && ['PENDING_CUSTOMER', 'RESOLVED'].includes(t.status.category)) {
                    const open = await this.workflow.statusByCategory(tx, conv.organization_id, 'OPEN');
                    if (open) await this.workflow.transition(tx, t.id, open, { user_id: input.author_user_id }, { via: 'customer', reason: 'Customer replied' });
                }
            }
        }
        return message;
    }

    async markRead(ctx: OrgContext, id: string) {
        await this.findBase(ctx, id);
        if (!ctx.membership_id) return { success: true };
        await this.prisma.supportConversationParticipant.upsert({
            where: { conversation_id_membership_id: { conversation_id: id, membership_id: ctx.membership_id } },
            update: { last_read_at: new Date() },
            create: { conversation_id: id, membership_id: ctx.membership_id, role: 'COLLABORATOR', last_read_at: new Date() },
        });
        return { success: true };
    }

    async assign(ctx: OrgContext, id: string, dto: AssignConversationDto) {
        const conv = await this.findBase(ctx, id);
        if (dto.assignee_membership_id) await this.validMembers(ctx, [dto.assignee_membership_id], true);
        if (dto.team_id) await this.assertRefs(ctx, { team_id: dto.team_id });
        await this.prisma.$transaction(async (tx) => {
            await tx.supportConversation.update({ where: { id }, data: { assignee_membership_id: dto.assignee_membership_id, ...(dto.team_id !== undefined && { team_id: dto.team_id }) } });
            if (conv.assignee_membership_id && conv.assignee_membership_id !== dto.assignee_membership_id) {
                await tx.supportConversationParticipant.updateMany({ where: { conversation_id: id, membership_id: conv.assignee_membership_id, role: 'ASSIGNEE' }, data: { role: 'COLLABORATOR' } });
            }
            if (dto.assignee_membership_id) {
                await tx.supportConversationParticipant.upsert({
                    where: { conversation_id_membership_id: { conversation_id: id, membership_id: dto.assignee_membership_id } },
                    update: { role: 'ASSIGNEE' },
                    create: { conversation_id: id, membership_id: dto.assignee_membership_id, role: 'ASSIGNEE' },
                });
            }
            await this.systemNote(tx, id, dto.assignee_membership_id ? 'Conversation assigned' : 'Conversation unassigned', ctx);
        });
        await this.audit.record(ctx, 'support_conversation.assigned', { resource_type: 'support_conversation', resource_id: id, metadata: { before: conv.assignee_membership_id, after: dto.assignee_membership_id, team_id: dto.team_id } });
        this.events.publish(ctx, { event_key: 'support.conversation.assigned', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, payload: { assignee_membership_id: dto.assignee_membership_id, previous_assignee_membership_id: conv.assignee_membership_id, team_id: dto.team_id } });
        return this.findOne(ctx, id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateConversationDto) {
        const conv = await this.findBase(ctx, id);
        await this.assertRefs(ctx, { inbox_id: dto.inbox_id, team_id: dto.team_id ?? undefined, company_id: dto.company_id ?? undefined, contact_id: dto.contact_id ?? undefined });
        await this.prisma.$transaction(async (tx) => {
            await tx.supportConversation.update({ where: { id }, data: dto });
            if (dto.inbox_id && dto.inbox_id !== conv.inbox_id) await this.systemNote(tx, id, 'Conversation transferred to another inbox', ctx);
        });
        await this.audit.record(ctx, 'support_conversation.updated', { resource_type: 'support_conversation', resource_id: id, metadata: { before: { priority: conv.priority, inbox_id: conv.inbox_id, team_id: conv.team_id, subject: conv.subject }, after: dto } });
        this.events.publish(ctx, { event_key: dto.inbox_id && dto.inbox_id !== conv.inbox_id ? 'support.conversation.transferred' : 'support.conversation.updated', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, changes: dto as Record<string, unknown> });
        return this.findOne(ctx, id);
    }

    async snooze(ctx: OrgContext, id: string, until: string) {
        await this.findBase(ctx, id);
        const date = new Date(until);
        if (date <= new Date()) throw new BadRequestException({ message: 'Snooze until a time in the future', code: 'snooze_in_past' });
        await this.prisma.supportConversation.update({ where: { id }, data: { status: 'SNOOZED', snoozed_until: date } });
        await this.audit.record(ctx, 'support_conversation.snoozed', { resource_type: 'support_conversation', resource_id: id, metadata: { until: date } });
        this.events.publish(ctx, { event_key: 'support.conversation.snoozed', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, payload: { until: date } });
        return this.findOne(ctx, id);
    }

    async setPending(ctx: OrgContext, id: string) {
        await this.findBase(ctx, id);
        await this.prisma.$transaction((tx) => this.setStatus(tx, id, 'PENDING', ctx));
        await this.audit.record(ctx, 'support_conversation.status_changed', { resource_type: 'support_conversation', resource_id: id, metadata: { to: 'PENDING' } });
        this.events.publish(ctx, { event_key: 'support.conversation.status_changed', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, payload: { status: 'PENDING' } });
        return this.findOne(ctx, id);
    }

    async close(ctx: OrgContext, id: string) {
        const conv = await this.findBase(ctx, id);
        if (conv.status === 'RESOLVED') return this.findOne(ctx, id);
        await this.prisma.$transaction((tx) => this.setStatus(tx, id, 'RESOLVED', ctx));
        await this.audit.record(ctx, 'support_conversation.resolved', { resource_type: 'support_conversation', resource_id: id });
        this.events.publish(ctx, {
            event_key: 'support.conversation.resolved',
            module: ModuleKey.SUPPORT,
            entity_type: 'SUPPORT_CONVERSATION',
            entity_id: id,
            payload: { subject: conv.subject, company_id: conv.company_id },
            activity: { summary: `Conversation resolved${conv.subject ? `: ${conv.subject}` : ''}`, company_id: conv.company_id, customer_visible: true },
        });
        this.afterResolve(ctx, id);
        return this.findOne(ctx, id);
    }

    async reopen(ctx: OrgContext, id: string) {
        const conv = await this.findBase(ctx, id);
        await this.prisma.supportConversation.update({ where: { id }, data: { status: 'OPEN', snoozed_until: null, reopened_at: conv.status === 'RESOLVED' ? new Date() : conv.reopened_at } });
        await this.audit.record(ctx, 'support_conversation.reopened', { resource_type: 'support_conversation', resource_id: id });
        this.events.publish(ctx, { event_key: 'support.conversation.reopened', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id });
        return this.findOne(ctx, id);
    }

    async addParticipant(ctx: OrgContext, id: string, dto: AddParticipantDto) {
        await this.findBase(ctx, id);
        await this.validMembers(ctx, [dto.membership_id], true);
        const row = await this.prisma.supportConversationParticipant.upsert({
            where: { conversation_id_membership_id: { conversation_id: id, membership_id: dto.membership_id } },
            update: { role: dto.role ?? 'COLLABORATOR' },
            create: { conversation_id: id, membership_id: dto.membership_id, role: dto.role ?? 'COLLABORATOR' },
        });
        await this.audit.record(ctx, 'support_conversation.participant_added', { resource_type: 'support_conversation', resource_id: id, metadata: { membership_id: dto.membership_id, role: row.role } });
        return row;
    }

    async removeParticipant(ctx: OrgContext, id: string, membershipId: string) {
        await this.findBase(ctx, id);
        const res = await this.prisma.supportConversationParticipant.deleteMany({ where: { conversation_id: id, membership_id: membershipId, role: { not: 'ASSIGNEE' } } });
        if (!res.count) throw new NotFoundException({ message: 'Participant not found (unassign the assignee instead)', code: 'participant_not_found' });
        await this.audit.record(ctx, 'support_conversation.participant_removed', { resource_type: 'support_conversation', resource_id: id, metadata: { membership_id: membershipId } });
        return { success: true };
    }

    /** Merge `id` into another conversation: messages move, the source is resolved and points at the target (13 §1). */
    async merge(ctx: OrgContext, id: string, dto: MergeConversationDto) {
        if (id === dto.into_conversation_id) throw new BadRequestException({ message: 'Pick a different conversation', code: 'merge_same' });
        const [source, target] = await Promise.all([this.findBase(ctx, id), this.findBase(ctx, dto.into_conversation_id)]);
        if (target.merged_into_conversation_id) throw new ConflictException({ message: 'The target conversation was itself merged', code: 'merge_target_merged' });
        await this.prisma.$transaction(async (tx) => {
            const moved = await tx.supportMessage.updateMany({ where: { conversation_id: id }, data: { conversation_id: target.id } });
            await tx.supportConversation.update({
                where: { id: target.id },
                data: { message_count: { increment: moved.count }, last_message_at: [target.last_message_at, source.last_message_at].filter(Boolean).sort().pop() ?? target.last_message_at },
            });
            await tx.supportConversation.update({ where: { id }, data: { merged_into_conversation_id: target.id, status: 'RESOLVED', resolved_at: new Date(), resolved_by_membership_id: ctx.membership_id, message_count: 0 } });
            await tx.ticket.updateMany({ where: { conversation_id: id }, data: { conversation_id: target.id } });
            await this.systemNote(tx, target.id, `Merged conversation "${source.subject ?? 'Untitled'}" into this one`, ctx);
        });
        await this.audit.record(ctx, 'support_conversation.merged', { resource_type: 'support_conversation', resource_id: id, metadata: { into_conversation_id: target.id } });
        this.events.publish(ctx, { event_key: 'support.conversation.merged', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, payload: { into_conversation_id: target.id } });
        return this.findOne(ctx, target.id);
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    async findBase(ctx: OrgContext, id: string) {
        const conv = await this.prisma.supportConversation.findFirst({ where: { AND: [{ id, organization_id: ctx.organization_id }, conversationScopeWhere(ctx, READ)] } });
        if (!conv) throw new NotFoundException({ message: 'Conversation not found', code: 'conversation_not_found' });
        return conv;
    }

    private async setStatus(tx: Tx, id: string, status: 'OPEN' | 'PENDING' | 'RESOLVED', ctx: OrgContext) {
        const now = new Date();
        await tx.supportConversation.update({
            where: { id },
            data: {
                status,
                snoozed_until: null,
                ...(status === 'RESOLVED' ? { resolved_at: now, resolved_by_membership_id: ctx.membership_id } : {}),
            },
        });
    }

    /** CSAT request after resolve (13 §9), outside the request path. */
    private afterResolve(ctx: OrgContext, id: string) {
        setImmediate(async () => {
            try {
                const conv = await this.prisma.supportConversation.findUnique({ where: { id }, select: { organization_id: true, contact_id: true, customer_user_id: true, assignee_membership_id: true, channel: { select: { csat_enabled: true } } } });
                if (!conv || conv.channel?.csat_enabled === false) return;
                await this.csat.request(ctx, { conversation_id: id, contact_id: conv.contact_id, rated_by_user_id: conv.customer_user_id, agent_membership_id: conv.assignee_membership_id });
            } catch {
                /* never surfaces */
            }
        });
    }

    private async systemNote(tx: Tx, conversationId: string, body: string, ctx: OrgContext) {
        const conv = await tx.supportConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { organization_id: true } });
        await tx.supportMessage.create({ data: { conversation_id: conversationId, organization_id: conv.organization_id, kind: 'SYSTEM', body, author_membership_id: ctx.membership_id } });
    }

    private async validMembers(ctx: OrgContext, ids: string[], strict = false) {
        if (!ids.length) return [];
        const rows = await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true } });
        if (strict && rows.length !== new Set(ids).size) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        return rows.map((r) => r.id);
    }

    private async assertRefs(ctx: OrgContext, refs: { inbox_id?: string | null; team_id?: string | null; company_id?: string | null; contact_id?: string | null }) {
        const org = ctx.organization_id;
        const checks: Promise<unknown>[] = [];
        if (refs.inbox_id) checks.push(this.prisma.supportInbox.findFirstOrThrow({ where: { id: refs.inbox_id, organization_id: org, archived_at: null } }));
        if (refs.team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: refs.team_id, organization_id: org } }));
        if (refs.company_id) checks.push(this.prisma.crmCompany.findFirstOrThrow({ where: { id: refs.company_id, organization_id: org } }));
        if (refs.contact_id) checks.push(this.prisma.crmContact.findFirstOrThrow({ where: { id: refs.contact_id, organization_id: org } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Inbox, team, company or contact not found', code: 'reference_not_found' });
        }
    }
}
