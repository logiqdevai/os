import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, SupportAiSuggestionKind, SupportAiSuggestionStatus } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuerySchema, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { OrgAiService } from '@/integrations/ai/services/org-ai.service';
import { ConversationsService } from '../conversations/conversations.service';
import { conversationScopeWhere, ticketScopeWhere } from '../common/support-scope.utils';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'your', 'you', 'are', 'was', 'not', 'but', 'can', 'our', 'how', 'what', 'when', 'please', 'thanks', 'hello', 'hi']);

export const SuggestionQuerySchema = BaseListQuerySchema.extend({
    status: z.nativeEnum(SupportAiSuggestionStatus).optional().default('PENDING'),
    kind: z.nativeEnum(SupportAiSuggestionKind).optional(),
    conversation_id: z.string().uuid().optional(),
    ticket_id: z.string().uuid().optional(),
});
export type SuggestionQuery = z.infer<typeof SuggestionQuerySchema>;

export const AcceptSuggestionSchema = z.object({
    /** Edited reply text (REPLY / REWRITE / TRANSLATION); defaults to the suggested text. */
    body: z.string().trim().min(1).max(50000).optional(),
    /** REPLY: send as a public reply (default) or keep it as an internal note. */
    as: z.enum(['AGENT', 'INTERNAL_NOTE']).optional(),
    note: z.string().max(1000).optional(),
});
export type AcceptSuggestionInput = z.infer<typeof AcceptSuggestionSchema>;

export const RejectSuggestionSchema = z.object({ note: z.string().max(1000).optional() });

/** Kinds whose acceptance posts a message on the conversation. */
const MESSAGE_KINDS: SupportAiSuggestionKind[] = ['REPLY', 'REWRITE', 'TRANSLATION', 'FOLLOW_UP_QUESTION', 'TROUBLESHOOTING'];

/**
 * AI assistance for agents (13 §3) on the organization's own AI key (shared layer `integrations/ai` OrgAiService, BYOK).
 * Without a connection every call degrades gracefully (`available: false` + knowledge-base matches), never an error.
 * Output is a SupportAiSuggestion in a human review queue: accept (optionally edited) / reject, with accuracy feedback.
 */
