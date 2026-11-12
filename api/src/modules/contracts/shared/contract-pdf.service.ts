import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContractVersionStatus, ModuleKey, Prisma, RecordEntityType, SignatureRequestStatus, SignerStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { GeneratedPdfService, PdfFile } from '@/modules/pdf/generated-pdf.service';
import { PdfBlock } from '@/shared/utils/pdf/pdf-document.interfaces';
import { pdfDate, pdfDateTime, pdfFilename } from '@/shared/utils/pdf/pdf-format.utils';
import { maskEmail } from './contracts.utils';

const PARTY_LABEL: Record<string, string> = { AGENCY: 'Agency', CUSTOMER: 'Customer', VENDOR: 'Vendor', PARTNER: 'Partner', CONTRACTOR: 'Contractor', EMPLOYEE: 'Employee', OTHER: 'Party' };
const addressText = (a: Prisma.JsonValue | null) => {
    if (!a) return null;
    if (typeof a === 'string') return a;
    if (typeof a !== 'object' || Array.isArray(a)) return null;
    return Object.values(a).filter((v) => typeof v === 'string' && v).join(', ') || null;
};
const EVENT_LABEL: Record<string, string> = {
    REQUEST_CREATED: 'Request created', SENT: 'Sent', DELIVERED: 'Delivered', VIEWED: 'Viewed', SIGNED: 'Signed', DECLINED: 'Declined',
    REMINDER_SENT: 'Reminder sent', CANCELLED: 'Cancelled', EXPIRED: 'Expired', COMPLETED: 'Completed', FAILED: 'Failed',
};

type RequestForPdf = Prisma.SignatureRequestGetPayload<{
    include: {
        contract: true;
        contract_version: true;
        signers: { include: { consent_text: { select: { version: true } } } };
        events: { include: { signer: { select: { name: true } } } };
    };
}>;

/**
 * 04 §18, §40–41 — contract documents as PDF: any version (draft render on demand), the signed artifact (version +
 * signature blocks) and the completion certificate. When a request is fully signed both files are stored once in
 * 17 Files and linked (ContractVersion.signed_document_id, SignatureRequest.signed_document_id /
 * audit_certificate_document_id); later downloads stream the stored, hashed files.
 */
@Injectable()
export class ContractPdfService {
    private readonly logger = new Logger(ContractPdfService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly pdf: GeneratedPdfService,
    ) { }

    private loadRequest(requestId: string) {
        return this.prisma.signatureRequest.findUniqueOrThrow({
            where: { id: requestId },
            include: {
                contract: true,
                contract_version: true,
                signers: { orderBy: { order: 'asc' }, include: { consent_text: { select: { version: true } } } },
                events: { orderBy: { occurred_at: 'asc' }, include: { signer: { select: { name: true } } } },
            },
        });
    }

