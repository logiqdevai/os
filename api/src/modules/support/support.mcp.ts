import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ConversationsService } from './conversations/conversations.service';
import { ConversationQuerySchema, PostMessageSchema } from './conversations/dto/conversation.dto';
import { TicketsService } from './tickets/tickets.service';
import { CreateTicketSchema, TicketQuerySchema, UpdateTicketSchema } from './tickets/dto/ticket.dto';
import { KnowledgeService } from './knowledge/knowledge.service';
import { ArticleQuerySchema, CreateArticleSchema } from './knowledge/dto/knowledge.dto';
import { SupportAnalyticsService, AnalyticsQuerySchema } from './analytics/analytics.service';
import { AcceptSuggestionSchema, RejectSuggestionSchema, SuggestionQuerySchema, SupportAiService } from './ai/support-ai.service';
import { IncidentsService } from './incidents/incidents.service';
import { IncidentQuerySchema } from './incidents/dto/incident.dto';
import { SupportEmailService } from './email/support-email.service';
import { SupportAiAgentService } from './ai/support-ai-agent.service';
import { InboxesService } from './inboxes/inboxes.service';
import { ChannelAiConfigSchema, OfficeHoursSchema } from './common/channel-config.utils';

const id = z.object({ id: z.string().uuid() });
const M = ModuleKey.SUPPORT;

