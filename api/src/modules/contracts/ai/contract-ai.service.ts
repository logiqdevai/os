import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
    ContractAiFindingKind, ContractAiFindingStatus, ContractObligationStatus, ContractObligationType, ContractRiskLevel, ExtractionReviewState, ModuleKey, Prisma,
} from 'generated/prisma';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { generateOrgAiObject, orgAiConfigured } from '@/integrations/ai/utils/org-ai-structured.utils';
import { ContractsService } from '../contracts/contracts.service';
import { CONFIDENTIAL_READ, MEMBER_SELECT } from '../shared/contracts.utils';

export const FindingQuerySchema = z.object({
    status: z.nativeEnum(ContractAiFindingStatus).optional(),
    severity: z.nativeEnum(ContractRiskLevel).optional(),
    kind: z.nativeEnum(ContractAiFindingKind).optional(),
});
export type FindingQuery = z.infer<typeof FindingQuerySchema>;

export const DecideFindingSchema = z.object({
    status: z.enum([ContractAiFindingStatus.ACCEPTED, ContractAiFindingStatus.DISMISSED]),
    resolution_note: z.string().trim().max(2000).optional(),
});
export type DecideFindingDto = z.infer<typeof DecideFindingSchema>;

export const ReviewExtractionSchema = z.object({
    decision: z.enum(['CONFIRM', 'REJECT']),
    /** Corrections made by the reviewer before confirming. */
    title: z.string().min(1).max(200).optional(),
    type: z.nativeEnum(ContractObligationType).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    frequency: z.enum(['none', 'weekly', 'monthly', 'quarterly', 'annual']).nullish(),
    responsible_membership_id: z.string().uuid().nullish(),
});
export type ReviewExtractionDto = z.infer<typeof ReviewExtractionSchema>;

const ReviewOutputSchema = z.object({
    findings: z.array(z.object({
        section_key: z.string().nullable().describe('Key of the section the finding points at, or null for missing clauses'),
        kind: z.nativeEnum(ContractAiFindingKind),
        severity: z.nativeEnum(ContractRiskLevel),
        message: z.string().max(500),
        recommendation: z.string().max(1000),
        confidence: z.number().min(0).max(1),
    })).max(25),
    risk: z.object({
        score: z.number().int().min(0).max(100),
        level: z.nativeEnum(ContractRiskLevel),
        factors: z.array(z.object({ factor: z.string().max(120), points: z.number().int().min(0).max(100), note: z.string().max(300) })).max(10),
    }),
});

const ExtractOutputSchema = z.object({
    obligations: z.array(z.object({
        section_key: z.string().nullable(),
        type: z.nativeEnum(ContractObligationType),
        title: z.string().max(200),
        description: z.string().max(1000),
        responsible_side: z.enum(['AGENCY', 'CUSTOMER', 'BOTH', 'UNKNOWN']),
        due_date: z.string().nullable().describe('YYYY-MM-DD when the text gives a date, else null'),
        frequency: z.enum(['none', 'weekly', 'monthly', 'quarterly', 'annual']),
        confidence: z.number().min(0).max(1),
    })).max(40),
});

const DISCLAIMER = 'AI-generated recommendation, not legal advice.';

/**
 * 04 §72–75 — AI contract review (ContractAiFinding rows pointing at sections + an explainable risk score) and
 * obligation extraction (ContractObligation suggestions, is_ai_extracted, review_state PENDING_REVIEW). Runs on the
 * organization's own OpenAI key (BYOK). AI never edits contract text and nothing operational starts from an
 * unreviewed extraction: humans accept/dismiss findings and confirm/reject obligations. Every step is audited.
 */
