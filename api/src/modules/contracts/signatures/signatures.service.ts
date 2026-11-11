import { BadRequestException, ConflictException, GoneException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
    AuditOutcome, ContractRelationKind, ContractStatus, ContractVersionStatus, ModuleKey, Prisma, SignatureEventType, SignatureRequestStatus, SignatureSubjectType, SignatureType, SignerStatus, SigningOrder,
    VerificationChannel, VerificationPurpose, RecordEntityType, DocumentSource,
} from 'generated/prisma';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { DocumentsService } from '@/modules/files/services/documents.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ContractsService } from '../contracts/contracts.service';
import { ContractVersionsService } from '../versions/versions.service';
import { ContractMailerService } from '../shared/contract-mailer.service';
import { addDays, maskEmail, newCode, newToken, publicContext, sectionsHash, sha256, today } from '../shared/contracts.utils';
import { CancelSignatureRequestDto, CreateSignatureRequestDto, DeclineDto, SignDto, SignatureRequestQuery, VerifyCodeDto } from './dto/signature.dto';

const ACTIVE_REQUEST: SignatureRequestStatus[] = [SignatureRequestStatus.NOT_SENT, SignatureRequestStatus.SENT, SignatureRequestStatus.DELIVERED, SignatureRequestStatus.VIEWED, SignatureRequestStatus.PARTIALLY_SIGNED];
const CODE_TTL_MS = 10 * 60_000;
const LOCKOUT_MS = 15 * 60_000;
const IDENTITY_FRESH_MS = 12 * 3_600_000;
const MAX_CODES_PER_WINDOW = 5;

const DEFAULT_CONSENT = [
    'By signing electronically you agree that your electronic signature is the legal equivalent of your handwritten signature on this document.',
    'You confirm that you are the person named as signer, that you are authorised to sign on behalf of the party you represent, and that you have reviewed the full document.',
    'A record of this signing (date, time, IP address, device and the document fingerprint) is kept as evidence and included in the completion certificate.',
].join('\n\n');

export interface PublicMeta { ip?: string | null; user_agent?: string | null }

type SignerRow = Prisma.SignerGetPayload<{ include: { request: { include: { contract: true; contract_version: true } } } }>;

/**
 * In-house e-signature service (04 §30–42, §71, §78–79). Requests are bound immutably to one contract version
 * (locked for signature with its content hash). Signers get a single-use link (only its SHA-256 is stored), prove
 * identity with a one-time email code, accept a versioned consent text and sign by typed name or drawn image.
 * Every step writes a SignatureEvent (evidence trail) and an audit event.
 */
@Injectable()
export class SignaturesService {
    private readonly logger = new Logger(SignaturesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly contracts: ContractsService,
        private readonly versions: ContractVersionsService,
        private readonly mailer: ContractMailerService,
        private readonly config: ConfigService,
        private readonly authorization: AuthorizationService,
        private readonly documents: DocumentsService,
    ) { }

    /**
     * Store a drawn signature as a Document on the contract (17) and link it from Signer.signature_document_id.
     * The public signer has no permissions, so the file is stored on behalf of the contract owner; if the owner cannot
     * create documents the PNG stays in the SIGNED event payload as evidence.
     */
    private async storeDrawnSignature(input: { organization_id: string; contract_id: string; owner_membership_id: string | null; signer_id: string; event_id: string; data_url: string }) {
        try {
            if (!input.owner_membership_id) return;
            const ownerCtx = await this.authorization.contextFor({ organization_id: input.organization_id, membership_id: input.owner_membership_id, channel: 'api' });
            if (!ownerCtx.can('documents.documents.create')) return;
            const buffer = Buffer.from(input.data_url.replace(/^data:image\/png;base64,/, ''), 'base64');
            const doc = await this.documents.attachToEntity(ownerCtx, {
                buffer, filename: `signature-${input.signer_id}.png`, mimetype: 'image/png', title: 'Signature',
                entity_type: RecordEntityType.CONTRACT, entity_id: input.contract_id, role: 'signature', source: DocumentSource.GENERATED, source_module: ModuleKey.CONTRACTS,
            });
            await this.prisma.signer.update({ where: { id: input.signer_id }, data: { signature_document_id: doc.id } });
            const event = await this.prisma.signatureEvent.findUnique({ where: { id: input.event_id }, select: { payload: true } });
            const payload = { ...((event?.payload as Record<string, unknown>) ?? {}), signature_data_url: null, signature_document_id: doc.id };
            await this.prisma.signatureEvent.update({ where: { id: input.event_id }, data: { payload: payload as Prisma.InputJsonValue } });
        } catch (error) {
            this.logger.warn(`signature image not stored as a document: ${(error as Error).message}`);
        }
    }

    private signUrl(token: string) {
        return this.mailer.appUrl(`/sign/${token}`);
    }

    // ===================================================================== staff side