    /** The document of one version; with a completed request the signature page is appended. */
    private async renderVersion(contractId: string, versionId: string, request: RequestForPdf | null) {
        const [contract, version] = await Promise.all([
            this.prisma.contract.findUniqueOrThrow({
                where: { id: contractId },
                include: { parties: { orderBy: { sort_order: 'asc' }, include: { company: { select: { name: true, legal_name: true } } } }, type: { select: { name: true } } },
            }),
            this.prisma.contractVersion.findFirstOrThrow({ where: { id: versionId, contract_id: contractId }, include: { sections: { orderBy: { sort_order: 'asc' } } } }),
        ]);
        const branding = await this.pdf.branding(contract.organization_id);
        const blocks: PdfBlock[] = [];
        if (contract.parties.length) {
            blocks.push({ kind: 'heading', text: 'Parties', level: 2 }, { kind: 'key_values', rows: contract.parties.map((p) => [PARTY_LABEL[p.party_type] ?? p.party_type, [p.legal_name, addressText(p.address), p.registration_number ? `Reg. ${p.registration_number}` : null, p.vat_number ? `VAT ${p.vat_number}` : null].filter(Boolean).join(', ')]) });
        }
        let appendix = false;
        for (const s of version.sections) {
            if (s.is_appendix && !appendix) { blocks.push({ kind: 'page_break' }); appendix = true; }
            blocks.push({ kind: 'heading', text: s.title });
            if (s.body?.trim()) blocks.push({ kind: 'markdown', text: s.body });
        }
        if (request && request.status === SignatureRequestStatus.FULLY_SIGNED) {
            blocks.push({ kind: 'page_break' }, { kind: 'heading', text: 'Signatures' });
            for (const s of request.signers.filter((x) => x.status === SignerStatus.SIGNED)) {
                const signed = request.events.find((e) => e.type === 'SIGNED' && e.signer_id === s.id);
                const payload = (signed?.payload ?? {}) as Record<string, unknown>;
                let image: Buffer | null = null;
                if (s.signature_document_id) image = await this.pdf.readStored(contract.organization_id, s.signature_document_id);
                else if (typeof payload.signature_data_url === 'string') image = Buffer.from(payload.signature_data_url.replace(/^data:image\/png;base64,/, ''), 'base64');
                if (image) blocks.push({ kind: 'image', bytes: image, type: 'png', max_width: 200, max_height: 60 });
                else if (typeof payload.typed_name === 'string') blocks.push({ kind: 'paragraph', text: payload.typed_name, size: 16, bold: true });
                blocks.push({
                    kind: 'key_values',
                    rows: [
                        ['Signer', [s.name, s.title].filter(Boolean).join(', ')],
                        ['Signed', pdfDateTime(s.signed_at)],
                        ['Method', `${s.signature_type === 'DRAWN' ? 'Drawn' : 'Typed'} electronic signature · identity verified by one-time code (${s.auth_method === 'SMS_OTP' ? 'SMS' : 'email'})`],
                    ],
                });
                blocks.push({ kind: 'divider' });
            }
            blocks.push({ kind: 'paragraph', text: `Document fingerprint (SHA-256): ${version.content_hash ?? '—'}\nSigned fingerprint: ${request.signed_hash ?? '—'}`, size: 8, muted: true });
        }
        const buffer = await this.pdf.render({
            eyebrow: contract.type?.name ?? 'Contract',
            title: contract.title,
            subtitle: request?.status === SignatureRequestStatus.FULLY_SIGNED ? 'Signed agreement' : version.status === ContractVersionStatus.SIGNED ? 'Signed agreement' : `Version ${version.label} · ${version.status.toLowerCase().replace(/_/g, ' ')}`,
            branding,
            meta: [
                ['Number', contract.number],
                ['Version', version.label],
                ...(contract.effective_date || contract.start_date ? [['Effective', pdfDate(contract.effective_date ?? contract.start_date)] as [string, string]] : []),
                ...(contract.end_date ? [['Ends', pdfDate(contract.end_date)] as [string, string]] : []),
                ...(request?.completed_at ? [['Signed', pdfDate(request.completed_at)] as [string, string]] : []),
            ],
            blocks,
            subject: `Contract ${contract.number}`,
            keywords: [contract.number, version.label],
            created_at: request?.completed_at ?? version.updated_at,
        });
        return { buffer, contract, version, filename: pdfFilename(contract.number, version.label, request?.status === SignatureRequestStatus.FULLY_SIGNED ? 'signed' : null) };
    }

