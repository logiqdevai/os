import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocumentSource, DocumentVersionStatus, ModuleKey, RecordEntityType } from 'generated/prisma';
import { isIP } from 'net';
import { Readable } from 'stream';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { DocumentsService } from '@/modules/files/services/documents.service';
import { StorageService } from '@/modules/files/storage/storage.service';
import { PdfBranding, PdfDocumentModel } from '@/shared/utils/pdf/pdf-document.interfaces';
import { renderPdf } from '@/shared/utils/pdf/pdf-renderer';

const DOC_CREATE = 'documents.documents.create';
const LOGO_TTL_MS = 10 * 60_000;
const LOGO_MAX_BYTES = 1_000_000;

export interface StorePdfInput {
    buffer: Buffer;
    filename: string;
    title: string;
    entity_type: RecordEntityType;
    entity_id: string;
    source_module: ModuleKey;
    /** generated_pdf | signed | certificate … */
    role: string;
    company_id?: string | null;
    project_id?: string | null;
    customer_visible?: boolean;
    /** Add a new version to this document instead of creating another one. */
    document_id?: string | null;
}

/** A PDF ready to stream to the caller (Nest `streamable()` shape). */
export interface PdfFile {
    stream: Readable;
    filename: string;
    mimetype: string;
    size?: number;
    disposition: 'inline' | 'attachment';
}

/**
 * Generated PDFs (03 proposals, 04 contracts + certificates, 08 invoices): organization branding, rendering
 * (`shared/utils/pdf`), storage through 17 Files (`DocumentsService`, never Document rows written here) and
 * streaming. Callers authorize access on their own record (proposal / contract / invoice) before calling.
 */
