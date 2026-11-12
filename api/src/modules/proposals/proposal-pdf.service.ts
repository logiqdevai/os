import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ProposalSectionType, ProposalVersionStatus, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { GeneratedPdfService, PdfFile } from '@/modules/pdf/generated-pdf.service';
import { PdfBlock } from '@/shared/utils/pdf/pdf-document.interfaces';
import { pdfDate, pdfFilename, pdfMoney, pdfNumber } from '@/shared/utils/pdf/pdf-format.utils';
import { ProposalsService } from './proposals.service';
import { computeTotals, num, renderVariables } from './utils/proposal.utils';
import { personName } from './utils/person-name.utils';

const TRIGGER_LABEL: Record<string, string> = {
    ON_ACCEPTANCE: 'On acceptance', ON_MILESTONE: 'On milestone', ON_DELIVERY: 'On delivery', ON_SIGNATURE: 'On signature', ON_DATE: 'On date', RECURRING: 'Recurring',
};

type VersionForPdf = Prisma.ProposalVersionGetPayload<{ include: { sections: true; line_items: true; payment_schedule: true } }>;

/**
 * 03 "Customer Delivery" — the proposal as a branded PDF. Customer-facing content only (internal sections never
 * render). Locked (sent) versions are immutable, so their PDF is generated once, stored in 17 Files
 * (ProposalVersion.pdf_document_id) and streamed from storage afterwards; drafts are rendered on demand.
 */
@Injectable()
export class ProposalPdfService {
    private readonly logger = new Logger(ProposalPdfService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly proposals: ProposalsService,
        private readonly pdf: GeneratedPdfService,
    ) { }

