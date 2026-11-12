import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { DocumentSource, MessageAttachmentKind, ModuleKey, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { DocumentsService, IncomingFile } from '@/modules/files/services/documents.service';
import { MessagingAccessService } from './messaging-access.service';

/** Attachment kind from the MIME type (12 §22). */
export function attachmentKind(mime: string | null | undefined, filename = ''): MessageAttachmentKind {
    const m = (mime ?? '').toLowerCase();
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (m.startsWith('image/')) return MessageAttachmentKind.IMAGE;
    if (m === 'application/pdf') return MessageAttachmentKind.PDF;
    if (m.startsWith('video/')) return MessageAttachmentKind.VIDEO;
    if (m.startsWith('audio/')) return MessageAttachmentKind.AUDIO;
    if (/spreadsheet|excel|csv/.test(m) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return MessageAttachmentKind.SPREADSHEET;
    if (/presentation|powerpoint/.test(m) || ['ppt', 'pptx', 'key', 'odp'].includes(ext)) return MessageAttachmentKind.PRESENTATION;
    if (/zip|compressed|tar|rar|7z/.test(m) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return MessageAttachmentKind.ARCHIVE;
    if (/word|document|text\//.test(m) || ['doc', 'docx', 'odt', 'txt', 'md', 'rtf'].includes(ext)) return MessageAttachmentKind.DOCUMENT;
    return MessageAttachmentKind.OTHER;
}

/**
 * Files in messages (12 §22, §45). Bytes, versions and storage belong to 17 Documents: uploads go through
 * DocumentsService.attachToEntity (CHANNEL record, authorized by the channel's posting rules), the message then links
 * the document with a MessageAttachment row. Downloads get a short-lived signed URL after the channel read check.
 */
@Injectable()
export class MessagingAttachmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly documents: DocumentsService,
        private readonly audit: AuditService,
    ) { }

    async upload(ctx: OrgContext, channelId: string, file: IncomingFile | undefined) {
        if (!file?.buffer?.length) throw new BadRequestException({ message: 'Choose a file (multipart field "file")', code: 'file_required' });
        const channel = await this.access.channelForMember(ctx, channelId);
        this.access.assertCanPost(channel, channel.me);
        await this.access.assertNotRestricted(ctx, channelId);
        const settings = await this.access.settings(ctx.organization_id);
        const policy = (settings.file_policy ?? {}) as { max_file_size_bytes?: number; blocked_extensions?: string[] };
        if (policy.max_file_size_bytes && file.buffer.length > policy.max_file_size_bytes) {
            throw new PayloadTooLargeException({ message: `Files in messages can be at most ${Math.round(policy.max_file_size_bytes / 1048576)} MB`, code: 'file_too_large' });
        }
        const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
        if (policy.blocked_extensions?.map((e) => e.replace(/^\./, '').toLowerCase()).includes(ext)) throw new BadRequestException({ message: `.${ext} files are not allowed in messages`, code: 'file_type_blocked' });
        const doc = await this.documents.attachToEntity(ctx, {
            buffer: file.buffer,
            filename: file.originalname || 'file',
            mimetype: file.mimetype || 'application/octet-stream',
            entity_type: RecordEntityType.CHANNEL,
            entity_id: channelId,
            project_id: channel.project_id ?? undefined,
            role: 'message_attachment',
            source: DocumentSource.UPLOAD,
            source_module: ModuleKey.MESSAGING,
            authorized_by_module: true,
        });
        return {
            document_id: doc.id,
            file_name: file.originalname || 'file',
            mime_type: file.mimetype || null,
            size_bytes: file.buffer.length,
            kind: attachmentKind(file.mimetype, file.originalname),
        };
    }

    /** Signed URL for an attachment of a message the caller can read (inline for previews, attachment for download). */
    async url(ctx: OrgContext, attachmentId: string, disposition: 'inline' | 'attachment') {
        const att = await this.prisma.messageAttachment.findFirst({
            where: { id: attachmentId, message: { organization_id: ctx.organization_id, deleted_at: null, channel: this.access.readableWhere(ctx) } },
            select: { id: true, document_id: true, channel_id: true, message_id: true, file_name: true },
        });
        if (!att) throw new NotFoundException({ message: 'File not found', code: 'attachment_not_found' });
        const res = await this.documents.issueRecordDownloadUrl(ctx.organization_id, att.document_id, disposition);
        if (disposition === 'attachment') this.audit.recordAsync(ctx, 'message.attachment_downloaded', { resource_type: 'message', resource_id: att.message_id, metadata: { attachment_id: att.id, document_id: att.document_id, channel_id: att.channel_id } });
        return res;
    }

    /** Files shared in a channel (newest first). */
    async channelFiles(ctx: OrgContext, channelId: string, limit = 50) {
        await this.access.channelForRead(ctx, channelId);
        const rows = await this.prisma.messageAttachment.findMany({
            where: { channel_id: channelId, message: { deleted_at: null } },
            orderBy: { created_at: 'desc' },
            take: Math.min(200, limit),
            select: { id: true, message_id: true, document_id: true, kind: true, file_name: true, mime_type: true, size_bytes: true, created_at: true, message: { select: { author: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } } } },
        });
        return { data: rows };
    }
}