@Injectable()
export class ContractAiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly contracts: ContractsService,
    ) { }

    async status(ctx: OrgContext) {
        return { configured: await orgAiConfigured(this.prisma, ctx.organization_id) };
    }

    private async loadVersion(ctx: OrgContext, contractId: string, versionId: string) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const version = await this.prisma.contractVersion.findFirst({ where: { id: versionId, contract_id: contractId }, include: { sections: { orderBy: { sort_order: 'asc' } } } });
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        if (!version.sections.some((s) => s.body?.trim())) throw new BadRequestException({ message: 'This version has no text to analyse', code: 'contract_version_empty' });
        return { contract, version };
    }

    private documentText(sections: { key: string; title: string; body: string | null }[]) {
        return sections.map((s) => `[section_key: ${s.key}] ${s.title}\n${(s.body ?? '').slice(0, 12_000)}`).join('\n\n').slice(0, 120_000);
    }

    async review(ctx: OrgContext, contractId: string, versionId: string) {
        const { contract, version } = await this.loadVersion(ctx, contractId, versionId);
        const [type, standardClauses] = await Promise.all([
            contract.type_id ? this.prisma.contractType.findUnique({ where: { id: contract.type_id }, select: { name: true } }) : null,
            this.prisma.contractClause.findMany({ where: { organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { name: true, category: true }, take: 40 }),
        ]);
        const runId = randomUUID();
        const system = [
            'You are a careful contract reviewer for a software and digital agency. Review the contract from the agency\'s point of view.',
            'Flag: missing clauses, conflicting dates, unusual payment terms, liability differences, termination differences, scope inconsistencies, renewal provisions and non-standard clauses.',
            'Each finding must point to the section_key it concerns (null only for a missing clause), quote no more than a short phrase, and give a practical recommendation.',
            'Also give an explainable risk score 0–100 with the factors that add points (type, liability, payment terms, duration, termination rights, privacy, non-standard clauses).',
            'You never rewrite the contract. Your output is a recommendation, not legal advice.',
        ].join(' ');
        const prompt = [
            `Contract: ${contract.title} (${contract.number})${type ? `, type ${type.name}` : ''}`,
            contract.processes_personal_data ? 'The contract involves processing personal data.' : '',
            standardClauses.length ? `The organization's approved standard clauses: ${standardClauses.map((c) => `${c.name} (${c.category})`).join('; ')}` : '',
            `\n--- Contract text (version ${version.label}) ---\n${this.documentText(version.sections)}`,
        ].filter(Boolean).join('\n');
        const result = await generateOrgAiObject(this.prisma, ctx.organization_id, { schema: ReviewOutputSchema, system, prompt, temperature: 0.1, maxTokens: 6000 });
        if (result.available === false) {
            await this.audit.record(ctx, 'contract.ai_review_failed', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, reason: result.reason } });
            return { available: false as const, reason: result.reason, message: result.message };
        }
        const byKey = new Map(version.sections.map((s) => [s.key, s.id]));
        const rows = result.object.findings.map((f) => ({
            version_id: versionId, section_id: f.section_key ? byKey.get(f.section_key) ?? null : null, kind: f.kind, severity: f.severity,
            message: f.message, recommendation: f.recommendation, model: result.model, review_run_id: runId, confidence: new Prisma.Decimal(Math.round(f.confidence * 10_000) / 10_000),
        }));
        await this.prisma.$transaction(async (tx) => {
            // A new run replaces the previous run's still-open findings of this version (handled ones stay for traceability).
            await tx.contractAiFinding.deleteMany({ where: { version_id: versionId, status: ContractAiFindingStatus.OPEN } });
            if (rows.length) await tx.contractAiFinding.createMany({ data: rows });
            await tx.contract.update({
                where: { id: contractId },
                data: { risk_score: result.object.risk.score, risk_level: result.object.risk.level, risk_factors: { source: 'ai_review', run_id: runId, model: result.model, version_id: versionId, factors: result.object.risk.factors, disclaimer: DISCLAIMER } as Prisma.InputJsonValue },
            });
        });
        await this.audit.record(ctx, 'contract.ai_review_run', {
            resource_type: 'contract', resource_id: contractId,
            metadata: { version_id: versionId, run_id: runId, model: result.model, findings: rows.length, risk_level: result.object.risk.level, tokens: { in: result.input_tokens, out: result.output_tokens } },
        });
        this.events.publish(ctx, {
            event_key: 'contracts.ai_review.completed', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId,
            payload: { number: contract.number, title: contract.title, version_id: versionId, findings: rows.length, high: rows.filter((r) => r.severity === 'HIGH' || r.severity === 'CRITICAL').length },
        });
        return { available: true as const, run_id: runId, model: result.model, disclaimer: DISCLAIMER, findings: await this.findings(ctx, contractId, versionId, {}), risk: ctx.can(CONFIDENTIAL_READ) ? result.object.risk : null };
    }

    async findings(ctx: OrgContext, contractId: string, versionId: string, q: FindingQuery) {
        await this.contracts.assertContract(ctx, contractId);
        const rows = await this.prisma.contractAiFinding.findMany({
            where: { version_id: versionId, version: { contract_id: contractId }, ...(q.status && { status: q.status }), ...(q.severity && { severity: q.severity }), ...(q.kind && { kind: q.kind }) },
            orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
            include: { section: { select: { id: true, key: true, title: true } }, reviewed_by: { select: MEMBER_SELECT } },
        });
        const rank: Record<ContractRiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return rows.sort((a, b) => (a.status === b.status ? rank[a.severity] - rank[b.severity] : 0)).map((f) => ({ ...f, confidence: f.confidence === null ? null : Number(f.confidence), disclaimer: DISCLAIMER }));
    }

    async decideFinding(ctx: OrgContext, contractId: string, findingId: string, dto: DecideFindingDto) {
        await this.contracts.assertContract(ctx, contractId);
        const f = await this.prisma.contractAiFinding.findFirst({ where: { id: findingId, version: { contract_id: contractId } } });
        if (!f) throw new NotFoundException({ message: 'Finding not found', code: 'finding_not_found' });
        if (dto.status === ContractAiFindingStatus.DISMISSED && !dto.resolution_note?.trim()) throw new BadRequestException({ message: 'Add a note explaining why the finding is dismissed', code: 'resolution_note_required' });
        const updated = await this.prisma.contractAiFinding.update({
            where: { id: findingId },
            data: { status: dto.status, resolution_note: dto.resolution_note ?? null, reviewed_by_membership_id: ctx.membership_id, reviewed_at: new Date() },
        });
        await this.audit.record(ctx, dto.status === ContractAiFindingStatus.ACCEPTED ? 'contract.ai_finding_accepted' : 'contract.ai_finding_dismissed', {
            resource_type: 'contract', resource_id: contractId, metadata: { finding_id: findingId, kind: f.kind, severity: f.severity, before: { status: f.status }, after: { status: dto.status, resolution_note: dto.resolution_note ?? null } },
        });
        return updated;
    }

    async extractObligations(ctx: OrgContext, contractId: string, versionId: string) {
        const { contract, version } = await this.loadVersion(ctx, contractId, versionId);
        const runId = randomUUID();
        const parties = await this.prisma.contractParty.findMany({ where: { contract_id: contractId }, select: { id: true, party_type: true, legal_name: true } });
        const system = [
            'You extract contractual obligations from an agreement for an agency\'s obligation tracker.',
            'An obligation is something a party must do or deliver (deliverables, payments, reporting, renewal notices, SLAs, security reviews, customer approvals).',
            'For each, give the section_key it comes from, a short imperative title, the responsible side, the due date only when the text states one (YYYY-MM-DD), the frequency and your confidence.',
            'Do not invent obligations that are not in the text.',
        ].join(' ');
        const prompt = [
            `Contract: ${contract.title} (${contract.number}). Start ${contract.start_date?.toISOString().slice(0, 10) ?? 'unknown'}, end ${contract.end_date?.toISOString().slice(0, 10) ?? 'unknown'}.`,
            parties.length ? `Parties: ${parties.map((p) => `${p.party_type} = ${p.legal_name}`).join('; ')}` : '',
            `\n--- Contract text (version ${version.label}) ---\n${this.documentText(version.sections)}`,
        ].filter(Boolean).join('\n');
        const result = await generateOrgAiObject(this.prisma, ctx.organization_id, { schema: ExtractOutputSchema, system, prompt, temperature: 0.1, maxTokens: 6000 });
        if (result.available === false) {
            await this.audit.record(ctx, 'contract.ai_extraction_failed', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, reason: result.reason } });
            return { available: false as const, reason: result.reason, message: result.message };
        }
        const byKey = new Map(version.sections.map((s) => [s.key, s.id]));
        const partyOf = (side: string) => parties.find((p) => p.party_type === side)?.id ?? null;
        const data: Prisma.ContractObligationCreateManyInput[] = result.object.obligations.map((o) => ({
            contract_id: contractId, section_id: o.section_key ? byKey.get(o.section_key) ?? null : null, type: o.type, title: o.title, description: o.description || null,
            responsible_party_id: o.responsible_side === 'AGENCY' || o.responsible_side === 'CUSTOMER' ? partyOf(o.responsible_side) : null,
            due_date: o.due_date && /^\d{4}-\d{2}-\d{2}$/.test(o.due_date) ? new Date(o.due_date) : null,
            frequency: o.frequency === 'none' ? null : o.frequency, status: ContractObligationStatus.OPEN,
            is_ai_extracted: true, extraction_confidence: new Prisma.Decimal(Math.round(o.confidence * 10_000) / 10_000), review_state: ExtractionReviewState.PENDING_REVIEW,
        }));
        await this.prisma.$transaction(async (tx) => {
            // Re-running replaces the previous unreviewed suggestions; confirmed and rejected rows stay.
            await tx.contractObligation.deleteMany({ where: { contract_id: contractId, is_ai_extracted: true, review_state: ExtractionReviewState.PENDING_REVIEW } });
            if (data.length) await tx.contractObligation.createMany({ data });
        });
        await this.audit.record(ctx, 'contract.ai_obligations_extracted', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, run_id: runId, model: result.model, suggestions: data.length, tokens: { in: result.input_tokens, out: result.output_tokens } } });
        this.events.publish(ctx, {
            event_key: 'contracts.ai_extraction.completed', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId,
            payload: { number: contract.number, version_id: versionId, suggestions: data.length, owner_membership_id: contract.owner_membership_id },
        });
        return { available: true as const, run_id: runId, model: result.model, disclaimer: DISCLAIMER, suggestions: await this.suggestions(ctx, contractId) };
    }

    async suggestions(ctx: OrgContext, contractId: string) {
        await this.contracts.assertContract(ctx, contractId);
        const rows = await this.prisma.contractObligation.findMany({
            where: { contract_id: contractId, is_ai_extracted: true, review_state: ExtractionReviewState.PENDING_REVIEW },
            orderBy: [{ extraction_confidence: 'desc' }, { created_at: 'asc' }],
            include: { section: { select: { id: true, key: true, title: true, body: true } } },
        });
        return rows.map((o) => ({ ...o, extraction_confidence: o.extraction_confidence === null ? null : Number(o.extraction_confidence) }));
    }

    async reviewExtraction(ctx: OrgContext, contractId: string, obligationId: string, dto: ReviewExtractionDto) {
        await this.contracts.assertContract(ctx, contractId);
        const o = await this.prisma.contractObligation.findFirst({ where: { id: obligationId, contract_id: contractId, is_ai_extracted: true } });
        if (!o) throw new NotFoundException({ message: 'Suggestion not found', code: 'obligation_not_found' });
        if (o.review_state !== ExtractionReviewState.PENDING_REVIEW) throw new ConflictException({ message: 'This suggestion was already reviewed', code: 'extraction_already_reviewed' });
        if (dto.responsible_membership_id && !(await this.prisma.membership.findFirst({ where: { id: dto.responsible_membership_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        const confirm = dto.decision === 'CONFIRM';
        const updated = await this.prisma.contractObligation.update({
            where: { id: obligationId },
            data: confirm
                ? {
                    review_state: ExtractionReviewState.CONFIRMED,
                    ...(dto.title && { title: dto.title }), ...(dto.type && { type: dto.type }),
                    ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
                    ...(dto.frequency !== undefined && { frequency: dto.frequency === 'none' ? null : dto.frequency }),
                    ...(dto.responsible_membership_id !== undefined && { responsible_membership_id: dto.responsible_membership_id }),
                }
                : { review_state: ExtractionReviewState.REJECTED, status: ContractObligationStatus.CANCELLED },
        });
        await this.audit.record(ctx, confirm ? 'contract.ai_obligation_confirmed' : 'contract.ai_obligation_rejected', {
            resource_type: 'contract', resource_id: contractId,
            metadata: { obligation_id: obligationId, before: { title: o.title, type: o.type, due_date: o.due_date, frequency: o.frequency }, after: confirm ? { title: updated.title, type: updated.type, due_date: updated.due_date, frequency: updated.frequency, responsible_membership_id: updated.responsible_membership_id } : null },
        });
        if (confirm) {
            this.events.publish(ctx, {
                event_key: 'contracts.obligation.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract_obligation', entity_id: obligationId,
                payload: { contract_id: contractId, title: updated.title, due_date: updated.due_date, source: 'ai_extraction', assignee_membership_ids: updated.responsible_membership_id ? [updated.responsible_membership_id] : [] },
            });
        }
        return updated;
    }
}
