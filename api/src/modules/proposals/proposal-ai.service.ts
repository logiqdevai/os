import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ProposalSectionType, ProposalVersionStatus, RecordEntityType } from 'generated/prisma';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { generateOrgAiObject, orgAiConfigured } from '@/integrations/ai/utils/org-ai-structured.utils';
import { CLOSED_STATUSES, ProposalsService } from './proposals.service';
import { num } from './utils/proposal.utils';

export const AI_GENERATE = 'proposals.ai.generate';
const UPDATE = 'proposals.proposals.update';

const SECTION_TYPES = Object.values(ProposalSectionType).filter((t) => t !== ProposalSectionType.PRICING && t !== ProposalSectionType.PAYMENT_SCHEDULE && t !== ProposalSectionType.SIGNATURE);

export const AiGenerateProposalSchema = z.object({
    /** CRM deal to read (defaults to the proposal's deal). */
    deal_id: z.string().uuid().optional(),
    /** Free notes from the user (meeting notes, requirements). Sent to the organization's AI provider. */
    notes: z.string().max(20_000).optional(),
    /** Include the deal's non-private CRM notes and recent activities. */
    include_crm_notes: z.boolean().optional().default(true),
    sections: z.array(z.nativeEnum(ProposalSectionType)).max(15).optional(),
    include_line_items: z.boolean().optional().default(true),
    tone: z.enum(['professional', 'friendly', 'concise', 'formal']).optional().default('professional'),
    language: z.string().max(10).optional(),
});
export type AiGenerateProposalDto = z.infer<typeof AiGenerateProposalSchema>;

const DraftSectionSchema = z.object({
    type: z.nativeEnum(ProposalSectionType),
    title: z.string().min(1).max(200),
    body: z.string().max(20_000),
});
const DraftLineSchema = z.object({
    name: z.string().min(1).max(300),
    description: z.string().max(2000).nullish(),
    quantity: z.number().min(0).max(1_000_000),
    unit: z.string().max(30).nullish(),
    unit_price: z.number().min(0).max(100_000_000),
    is_optional: z.boolean().optional(),
    is_recurring: z.boolean().optional(),
    billing_frequency: z.enum(['monthly', 'quarterly', 'annual']).nullish(),
});
const ModelOutputSchema = z.object({
    sections: z.array(DraftSectionSchema).max(15),
    line_items: z.array(DraftLineSchema).max(50),
    assumptions: z.array(z.string().max(500)).max(10).describe('Facts the model assumed because the sources did not say'),
});

export const AiApplyProposalSchema = z.object({
    version_id: z.string().uuid(),
    run_id: z.string().uuid(),
    /** append: add the drafted sections/lines after the existing ones; replace: replace sections and/or lines. */
    mode: z.enum(['append', 'replace']).default('append'),
    sections: z.array(DraftSectionSchema).max(15).default([]),
    line_items: z.array(DraftLineSchema).max(50).default([]),
});
export type AiApplyProposalDto = z.infer<typeof AiApplyProposalSchema>;

/**
 * 03 "AI Proposal Generation" — drafts sections and line items from a CRM deal, its notes and the user's notes,
 * on the organization's own OpenAI key (BYOK). Generation returns a DRAFT only (nothing is written); a human reviews
 * and applies it to a DRAFT version (proposals.proposals.update), which marks the content `is_ai_generated` and
 * stores the run in ProposalVersion.ai_metadata. AI output is never sent to a customer automatically.
 */
