import { Injectable } from '@nestjs/common';
import { CommAiTaskKind, CommChannel, ModuleKey, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { OrgAiService } from '@/integrations/ai/services/org-ai.service';
import { notFound } from '../common/comm.utils';

export const AI_TASKS = [CommAiTaskKind.SUBJECT_LINES, CommAiTaskKind.WRITE_EMAIL, CommAiTaskKind.WRITE_SMS, CommAiTaskKind.IMPROVE_TONE, CommAiTaskKind.TRANSLATE] as const;

export const AiGenerateSchema = z.object({
    task: z.enum(AI_TASKS),
    channel: z.nativeEnum(CommChannel).optional(),
    /** What the user wants ("announce the new support plan, friendly, 3 short paragraphs"). */
    prompt: z.string().max(4000).optional(),
    /** Current content the assistant should work from. */
    subject: z.string().max(300).optional(),
    body: z.string().max(50_000).optional(),
    tone: z.enum(['friendly', 'professional', 'formal', 'enthusiastic', 'concise']).optional(),
    language: z.string().max(40).optional(),
    campaign_id: z.string().uuid().optional(),
    template_id: z.string().uuid().optional(),
});
export type AiGenerateInput = z.infer<typeof AiGenerateSchema>;

export const AiFeedbackSchema = z.object({ accepted: z.boolean(), campaign_id: z.string().uuid().optional() });
export type AiFeedbackInput = z.infer<typeof AiFeedbackSchema>;

const SYSTEM = [
    'You are the writing assistant of a software agency\'s communication center (email and SMS to customers).',
    'Write clear, honest, human copy. Never invent prices, dates, discounts or facts that are not in the brief.',
    'Keep personalization variables exactly as written, e.g. {{first_name}}, {{company_name}}, {{unsubscribe_url}}.',
    'Answer ONLY with a JSON object, no Markdown fences, in the shape requested.',
].join(' ');

/** Parse the model answer: a JSON object, possibly wrapped in ``` fences. */
function parseJson(text: string): Record<string, unknown> | null {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);

/**
 * AI Communication Assistant (11 "AI Communication Assistant"): subject lines, email / SMS drafts, tone rewrite and
 * translation with the organization's OWN OpenAI connection (IntegrationConnection, BYOK). Without one every call
 * returns `available: false` with a message instead of failing. Every request is logged in CommAiGeneration.
 */
@Injectable()
export class CommAiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly ai: OrgAiService,
    ) { }

    async status(ctx: OrgContext) {
        const conn = await this.ai.connection(ctx.organization_id);
        return { configured: !!conn, model: conn?.model ?? null, message: conn ? null : 'Connect OpenAI in Admin → Integrations to use the writing assistant.' };
    }

    private brief(dto: AiGenerateInput) {
        const lines = [
            dto.prompt ? `Brief: ${dto.prompt}` : null,
            dto.subject ? `Current subject: ${dto.subject}` : null,
            dto.body ? `Current content:\n${dto.body}` : null,
            dto.tone ? `Tone: ${dto.tone}` : null,
            dto.language ? `Language: ${dto.language}` : 'Language: same as the brief or content',
        ];
        switch (dto.task) {
            case CommAiTaskKind.SUBJECT_LINES:
                lines.push('Task: suggest 5 different email subject lines (max 60 characters each) and one preheader. Shape: {"subject_lines": string[], "preheader": string}');
                break;
            case CommAiTaskKind.WRITE_EMAIL:
                lines.push('Task: write a marketing email. Use simple HTML (<p>, <h2>, <ul>, <a>, <strong>) without <html>/<body>/styles. Shape: {"subject": string, "preheader": string, "body_html": string}');
                break;
            case CommAiTaskKind.WRITE_SMS:
                lines.push('Task: write one SMS, max 300 characters, no links unless given. Shape: {"body_text": string}');
                break;
            case CommAiTaskKind.IMPROVE_TONE:
                lines.push(`Task: rewrite the current content in the requested tone, keep the meaning and the format (HTML stays HTML). Shape: {"subject": string | null, "body": string}`);
                break;
            case CommAiTaskKind.TRANSLATE:
                lines.push(`Task: translate the current subject and content into ${dto.language ?? 'English'}, keep HTML tags and {{variables}}. Shape: {"subject": string | null, "body": string}`);
                break;
        }
        return lines.filter(Boolean).join('\n\n');
    }

    private shape(task: AiGenerateInput['task'], json: Record<string, unknown>) {
        switch (task) {
            case CommAiTaskKind.SUBJECT_LINES:
                return { subject_lines: (Array.isArray(json.subject_lines) ? json.subject_lines : []).map((s) => str(s, 150)).filter((s): s is string => !!s).slice(0, 8), preheader: str(json.preheader, 300) };
            case CommAiTaskKind.WRITE_EMAIL:
                return { subject: str(json.subject, 300), preheader: str(json.preheader, 300), body_html: str(json.body_html, 100_000) };
            case CommAiTaskKind.WRITE_SMS:
                return { body_text: str(json.body_text, 1600) };
            default:
                return { subject: str(json.subject, 300), body: str(json.body, 100_000) };
        }
    }

    async generate(ctx: OrgContext, dto: AiGenerateInput) {
        if (dto.campaign_id && !(await this.prisma.campaign.findFirst({ where: { id: dto.campaign_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Campaign', 'campaign_not_found');
        if (dto.template_id && !(await this.prisma.commTemplate.findFirst({ where: { id: dto.template_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Template', 'template_not_found');
        const input = { subject: dto.subject ?? null, body: dto.body ? dto.body.slice(0, 20_000) : null, tone: dto.tone ?? null, language: dto.language ?? null, campaign_id: dto.campaign_id ?? null };
        const res = await this.ai.generateText(ctx.organization_id, { system: SYSTEM, prompt: this.brief(dto), temperature: dto.task === CommAiTaskKind.TRANSLATE ? 0.2 : 0.7, maxTokens: dto.task === CommAiTaskKind.WRITE_EMAIL ? 1500 : 700 });
        if (res.available === false) {
            return { available: false as const, reason: res.reason, message: res.reason === 'ai_not_configured' ? 'Connect OpenAI in Admin → Integrations to use the writing assistant. Your organization uses its own key.' : res.message };
        }
        const json = parseJson(res.text);
        if (!json) return { available: false as const, reason: 'ai_provider_error' as const, message: 'The AI answer could not be used. Try again or rephrase the brief.' };
        const output = this.shape(dto.task, json);
        const row = await this.prisma.commAiGeneration.create({
            data: {
                organization_id: ctx.organization_id,
                requested_by_membership_id: ctx.membership_id,
                task: dto.task,
                channel: dto.channel ?? null,
                prompt: dto.prompt ?? null,
                input: input as Prisma.InputJsonValue,
                output: output as Prisma.InputJsonValue,
                model: res.model,
                input_tokens: res.input_tokens,
                output_tokens: res.output_tokens,
                template_id: dto.template_id ?? null,
            },
        });
        await this.audit.record(ctx, 'communications.ai.generated', { resource_type: 'comm_ai_generation', resource_id: row.id, metadata: { task: dto.task, model: res.model, campaign_id: dto.campaign_id ?? null, tokens: (res.input_tokens ?? 0) + (res.output_tokens ?? 0) } });
        this.events.publish(ctx, { event_key: 'communications.ai.generated', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_ai_generation', entity_id: row.id, payload: { task: dto.task } });
        return { available: true as const, generation_id: row.id, task: dto.task, model: res.model, output };
    }

    /** The user kept (or discarded) a suggestion; kept campaign drafts link the generation to the campaign. */
    async feedback(ctx: OrgContext, id: string, dto: AiFeedbackInput) {
        const row = await this.prisma.commAiGeneration.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw notFound('AI generation', 'ai_generation_not_found');
        await this.prisma.commAiGeneration.update({ where: { id }, data: { accepted: dto.accepted } });
        if (dto.accepted && dto.campaign_id) {
            await this.prisma.campaign.updateMany({ where: { id: dto.campaign_id, organization_id: ctx.organization_id }, data: { ai_generation_id: id } });
        }
        this.audit.recordAsync(ctx, 'communications.ai.feedback', { resource_type: 'comm_ai_generation', resource_id: id, metadata: { accepted: dto.accepted, campaign_id: dto.campaign_id ?? null } });
        return { id, accepted: dto.accepted };
    }

    async history(ctx: OrgContext, limit = 20) {
        return this.prisma.commAiGeneration.findMany({
            where: { organization_id: ctx.organization_id, requested_by_membership_id: ctx.membership_id ?? undefined },
            orderBy: { created_at: 'desc' },
            take: Math.min(100, limit),
            select: { id: true, task: true, channel: true, prompt: true, output: true, model: true, accepted: true, created_at: true },
        });
    }
}
