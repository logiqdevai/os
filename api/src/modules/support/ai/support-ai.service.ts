import { Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { ConversationsService } from '../conversations/conversations.service';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'have', 'from', 'your', 'you', 'are', 'was', 'not', 'but', 'can', 'our', 'how', 'what', 'when', 'please', 'thanks', 'hello', 'hi']);

/**
 * Optional AI assistance for agents (13 §3). Uses the organization's own AI connection (01 §157, BYOK);
 * without one every call degrades gracefully: `available: false` plus knowledge-base matches, never an error.
 */
@Injectable()
export class SupportAiService {
    private readonly logger = new Logger(SupportAiService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly conversations: ConversationsService,
    ) { }

    private async connection(organizationId: string) {
        const conn = await this.prisma.integrationConnection.findFirst({
            where: { organization_id: organizationId, category: 'AI', provider: 'OPENAI', status: 'ACTIVE' },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        if (!conn?.secret_ciphertext) return null;
        try {
            const secret = decryptJson(conn.secret_ciphertext);
            const config = (conn.config ?? {}) as Record<string, unknown>;
            return secret.api_key ? { id: conn.id, apiKey: secret.api_key, model: typeof config.default_model === 'string' ? config.default_model : 'gpt-4o-mini' } : null;
        } catch {
            return null;
        }
    }

    async status(ctx: OrgContext) {
        const [conn, settings] = await Promise.all([this.connection(ctx.organization_id), this.prisma.supportSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { ai_agent_enabled: true, ai_require_reply_approval: true } })]);
        return { configured: !!conn, agent_enabled: settings?.ai_agent_enabled ?? false, require_reply_approval: settings?.ai_require_reply_approval ?? true };
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
        const conn = await this.connection(ctx.organization_id);
        if (!conn) return { available: false, reason: 'ai_not_configured', suggestion: null, articles };

        const transcript = thread.map((m) => `${m.kind === 'CUSTOMER' ? 'Customer' : m.kind === 'INTERNAL_NOTE' ? 'Internal note' : 'Agent'}: ${m.body}`).join('\n\n');
        const kb = articles.map((a) => `- ${a.title}: ${a.summary ?? ''}`).join('\n');
        try {
            const openai = createOpenAI({ apiKey: conn.apiKey });
            const { text, usage } = await generateText({
                model: openai(conn.model),
                system: 'You are a helpful, concise customer support agent for a software agency. Write the next reply to the customer in the same language they used. Never reveal internal notes. Use the knowledge base when relevant. Do not invent facts; ask a clarifying question when needed.',
                prompt: `Conversation:\n${transcript}\n\nKnowledge base:\n${kb || '(none)'}\n\nWrite the agent's next reply.`,
                temperature: 0.3,
                maxOutputTokens: 500,
            });
            const suggestion = await this.prisma.supportAiSuggestion.create({
                data: {
                    organization_id: ctx.organization_id,
                    kind: 'REPLY',
                    conversation_id: conversationId,
                    source_message_id: lastCustomer?.id ?? null,
                    model: conn.model,
                    payload: { body: text, article_ids: articles.map((a) => a.id) } as Prisma.InputJsonValue,
                    status: 'PENDING',
                },
            });
            await this.audit.record(ctx, 'support_ai.reply_suggested', { resource_type: 'support_conversation', resource_id: conversationId, metadata: { suggestion_id: suggestion.id, model: conn.model, tokens: usage?.totalTokens ?? null } });
            return { available: true, suggestion: { id: suggestion.id, body: text }, articles };
        } catch (error) {
            this.logger.warn(`AI reply suggestion failed: ${(error as Error).message}`);
            await this.prisma.integrationConnection.update({ where: { id: conn.id }, data: { last_error: (error as Error).message.slice(0, 500) } }).catch(() => undefined);
            return { available: false, reason: 'ai_provider_error', suggestion: null, articles };
        }
    }

    async summarize(ctx: OrgContext, conversationId: string) {
        const conv = await this.conversations.findOne(ctx, conversationId);
        const conn = await this.connection(ctx.organization_id);
        if (!conn) return { available: false, reason: 'ai_not_configured', summary: conv.ai_summary };
        const transcript = conv.messages.filter((m) => m.kind !== 'SYSTEM').slice(-40).map((m) => `${m.kind}: ${m.body}`).join('\n');
        try {
            const openai = createOpenAI({ apiKey: conn.apiKey });
            const { text } = await generateText({
                model: openai(conn.model),
                system: 'Summarize this support conversation for a colleague in 3–5 short bullet points: the problem, what was tried, current state and next step.',
                prompt: transcript,
                temperature: 0.2,
                maxOutputTokens: 300,
            });
            await this.prisma.supportConversation.update({ where: { id: conversationId }, data: { ai_summary: text, ai_summary_at: new Date() } });
            await this.audit.record(ctx, 'support_ai.summary_generated', { resource_type: 'support_conversation', resource_id: conversationId, metadata: { model: conn.model } });
            this.events.publish(ctx, { event_key: 'support.conversation.summarized', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: conversationId });
            return { available: true, summary: text };
        } catch (error) {
            this.logger.warn(`AI summary failed: ${(error as Error).message}`);
            return { available: false, reason: 'ai_provider_error', summary: conv.ai_summary };
        }
    }

    /** Record what the agent did with a suggestion (accuracy feedback, 13 §9). */
    async review(ctx: OrgContext, suggestionId: string, accepted: boolean) {
        const s = await this.prisma.supportAiSuggestion.findFirst({ where: { id: suggestionId, organization_id: ctx.organization_id } });
        if (!s) return { success: false };
        await this.prisma.supportAiSuggestion.update({ where: { id: suggestionId }, data: { status: accepted ? 'ACCEPTED' : 'REJECTED', reviewed_by_membership_id: ctx.membership_id, reviewed_at: new Date(), ...(accepted && { applied_at: new Date() }) } });
        await this.audit.record(ctx, accepted ? 'support_ai.suggestion_accepted' : 'support_ai.suggestion_rejected', { resource_type: 'support_ai_suggestion', resource_id: suggestionId });
        return { success: true };
    }
}