/** MCP adapter for 13 Support — same service methods and validation as REST (roles-and-permissions rule §5). */
@Injectable()
export class SupportMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly conversations: ConversationsService,
        private readonly tickets: TicketsService,
        private readonly knowledge: KnowledgeService,
        private readonly analytics: SupportAnalyticsService,
        private readonly ai: SupportAiService,
        private readonly incidents: IncidentsService,
        private readonly email: SupportEmailService,
        private readonly aiAgent: SupportAiAgentService,
        private readonly inboxes: InboxesService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            // --- Conversations -----------------------------------------------------------------
            { name: 'support_conversations_read', description: 'List inbox conversations (views: all, mine, unassigned, mentions; filter by status, inbox, channel, customer).', permission: 'support.conversations.read', module: M, resource_type: 'support_conversation', input: ConversationQuerySchema, handler: (ctx, a) => this.conversations.findAll(ctx, a) },
            { name: 'support_conversations_get', description: 'Get one conversation with its messages (replies and internal notes) and linked tickets.', permission: 'support.conversations.read', module: M, resource_type: 'support_conversation', input: id, handler: (ctx, a) => this.conversations.findOne(ctx, a.id) },
            {
                name: 'support_conversations_reply',
                description: 'Send a public reply to the customer (kind AGENT) or add a private internal note (kind INTERNAL_NOTE).',
                permission: 'support.conversations.reply',
                module: M,
                resource_type: 'support_conversation',
                sensitive: true,
                input: PostMessageSchema,
                handler: (ctx, { id: cid, ...dto }) => this.conversations.postMessage(ctx, cid, dto),
            },
            {
                name: 'support_conversations_assign',
                description: 'Assign a conversation to a member (null to unassign).',
                permission: 'support.conversations.assign',
                module: M,
                resource_type: 'support_conversation',
                input: z.object({ id: z.string().uuid(), assignee_membership_id: z.string().uuid().nullable(), team_id: z.string().uuid().nullable().optional() }),
                handler: (ctx, { id: cid, ...dto }) => this.conversations.assign(ctx, cid, dto),
            },
            { name: 'support_conversations_close', description: 'Resolve a conversation.', permission: 'support.conversations.close', module: M, resource_type: 'support_conversation', input: id, handler: (ctx, a) => this.conversations.close(ctx, a.id) },
            // --- Tickets -----------------------------------------------------------------------
            { name: 'support_tickets_read', description: 'List tickets (state=open|closed, priority, assignee=me|unassigned|<id>, sla=breached|at_risk, company, project, search).', permission: 'support.tickets.read', module: M, resource_type: 'ticket', input: TicketQuerySchema, handler: (ctx, a) => this.tickets.findAll(ctx, a) },
            { name: 'support_tickets_get', description: 'Get one ticket by id or reference (e.g. SUP-1042) with SLA timers, tasks and history.', permission: 'support.tickets.read', module: M, resource_type: 'ticket', input: z.object({ id_or_reference: z.string().min(1) }), handler: (ctx, a) => this.tickets.findOne(ctx, a.id_or_reference) },
            { name: 'support_tickets_create', description: 'Create a support ticket (SLA starts immediately).', permission: 'support.tickets.create', module: M, resource_type: 'ticket', input: CreateTicketSchema, handler: (ctx, a) => this.tickets.create(ctx, a) },
            { name: 'support_tickets_update', description: 'Update ticket fields (subject, type, priority, category, team, project).', permission: 'support.tickets.update', module: M, resource_type: 'ticket', input: UpdateTicketSchema, handler: (ctx, { id: tid, ...dto }) => this.tickets.update(ctx, tid, dto) },
            {
                name: 'support_tickets_change_status',
                description: 'Move a ticket to another status (see GET /support/ticket-statuses).',
                permission: 'support.tickets.update',
                module: M,
                resource_type: 'ticket',
                input: z.object({ id: z.string().uuid(), status_id: z.string().uuid(), reason: z.string().max(1000).optional(), resolution: z.string().max(10000).optional() }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.changeStatus(ctx, tid, dto),
            },
            {
                name: 'support_tickets_assign',
                description: 'Assign a ticket to a member and/or team.',
                permission: 'support.tickets.assign',
                module: M,
                resource_type: 'ticket',
                input: z.object({ id: z.string().uuid(), assignee_membership_id: z.string().uuid().nullable(), team_id: z.string().uuid().nullable().optional() }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.assign(ctx, tid, dto),
            },
            {
                name: 'support_tickets_reply',
                description: 'Reply to the ticket requester (AGENT) or add an internal note.',
                permission: 'support.conversations.reply',
                module: M,
                resource_type: 'ticket',
                sensitive: true,
                input: z.object({ id: z.string().uuid(), kind: z.enum(['AGENT', 'INTERNAL_NOTE']), body: z.string().min(1).max(50000) }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.reply(ctx, tid, dto),
            },
            {
                name: 'support_tickets_convert_to_task',
                description: 'Convert a ticket into a Task with a permanent link (idempotent).',
                permission: 'support.tickets.convert_to_task',
                module: M,
                resource_type: 'ticket',
                sensitive: true,
                input: z.object({ id: z.string().uuid(), title: z.string().max(300).optional(), project_id: z.string().uuid().optional(), team_id: z.string().uuid().optional(), assignee_membership_id: z.string().uuid().optional() }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.convertToTask(ctx, tid, dto),
            },
            {
                name: 'support_tickets_merge',
                description: 'Merge a duplicate ticket into another one.',
                permission: 'support.tickets.merge',
                module: M,
                resource_type: 'ticket',
                sensitive: true,
                input: z.object({ id: z.string().uuid(), into_ticket_id: z.string().uuid() }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.merge(ctx, tid, dto),
            },
            {
                name: 'support_tickets_escalate',
                description: 'Escalate a ticket, optionally to a member, with a note.',
                permission: 'support.tickets.escalate',
                module: M,
                resource_type: 'ticket',
                input: z.object({ id: z.string().uuid(), to_membership_id: z.string().uuid().optional(), note: z.string().max(2000).optional() }),
                handler: (ctx, { id: tid, ...dto }) => this.tickets.escalate(ctx, tid, dto),
            },
            // --- Knowledge base ----------------------------------------------------------------
            { name: 'support_knowledge_read', description: 'Search help-center articles (any status/visibility).', permission: 'support.knowledge.read', module: M, resource_type: 'knowledge_article', input: ArticleQuerySchema, handler: (ctx, a) => this.knowledge.findAll(ctx, a) },
            { name: 'support_knowledge_get', description: 'Get an article with its body and versions.', permission: 'support.knowledge.read', module: M, resource_type: 'knowledge_article', input: id, handler: (ctx, a) => this.knowledge.findOne(ctx, a.id) },
            { name: 'support_knowledge_create', description: 'Create a draft help-center article (e.g. from a resolved ticket).', permission: 'support.knowledge.create', module: M, resource_type: 'knowledge_article', input: CreateArticleSchema, handler: (ctx, a) => this.knowledge.create(ctx, a) },
            { name: 'support_knowledge_publish', description: 'Publish an article to the help center.', permission: 'support.knowledge.publish', module: M, resource_type: 'knowledge_article', sensitive: true, input: id, handler: (ctx, a) => this.knowledge.publish(ctx, a.id) },
            // --- AI review queue -----------------------------------------------------------------
            { name: 'support_ai_suggestions_list', description: 'AI suggestion review queue (status PENDING by default; filter by kind, conversation, ticket).', permission: 'support.ai.use', module: M, resource_type: 'support_ai_suggestion', input: SuggestionQuerySchema, handler: (ctx, a) => this.ai.list(ctx, a) },
            {
                name: 'support_ai_suggestions_accept',
                description: 'Accept an AI suggestion, optionally with edited text. Reply suggestions are sent to the customer (as=AGENT) or kept as an internal note.',
                permission: 'support.ai.use',
                module: M,
                resource_type: 'support_ai_suggestion',
                sensitive: true,
                input: AcceptSuggestionSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id: sid, ...dto }) => this.ai.accept(ctx, sid, dto),
            },
            { name: 'support_ai_suggestions_reject', description: 'Reject an AI suggestion with an optional note.', permission: 'support.ai.use', module: M, resource_type: 'support_ai_suggestion', input: RejectSuggestionSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: sid, note }) => this.ai.reject(ctx, sid, note) },
            // --- AI auto-answer -------------------------------------------------------------------
            { name: 'support_ai_sessions_list', description: 'AI auto-answer sessions of a conversation: status, turns, cited articles, handover reason, usage.', permission: 'support.conversations.read', module: M, resource_type: 'support_conversation', input: z.object({ conversation_id: z.string().uuid() }), handler: (ctx, a) => this.aiAgent.sessions(ctx, a.conversation_id) },
            { name: 'support_ai_take_over', description: 'Take a conversation over from the AI assistant (ends its active session; the customer is not messaged).', permission: 'support.conversations.reply', module: M, resource_type: 'support_conversation', input: z.object({ conversation_id: z.string().uuid() }), handler: (ctx, a) => this.aiAgent.takeOver(ctx, a.conversation_id) },
            { name: 'support_channels_automation_get', description: 'AI auto-answer mode / threshold / max turns and office hours (with open now?) of a channel.', permission: 'support.inboxes.read', module: M, resource_type: 'support_channel', input: id, handler: (ctx, a) => this.inboxes.channelAutomation(ctx, a.id) },
            {
                name: 'support_channels_ai_agent_update',
                description: 'Set AI auto-answer on a channel: mode OFF | SUGGEST | AUTO_REPLY, min_confidence (0.5–0.99), max_turns, handover_phrases. AUTO_REPLY lets the AI answer customers.',
                permission: 'support.ai.configure',
                module: M,
                resource_type: 'support_channel',
                sensitive: true,
                input: ChannelAiConfigSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id: cid, ...dto }) => this.inboxes.setAiAgent(ctx, cid, dto),
            },
            { name: 'support_channels_office_hours_update', description: 'Set office hours of a widget / live chat channel (organization hours or custom per weekday, time zone, offline message).', permission: 'support.inboxes.manage', module: M, resource_type: 'support_channel', input: OfficeHoursSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id: cid, ...dto }) => this.inboxes.setOfficeHours(ctx, cid, dto) },
            // --- Incidents -----------------------------------------------------------------------
            { name: 'support_incidents_list', description: 'List incidents (status DETECTED|CONFIRMED|RESOLVED|DISMISSED, severity).', permission: 'support.tickets.read', module: M, resource_type: 'support_incident', input: IncidentQuerySchema, handler: (ctx, a) => this.incidents.findAll(ctx, a) },
            { name: 'support_incidents_get', description: 'Get an incident with its timeline and affected tickets.', permission: 'support.tickets.read', module: M, resource_type: 'support_incident', input: id, handler: (ctx, a) => this.incidents.findOne(ctx, a.id) },
            // --- Email channels ------------------------------------------------------------------
            { name: 'support_channels_email_setup', description: 'Inbound webhook URL, secret status and sending connection of an email channel.', permission: 'support.inboxes.read', module: M, resource_type: 'support_channel', input: id, handler: (ctx, a) => this.email.setup(ctx, a.id) },
            // --- Analytics ---------------------------------------------------------------------
            { name: 'support_analytics_read', description: 'Support KPIs: volume, first response and resolution time, SLA compliance, CSAT, backlog.', permission: 'support.analytics.read', module: M, input: AnalyticsQuerySchema, handler: (ctx, a) => this.analytics.overview(ctx, a) },
        ]);
    }
}
