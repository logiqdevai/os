import { Injectable, Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { embedMany, generateText } from 'ai';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { calculateAiCost } from '../utils/ai-cost';

/** The organization's own OpenAI connection (01 §157, BYOK). Secrets never leave this service. */
export interface OrgAiConnection {
    id: string;
    provider: 'openai';
    model: string;
    embedding_model: string;
    apiKey: string;
}

export type OrgAiUnavailableReason = 'ai_not_configured' | 'ai_provider_error';

export type OrgAiTextResult =
    | { available: true; text: string; model: string; provider: 'openai'; input_tokens: number | null; output_tokens: number | null; cost: number | null; latency_ms: number }
    | { available: false; reason: OrgAiUnavailableReason; message: string };

export type OrgAiEmbedResult =
    | { available: true; vectors: number[][]; model: string; input_tokens: number | null }
    | { available: false; reason: OrgAiUnavailableReason; message: string };

export const AI_NOT_CONFIGURED_MESSAGE = 'No AI provider connected. Connect your OpenAI key in Admin → Integrations.';

/**
 * Shared AI layer for module features that run on the organization's own key (Product Specification §6, BYOK).
 * Every call degrades gracefully: without an ACTIVE OpenAI IntegrationConnection, or when the provider fails,
 * it returns `available: false` with a reason instead of throwing, so callers can fall back (keyword search,
 * a failed automation step with a clear message, …). Provider errors are written to the connection's `last_error`.
 */
@Injectable()
export class OrgAiService {
    private readonly logger = new Logger(OrgAiService.name);

    constructor(private readonly prisma: PrismaService) { }

    async connection(organizationId: string): Promise<OrgAiConnection | null> {
        const conn = await this.prisma.integrationConnection.findFirst({
            where: { organization_id: organizationId, category: 'AI', provider: 'OPENAI', status: 'ACTIVE', disconnected_at: null },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        if (!conn?.secret_ciphertext) return null;
        try {
            const secret = decryptJson(conn.secret_ciphertext);
            const config = (conn.config ?? {}) as Record<string, unknown>;
            if (!secret.api_key) return null;
            return {
                id: conn.id,
                provider: 'openai',
                apiKey: secret.api_key,
                model: typeof config.default_model === 'string' && config.default_model ? config.default_model : 'gpt-4o-mini',
                embedding_model: typeof config.embedding_model === 'string' && config.embedding_model ? config.embedding_model : 'text-embedding-3-small',
            };
        } catch {
            return null;
        }
    }

    async isConfigured(organizationId: string) {
        return !!(await this.connection(organizationId));
    }

    async generateText(organizationId: string, options: { system: string; prompt: string; temperature?: number; maxTokens?: number }): Promise<OrgAiTextResult> {
        const conn = await this.connection(organizationId);
        if (!conn) return { available: false, reason: 'ai_not_configured', message: AI_NOT_CONFIGURED_MESSAGE };
        const started = Date.now();
        try {
            const openai = createOpenAI({ apiKey: conn.apiKey });
            const { text, usage } = await generateText({
                model: openai(conn.model),
                system: options.system,
                prompt: options.prompt,
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxTokens ?? 800,
            });
            const inputTokens = usage?.inputTokens ?? null;
            const outputTokens = usage?.outputTokens ?? null;
            const cost = inputTokens !== null && outputTokens !== null ? safeCost(conn.model, inputTokens, outputTokens) : null;
            return { available: true, text, model: conn.model, provider: 'openai', input_tokens: inputTokens, output_tokens: outputTokens, cost, latency_ms: Date.now() - started };
        } catch (error) {
            return this.providerError(conn.id, error);
        }
    }

    async embed(organizationId: string, texts: string[]): Promise<OrgAiEmbedResult> {
        const conn = await this.connection(organizationId);
        if (!conn) return { available: false, reason: 'ai_not_configured', message: AI_NOT_CONFIGURED_MESSAGE };
        if (!texts.length) return { available: true, vectors: [], model: conn.embedding_model, input_tokens: 0 };
        try {
            const openai = createOpenAI({ apiKey: conn.apiKey });
            const { embeddings, usage } = await embedMany({ model: openai.embedding(conn.embedding_model), values: texts });
            return { available: true, vectors: embeddings, model: conn.embedding_model, input_tokens: usage?.tokens ?? null };
        } catch (error) {
            return this.providerError(conn.id, error);
        }
    }

    private async providerError(connectionId: string, error: unknown): Promise<{ available: false; reason: 'ai_provider_error'; message: string }> {
        const message = ((error as Error)?.message ?? 'AI provider error').slice(0, 500);
        this.logger.warn(`AI provider call failed: ${message}`);
        await this.prisma.integrationConnection.update({ where: { id: connectionId }, data: { last_error: message } }).catch(() => undefined);
        return { available: false, reason: 'ai_provider_error', message: `The AI provider returned an error: ${message}` };
    }
}

/** Cosine similarity of two equal-length vectors (0 when either is empty). */
export function cosineSimilarity(a: number[], b: number[]) {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Cost from the pricing table; null for models the table does not know. */
function safeCost(model: string, inputTokens: number, outputTokens: number) {
    try {
        return calculateAiCost({ provider: 'openai', model, inputTokens, outputTokens }).totalCost;
    } catch {
        return null;
    }
}