@Injectable()
export class SupportAiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly conversations: ConversationsService,
        private readonly ai: OrgAiService,
    ) { }

    async status(ctx: OrgContext) {
        const [configured, settings, pending] = await Promise.all([
            this.ai.isConfigured(ctx.organization_id),
            this.prisma.supportSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { ai_agent_enabled: true, ai_require_reply_approval: true } }),
            this.prisma.supportAiSuggestion.count({ where: { ...this.scopeWhere(ctx), status: 'PENDING' } }),
        ]);
        return { configured, agent_enabled: settings?.ai_agent_enabled ?? false, require_reply_approval: settings?.ai_require_reply_approval ?? true, pending_suggestions: pending };
    }

    /** Knowledge-base matches for the conversation text (works without AI). */
    async relatedArticles(ctx: OrgContext, text: string, take = 5) {
        const words = [...new Set(text.toLowerCase().match(/[a-zà-ÿ0-9]{4,}/g) ?? [])].filter((w) => !STOP.has(w)).slice(0, 8);
        if (!words.length) return [];
        const rows = await this.prisma.knowledgeArticle.findMany({
            where: { organization_id: ctx.organization_id, status: 'PUBLISHED', archived_at: null, OR: words.flatMap((w) => [{ title: { contains: w, mode: 'insensitive' as const } }, { keywords: { has: w } }]) },
            select: { id: true, title: true, slug: true, summary: true, visibility: true },
            take: 20,
        });
        const score = (r: { title: string }) => words.filter((w) => r.title.toLowerCase().includes(w)).length;
        return rows.sort((a, b) => score(b) - score(a)).slice(0, take);
    }

    async suggestReply(ctx: OrgContext, conversationId: string) {
        const conv = await this.conversations.findOne(ctx, conversationId);
        const thread = conv.messages.filter((m) => m.kind !== 'SYSTEM').slice(-12);
        const lastCustomer = [...thread].reverse().find((m) => m.kind === 'CUSTOMER');
        const articles = await this.relatedArticles(ctx, `${conv.subject ?? ''} ${lastCustomer?.body ?? ''}`);
        const transcript = thread.map((m) => `${m.kind === 'CUSTOMER' ? 'Customer' : m.kind === 'INTERNAL_NOTE' ? 'Internal note' : 'Agent'}: ${m.body}`).join('\n\n');
        const kb = articles.map((a) => `- ${a.title}: ${a.summary ?? ''}`).join('\n');
        const res = await this.ai.generateText(ctx.organization_id, {
            system: 'You are a helpful, concise customer support agent for a software agency. Write the next reply to the customer in the same language they used. Never reveal internal notes. Use the knowledge base when relevant. Do not invent facts; ask a clarifying question when needed.',
            prompt: `Conversation:\n${transcript}\n\nKnowledge base:\n${kb || '(none)'}\n\nWrite the agent's next reply.`,
            temperature: 0.3,
            maxTokens: 500,
        });
        if (res.available === false) return { available: false, reason: res.reason, message: res.message, suggestion: null, articles };
        const suggestion = await this.prisma.supportAiSuggestion.create({
            data: {
                organization_id: ctx.organization_id,
                kind: 'REPLY',
                conversation_id: conversationId,
                ticket_id: conv.primary_tickets[0]?.id ?? null,
                source_message_id: lastCustomer?.id ?? null,
                model: res.model,
                payload: { body: res.text, article_ids: articles.map((a) => a.id) } as Prisma.InputJsonValue,
                status: 'PENDING',
                expires_at: new Date(Date.now() + 7 * 86_400_000),
            },
        });
        await this.audit.record(ctx, 'support_ai.reply_suggested', { resource_type: 'support_conversation', resource_id: conversationId, metadata: { suggestion_id: suggestion.id, model: res.model, input_tokens: res.input_tokens, output_tokens: res.output_tokens } });
        this.events.publish(ctx, { event_key: 'support.ai.suggestion_created', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: conversationId, payload: { suggestion_id: suggestion.id, kind: 'REPLY', conversation_id: conversationId } });
        return { available: true, suggestion: { id: suggestion.id, body: res.text }, articles };
    }

    async summarize(ctx: OrgContext, conversationId: string) {
        const conv = await this.conversations.findOne(ctx, conversationId);
        const transcript = conv.messages.filter((m) => m.kind !== 'SYSTEM').slice(-40).map((m) => `${m.kind}: ${m.body}`).join('\n');
        const res = await this.ai.generateText(ctx.organization_id, {
            system: 'Summarize this support conversation for a colleague in 3–5 short bullet points: the problem, what was tried, current state and next step.',
            prompt: transcript,
            temperature: 0.2,
            maxTokens: 300,
        });
        if (res.available === false) return { available: false, reason: res.reason, message: res.message, summary: conv.ai_summary };
        await this.prisma.supportConversation.update({ where: { id: conversationId }, data: { ai_summary: res.text, ai_summary_at: new Date() } });
        await this.audit.record(ctx, 'support_ai.summary_generated', { resource_type: 'support_conversation', resource_id: conversationId, metadata: { model: res.model } });
        this.events.publish(ctx, { event_key: 'support.conversation.summarized', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: conversationId });
        return { available: true, summary: res.text };
    }

    // ---------------------------------------------------------------------------------------------
    // Review queue
    // ---------------------------------------------------------------------------------------------

    /** Suggestions on conversations / tickets inside the caller's support scope. */
    private scopeWhere(ctx: OrgContext): Prisma.SupportAiSuggestionWhereInput {
        const convScope = conversationScopeWhere(ctx, SUPPORT_PERMS.conversationsRead);
        const ticketScope = ticketScopeWhere(ctx, SUPPORT_PERMS.ticketsRead);
        return {
            organization_id: ctx.organization_id,
            OR: [
                { conversation_id: { not: null }, conversation: { organization_id: ctx.organization_id, ...convScope } },
                { conversation_id: null, ticket_id: { not: null }, ticket: { organization_id: ctx.organization_id, ...ticketScope } },
            ],
        };
    }

    async list(ctx: OrgContext, q: SuggestionQuery) {
        const where: Prisma.SupportAiSuggestionWhereInput = {
            AND: [
                this.scopeWhere(ctx),
                { status: q.status },
                q.kind ? { kind: q.kind } : {},
                q.conversation_id ? { conversation_id: q.conversation_id } : {},
                q.ticket_id ? { ticket_id: q.ticket_id } : {},
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.supportAiSuggestion.findMany({
                where,
                ...skipTake(q),
                orderBy: { created_at: q.status === 'PENDING' ? 'asc' : 'desc' },
                include: {
                    conversation: { select: { id: true, subject: true, customer_name: true, customer_email: true, channel_type: true, status: true } },
                    ticket: { select: { id: true, reference: true, subject: true } },
                    reviewed_by: { select: MEMBER_SELECT },
                },
            }),
            this.prisma.supportAiSuggestion.count({ where }),
        ]);
        return paginate(rows.map((r) => ({ ...r, confidence: r.confidence === null ? null : Number(r.confidence) })), total, q);
    }

    private async pending(ctx: OrgContext, id: string) {
        const s = await this.prisma.supportAiSuggestion.findFirst({ where: { AND: [{ id }, this.scopeWhere(ctx)] } });
        if (!s) throw new NotFoundException({ message: 'Suggestion not found', code: 'ai_suggestion_not_found' });
        if (s.status !== 'PENDING') throw new ConflictException({ message: 'This suggestion was already reviewed', code: 'ai_suggestion_reviewed' });
        return s;
    }

    /**
     * Accept a suggestion, optionally edited. REPLY-like kinds post the (edited) text on the conversation through the normal
     * message engine (needs support.conversations.reply); SUMMARY stores the summary. Everything else is recorded as accepted.
     */
    async accept(ctx: OrgContext, id: string, dto: AcceptSuggestionInput) {
        const s = await this.pending(ctx, id);
        const payload = (s.payload ?? {}) as Record<string, unknown>;
        const suggested = typeof payload.body === 'string' ? payload.body : typeof payload.text === 'string' ? payload.text : typeof payload.summary === 'string' ? payload.summary : null;
        const text = dto.body ?? suggested;
        const edited = !!dto.body && dto.body !== suggested;
        let messageId: string | null = null;
        if (MESSAGE_KINDS.includes(s.kind)) {
            if (!s.conversation_id || !text) throw new ConflictException({ message: 'This suggestion has no conversation or text to send', code: 'ai_suggestion_not_applicable' });
            if (!ctx.can(SUPPORT_PERMS.conversationsReply)) throw new ForbiddenException({ message: 'Sending needs support.conversations.reply', code: 'permission_denied', permissions: [SUPPORT_PERMS.conversationsReply] });
            const msg = await this.conversations.postMessage(ctx, s.conversation_id, { kind: dto.as ?? 'AGENT', body: text });
            await this.prisma.supportMessage.update({ where: { id: msg.id }, data: { ai_suggestion_id: s.id } });
            messageId = msg.id;
        } else if (s.kind === 'SUMMARY' && s.conversation_id && text) {
            await this.conversations.findBase(ctx, s.conversation_id);
            await this.prisma.supportConversation.update({ where: { id: s.conversation_id }, data: { ai_summary: text, ai_summary_at: new Date() } });
        }
        const row = await this.prisma.supportAiSuggestion.update({
            where: { id },
            data: {
                status: 'ACCEPTED',
                reviewed_by_membership_id: ctx.membership_id,
                reviewed_at: new Date(),
                applied_at: new Date(),
                review_note: dto.note ?? null,
                was_correct: !edited,
                ...(edited && { payload: { ...payload, edited_body: dto.body } as Prisma.InputJsonValue }),
            },
        });
        await this.audit.record(ctx, 'support_ai.suggestion_accepted', { resource_type: 'support_ai_suggestion', resource_id: id, metadata: { kind: s.kind, edited, message_id: messageId, conversation_id: s.conversation_id } });
        this.events.publish(ctx, { event_key: 'support.ai.suggestion_accepted', module: ModuleKey.SUPPORT, entity_kind: 'support_ai_suggestion', entity_id: id, payload: { kind: s.kind, edited, conversation_id: s.conversation_id, ticket_id: s.ticket_id } });
        return { ...row, confidence: row.confidence === null ? null : Number(row.confidence), message_id: messageId };
    }

    async reject(ctx: OrgContext, id: string, note?: string) {
        const s = await this.pending(ctx, id);
        const row = await this.prisma.supportAiSuggestion.update({ where: { id }, data: { status: 'REJECTED', reviewed_by_membership_id: ctx.membership_id, reviewed_at: new Date(), review_note: note ?? null, was_correct: false } });
        await this.audit.record(ctx, 'support_ai.suggestion_rejected', { resource_type: 'support_ai_suggestion', resource_id: id, metadata: { kind: s.kind, note: note ?? null } });
        this.events.publish(ctx, { event_key: 'support.ai.suggestion_rejected', module: ModuleKey.SUPPORT, entity_kind: 'support_ai_suggestion', entity_id: id, payload: { kind: s.kind, conversation_id: s.conversation_id, ticket_id: s.ticket_id } });
        return { ...row, confidence: row.confidence === null ? null : Number(row.confidence) };
    }

    /** Record whether a suggestion shown inline in the composer was used (accuracy feedback, 13 §9). */
    async review(ctx: OrgContext, suggestionId: string, accepted: boolean) {
        const s = await this.prisma.supportAiSuggestion.findFirst({ where: { AND: [{ id: suggestionId }, this.scopeWhere(ctx)] } });
        if (!s || s.status !== 'PENDING') return { success: false };
        await this.prisma.supportAiSuggestion.update({ where: { id: suggestionId }, data: { status: accepted ? 'ACCEPTED' : 'REJECTED', reviewed_by_membership_id: ctx.membership_id, reviewed_at: new Date(), was_correct: accepted, ...(accepted && { applied_at: new Date() }) } });
        await this.audit.record(ctx, accepted ? 'support_ai.suggestion_accepted' : 'support_ai.suggestion_rejected', { resource_type: 'support_ai_suggestion', resource_id: suggestionId, metadata: { via: 'composer' } });
        return { success: true };
    }
}
