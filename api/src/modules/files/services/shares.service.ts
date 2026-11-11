import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DocumentShare, DocumentShareStatus, DocumentShareSubjectType, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { DocumentsService } from './documents.service';
import { FileSettingsService } from './file-settings.service';
import { CreateShareDto, ShareQuery, UpdateShareDto } from '../dto/shares.dto';
import { signDownloadToken } from '../utils/download-token.utils';
import { MEMBER_SELECT } from '../utils/serialize.utils';

const SHARE_KEY = 'documents.documents.share';
const LINK_TYPES: DocumentShareSubjectType[] = [DocumentShareSubjectType.PUBLIC_LINK, DocumentShareSubjectType.EXTERNAL_EMAIL];

const SHARE_INCLUDE = {
    document: { select: { id: true, title: true, filename: true, mimetype: true, is_sensitive: true } },
    folder: { select: { id: true, name: true } },
    membership: { select: MEMBER_SELECT },
    team: { select: { id: true, name: true } },
    portal_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
    shared_by: { select: MEMBER_SELECT },
} satisfies Prisma.DocumentShareInclude;

type ShareRow = Prisma.DocumentShareGetPayload<{ include: typeof SHARE_INCLUDE }>;

/** Shares of documents and folders (17 §9). Link tokens are shown once; password hashes are never returned. */
@Injectable()
export class SharesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly documents: DocumentsService,
        private readonly settings: FileSettingsService,
    ) { }

    private appUrl() {
        return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    }

    /** Public row: no password hash, token reduced to its last 4 characters. */
    private present(share: ShareRow | (DocumentShare & Partial<ShareRow>)) {
        const { link_password_hash, link_token, ...rest } = share;
        return {
            ...rest,
            has_password: !!link_password_hash,
            link_token_last4: link_token ? link_token.slice(-4) : null,
            document: share.document ? { ...share.document, title: share.document.title ?? share.document.filename } : share.document,
        };
    }

    /** Flip ACTIVE shares past their expiry to EXPIRED. */
    private expireStale(organizationId: string) {
        return this.prisma.documentShare.updateMany({ where: { organization_id: organizationId, status: DocumentShareStatus.ACTIVE, expires_at: { lt: new Date() } }, data: { status: DocumentShareStatus.EXPIRED } });
    }

    /** Minimal people/team picker for sharing, approvals and vault grants (active members only, no HR data). */
    async directory(ctx: OrgContext, search?: string) {
        const q = search?.trim();
        const [members, teams] = await Promise.all([
            this.prisma.membership.findMany({
                where: {
                    organization_id: ctx.organization_id,
                    status: 'ACTIVE',
                    type: 'INTERNAL',
                    ...(q && { user: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { display_name: { contains: q, mode: 'insensitive' } }, { first_name: { contains: q, mode: 'insensitive' } }, { last_name: { contains: q, mode: 'insensitive' } }] } }),
                },
                take: 50,
                select: MEMBER_SELECT,
                orderBy: { joined_at: 'asc' },
            }),
            this.prisma.team.findMany({
                where: { organization_id: ctx.organization_id, archived_at: null, ...(q && { name: { contains: q, mode: 'insensitive' } }) },
                take: 50,
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            }),
        ]);
        return { members, teams };
    }

    async findAll(ctx: OrgContext, query: ShareQuery) {
        await this.expireStale(ctx.organization_id);
        const and: Prisma.DocumentShareWhereInput[] = [
            // The shared document must be visible to the caller (folder shares are org-scoped).
            { OR: [{ document_id: null }, { document: { deleted_at: null, ...this.documents.scopeWhere(ctx) } }] },
        ];
        if (query.with_me || !ctx.can(SHARE_KEY)) {
            const teamIds = ctx.membership_id ? (await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } })).map((t) => t.team_id) : [];
            and.push({ OR: [{ membership_id: ctx.membership_id ?? '' }, { team_id: { in: teamIds } }] });
        }
        const where: Prisma.DocumentShareWhereInput = {
            organization_id: ctx.organization_id,
            AND: and,
            ...(query.document_id && { document_id: query.document_id }),
            ...(query.folder_id && { folder_id: query.folder_id }),
            ...(query.subject_type && { subject_type: query.subject_type }),
            ...(query.links && { subject_type: { in: LINK_TYPES } }),
            ...(query.status && { status: query.status }),
            ...(query.search && { OR: [{ external_email: { contains: query.search, mode: 'insensitive' } }, { document: { title: { contains: query.search, mode: 'insensitive' } } }, { folder: { name: { contains: query.search, mode: 'insensitive' } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.documentShare.findMany({ where, ...skipTake(query), orderBy: { created_at: query.order_direction ?? 'desc' }, include: SHARE_INCLUDE }),
            this.prisma.documentShare.count({ where }),
        ]);
        return paginate(items.map((s) => this.present(s)), total, query);
    }

    async create(ctx: OrgContext, dto: CreateShareDto) {
        if (!!dto.document_id === !!dto.folder_id) throw new BadRequestException({ message: 'Share exactly one document or one folder', code: 'share_target_required' });
        const settings = await this.settings.get(ctx.organization_id);
        const doc = dto.document_id ? await this.documents.getAccessible(ctx, dto.document_id) : null;
        const folder = dto.folder_id ? await this.prisma.folder.findFirst({ where: { id: dto.folder_id, organization_id: ctx.organization_id, deleted_at: null } }) : null;
        if (dto.folder_id && !folder) throw new NotFoundException({ message: 'Folder not found', code: 'folder_not_found' });

        const org = ctx.organization_id;
        const subject: Partial<Prisma.DocumentShareUncheckedCreateInput> = {};
        switch (dto.subject_type) {
            case DocumentShareSubjectType.MEMBERSHIP:
                if (!dto.membership_id || !(await this.prisma.membership.findFirst({ where: { id: dto.membership_id, organization_id: org } }))) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
                subject.membership_id = dto.membership_id;
                break;
            case DocumentShareSubjectType.TEAM:
                if (!dto.team_id || !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: org } }))) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
                subject.team_id = dto.team_id;
                break;
            case DocumentShareSubjectType.PORTAL_USER:
                if (!dto.portal_user_id || !(await this.prisma.customerPortalMembership.findFirst({ where: { user_id: dto.portal_user_id, organization_id: org } }))) throw new NotFoundException({ message: 'Portal user not found', code: 'portal_user_not_found' });
                subject.portal_user_id = dto.portal_user_id;
                break;
            case DocumentShareSubjectType.EXTERNAL_EMAIL:
                if (!dto.external_email) throw new BadRequestException({ message: 'An email address is required', code: 'external_email_required' });
                subject.external_email = dto.external_email.toLowerCase();
                subject.external_name = dto.external_name;
                break;
            case DocumentShareSubjectType.PUBLIC_LINK:
                if (!settings.public_links_enabled) throw new ForbiddenException({ message: 'Public links are disabled by your organization policy', code: 'public_links_disabled' });
                if (doc?.is_sensitive) throw new ForbiddenException({ message: 'Sensitive documents cannot be shared with a public link', code: 'public_link_sensitive' });
                break;
        }

        let expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;
        if (expiresAt && expiresAt <= new Date()) throw new BadRequestException({ message: 'The expiry must be in the future', code: 'share_expiry_past' });
        if (dto.subject_type === DocumentShareSubjectType.PUBLIC_LINK) {
            const max = new Date(Date.now() + settings.public_link_max_days * 86_400_000);
            if (!expiresAt) expiresAt = max;
            if (expiresAt > max) throw new BadRequestException({ message: `Public links can last at most ${settings.public_link_max_days} days`, code: 'share_expiry_too_long' });
        } else if (!expiresAt && settings.default_share_expiry_days) {
            expiresAt = new Date(Date.now() + settings.default_share_expiry_days * 86_400_000);
        }
        if (dto.pinned_version_id && !(doc && (await this.prisma.documentVersion.findFirst({ where: { id: dto.pinned_version_id, document_id: doc.id } })))) {
            throw new NotFoundException({ message: 'Pinned version not found', code: 'version_not_found' });
        }
        const isLink = LINK_TYPES.includes(dto.subject_type);
        if (dto.password && !isLink) throw new BadRequestException({ message: 'Passwords apply to link shares only', code: 'share_password_not_link' });
        const token = isLink ? randomBytes(24).toString('base64url') : null;

        const share = await this.prisma.documentShare.create({
            data: {
                organization_id: org,
                document_id: doc?.id ?? null,
                folder_id: folder?.id ?? null,
                subject_type: dto.subject_type,
                ...subject,
                link_token: token,
                link_password_hash: dto.password ? await bcrypt.hash(dto.password, 10) : null,
                permission: dto.permission ?? 'VIEW',
                allow_download: dto.allow_download ?? true,
                watermark: dto.watermark ?? false,
                pinned_version_id: dto.pinned_version_id ?? null,
                max_access_count: dto.max_access_count ?? null,
                max_download_count: dto.max_download_count ?? null,
                message: dto.message,
                expires_at: expiresAt,
                shared_by_membership_id: ctx.membership_id,
                shared_by_user_id: ctx.user_id,
            },
            include: SHARE_INCLUDE,
        });
        await this.audit.record(ctx, 'document.shared', {
            resource_type: doc ? 'document' : 'folder',
            resource_id: doc?.id ?? folder!.id,
            metadata: { share_id: share.id, subject_type: share.subject_type, permission: share.permission, expires_at: share.expires_at, pinned_version_id: share.pinned_version_id, password_protected: !!dto.password, external_email: share.external_email },
        });
        this.events.publish(ctx, {
            event_key: 'documents.document.shared',
            module: ModuleKey.DOCUMENTS,
            entity_type: doc ? RecordEntityType.DOCUMENT : null,
            entity_kind: doc ? 'document' : 'folder',
            entity_id: doc?.id ?? folder!.id,
            payload: { share_id: share.id, subject_type: share.subject_type, permission: share.permission, membership_id: share.membership_id, team_id: share.team_id, external_email: share.external_email, expires_at: share.expires_at, title: doc?.title ?? folder?.name },
            activity: { summary: `shared ${doc?.title ?? folder?.name}`, entity_label: doc?.title ?? folder?.name ?? null },
        });
        return { ...this.present(share), link_token: token, share_url: token ? `${this.appUrl()}/share/${token}` : null };
    }

    private async get(ctx: OrgContext, id: string) {
        const share = await this.prisma.documentShare.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!share) throw new NotFoundException({ message: 'Share not found', code: 'share_not_found' });
        if (share.document_id) await this.documents.getAccessible(ctx, share.document_id, { includeDeleted: true });
        return share;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateShareDto) {
        const before = await this.get(ctx, id);
        if (before.status === DocumentShareStatus.REVOKED) throw new ConflictException({ message: 'Revoked shares cannot be changed', code: 'share_revoked' });
        if (dto.expires_at !== undefined && dto.expires_at !== null && new Date(dto.expires_at) <= new Date()) throw new BadRequestException({ message: 'The expiry must be in the future', code: 'share_expiry_past' });
        if (before.subject_type === DocumentShareSubjectType.PUBLIC_LINK && dto.expires_at !== undefined) {
            const settings = await this.settings.get(ctx.organization_id);
            if (!dto.expires_at || new Date(dto.expires_at).getTime() > Date.now() + settings.public_link_max_days * 86_400_000) {
                throw new BadRequestException({ message: `Public links must expire within ${settings.public_link_max_days} days`, code: 'share_expiry_too_long' });
            }
        }
        const share = await this.prisma.documentShare.update({
            where: { id },
            data: {
                ...dto,
                ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }),
                // Extending an expired share re-activates it.
                ...(before.status === DocumentShareStatus.EXPIRED && dto.expires_at && { status: DocumentShareStatus.ACTIVE }),
            },
            include: SHARE_INCLUDE,
        });
        await this.audit.record(ctx, 'document.share_updated', { resource_type: 'document_share', resource_id: id, metadata: { before: { permission: before.permission, expires_at: before.expires_at, allow_download: before.allow_download }, after: dto } });
        return this.present(share);
    }

    async revoke(ctx: OrgContext, id: string) {
        const before = await this.get(ctx, id);
        if (before.status === DocumentShareStatus.REVOKED) return this.present(before);
        const share = await this.prisma.documentShare.update({ where: { id }, data: { status: DocumentShareStatus.REVOKED, revoked_at: new Date(), revoked_by_user_id: ctx.user_id }, include: SHARE_INCLUDE });
        await this.audit.record(ctx, 'document.share_revoked', { resource_type: 'document_share', resource_id: id, metadata: { document_id: share.document_id, folder_id: share.folder_id, subject_type: share.subject_type } });
        this.events.publish(ctx, { event_key: 'documents.share.revoked', module: ModuleKey.DOCUMENTS, entity_kind: 'document_share', entity_id: id, payload: { document_id: share.document_id, folder_id: share.folder_id, subject_type: share.subject_type } });
        return this.present(share);
    }

    // ---------------------------------------------------------------------------------------------
    // Public link resolution (no credential)
    // ---------------------------------------------------------------------------------------------

    private async activeLink(token: string) {
        const share = await this.prisma.documentShare.findUnique({
            where: { link_token: token },
            include: {
                document: { select: { id: true, title: true, filename: true, mimetype: true, size: true, current_version_id: true, deleted_at: true, updated_at: true } },
                folder: { select: { id: true, name: true, deleted_at: true } },
                organization: { select: { display_name: true, logo_url: true } },
            },
        });
        if (!share || share.status === DocumentShareStatus.REVOKED) throw new NotFoundException({ message: 'This link does not exist or was revoked', code: 'share_not_found' });
        if (share.status === DocumentShareStatus.EXPIRED || (share.expires_at && share.expires_at < new Date())) {
            if (share.status === DocumentShareStatus.ACTIVE) await this.prisma.documentShare.update({ where: { id: share.id }, data: { status: DocumentShareStatus.EXPIRED } });
            throw new NotFoundException({ message: 'This link has expired', code: 'share_expired' });
        }
        if (share.document?.deleted_at || share.folder?.deleted_at) throw new NotFoundException({ message: 'The shared item is no longer available', code: 'share_item_gone' });
        if (share.max_access_count && share.access_count >= share.max_access_count) throw new ForbiddenException({ message: 'This link reached its maximum number of opens', code: 'share_access_limit' });
        return share;
    }

    /** What the public share page shows before the password (no file access yet). */
    async resolvePublic(token: string) {
        const share = await this.activeLink(token);
        return {
            organization: share.organization,
            kind: share.document ? 'document' : 'folder',
            title: share.document ? (share.document.title ?? share.document.filename) : share.folder!.name,
            requires_password: !!share.link_password_hash,
            allow_download: share.allow_download,
            expires_at: share.expires_at,
            message: share.message,
            recipient_name: share.external_name,
        };
    }

    /** Open the link (password checked): counts the open and returns signed preview / download paths. */
    async accessPublic(token: string, password: string | undefined, meta: { ip?: string | null }) {
        const share = await this.activeLink(token);
        if (share.link_password_hash && !(password && (await bcrypt.compare(password, share.link_password_hash)))) {
            throw new UnauthorizedException({ message: 'The password is not correct', code: 'share_password_invalid' });
        }
        await this.prisma.documentShare.update({ where: { id: share.id }, data: { access_count: { increment: 1 }, last_accessed_at: new Date() } });
        await this.audit.record(null, 'document.share_opened', { resource_type: 'document_share', resource_id: share.id, metadata: { organization_id: share.organization_id, document_id: share.document_id, folder_id: share.folder_id, ip: meta.ip } });
        const settings = await this.settings.get(share.organization_id);
        const exp = Math.floor(Date.now() / 1000) + settings.signed_url_ttl_seconds;
        const sign = (versionId: string, d: 'inline' | 'attachment') => `/files/public/download/${signDownloadToken({ v: versionId, o: share.organization_id, d, e: exp, s: share.id })}`;

        const docs = share.document
            ? [share.document]
            : await this.prisma.document.findMany({
                where: { folder_id: share.folder_id, deleted_at: null, status: { not: 'ARCHIVED' } },
                select: { id: true, title: true, filename: true, mimetype: true, size: true, current_version_id: true, deleted_at: true, updated_at: true },
                orderBy: { title: 'asc' },
                take: 200,
            });
        const files = docs
            .map((d) => {
                const versionId = share.document && share.pinned_version_id ? share.pinned_version_id : d.current_version_id;
                if (!versionId) return null;
                return {
                    id: d.id,
                    title: d.title ?? d.filename,
                    filename: d.filename,
                    mimetype: d.mimetype,
                    size: d.size,
                    updated_at: d.updated_at,
                    preview_path: sign(versionId, 'inline'),
                    download_path: share.allow_download ? sign(versionId, 'attachment') : null,
                };
            })
            .filter(Boolean);
        return {
            organization: share.organization,
            kind: share.document ? 'document' : 'folder',
            title: share.document ? (share.document.title ?? share.document.filename) : share.folder!.name,
            allow_download: share.allow_download,
            expires_at: share.expires_at,
            message: share.message,
            links_expire_at: new Date(exp * 1000),
            files,
        };
    }
}