    /** 04 §40 — completion certificate (evidence trail). Emails are masked for signer viewers. */
    private async renderCertificate(request: RequestForPdf, viewerSignerId: string | null) {
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: request.organization_id }, select: { display_name: true, legal_name: true } });
        const branding = await this.pdf.branding(request.organization_id);
        const blocks: PdfBlock[] = [
            { kind: 'heading', text: 'Document', level: 2 },
            {
                kind: 'key_values', rows: [
                    ['Title', request.contract?.title ?? '—'], ['Number', request.contract?.number ?? '—'], ['Version', request.contract_version?.label ?? '—'],
                    ['Content hash', request.contract_version?.content_hash ?? '—'], ['Signed hash', request.signed_hash ?? '—'],
                    ['Signing order', request.signing_order === 'PARALLEL' ? 'Parallel' : 'Sequential'],
                    ['Sent', pdfDateTime(request.sent_at)], ['Completed', pdfDateTime(request.completed_at)],
                ],
            },
            { kind: 'heading', text: 'Signers', level: 2 },
        ];
        for (const s of request.signers) {
            blocks.push({
                kind: 'key_values', rows: [
                    ['Name', [s.name, s.title].filter(Boolean).join(', ')],
                    ['Email', viewerSignerId && viewerSignerId !== s.id ? maskEmail(s.email) : s.email],
                    ['Status', s.status.toLowerCase().replace(/_/g, ' ')],
                    ['Identity verified', `${pdfDateTime(s.identity_verified_at)} (${s.auth_method === 'SMS_OTP' ? 'SMS one-time code' : 'email one-time code'})`],
                    ['Consent', s.consent_accepted_at ? `version ${s.consent_text?.version ?? '—'} · ${pdfDateTime(s.consent_accepted_at)}` : '—'],
                    ['Viewed', pdfDateTime(s.viewed_at)], ['Signed', pdfDateTime(s.signed_at)],
                    ['Signature', s.signature_type ? (s.signature_type === 'DRAWN' ? 'Drawn' : 'Typed name') : '—'],
                    ['IP address', s.ip_address ?? '—'], ['Device', s.user_agent ?? '—'],
                ],
            }, { kind: 'divider' });
        }
        blocks.push(
            { kind: 'heading', text: 'Event trail', level: 2 },
            {
                kind: 'table',
                columns: [{ label: 'When', width: 34 }, { label: 'Event', width: 24 }, { label: 'Signer', width: 24 }, { label: 'IP', width: 18 }],
                rows: request.events.map((e) => [pdfDateTime(e.occurred_at), EVENT_LABEL[e.type] ?? e.type, e.signer?.name ?? '—', e.ip_address ?? '—']),
            },
            { kind: 'paragraph', text: `Issued by ${org.display_name || org.legal_name} with Logiqdev OS in-house e-signature. Certificate id ${request.id}.`, size: 8.5, muted: true },
        );
        const buffer = await this.pdf.render({
            eyebrow: 'Completion certificate',
            title: request.contract?.title ?? 'Signature request',
            subtitle: request.status === SignatureRequestStatus.FULLY_SIGNED ? 'All parties signed' : `Status: ${request.status.toLowerCase().replace(/_/g, ' ')}`,
            branding,
            blocks,
            subject: `Completion certificate ${request.contract?.number ?? request.id}`,
            created_at: request.completed_at ?? request.updated_at,
        });
        return { buffer, filename: pdfFilename(request.contract?.number ?? 'signature', 'certificate') };
    }

    /**
     * After full signature: render and store the signed document and the certificate (once), as the contract owner.
     * Never throws — the signing flow must not fail because of the artifact; missing files render on demand later.
     */
    async storeSignedArtifacts(requestId: string, ctx: OrgContext | null = null) {
        try {
            const request = await this.loadRequest(requestId);
            if (request.status !== SignatureRequestStatus.FULLY_SIGNED || !request.contract || !request.contract_version) return;
            const storeCtx = await this.pdf.storageContext(ctx, request.organization_id, request.contract.owner_membership_id);
            if (!storeCtx) return;
            const common = { entity_type: RecordEntityType.CONTRACT, entity_id: request.contract.id, source_module: ModuleKey.CONTRACTS, company_id: request.contract.primary_company_id };
            if (!request.signed_document_id) {
                const signed = await this.renderVersion(request.contract.id, request.contract_version.id, request);
                const doc = await this.pdf.store(storeCtx, { ...common, buffer: signed.buffer, filename: signed.filename, title: `${request.contract.number} ${request.contract_version.label} (signed)`, role: 'signed' });
                await this.prisma.$transaction([
                    this.prisma.signatureRequest.update({ where: { id: requestId }, data: { signed_document_id: doc.id } }),
                    this.prisma.contractVersion.update({ where: { id: request.contract_version.id }, data: { signed_document_id: doc.id } }),
                ]);
                await this.audit.record(storeCtx, 'contract.signed_pdf_stored', { resource_type: 'contract', resource_id: request.contract.id, metadata: { request_id: requestId, document_id: doc.id } });
            }
            if (!request.audit_certificate_document_id) {
                const cert = await this.renderCertificate(request, null);
                const doc = await this.pdf.store(storeCtx, { ...common, buffer: cert.buffer, filename: cert.filename, title: `${request.contract.number} completion certificate`, role: 'certificate' });
                await this.prisma.signatureRequest.update({ where: { id: requestId }, data: { audit_certificate_document_id: doc.id } });
                await this.audit.record(storeCtx, 'contract.certificate_pdf_stored', { resource_type: 'contract', resource_id: request.contract.id, metadata: { request_id: requestId, document_id: doc.id } });
            }
        } catch (error) {
            this.logger.warn(`signed artifacts for ${requestId} not stored: ${(error as Error).message}`);
        }
    }

    /** Staff: PDF of a version (caller already authorized on the contract). Signed versions stream the stored artifact. */
    async versionPdf(ctx: OrgContext, contractId: string, versionId: string): Promise<PdfFile> {
        const version = await this.prisma.contractVersion.findFirst({ where: { id: versionId, contract_id: contractId }, select: { id: true, signed_document_id: true } });
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        const request = await this.prisma.signatureRequest.findFirst({ where: { contract_version_id: versionId, status: SignatureRequestStatus.FULLY_SIGNED }, orderBy: { completed_at: 'desc' }, select: { id: true } });
        if (request) {
            await this.storeSignedArtifacts(request.id, ctx);
            const fresh = await this.prisma.contractVersion.findUniqueOrThrow({ where: { id: versionId }, select: { signed_document_id: true } });
            if (fresh.signed_document_id) {
                try { return await this.pdf.streamStored(ctx.organization_id, fresh.signed_document_id); } catch { /* render below */ }
            }
        }
        const full = request ? await this.loadRequest(request.id) : null;
        const r = await this.renderVersion(contractId, versionId, full);
        return this.pdf.fromBuffer(r.buffer, r.filename);
    }

    /** Certificate PDF of a request (staff, or a signer with viewerSignerId → other emails masked). */
    async certificatePdf(organizationId: string, requestId: string, viewerSignerId: string | null, ctx: OrgContext | null = null): Promise<PdfFile> {
        const request = await this.loadRequest(requestId);
        if (request.organization_id !== organizationId) throw new NotFoundException({ message: 'Signature request not found', code: 'signature_request_not_found' });
        if (!viewerSignerId && request.status === SignatureRequestStatus.FULLY_SIGNED) {
            await this.storeSignedArtifacts(requestId, ctx);
            const fresh = await this.prisma.signatureRequest.findUniqueOrThrow({ where: { id: requestId }, select: { audit_certificate_document_id: true } });
            if (fresh.audit_certificate_document_id) {
                try { return await this.pdf.streamStored(organizationId, fresh.audit_certificate_document_id); } catch { /* render below */ }
            }
        }
        const r = await this.renderCertificate(request, viewerSignerId);
        return this.pdf.fromBuffer(r.buffer, r.filename);
    }

    /** Signer: the signed document once everyone signed. */
    async signedPdfForSigner(requestId: string): Promise<PdfFile> {
        const request = await this.loadRequest(requestId);
        if (request.status !== SignatureRequestStatus.FULLY_SIGNED || !request.contract || !request.contract_version) {
            throw new ConflictException({ message: 'The signed document is available once everyone has signed', code: 'signed_document_not_ready' });
        }
        await this.storeSignedArtifacts(requestId);
        const fresh = await this.prisma.signatureRequest.findUniqueOrThrow({ where: { id: requestId }, select: { signed_document_id: true } });
        if (fresh.signed_document_id) {
            try { return await this.pdf.streamStored(request.organization_id, fresh.signed_document_id); } catch { /* render below */ }
        }
        const r = await this.renderVersion(request.contract.id, request.contract_version.id, request);
        return this.pdf.fromBuffer(r.buffer, r.filename);
    }
}