@Injectable()
export class ProposalAiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly proposals: ProposalsService,
    ) { }

    async status(ctx: OrgContext) {
        return { configured: await orgAiConfigured(this.prisma, ctx.organization_id), can_generate: ctx.can(AI_GENERATE) };
    }

    async generate(ctx: OrgContext, proposalId: string, dto: AiGenerateProposalDto) {
        const p = await this.proposals.getRecord(ctx, proposalId);
        const [company, contact, org] = await Promise.all([
            p.company_id ? this.prisma.crmCompany.findFirst({ where: { id: p.company_id, organization_id: ctx.organization_id }, select: { name: true, industry: true, website: true } }) : null,
            p.contact_id ? this.prisma.crmContact.findFirst({ where: { id: p.contact_id, organization_id: ctx.organization_id }, select: { first_name: true, last_name: true, job_title: true } }) : null,
            this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { display_name: true, default_currency: true } }),
        ]);
        const dealId = dto.deal_id ?? p.deal_id;
        const sources: string[] = [];
        let dealText = '';
        if (dealId) {
            if (!ctx.can('crm.deals.read')) throw new ForbiddenException({ message: 'Reading the deal needs crm.deals.read', code: 'permission_denied', permissions: ['crm.deals.read'] });
            const deal = await this.prisma.crmDeal.findFirst({
                where: { id: dealId, organization_id: ctx.organization_id },
                include: { line_items: { orderBy: { sort_order: 'asc' } } },
            });
            if (!deal) throw new NotFoundException({ message: 'Deal not found', code: 'reference_not_found' });
            const financials = ctx.can('crm.financials.read');
            sources.push(`deal:${deal.id}`);
            dealText = [
                `Deal: ${deal.name}${deal.deal_type ? ` (${deal.deal_type})` : ''}`,
                deal.description ? `Description: ${deal.description}` : '',
                deal.next_step ? `Next step: ${deal.next_step}` : '',
                financials ? `Value: ${num(deal.value)} ${deal.currency} (one-time ${num(deal.one_time_value)}, recurring ${num(deal.recurring_value)})` : '',
                deal.line_items.length ? `Deal products:\n${deal.line_items.map((l) => `- ${l.name}${l.description ? `: ${l.description}` : ''} · qty ${num(l.quantity)}${financials ? ` × ${num(l.unit_price)}` : ''}${l.is_recurring ? ` (${l.billing_frequency ?? 'monthly'})` : ''}`).join('\n')}` : '',
            ].filter(Boolean).join('\n');
            if (dto.include_crm_notes) {
                const [notes, activities] = await Promise.all([
                    this.prisma.crmNote.findMany({
                        where: { organization_id: ctx.organization_id, entity_type: RecordEntityType.CRM_DEAL, entity_id: deal.id, OR: [{ is_private: false }, { author_membership_id: ctx.membership_id ?? '—' }] },
                        orderBy: { created_at: 'desc' }, take: 15, select: { body: true, created_at: true },
                    }),
                    this.prisma.crmActivity.findMany({ where: { organization_id: ctx.organization_id, deal_id: deal.id }, orderBy: { created_at: 'desc' }, take: 15, select: { type: true, title: true, description: true } }),
                ]);
                if (notes.length) { dealText += `\nCRM notes:\n${notes.map((n) => `- ${n.body.slice(0, 1500)}`).join('\n')}`; sources.push(`crm_notes:${notes.length}`); }
                if (activities.length) { dealText += `\nActivities:\n${activities.map((a) => `- ${a.type}: ${a.title}${a.description ? ` — ${a.description.slice(0, 500)}` : ''}`).join('\n')}`; sources.push(`crm_activities:${activities.length}`); }
            }
        }
        if (dto.notes?.trim()) sources.push('user_notes');
        if (!dealText && !dto.notes?.trim()) throw new BadRequestException({ message: 'Pick a deal or add notes for the AI to work from', code: 'ai_no_sources' });

        const wanted = dto.sections?.length ? dto.sections.filter((s) => (SECTION_TYPES as string[]).includes(s)) : [ProposalSectionType.EXECUTIVE_SUMMARY, ProposalSectionType.SCOPE, ProposalSectionType.DELIVERABLES, ProposalSectionType.TIMELINE, ProposalSectionType.ASSUMPTIONS, ProposalSectionType.EXCLUSIONS];
        const language = dto.language ?? p.language ?? 'en';
        const system = [
            `You draft commercial proposals for ${org.display_name}, a software and digital agency.`,
            `Write in language "${language}", ${dto.tone} tone, Markdown bodies (short paragraphs, bullet lists, no tables, no H1).`,
            'Use only facts from the sources. When something is unknown, keep it generic and list it under assumptions. Never invent customer names, prices or dates that are not in the sources.',
            `Line item prices are in ${p.currency}; reuse deal product prices when given, otherwise propose reasonable estimates and mention that in assumptions.`,
            'Return only the requested section types.',
        ].join(' ');
        const prompt = [
            `Proposal title: ${p.title}`,
            company ? `Customer: ${company.name}${company.industry ? ` (${company.industry})` : ''}` : '',
            contact ? `Contact: ${contact.first_name} ${contact.last_name ?? ''}${contact.job_title ? `, ${contact.job_title}` : ''}` : '',
            `Sections to write (type codes): ${wanted.join(', ')}`,
            dto.include_line_items ? 'Also propose line items (name, description, quantity, unit, unit_price, optional/recurring flags).' : 'Do not propose line items (return an empty list).',
            dealText ? `\n--- CRM deal ---\n${dealText}` : '',
            dto.notes?.trim() ? `\n--- Notes from the user ---\n${dto.notes.trim()}` : '',
        ].filter(Boolean).join('\n');

        const runId = randomUUID();
        const result = await generateOrgAiObject(this.prisma, ctx.organization_id, { schema: ModelOutputSchema, system, prompt, temperature: 0.4 });
        await this.audit.record(ctx, 'proposal.ai_generated', {
            resource_type: 'proposal', resource_id: proposalId,
            metadata: { run_id: runId, available: result.available, model: result.available ? result.model : null, sources, sections: wanted, prompt_hash: createHash('sha256').update(prompt).digest('hex').slice(0, 16), tokens: result.available ? { in: result.input_tokens, out: result.output_tokens } : null, reason: result.available === false ? result.reason : null },
        });
        if (result.available === false) return { available: false as const, reason: result.reason, message: result.message };
        const sections = result.object.sections.filter((s) => wanted.includes(s.type));
        return {
            available: true as const,
            run_id: runId,
            model: result.model,
            sources,
            draft: { sections, line_items: dto.include_line_items ? result.object.line_items : [], assumptions: result.object.assumptions },
            usage: { input_tokens: result.input_tokens, output_tokens: result.output_tokens, cost: result.cost },
        };
    }

    /** A human applies (an edited copy of) the draft to a DRAFT version. */
    async apply(ctx: OrgContext, proposalId: string, dto: AiApplyProposalDto) {
        if (!ctx.can(UPDATE)) throw new ForbiddenException({ message: 'Applying a draft needs proposals.proposals.update', code: 'permission_denied', permissions: [UPDATE] });
        const p = await this.proposals.getRecord(ctx, proposalId, UPDATE);
        if (CLOSED_STATUSES.includes(p.status)) throw new ConflictException({ message: 'This proposal is closed', code: 'proposal_closed' });
        const version = await this.prisma.proposalVersion.findFirst({
            where: { id: dto.version_id, proposal_id: proposalId },
            include: { sections: { orderBy: { sort_order: 'asc' } }, line_items: { orderBy: { sort_order: 'asc' } } },
        });
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });
        if (version.status !== ProposalVersionStatus.DRAFT) throw new ConflictException({ message: 'Only a draft version can receive AI content. Create a revision first.', code: 'proposal_version_locked' });
        if (!dto.sections.length && !dto.line_items.length) throw new BadRequestException({ message: 'Nothing to apply', code: 'ai_nothing_to_apply' });

        const existingSections = version.sections.map((s) => ({ id: s.id, type: s.type, title: s.title, body: s.body, is_internal: s.is_internal, is_ai_generated: s.is_ai_generated }));
        const newSections = dto.sections.map((s) => ({ type: s.type, title: s.title, body: s.body, is_internal: false, is_ai_generated: true }));
        const existingLines = version.line_items.map((l) => ({
            product_id: l.product_id, group_name: l.group_name, name: l.name, description: l.description, quantity: num(l.quantity), unit: l.unit, unit_price: num(l.unit_price),
            discount_percent: l.discount_percent === null ? null : num(l.discount_percent), discount_amount: num(l.discount_amount), tax_percent: l.tax_percent === null ? null : num(l.tax_percent),
            is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, is_optional: l.is_optional,
        }));
        const newLines = dto.line_items.map((l) => ({ name: l.name, description: l.description ?? null, quantity: l.quantity, unit: l.unit ?? null, unit_price: l.unit_price, is_optional: l.is_optional ?? false, is_recurring: l.is_recurring ?? false, billing_frequency: l.is_recurring ? (l.billing_frequency ?? 'monthly') : null }));
        const content = {
            ...(dto.sections.length && { sections: dto.mode === 'replace' ? newSections : [...existingSections, ...newSections] }),
            ...(dto.line_items.length && { line_items: dto.mode === 'replace' ? newLines : [...existingLines, ...newLines] }),
        };
        const result = await this.proposals.saveContent(ctx, proposalId, version.id, content as Parameters<ProposalsService['saveContent']>[3]);
        const meta = (version.ai_metadata ?? {}) as { runs?: unknown[] };
        await this.prisma.proposalVersion.update({
            where: { id: version.id },
            data: { is_ai_generated: true, ai_metadata: { ...meta, runs: [...(meta.runs ?? []), { run_id: dto.run_id, applied_at: new Date().toISOString(), applied_by_membership_id: ctx.membership_id, mode: dto.mode, sections: dto.sections.length, line_items: dto.line_items.length }].slice(-20) } as Prisma.InputJsonValue },
        });
        await this.audit.record(ctx, 'proposal.ai_draft_applied', { resource_type: 'proposal', resource_id: proposalId, metadata: { run_id: dto.run_id, version_id: version.id, mode: dto.mode, sections: dto.sections.map((s) => s.type), line_items: dto.line_items.length } });
        this.events.publish(ctx, {
            event_key: 'proposals.proposal.ai_draft_applied', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: proposalId,
            payload: { number: p.number, version_id: version.id, sections: dto.sections.length, line_items: dto.line_items.length },
        });
        return result;
    }
}
