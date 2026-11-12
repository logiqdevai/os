import { Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { calculateAiCost } from './ai-cost';

const logger = new Logger('OrgAiStructured');

export const ORG_AI_NOT_CONFIGURED = 'No AI provider connected. Connect your OpenAI key in Admin → Integrations.';

export type OrgAiObjectResult<T> =
    | { available: true; object: T; model: string; connection_id: string; input_tokens: number | null; output_tokens: number | null; cost: number | null; latency_ms: number }
    | { available: false; reason: 'ai_not_configured' | 'ai_provider_error'; message: string };

/**
 * Structured generation (zod schema → typed object) on the organization's OWN OpenAI connection (01 §157, BYOK):
 * the ACTIVE OPENAI IntegrationConnection's encrypted key, never an .env key. Never throws: without a connection
 * or on provider errors it returns `available: false` with a human-readable message (and records `last_error`).
 */
export async function generateOrgAiObject<S extends z.ZodTypeAny>(
    prisma: PrismaService,
    organizationId: string,
    options: { schema: S; system: string; prompt: string; temperature?: number; maxTokens?: number },
): Promise<OrgAiObjectResult<z.infer<S>>> {
    const conn = await prisma.integrationConnection.findFirst({
        where: { organization_id: organizationId, category: 'AI', provider: 'OPENAI', status: 'ACTIVE', disconnected_at: null },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
    let apiKey: string | null = null;
    try {
        apiKey = conn?.secret_ciphertext ? (decryptJson(conn.secret_ciphertext).api_key ?? null) : null;
    } catch {
        apiKey = null;
    }
    if (!conn || !apiKey) return { available: false, reason: 'ai_not_configured', message: ORG_AI_NOT_CONFIGURED };
    const config = (conn.config ?? {}) as Record<string, unknown>;
    const model = typeof config.default_model === 'string' && config.default_model ? config.default_model : 'gpt-4o-mini';
    const started = Date.now();
    try {
        const openai = createOpenAI({ apiKey });
        // Loosely typed on purpose: inferring generateObject's generics from arbitrary zod schemas is very expensive for tsc.
        const run = generateObject as unknown as (o: Record<string, unknown>) => Promise<{ object: unknown; usage?: { inputTokens?: number; outputTokens?: number } }>;
        const { object, usage } = await run({
            model: openai(model),
            schema: options.schema,
            system: options.system,
            prompt: options.prompt,
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? 4000,
        });
        const input = usage?.inputTokens ?? null;
        const output = usage?.outputTokens ?? null;
        let cost: number | null = null;
        try { cost = input !== null && output !== null ? calculateAiCost({ provider: 'openai', model, inputTokens: input, outputTokens: output }).totalCost : null; } catch { cost = null; }
        await prisma.integrationConnection.update({ where: { id: conn.id }, data: { last_used_at: new Date(), last_error: null } }).catch(() => undefined);
        return { available: true, object: object as z.infer<S>, model, connection_id: conn.id, input_tokens: input, output_tokens: output, cost, latency_ms: Date.now() - started };
    } catch (error) {
        const message = ((error as Error)?.message ?? 'AI provider error').slice(0, 500);
        logger.warn(`AI call failed: ${message}`);
        await prisma.integrationConnection.update({ where: { id: conn.id }, data: { last_error: message } }).catch(() => undefined);
        return { available: false, reason: 'ai_provider_error', message: `The AI provider returned an error: ${message}` };
    }
}

/** Whether the organization has an ACTIVE OpenAI connection (for UI hints; no key is decrypted). */
export async function orgAiConfigured(prisma: PrismaService, organizationId: string) {
    return !!(await prisma.integrationConnection.findFirst({ where: { organization_id: organizationId, category: 'AI', provider: 'OPENAI', status: 'ACTIVE', disconnected_at: null }, select: { id: true } }));
}