    private async render(proposalId: string, version: VersionForPdf) {
        const p = await this.prisma.proposal.findUniqueOrThrow({
            where: { id: proposalId },
            include: {
                company: { select: { name: true, legal_name: true } },
                contact: { select: { first_name: true, last_name: true, email: true } },
                owner: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
            },
        });
        const vars = (version.variables ?? {}) as Record<string, string>;
        const branding = await this.pdf.branding(p.organization_id);
        const acceptance = await this.prisma.proposalAcceptance.findFirst({ where: { proposal_id: p.id, version_id: version.id, decision: 'ACCEPTED' }, orderBy: { created_at: 'desc' } });
        const selected = acceptance?.selected_optional_item_ids ?? version.line_items.filter((l) => l.is_optional && l.selected_by_customer).map((l) => l.id);
        const totals = computeTotals(version.line_items.map((l) => ({
            quantity: num(l.quantity), unit_price: num(l.unit_price), discount_percent: num(l.discount_percent), discount_amount: num(l.discount_amount), tax_percent: num(l.tax_percent),
            is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, is_optional: l.is_optional, selected_by_customer: l.is_optional ? selected.includes(l.id) : null,
        })));
        const money = (v: unknown) => pdfMoney(v, p.currency);

        const pricingTable: PdfBlock[] = version.line_items.length
            ? [{
                kind: 'table',
                columns: [{ label: 'Item', width: 46 }, { label: 'Qty', width: 9, align: 'right' }, { label: 'Unit price', width: 16, align: 'right' }, { label: 'Tax', width: 9, align: 'right' }, { label: 'Total', width: 18, align: 'right' }],
                rows: version.line_items.map((l) => [
                    [l.group_name ? `${l.group_name} · ` : '', l.name, l.is_optional ? (selected.includes(l.id) ? ' (optional, selected)' : ' (optional)') : '', l.is_recurring ? ` · ${l.billing_frequency ?? 'monthly'}` : '', l.description ? `\n${l.description}` : ''].join(''),
                    `${pdfNumber(l.quantity, 3)}${l.unit ? ` ${l.unit}` : ''}`,
                    money(l.unit_price),
                    l.tax_percent !== null ? `${pdfNumber(l.tax_percent)}%` : '—',
                    money(l.gross_amount),
                ]),
                totals: [
                    ['Subtotal', money(totals.net_total + totals.discount_total)],
                    ...(totals.discount_total ? [['Discount', `-${money(totals.discount_total)}`] as [string, string]] : []),
                    ['Tax', money(totals.tax_total)],
                    ...(totals.recurring_monthly ? [['Recurring (monthly)', money(totals.recurring_monthly)] as [string, string]] : []),
                    ['Total', money(totals.gross_total)],
                ],
            }]
            : [];
        const scheduleTable: PdfBlock[] = version.payment_schedule.length
            ? [{
                kind: 'table',
                columns: [{ label: 'Payment', width: 34 }, { label: 'When', width: 34 }, { label: 'Amount', width: 22, align: 'right' }],
                rows: version.payment_schedule.map((s) => [
                    s.name,
                    [TRIGGER_LABEL[s.trigger] ?? s.trigger, s.milestone_name, s.due_date ? pdfDate(s.due_date) : null, s.frequency].filter(Boolean).join(' · '),
                    s.amount !== null ? money(s.amount) : s.percentage !== null ? `${pdfNumber(s.percentage)}% (${money((num(s.percentage) / 100) * totals.gross_total)})` : '—',
                ]),
            }]
            : [];

        const blocks: PdfBlock[] = [];
        let pricingPlaced = false;
        let schedulePlaced = false;
        for (const s of version.sections.filter((x) => !x.is_internal).sort((a, b) => a.sort_order - b.sort_order)) {
            if (s.type === ProposalSectionType.COVER) {
                const body = renderVariables(s.body, vars);
                if (body?.trim()) blocks.push({ kind: 'markdown', text: body.replace(/^#\s+.*$/m, '').trim() });
                continue;
            }
            blocks.push({ kind: 'heading', text: s.title });
            const body = renderVariables(s.body, vars);
            if (body?.trim()) blocks.push({ kind: 'markdown', text: body });
            if (s.type === ProposalSectionType.PRICING && !pricingPlaced) { blocks.push(...pricingTable); pricingPlaced = true; }
            if (s.type === ProposalSectionType.PAYMENT_SCHEDULE && !schedulePlaced) { blocks.push(...scheduleTable); schedulePlaced = true; }
        }
        if (!pricingPlaced && pricingTable.length) blocks.push({ kind: 'heading', text: 'Investment' }, ...pricingTable);
        if (!schedulePlaced && scheduleTable.length) blocks.push({ kind: 'heading', text: 'Payment schedule' }, ...scheduleTable);
        const terms = renderVariables(version.payment_terms, vars);
        if (terms?.trim()) blocks.push({ kind: 'heading', text: 'Payment terms', level: 2 }, { kind: 'markdown', text: terms });
        if (acceptance) {
            blocks.push(
                { kind: 'heading', text: 'Acceptance', level: 2 },
                { kind: 'key_values', rows: [['Accepted by', [acceptance.signer_name, acceptance.signer_title].filter(Boolean).join(', ')], ['Email', acceptance.signer_email], ['Date', pdfDate(acceptance.created_at)]] },
            );
        }

        const contact = p.contact ? `${p.contact.first_name} ${p.contact.last_name ?? ''}`.trim() : null;
        const buffer = await this.pdf.render({
            eyebrow: 'Proposal',
            title: p.title,
            subtitle: [p.company?.legal_name || p.company?.name, contact].filter(Boolean).length ? `Prepared for ${[p.company?.legal_name || p.company?.name, contact].filter(Boolean).join(' · ')}` : null,
            branding,
            meta: [
                ['Number', `${p.number} · v${version.version_number}`],
                ['Date', pdfDate(version.sent_at ?? version.created_at)],
                ...(p.valid_until ? [['Valid until', pdfDate(p.valid_until)] as [string, string]] : []),
                ...(p.owner?.user ? [['Prepared by', personName(p.owner.user)] as [string, string]] : []),
                ['Total', pdfMoney(totals.gross_total, p.currency)],
            ],
            blocks,
            subject: `Proposal ${p.number}`,
            keywords: [p.number, `v${version.version_number}`],
            created_at: version.sent_at ?? version.updated_at,
        });
        return { buffer, filename: pdfFilename(p.number, `v${version.version_number}`), proposal: p };
    }

    private loadVersion(proposalId: string, versionId: string) {
        return this.prisma.proposalVersion.findFirst({
            where: { id: versionId, proposal_id: proposalId },
            include: { sections: { orderBy: { sort_order: 'asc' } }, line_items: { orderBy: { sort_order: 'asc' } }, payment_schedule: { orderBy: { sort_order: 'asc' } } },
        });
    }

    /**
     * PDF of one version (default: current). Locked versions are stored once in 17 Files by the caller (or the proposal
     * owner when the caller cannot create documents) and streamed from storage afterwards.
     */
    async forVersion(ctx: OrgContext | null, organizationId: string, proposalId: string, versionId: string): Promise<PdfFile & { document_id: string | null }> {
        const version = await this.loadVersion(proposalId, versionId);
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });
        if (version.pdf_document_id) {
            try {
                return { ...(await this.pdf.streamStored(organizationId, version.pdf_document_id)), document_id: version.pdf_document_id };
            } catch {
                // The stored file is gone (deleted in Files): render again below.
            }
        }
        const { buffer, filename, proposal } = await this.render(proposalId, version);
        let documentId: string | null = null;
        if (version.status !== ProposalVersionStatus.DRAFT) {
            try {
                const storeCtx = await this.pdf.storageContext(ctx, organizationId, proposal.owner_membership_id);
                if (storeCtx) {
                    const doc = await this.pdf.store(storeCtx, {
                        buffer, filename, title: `Proposal ${proposal.number} v${version.version_number}`,
                        entity_type: RecordEntityType.PROPOSAL, entity_id: proposalId, source_module: ModuleKey.PROPOSALS, role: 'generated_pdf',
                        company_id: proposal.company_id, project_id: proposal.project_id,
                    });
                    documentId = doc.id;
                    await this.prisma.proposalVersion.update({ where: { id: version.id }, data: { pdf_document_id: doc.id } });
                    await this.audit.record(storeCtx, 'proposal.pdf_generated', { resource_type: 'proposal', resource_id: proposalId, metadata: { version_id: version.id, document_id: doc.id } });
                }
            } catch (error) {
                this.logger.warn(`proposal PDF not stored: ${(error as Error).message}`);
            }
        }
        return { ...this.pdf.fromBuffer(buffer, filename), document_id: documentId };
    }

    /** Staff download (scope-checked). */
    async download(ctx: OrgContext, proposalId: string, versionId?: string) {
        const p = await this.proposals.getRecord(ctx, proposalId);
        const vid = versionId ?? p.current_version_id;
        if (!vid) throw new NotFoundException({ message: 'This proposal has no version yet', code: 'proposal_version_not_found' });
        return this.forVersion(ctx, ctx.organization_id, proposalId, vid);
    }
}