    async create(ctx: OrgContext, contractId: string, versionId: string, dto: CreateSignatureRequestDto) {
        const contract = await this.contracts.findOne(ctx, contractId);
        const version = await this.prisma.contractVersion.findFirst({ where: { id: versionId, contract_id: contractId }, include: { sections: true } });
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        if (contract.current_version_id !== versionId) throw new ConflictException({ message: 'Only the current version can be sent for signature', code: 'version_not_current' });
        if (version.status !== ContractVersionStatus.APPROVED) {
            throw new ConflictException({ message: 'Approve this version before sending it for signature (submit for approval — it is approved automatically when no rule applies)', code: 'version_not_approved' });
        }
        await this.versions.assertReadyForSignature(versionId);
        const active = await this.prisma.signatureRequest.count({ where: { contract_id: contractId, status: { in: ACTIVE_REQUEST } } });
        if (active) throw new ConflictException({ message: 'A signature request is already in progress for this contract', code: 'signature_request_active' });

        const order = dto.signing_order ?? SigningOrder.SEQUENTIAL;
        let signers = dto.signers;
        if (!signers?.length) {
            signers = contract.parties.flatMap((p, pi) => p.signatories.filter((s) => s.is_required).map((s) => ({ signatory_id: s.id, name: s.name, email: s.email, title: s.title ?? undefined, phone: s.phone ?? undefined, order: pi + 1 })));
        }
        if (!signers.length) throw new BadRequestException({ message: 'Add at least one signatory to the contract parties, or pass signers', code: 'signers_required' });
        const signatoryIds = contract.parties.flatMap((p) => p.signatories.map((s) => s.id));
        for (const s of signers) if (s.signatory_id && !signatoryIds.includes(s.signatory_id)) throw new BadRequestException({ message: 'Signatory is not part of this contract', code: 'signatory_not_found' });
        const emails = signers.map((s) => s.email.toLowerCase());
        if (new Set(emails).size !== emails.length) throw new BadRequestException({ message: 'Each signer needs a different email address', code: 'duplicate_signer_email' });

        const normalized = signers.map((s, i) => ({ ...s, email: s.email.toLowerCase(), order: order === SigningOrder.PARALLEL ? 1 : s.order ?? i + 1 }));
        const firstOrder = Math.min(...normalized.map((s) => s.order));
        const tokens = normalized.map(() => newToken());
        const contentHash = sectionsHash(version.sections);
        const now = new Date();
        const expiresAt = addDays(now, dto.expires_in_days ?? 30);

        const request = await this.prisma.$transaction(async (tx) => {
            const r = await tx.signatureRequest.create({
                data: {
                    organization_id: ctx.organization_id, subject_type: SignatureSubjectType.CONTRACT_VERSION, contract_id: contractId, contract_version_id: versionId,
                    status: SignatureRequestStatus.SENT, signing_order: order, message: dto.message, reminder_settings: (dto.reminder_settings ?? { frequency_days: 3, max_reminders: 3 }) as Prisma.InputJsonValue,
                    created_by_user_id: ctx.user_id, sent_at: now, expires_at: expiresAt,
                    signers: {
                        create: normalized.map((s, i) => ({
                            signatory_id: s.signatory_id, name: s.name, email: s.email, title: s.title, phone: s.phone, order: s.order, auth_method: 'EMAIL_OTP',
                            access_token_hash: sha256(tokens[i]), status: s.order === firstOrder ? SignerStatus.SENT : SignerStatus.PENDING, sent_at: s.order === firstOrder ? now : null,
                        })),
                    },
                },
                include: { signers: true },
            });
            await tx.contractVersion.update({ where: { id: versionId }, data: { status: ContractVersionStatus.LOCKED_FOR_SIGNATURE, locked_at: now, content_hash: contentHash } });
            await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.READY_FOR_SIGNATURE } });
            await tx.signatureEvent.createMany({
                data: [
                    { request_id: r.id, type: SignatureEventType.REQUEST_CREATED, ip_address: ctx.ip_address ?? null, payload: { content_hash: contentHash, signers: normalized.length, signing_order: order } },
                    ...r.signers.filter((s) => s.order === firstOrder).map((s) => ({ request_id: r.id, signer_id: s.id, type: SignatureEventType.SENT })),
                ],
            });
            return r;
        });

        const links = request.signers.map((s) => ({ signer_id: s.id, name: s.name, email: s.email, order: s.order, active: s.order === firstOrder, url: this.signUrl(tokens[normalized.findIndex((n) => n.email === s.email)]) }));
        const emailed = await Promise.all(links.filter((l) => l.active).map((l) => this.emailInvite(contract.title, contract.number, l.name, l.email, l.url, dto.message)));

        await this.audit.record(ctx, 'contract.signature_requested', {
            resource_type: 'contract', resource_id: contractId,
            metadata: { request_id: request.id, version_id: versionId, signers: links.map((l) => ({ name: l.name, email: l.email, order: l.order })), signing_order: order, expires_at: expiresAt, content_hash: contentHash },
        });
        this.events.publish(ctx, {
            event_key: 'contracts.signature.requested', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: request.id,
            payload: { contract_id: contractId, number: contract.number, title: contract.title, version_id: versionId, owner_membership_id: contract.owner_membership_id, signer_emails: links.map((l) => l.email) },
            activity: { summary: `Contract ${contract.number} sent for signature`, entity_label: contract.title, company_id: contract.primary_company_id },
        });
        return { request: await this.findOne(ctx, request.id), links, email_sent: emailed.some(Boolean), mail_configured: this.mailer.configured };
    }

    async findAll(ctx: OrgContext, query: SignatureRequestQuery) {
        const where: Prisma.SignatureRequestWhereInput = {
            organization_id: ctx.organization_id,
            contract: { organization_id: ctx.organization_id, ...this.contracts.scopeWhere(ctx, 'contracts.signatures.read') },
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.contract_id && { contract_id: query.contract_id }),
            ...(query.search && {
                OR: [
                    { contract: { title: { contains: query.search, mode: 'insensitive' } } },
                    { contract: { number: { contains: query.search, mode: 'insensitive' } } },
                    { signers: { some: { OR: [{ email: { contains: query.search, mode: 'insensitive' } }, { name: { contains: query.search, mode: 'insensitive' } }] } } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.signatureRequest.findMany({
                where, ...skipTake(query), orderBy: { created_at: 'desc' },
                include: {
                    contract: { select: { id: true, number: true, title: true, status: true } },
                    contract_version: { select: { id: true, label: true } },
                    signers: { orderBy: { order: 'asc' }, select: { id: true, name: true, email: true, order: true, status: true, signed_at: true, viewed_at: true } },
                },
            }),
            this.prisma.signatureRequest.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const r = await this.prisma.signatureRequest.findFirst({
            where: { id, organization_id: ctx.organization_id, contract: { organization_id: ctx.organization_id, ...this.contracts.scopeWhere(ctx, 'contracts.signatures.read') } },
            include: {
                contract: { select: { id: true, number: true, title: true, status: true, owner_membership_id: true } },
                contract_version: { select: { id: true, label: true, content_hash: true, status: true } },
                signers: {
                    orderBy: { order: 'asc' },
                    select: { id: true, signatory_id: true, name: true, email: true, title: true, order: true, status: true, auth_method: true, signature_type: true, identity_verified_at: true, consent_accepted_at: true, sent_at: true, viewed_at: true, signed_at: true, declined_at: true, decline_reason: true, ip_address: true },
                },
                events: { orderBy: { occurred_at: 'asc' }, select: { id: true, type: true, occurred_at: true, ip_address: true, signer_id: true } },
            },
        });
        if (!r) throw new NotFoundException({ message: 'Signature request not found', code: 'signature_request_not_found' });
        return r;
    }

    /** Re-send invitations to the signers whose turn it is (rotates their link, so old links stop working). */
    async remind(ctx: OrgContext, id: string) {
        const r = await this.findOne(ctx, id);
        if (!ACTIVE_REQUEST.includes(r.status)) throw new ConflictException({ message: 'This request is no longer in progress', code: 'signature_request_closed' });
        const pending = r.signers.filter((s) => s.status !== SignerStatus.SIGNED && s.status !== SignerStatus.DECLINED);
        const turn = Math.min(...pending.map((s) => s.order));
        const links = [];
        for (const s of pending.filter((p) => p.order === turn)) links.push(await this.rotate(r.id, s.id, s.name, s.email, r.contract.title, r.contract.number, true));
        await this.prisma.signatureRequest.update({ where: { id }, data: { reminders_sent: { increment: 1 } } });
        await this.prisma.signatureEvent.createMany({ data: links.map((l) => ({ request_id: id, signer_id: l.signer_id, type: SignatureEventType.REMINDER_SENT, ip_address: ctx.ip_address ?? null })) });
        await this.audit.record(ctx, 'contract.signature_reminded', { resource_type: 'contract', resource_id: r.contract.id, metadata: { request_id: id, signers: links.map((l) => l.email) } });
        return { links, email_sent: links.some((l) => l.emailed), mail_configured: this.mailer.configured };
    }

    /** New single-use link for one signer (shown to staff once; emailed when mail is configured). */
    async resendLink(ctx: OrgContext, id: string, signerId: string) {
        const r = await this.findOne(ctx, id);
        if (!ACTIVE_REQUEST.includes(r.status)) throw new ConflictException({ message: 'This request is no longer in progress', code: 'signature_request_closed' });
        const s = r.signers.find((x) => x.id === signerId);
        if (!s) throw new NotFoundException({ message: 'Signer not found', code: 'signer_not_found' });
        if (s.status === SignerStatus.SIGNED || s.status === SignerStatus.DECLINED) throw new ConflictException({ message: 'This signer already finished', code: 'signer_finished' });
        const link = await this.rotate(r.id, s.id, s.name, s.email, r.contract.title, r.contract.number, true);
        await this.audit.record(ctx, 'contract.signature_link_reissued', { resource_type: 'contract', resource_id: r.contract.id, metadata: { request_id: id, signer_id: signerId } });
        return { ...link, mail_configured: this.mailer.configured };
    }

    async cancel(ctx: OrgContext, id: string, dto: CancelSignatureRequestDto) {
        const r = await this.findOne(ctx, id);
        if (!ACTIVE_REQUEST.includes(r.status)) throw new ConflictException({ message: 'This request is no longer in progress', code: 'signature_request_closed' });
        await this.prisma.$transaction(async (tx) => {
            await tx.signatureRequest.update({ where: { id }, data: { status: SignatureRequestStatus.CANCELLED, cancelled_at: new Date(), cancel_reason: dto.reason } });
            await tx.signer.updateMany({ where: { request_id: id }, data: { access_token_hash: null } });
            await this.unlock(tx, r.contract.id, r.contract_version!.id);
            await tx.signatureEvent.create({ data: { request_id: id, type: SignatureEventType.CANCELLED, ip_address: ctx.ip_address ?? null, payload: { reason: dto.reason ?? null } } });
        });
        await this.audit.record(ctx, 'contract.signature_cancelled', { resource_type: 'contract', resource_id: r.contract.id, metadata: { request_id: id, reason: dto.reason } });
        this.events.publish(ctx, { event_key: 'contracts.signature.cancelled', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: id, payload: { contract_id: r.contract.id, number: r.contract.number, reason: dto.reason, owner_membership_id: r.contract.owner_membership_id } });
        return this.findOne(ctx, id);
    }

    async certificate(ctx: OrgContext, id: string) {
        const r = await this.findOne(ctx, id);
        return this.buildCertificate(r.id, null);
    }

    // ===================================================================== public signing (token)

    /** Resolve a signing token; 404 for unknown / revoked tokens (never says which). Marks expired requests. */
    private async resolve(token: string): Promise<SignerRow> {
        if (!token || token.length < 20 || token.length > 100) throw new NotFoundException({ message: 'This signing link is not valid', code: 'signing_link_invalid' });
        const signer = await this.prisma.signer.findUnique({ where: { access_token_hash: sha256(token) }, include: { request: { include: { contract: true, contract_version: true } } } });
        if (!signer || !signer.request.contract || !signer.request.contract_version) throw new NotFoundException({ message: 'This signing link is not valid', code: 'signing_link_invalid' });
        const r = signer.request;
        if (r.expires_at && r.expires_at.getTime() < Date.now() && ACTIVE_REQUEST.includes(r.status)) {
            await this.prisma.$transaction(async (tx) => {
                await tx.signatureRequest.update({ where: { id: r.id }, data: { status: SignatureRequestStatus.EXPIRED } });
                await tx.signatureEvent.create({ data: { request_id: r.id, type: SignatureEventType.EXPIRED } });
                await this.unlock(tx, r.contract!.id, r.contract_version!.id);
            });
            r.status = SignatureRequestStatus.EXPIRED;
        }
        return signer;
    }

    private stateOf(signer: SignerRow, all: { status: SignerStatus; order: number }[]) {
        const r = signer.request;
        if (r.status === SignatureRequestStatus.FULLY_SIGNED) return 'COMPLETED';
        if (r.status === SignatureRequestStatus.CANCELLED) return 'CANCELLED';
        if (r.status === SignatureRequestStatus.EXPIRED) return 'EXPIRED';
        if (r.status === SignatureRequestStatus.DECLINED || signer.status === SignerStatus.DECLINED) return 'DECLINED';
        if (signer.status === SignerStatus.SIGNED) return 'SIGNED';
        const pending = all.filter((s) => s.status !== SignerStatus.SIGNED && s.status !== SignerStatus.DECLINED);
        const turn = Math.min(...pending.map((s) => s.order));
        return signer.order > turn ? 'WAITING' : 'ACTIVE';
    }

    private identityFresh(signer: { identity_verified_at: Date | null }) {
        return !!signer.identity_verified_at && Date.now() - signer.identity_verified_at.getTime() < IDENTITY_FRESH_MS;
    }

    async publicState(token: string, meta: PublicMeta) {
        const signer = await this.resolve(token);
        const r = signer.request;
        const [org, parties, all, consent] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: r.organization_id }, select: { display_name: true, legal_name: true, logo_url: true } }),
            this.prisma.contractParty.findMany({ where: { contract_id: r.contract!.id }, orderBy: { sort_order: 'asc' }, select: { party_type: true, legal_name: true } }),
            this.prisma.signer.findMany({ where: { request_id: r.id }, orderBy: { order: 'asc' }, select: { id: true, name: true, status: true, order: true, signed_at: true } }),
            this.consentText(r.organization_id),
        ]);
        const state = this.stateOf(signer, all);
        const verified = this.identityFresh(signer);
        let sections: { key: string; title: string; body: string | null; is_appendix: boolean }[] | null = null;
        if (verified && (state === 'ACTIVE' || state === 'SIGNED' || state === 'COMPLETED')) {
            sections = await this.prisma.contractSection.findMany({ where: { version_id: r.contract_version!.id }, orderBy: { sort_order: 'asc' }, select: { key: true, title: true, body: true, is_appendix: true } });
            if (!signer.viewed_at && state === 'ACTIVE') {
                const ctx = publicContext(r.organization_id, meta);
                await this.prisma.$transaction([
                    this.prisma.signer.update({ where: { id: signer.id }, data: { viewed_at: new Date(), status: SignerStatus.VIEWED } }),
                    this.prisma.signatureEvent.create({ data: { request_id: r.id, signer_id: signer.id, type: SignatureEventType.VIEWED, ip_address: meta.ip ?? null, payload: { user_agent: meta.user_agent ?? null } } }),
                    ...(r.status === SignatureRequestStatus.SENT || r.status === SignatureRequestStatus.DELIVERED ? [this.prisma.signatureRequest.update({ where: { id: r.id }, data: { status: SignatureRequestStatus.VIEWED } })] : []),
                ]);
                await this.audit.record(ctx, 'contract.signature_viewed', { resource_type: 'contract', resource_id: r.contract!.id, metadata: { request_id: r.id, signer_id: signer.id, signer_email: signer.email } });
            }
        }
        return {
            state,
            organization: { name: org.display_name || org.legal_name, logo_url: org.logo_url },
            contract: { number: r.contract!.number, title: r.contract!.title },
            version: { label: r.contract_version!.label, content_hash: r.contract_version!.content_hash },
            parties,
            message: r.message,
            expires_at: r.expires_at,
            signer: { name: signer.name, title: signer.title, email_masked: maskEmail(signer.email), identity_verified: verified, signed_at: signer.signed_at, signature_type: signer.signature_type },
            signers: all.map((s) => ({ name: s.name, status: s.status, order: s.order, is_you: s.id === signer.id, signed_at: s.signed_at })),
            consent_text: { id: consent.id, version: consent.version, locale: consent.locale, body: consent.body },
            sections,
        };
    }

    async sendCode(token: string, meta: PublicMeta) {
        const signer = await this.resolve(token);
        const all = await this.prisma.signer.findMany({ where: { request_id: signer.request_id }, select: { status: true, order: true } });
        const state = this.stateOf(signer, all);
        if (state !== 'ACTIVE') throw new ConflictException({ message: 'This document cannot be signed right now', code: `signing_${state.toLowerCase()}` });
        const recent = await this.prisma.verificationCode.findMany({ where: { signer_id: signer.id, created_at: { gte: new Date(Date.now() - LOCKOUT_MS) } }, orderBy: { created_at: 'desc' } });
        if (recent.some((c) => c.locked_until && c.locked_until.getTime() > Date.now())) throw new HttpException({ message: 'Too many wrong codes. Try again in 15 minutes.', code: 'verification_locked' }, HttpStatus.TOO_MANY_REQUESTS);
        if (recent.length >= MAX_CODES_PER_WINDOW) throw new HttpException({ message: 'Too many codes requested. Try again in 15 minutes.', code: 'verification_rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);

        const code = newCode();
        await this.prisma.verificationCode.create({
            data: {
                organization_id: signer.request.organization_id, purpose: VerificationPurpose.SIGNER_IDENTITY, channel: VerificationChannel.EMAIL, signer_id: signer.id,
                recipient: signer.email, code_hash: sha256(`${signer.id}:${code}`), expires_at: new Date(Date.now() + CODE_TTL_MS), ip_address: meta.ip ?? null,
            },
        });
        const emailed = await this.mailer.send(signer.email, `Your signing code: ${code}`, [
            `Hello ${signer.name},`,
            `Your one-time code to sign "${signer.request.contract!.title}" is ${code}.`,
            'It expires in 10 minutes. If you did not request it, you can ignore this email.',
        ]);
        await this.audit.record(publicContext(signer.request.organization_id, meta), 'contract.signature_code_sent', { resource_type: 'contract', resource_id: signer.request.contract!.id, metadata: { request_id: signer.request_id, signer_id: signer.id, channel: 'EMAIL', emailed } });
        // Without a mail key outside production the code is returned so the flow can be tested. Never in production:
        // a code in the response would let anyone holding the link skip identity verification.
        if (!emailed && this.config.get<string>('NODE_ENV') === 'production') {
            throw new HttpException({ message: 'The verification email could not be sent. Ask the sender to check the email settings.', code: 'verification_email_failed' }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        return { sent: true, channel: 'EMAIL', recipient: maskEmail(signer.email), expires_in_seconds: CODE_TTL_MS / 1000, ...(emailed ? {} : { dev_code: code }) };
    }

    async verify(token: string, dto: VerifyCodeDto, meta: PublicMeta) {
        const signer = await this.resolve(token);
        const code = await this.prisma.verificationCode.findFirst({ where: { signer_id: signer.id, purpose: VerificationPurpose.SIGNER_IDENTITY, verified_at: null }, orderBy: { created_at: 'desc' } });
        if (!code || code.expires_at.getTime() < Date.now()) throw new GoneException({ message: 'The code has expired. Request a new one.', code: 'verification_expired' });
        if (code.locked_until && code.locked_until.getTime() > Date.now()) throw new HttpException({ message: 'Too many wrong codes. Try again in 15 minutes.', code: 'verification_locked' }, HttpStatus.TOO_MANY_REQUESTS);
        if (code.code_hash !== sha256(`${signer.id}:${dto.code}`)) {
            const attempts = code.attempts + 1;
            await this.prisma.verificationCode.update({ where: { id: code.id }, data: { attempts, ...(attempts >= code.max_attempts ? { locked_until: new Date(Date.now() + LOCKOUT_MS) } : {}) } });
            await this.audit.record(publicContext(signer.request.organization_id, meta), 'contract.signature_code_failed', { resource_type: 'contract', resource_id: signer.request.contract!.id, outcome: AuditOutcome.FAILURE, metadata: { signer_id: signer.id, attempts } });
            throw new BadRequestException({ message: attempts >= code.max_attempts ? 'Too many wrong codes. Try again in 15 minutes.' : `That code is not correct. ${code.max_attempts - attempts} attempt(s) left.`, code: 'verification_invalid' });
        }
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.verificationCode.update({ where: { id: code.id }, data: { verified_at: now, attempts: code.attempts + 1 } }),
            this.prisma.signer.update({ where: { id: signer.id }, data: { identity_verified_at: now } }),
        ]);
        await this.audit.record(publicContext(signer.request.organization_id, meta), 'contract.signature_identity_verified', { resource_type: 'contract', resource_id: signer.request.contract!.id, metadata: { request_id: signer.request_id, signer_id: signer.id, method: 'EMAIL_OTP' } });
        return { verified: true };
    }

    async sign(token: string, dto: SignDto, meta: PublicMeta) {
        const signer = await this.resolve(token);
        const r = signer.request;
        const all = await this.prisma.signer.findMany({ where: { request_id: r.id }, select: { status: true, order: true } });
        const state = this.stateOf(signer, all);
        if (state !== 'ACTIVE') throw new ConflictException({ message: 'This document cannot be signed right now', code: `signing_${state.toLowerCase()}` });
        if (!this.identityFresh(signer)) throw new ConflictException({ message: 'Verify your identity first', code: 'identity_not_verified' });
        const consent = await this.prisma.signatureConsentText.findFirst({ where: { id: dto.consent_text_id, organization_id: r.organization_id, retired_at: null } });
        if (!consent) throw new BadRequestException({ message: 'The consent text changed. Reload the page.', code: 'consent_text_invalid' });
        if (dto.signature_type === 'TYPED' && !dto.typed_name?.trim()) throw new BadRequestException({ message: 'Type your full name to sign', code: 'typed_name_required' });
        if (dto.signature_type === 'DRAWN' && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dto.signature_data_url ?? '')) {
            throw new BadRequestException({ message: 'Draw your signature to sign', code: 'signature_image_required' });
        }
        // The locked document must still be the one the signer reviewed.
        const sections = await this.prisma.contractSection.findMany({ where: { version_id: r.contract_version!.id } });
        const hash = sectionsHash(sections);
        if (r.contract_version!.content_hash && hash !== r.contract_version!.content_hash) {
            throw new ConflictException({ message: 'The document changed after it was sent. Ask the sender for a new link.', code: 'document_changed' });
        }

        const now = new Date();
        const ctx = publicContext(r.organization_id, meta);
        const signedEvent = await this.prisma.$transaction(async (tx) => {
            await tx.signer.update({
                where: { id: signer.id },
                data: {
                    status: SignerStatus.SIGNED, signed_at: now, signature_type: dto.signature_type as SignatureType, consent_text_id: consent.id, consent_accepted_at: now,
                    ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null, viewed_at: signer.viewed_at ?? now,
                },
            });
            return tx.signatureEvent.create({
                data: {
                    request_id: r.id, signer_id: signer.id, type: SignatureEventType.SIGNED, occurred_at: now, ip_address: meta.ip ?? null,
                    payload: {
                        signature_type: dto.signature_type, typed_name: dto.typed_name?.trim() ?? null, signature_data_url: dto.signature_type === 'DRAWN' ? dto.signature_data_url : null,
                        document_hash: hash, consent_text_id: consent.id, consent_version: consent.version, user_agent: meta.user_agent ?? null,
                    } as Prisma.InputJsonValue,
                },
            });
        });
        if (dto.signature_type === 'DRAWN' && dto.signature_data_url) {
            await this.storeDrawnSignature({
                organization_id: r.organization_id, contract_id: r.contract!.id, owner_membership_id: r.contract!.owner_membership_id ?? null,
                signer_id: signer.id, event_id: signedEvent.id, data_url: dto.signature_data_url,
            });
        }
        await this.audit.record(ctx, 'contract.signed_by_signer', { resource_type: 'contract', resource_id: r.contract!.id, metadata: { request_id: r.id, signer_id: signer.id, signer_email: signer.email, signature_type: dto.signature_type, document_hash: hash } });
        this.events.publish(ctx, {
            event_key: 'contracts.signature.signer_signed', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: r.id,
            payload: { contract_id: r.contract!.id, number: r.contract!.number, title: r.contract!.title, signer_name: signer.name, owner_membership_id: r.contract!.owner_membership_id },
        });
        await this.advance(r.id, ctx);
        return this.publicState(token, meta);
    }

    async decline(token: string, dto: DeclineDto, meta: PublicMeta) {
        const signer = await this.resolve(token);
        const r = signer.request;
        const all = await this.prisma.signer.findMany({ where: { request_id: r.id }, select: { status: true, order: true } });
        const state = this.stateOf(signer, all);
        if (state !== 'ACTIVE' && state !== 'WAITING') throw new ConflictException({ message: 'This request is already closed', code: `signing_${state.toLowerCase()}` });
        const now = new Date();
        const ctx = publicContext(r.organization_id, meta);
        await this.prisma.$transaction(async (tx) => {
            await tx.signer.update({ where: { id: signer.id }, data: { status: SignerStatus.DECLINED, declined_at: now, decline_reason: dto.reason, ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null } });
            await tx.signatureRequest.update({ where: { id: r.id }, data: { status: SignatureRequestStatus.DECLINED } });
            await tx.signatureEvent.create({ data: { request_id: r.id, signer_id: signer.id, type: SignatureEventType.DECLINED, ip_address: meta.ip ?? null, payload: { reason: dto.reason } } });
            await this.unlock(tx, r.contract!.id, r.contract_version!.id);
        });
        await this.audit.record(ctx, 'contract.signature_declined', { resource_type: 'contract', resource_id: r.contract!.id, metadata: { request_id: r.id, signer_id: signer.id, reason: dto.reason } });
        this.events.publish(ctx, {
            event_key: 'contracts.signature.declined', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: r.id,
            payload: { contract_id: r.contract!.id, number: r.contract!.number, title: r.contract!.title, signer_name: signer.name, reason: dto.reason, owner_membership_id: r.contract!.owner_membership_id },
        });
        return this.publicState(token, meta);
    }

    async publicCertificate(token: string) {
        const signer = await this.resolve(token);
        if (signer.request.status !== SignatureRequestStatus.FULLY_SIGNED) throw new ConflictException({ message: 'The certificate is available once everyone has signed', code: 'certificate_not_ready' });
        return this.buildCertificate(signer.request_id, signer.id);
    }

    // ===================================================================== internals

    /** After a signature: complete the request, or open the next sequential group. */
    private async advance(requestId: string, ctx: OrgContext) {
        const r = await this.prisma.signatureRequest.findUniqueOrThrow({ where: { id: requestId }, include: { signers: true, contract: true, contract_version: true } });
        const remaining = r.signers.filter((s) => s.status !== SignerStatus.SIGNED);
        const now = new Date();
        if (!remaining.length) {
            const contract = r.contract!;
            const signedHash = sha256(`${r.contract_version!.content_hash}|${r.signers.map((s) => `${s.email}:${s.signed_at?.toISOString()}`).join('|')}`);
            const startsLater = (contract.effective_date ?? contract.start_date)?.getTime() ?? 0;
            const activate = startsLater <= today().getTime();
            await this.prisma.$transaction(async (tx) => {
                await tx.signatureRequest.update({ where: { id: requestId }, data: { status: SignatureRequestStatus.FULLY_SIGNED, completed_at: now, signed_hash: signedHash } });
                await tx.contractVersion.update({ where: { id: r.contract_version!.id }, data: { status: ContractVersionStatus.SIGNED, signed_at: now, signed_hash: signedHash } });
                await tx.contract.update({
                    where: { id: contract.id },
                    data: { status: activate ? ContractStatus.ACTIVE : ContractStatus.FULLY_SIGNED, signed_version_id: r.contract_version!.id, signature_date: now, ...(activate ? { activated_at: now, effective_date: contract.effective_date ?? today() } : {}) },
                });
                if (contract.relation_kind === ContractRelationKind.RENEWAL && contract.parent_contract_id) {
                    await tx.contract.update({ where: { id: contract.parent_contract_id }, data: { status: ContractStatus.RENEWED, superseded_by_contract_id: contract.id } });
                }
                await tx.signatureEvent.create({ data: { request_id: requestId, type: SignatureEventType.COMPLETED, occurred_at: now, payload: { signed_hash: signedHash } } });
            });
            await this.audit.record(ctx, 'contract.fully_signed', { resource_type: 'contract', resource_id: contract.id, metadata: { request_id: requestId, signed_hash: signedHash, activated: activate } });
            const payload = { contract_id: contract.id, number: contract.number, title: contract.title, owner_membership_id: contract.owner_membership_id, request_id: requestId };
            this.events.publish(ctx, { event_key: 'contracts.signature.completed', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: requestId, payload });
            this.events.publish(ctx, {
                event_key: 'contracts.contract.signed', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contract.id, payload,
                activity: { summary: `Contract ${contract.number} fully signed`, entity_label: contract.title, company_id: contract.primary_company_id, branch_id: contract.branch_id },
            });
            for (const s of r.signers) {
                void this.mailer.send(s.email, `Signed: ${contract.title}`, [`Hello ${s.name},`, `All parties have signed "${contract.title}" (${contract.number}).`, 'The sender keeps the signed document and the completion certificate.']);
            }
            return;
        }
        await this.prisma.$transaction([
            this.prisma.signatureRequest.update({ where: { id: requestId }, data: { status: SignatureRequestStatus.PARTIALLY_SIGNED } }),
            this.prisma.contract.update({ where: { id: r.contract!.id }, data: { status: ContractStatus.PARTIALLY_SIGNED } }),
        ]);
        if (r.signing_order === SigningOrder.SEQUENTIAL) {
            const turn = Math.min(...remaining.map((s) => s.order));
            for (const s of remaining.filter((x) => x.order === turn && x.status === SignerStatus.PENDING)) {
                // Rotate only when the invitation can actually be emailed; otherwise staff hand out the link from the request page.
                if (this.mailer.configured) await this.rotate(requestId, s.id, s.name, s.email, r.contract!.title, r.contract!.number, true);
                await this.prisma.signer.update({ where: { id: s.id }, data: { status: SignerStatus.SENT, sent_at: now } });
                await this.prisma.signatureEvent.create({ data: { request_id: requestId, signer_id: s.id, type: SignatureEventType.SENT } });
            }
        }
    }

    private async rotate(requestId: string, signerId: string, name: string, email: string, title: string, number: string, sendEmail: boolean) {
        const token = newToken();
        await this.prisma.signer.update({ where: { id: signerId }, data: { access_token_hash: sha256(token) } });
        const url = this.signUrl(token);
        const emailed = sendEmail ? await this.emailInvite(title, number, name, email, url) : false;
        return { signer_id: signerId, name, email, url, emailed, request_id: requestId };
    }

    private emailInvite(title: string, number: string, name: string, email: string, url: string, message?: string | null) {
        return this.mailer.send(email, `Please sign: ${title}`, [
            `Hello ${name},`,
            `You have been asked to sign "${title}" (${number}).`,
            ...(message ? [message] : []),
            'You will confirm your identity with a one-time code sent to this email address before signing.',
        ], { label: 'Review and sign', url });
    }

    /** Return a locked version to APPROVED (editable via a new version) when signing stops without completion. */
    private async unlock(tx: Prisma.TransactionClient, contractId: string, versionId: string) {
        await tx.contractVersion.updateMany({ where: { id: versionId, status: ContractVersionStatus.LOCKED_FOR_SIGNATURE }, data: { status: ContractVersionStatus.APPROVED, locked_at: null } });
        await tx.contract.updateMany({ where: { id: contractId, status: { in: [ContractStatus.READY_FOR_SIGNATURE, ContractStatus.PARTIALLY_SIGNED] } }, data: { status: ContractStatus.READY_FOR_SIGNATURE } });
    }

    /** Org consent text (latest effective, locale en); seeded with the platform default on first use. */
    private async consentText(organizationId: string) {
        const existing = await this.prisma.signatureConsentText.findFirst({ where: { organization_id: organizationId, locale: 'en', retired_at: null, effective_date: { lte: new Date() } }, orderBy: { effective_date: 'desc' } });
        if (existing) return existing;
        try {
            return await this.prisma.signatureConsentText.create({ data: { organization_id: organizationId, version: `${new Date().getUTCFullYear()}-1`, locale: 'en', body: DEFAULT_CONSENT, effective_date: today() } });
        } catch {
            return this.prisma.signatureConsentText.findFirstOrThrow({ where: { organization_id: organizationId, locale: 'en' }, orderBy: { created_at: 'desc' } });
        }
    }

    /** 04 §40–41 — completion certificate data (rendered by the app; PDF storage comes with 17 Documents). */
    private async buildCertificate(requestId: string, viewerSignerId: string | null) {
        const r = await this.prisma.signatureRequest.findUniqueOrThrow({
            where: { id: requestId },
            include: {
                contract: { select: { number: true, title: true } },
                contract_version: { select: { label: true, content_hash: true, signed_hash: true } },
                signers: { orderBy: { order: 'asc' }, include: { consent_text: { select: { version: true, locale: true } } } },
                events: { orderBy: { occurred_at: 'asc' }, include: { signer: { select: { name: true } } } },
                organization: { select: { display_name: true, legal_name: true } },
            },
        });
        return {
            certificate_id: r.id,
            issued_by: r.organization.display_name || r.organization.legal_name,
            status: r.status,
            document: { number: r.contract?.number, title: r.contract?.title, version: r.contract_version?.label, content_hash: r.contract_version?.content_hash, signed_hash: r.signed_hash },
            signing_order: r.signing_order,
            created_at: r.created_at, sent_at: r.sent_at, completed_at: r.completed_at,
            signers: r.signers.map((s) => ({
                name: s.name, title: s.title, email: viewerSignerId && viewerSignerId !== s.id ? maskEmail(s.email) : s.email, order: s.order, status: s.status,
                auth_method: s.auth_method, identity_verified_at: s.identity_verified_at, consent_version: s.consent_text?.version ?? null, consent_accepted_at: s.consent_accepted_at,
                signature_type: s.signature_type, viewed_at: s.viewed_at, signed_at: s.signed_at, ip_address: s.ip_address, user_agent: s.user_agent,
            })),
            events: r.events.map((e) => ({ type: e.type, occurred_at: e.occurred_at, signer: e.signer?.name ?? null, ip_address: e.ip_address })),
        };
    }
}