@Injectable()
export class GeneratedPdfService {
    private readonly logger = new Logger(GeneratedPdfService.name);
    private readonly logos = new Map<string, { at: number; logo: PdfBranding['logo'] }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly documents: DocumentsService,
        private readonly storage: StorageService,
        private readonly authorization: AuthorizationService,
    ) { }

    render(model: PdfDocumentModel) {
        return renderPdf(model);
    }

    /** Organization branding (01 §15): name, primary color, logo, footer. */
    async branding(organizationId: string): Promise<PdfBranding> {
        const org = await this.prisma.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { display_name: true, legal_name: true, logo_url: true, branding: true, contact_email: true, website: true, address: true },
        });
        const b = (org.branding ?? {}) as Record<string, unknown>;
        const addr = (org.address ?? {}) as Record<string, unknown>;
        const address = ['line1', 'street', 'city', 'postal_code', 'country'].map((k) => addr[k]).filter((v) => typeof v === 'string' && v).join(', ');
        const footer = (typeof b.email_footer === 'string' && b.email_footer) || [org.legal_name, address, org.contact_email, org.website].filter(Boolean).join(' · ');
        return {
            organization_name: org.display_name || org.legal_name,
            primary_color: typeof b.primary_color === 'string' ? b.primary_color : null,
            logo: await this.logo(org.logo_url ?? (typeof b.logo_url === 'string' ? b.logo_url : null)),
            footer,
        };
    }

    /** Fetch the logo once (https only, public hosts, 1 MB, PNG/JPEG); failures just drop the logo. */
    private async logo(url: string | null): Promise<PdfBranding['logo']> {
        if (!url) return null;
        const cached = this.logos.get(url);
        if (cached && Date.now() - cached.at < LOGO_TTL_MS) return cached.logo;
        let logo: PdfBranding['logo'] = null;
        try {
            const u = new URL(url);
            const host = u.hostname.toLowerCase();
            const privateHost = host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || (isIP(host) !== 0);
            if (u.protocol === 'https:' && !privateHost) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(url, { signal: controller.signal, redirect: 'error' }).finally(() => clearTimeout(timer));
                const len = Number(res.headers.get('content-length') ?? 0);
                if (res.ok && len <= LOGO_MAX_BYTES) {
                    const bytes = new Uint8Array(await res.arrayBuffer());
                    if (bytes.length <= LOGO_MAX_BYTES) {
                        if (bytes[0] === 0x89 && bytes[1] === 0x50) logo = { bytes, type: 'png' };
                        else if (bytes[0] === 0xff && bytes[1] === 0xd8) logo = { bytes, type: 'jpg' };
                    }
                }
            }
        } catch (error) {
            this.logger.debug(`logo not loaded: ${(error as Error).message}`);
        }
        this.logos.set(url, { at: Date.now(), logo });
        return logo;
    }

    /**
     * Context that stores the file: the caller when they may create documents, otherwise the record owner
     * (system flows such as signing completion). Null when neither can — the PDF is then streamed but not stored.
     */
    async storageContext(ctx: OrgContext | null, organizationId: string, ownerMembershipId: string | null): Promise<OrgContext | null> {
        if (ctx?.can(DOC_CREATE)) return ctx;
        if (!ownerMembershipId) return null;
        const owner = await this.authorization.contextFor({ organization_id: organizationId, membership_id: ownerMembershipId, channel: ctx?.channel ?? 'automation' });
        return owner.can(DOC_CREATE) ? owner : null;
    }

    /** Store through 17 Files (new document, or a new version of `document_id`). */
    async store(ctx: OrgContext, input: StorePdfInput) {
        if (!ctx.can(DOC_CREATE)) throw new ForbiddenException({ message: 'Storing the PDF needs documents.documents.create', code: 'permission_denied', permissions: [DOC_CREATE] });
        const existing = input.document_id
            ? await this.prisma.document.findFirst({ where: { id: input.document_id, organization_id: ctx.organization_id, deleted_at: null }, select: { id: true } })
            : null;
        if (existing) {
            return this.documents.upload(
                ctx,
                { buffer: input.buffer, originalname: input.filename, mimetype: 'application/pdf', size: input.buffer.length },
                { document_id: existing.id, change_note: 'Regenerated' },
                { source: DocumentSource.GENERATED, source_module: input.source_module, role: input.role },
            );
        }
        return this.documents.attachToEntity(ctx, {
            buffer: input.buffer, filename: input.filename, mimetype: 'application/pdf', title: input.title,
            entity_type: input.entity_type, entity_id: input.entity_id, role: input.role,
            company_id: input.company_id ?? undefined, project_id: input.project_id ?? undefined, customer_visible: input.customer_visible,
            source: DocumentSource.GENERATED, source_module: input.source_module,
        });
    }

    /** Stream a stored PDF (current version). The caller has authorized access to the owning record. */
    async streamStored(organizationId: string, documentId: string, disposition: 'inline' | 'attachment' = 'attachment'): Promise<PdfFile> {
        const doc = await this.prisma.document.findFirst({
            where: { id: documentId, organization_id: organizationId, deleted_at: null },
            include: { current_version: true },
        });
        const v = doc?.current_version;
        if (!v || v.status !== DocumentVersionStatus.AVAILABLE) throw new NotFoundException({ message: 'The stored PDF is not available', code: 'pdf_not_available' });
        return { stream: await this.storage.getStream(v.storage_key), filename: v.filename, mimetype: v.mimetype || 'application/pdf', size: Number(v.size_bytes), disposition };
    }

    /** Bytes of a stored document (e.g. a drawn signature image to embed); null when unavailable. */
    async readStored(organizationId: string, documentId: string): Promise<Buffer | null> {
        try {
            const file = await this.streamStored(organizationId, documentId);
            const chunks: Buffer[] = [];
            for await (const chunk of file.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return Buffer.concat(chunks);
        } catch {
            return null;
        }
    }

    /** Wrap freshly rendered bytes for streaming. */
    fromBuffer(buffer: Buffer, filename: string, disposition: 'inline' | 'attachment' = 'attachment'): PdfFile {
        return { stream: Readable.from(buffer), filename, mimetype: 'application/pdf', size: buffer.length, disposition };
    }
}
