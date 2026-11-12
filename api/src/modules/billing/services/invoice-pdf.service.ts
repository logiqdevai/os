import { Injectable, Logger } from '@nestjs/common';
import { InvoiceStatus, ModuleKey, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { GeneratedPdfService, PdfFile } from '@/modules/pdf/generated-pdf.service';
import { PdfBlock } from '@/shared/utils/pdf/pdf-document.interfaces';
import { pdfDate, pdfFilename, pdfMoney, pdfNumber } from '@/shared/utils/pdf/pdf-format.utils';
import { InvoicesService } from './invoices.service';

const STATUS_LABEL: Partial<Record<InvoiceStatus, string>> = { DRAFT: 'Draft', PAID: 'Paid', PARTIALLY_PAID: 'Partially paid', OVERDUE: 'Overdue', VOID: 'Void', CANCELLED: 'Cancelled', REFUNDED: 'Refunded' };

const addressText = (a: unknown) => {
    if (!a) return null;
    if (typeof a === 'string') return a;
    if (typeof a !== 'object' || Array.isArray(a)) return null;
    return Object.values(a as Record<string, unknown>).filter((v) => typeof v === 'string' && v).join(', ') || null;
};

/**
 * 08 "Invoicing" — the invoice as a branded PDF (same data as the print view). Finalized invoices are stored once in
 * 17 Files (Invoice.pdf_document_id) and streamed afterwards; drafts render on demand with a DRAFT label.
 */
@Injectable()
export class InvoicePdfService {
    private readonly logger = new Logger(InvoicePdfService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly invoices: InvoicesService,
        private readonly pdf: GeneratedPdfService,
    ) { }

    async download(ctx: OrgContext, id: string): Promise<PdfFile> {
        const inv = await this.invoices.findOne(ctx, id);
        if (inv.pdf_document_id && inv.status !== InvoiceStatus.DRAFT) {
            try { return await this.pdf.streamStored(ctx.organization_id, inv.pdf_document_id); } catch { /* render again */ }
        }
        const money = (v: unknown) => pdfMoney(v, inv.currency);
        const bp = inv.billing_profile;
        const blocks: PdfBlock[] = [
            { kind: 'heading', text: 'Bill to', level: 3 },
            { kind: 'paragraph', text: [bp?.legal_name ?? inv.company.name, addressText(bp?.billing_address), bp?.vat_number ? `VAT ${bp.vat_number}` : null, bp?.tax_id ? `Tax id ${bp.tax_id}` : null, bp?.billing_email].filter(Boolean).join('\n') },
            { kind: 'spacer', height: 6 },
            {
                kind: 'table',
                columns: [{ label: 'Description', width: 48 }, { label: 'Qty', width: 10, align: 'right' }, { label: 'Unit price', width: 16, align: 'right' }, { label: 'Tax', width: 9, align: 'right' }, { label: 'Amount', width: 17, align: 'right' }],
                rows: inv.line_items.map((l) => [
                    [l.description, l.period_start && l.period_end ? `\n${pdfDate(l.period_start)} – ${pdfDate(l.period_end)}` : ''].join(''),
                    `${pdfNumber(l.quantity, 3)}${l.unit ? ` ${l.unit}` : ''}`,
                    money(l.unit_amount),
                    l.tax_percent !== null ? `${pdfNumber(l.tax_percent)}%` : '—',
                    money(l.net_amount),
                ]),
                totals: [
                    ['Subtotal', money(inv.subtotal)],
                    ...(Number(inv.discount_total) ? [['Discount', `-${money(inv.discount_total)}`] as [string, string]] : []),
                    ['Tax', money(inv.tax_total)],
                    ...(Number(inv.amount_paid) ? [['Paid', `-${money(inv.amount_paid)}`] as [string, string]] : []),
                    ...(Number(inv.amount_paid) ? [['Amount due', money(inv.amount_due)] as [string, string]] : [['Total', money(inv.total)] as [string, string]]),
                ],
            },
        ];
        const taxNotes = [...new Set(inv.line_items.map((l) => l.tax_rate?.invoice_note).filter(Boolean))] as string[];
        if (bp?.reverse_charge) taxNotes.push('Reverse charge: VAT to be accounted for by the recipient.');
        if (taxNotes.length) blocks.push({ kind: 'paragraph', text: taxNotes.join('\n'), size: 9, muted: true });
        if (inv.payment_instructions?.trim()) blocks.push({ kind: 'heading', text: 'How to pay', level: 3 }, { kind: 'markdown', text: inv.payment_instructions });
        if (inv.hosted_invoice_url) blocks.push({ kind: 'paragraph', text: `Pay online: ${inv.hosted_invoice_url}`, size: 9.5 });
        if (inv.notes?.trim()) blocks.push({ kind: 'heading', text: 'Notes', level: 3 }, { kind: 'markdown', text: inv.notes });
        if (inv.footer?.trim()) blocks.push({ kind: 'paragraph', text: inv.footer, size: 9, muted: true });

        const branding = await this.pdf.branding(ctx.organization_id);
        const isDraft = inv.status === InvoiceStatus.DRAFT;
        const buffer = await this.pdf.render({
            eyebrow: isDraft ? 'Draft invoice' : 'Invoice',
            title: isDraft ? 'Draft invoice' : `Invoice ${inv.number}`,
            subtitle: STATUS_LABEL[inv.status] && !isDraft ? STATUS_LABEL[inv.status] : null,
            branding,
            meta: [
                ['Number', inv.number],
                ['Issue date', pdfDate(inv.issue_date)],
                ['Due date', pdfDate(inv.due_date)],
                ...(inv.period_start && inv.period_end ? [['Period', `${pdfDate(inv.period_start)} – ${pdfDate(inv.period_end)}`] as [string, string]] : []),
                ...(inv.contract ? [['Contract', inv.contract.title] as [string, string]] : []),
                ['Amount due', money(inv.amount_due)],
            ],
            blocks,
            subject: `Invoice ${inv.number}`,
            keywords: [inv.number],
            created_at: inv.sent_at ?? inv.approved_at ?? inv.updated_at,
        });
        const filename = pdfFilename(isDraft ? 'draft-invoice' : inv.number);
        if (!isDraft) {
            try {
                const storeCtx = await this.pdf.storageContext(ctx, ctx.organization_id, null);
                if (storeCtx) {
                    const doc = await this.pdf.store(storeCtx, {
                        buffer, filename, title: `Invoice ${inv.number}`, entity_type: RecordEntityType.INVOICE, entity_id: inv.id, source_module: ModuleKey.FINANCE, role: 'generated_pdf',
                        company_id: inv.company_id, project_id: inv.project_id, document_id: inv.pdf_document_id,
                    });
                    await this.prisma.invoice.update({ where: { id: inv.id }, data: { pdf_document_id: doc.id } });
                    await this.audit.record(storeCtx, 'invoice.pdf_generated', { resource_type: 'invoice', resource_id: inv.id, metadata: { document_id: doc.id, number: inv.number } });
                }
            } catch (error) {
                this.logger.warn(`invoice PDF not stored: ${(error as Error).message}`);
            }
        }
        return this.pdf.fromBuffer(buffer, filename);
    }
}
