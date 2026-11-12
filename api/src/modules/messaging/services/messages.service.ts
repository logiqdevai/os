import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageKind, MessageMentionKind, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { EditMessageDto, MarkReadDto, PostMessageDto, SaveDraftDto, SaveMessageDto } from '../dto/message.dto';
import { InboxQuery, MessageListQuery, SearchMessagesQuery } from '../dto/messaging-query.schema';
import { parseBody, preview } from '../utils/message-format.utils';
import { ACTIVE_MEMBER, ChannelWithMe, MEMBERSHIP_PERSON_SELECT, MessagingAccessService, USER_PUBLIC_SELECT, personName } from './messaging-access.service';
import { MessagingRealtimeService } from './messaging-realtime.service';
import { attachmentKind } from './attachments.service';

export const MESSAGE_INCLUDE = {
    author: { select: MEMBERSHIP_PERSON_SELECT },
    author_user: { select: USER_PUBLIC_SELECT },
    reactions: { select: { emoji: true, membership_id: true, external_user_id: true, created_at: true }, orderBy: { created_at: 'asc' } },
    attachments: { select: { id: true, document_id: true, kind: true, file_name: true, mime_type: true, size_bytes: true, preview: true, duration_seconds: true }, orderBy: { sort_order: 'asc' } },
    mentions: { select: { kind: true, membership_id: true } },
} satisfies Prisma.MessageInclude;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

/** API shape of one message. Viewer-specific flags (`is_saved`) are only set on REST reads, never on realtime broadcasts. */
export function serializeMessage(m: MessageRow, extra: { is_saved?: boolean } = {}) {
    const deleted = !!m.deleted_at;
    const groups = new Map<string, { emoji: string; count: number; membership_ids: string[] }>();
    for (const r of m.reactions) {
        const g = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, membership_ids: [] };
        g.count += 1;
        if (r.membership_id) g.membership_ids.push(r.membership_id);
        groups.set(r.emoji, g);
    }
    const authorUser = m.author?.user ?? m.author_user;
    return {
        id: m.id,
        channel_id: m.channel_id,
        kind: m.kind,
        visibility: m.visibility,
        status: m.status,
        body: deleted ? '' : m.body,
        body_plain: deleted ? '' : m.body_plain,
        parent_message_id: m.parent_message_id,
        reply_count: m.reply_count,
        last_reply_at: m.last_reply_at,
        quoted_message_id: m.quoted_message_id,
        is_edited: m.is_edited,
        edited_at: m.edited_at,
        deleted_at: m.deleted_at,
        pinned_at: m.pinned_at,
        system_event: m.system_event,
        integration_source: m.integration_source,
        client_message_id: m.client_message_id,
        has_attachments: m.has_attachments,
        created_at: m.created_at,
        author: authorUser
            ? {
                membership_id: m.author_membership_id,
                user_id: authorUser.id,
                name: personName(authorUser),
                profile_photo_url: authorUser.profile_photo_url,
                job_title: m.author?.job_title ?? null,
                external: !m.author_membership_id,
            }
            : null,
        reactions: deleted ? [] : [...groups.values()],
        attachments: deleted ? [] : m.attachments,
        mentioned_membership_ids: m.mentions.filter((x) => x.kind === MessageMentionKind.MEMBER && x.membership_id).map((x) => x.membership_id as string),
        mentions_channel: m.mentions.some((x) => x.kind === MessageMentionKind.CHANNEL || x.kind === MessageMentionKind.EVERYONE),
        ...(extra.is_saved !== undefined ? { is_saved: extra.is_saved } : {}),
    };
}

export type SerializedMessage = ReturnType<typeof serializeMessage>;

/**
 * Messages, threads, reactions, pins, saved items, read state, drafts, search and inboxes (12 §10–24, §30, §46–47).
 * Every method runs the channel visibility check of MessagingAccessService first; REST, MCP and the socket gateway share it.
 */
@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly realtime: MessagingRealtimeService,
    ) { }

    // ------------------------------------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------------------------------------

    async list(ctx: OrgContext, channelId: string, query: MessageListQuery) {
        await this.access.channelForRead(ctx, channelId);
        const where: Prisma.MessageWhereInput = {
            channel_id: channelId,
            parent_message_id: null,
            status: { not: 'SCHEDULED' },
            OR: [{ deleted_at: null }, { reply_count: { gt: 0 } }],
        };
        const cursorId = query.before ?? query.after;
        if (cursorId) {
            const cursor = await this.prisma.message.findFirst({ where: { id: cursorId, channel_id: channelId }, select: { created_at: true } });
            if (!cursor) throw new NotFoundException({ message: 'Cursor message not found', code: 'message_not_found' });
            where.created_at = query.before ? { lt: cursor.created_at } : { gt: cursor.created_at };
        }
        const ascending = !!query.after;
        const rows = await this.prisma.message.findMany({
            where,
            include: MESSAGE_INCLUDE,
            orderBy: [{ created_at: ascending ? 'asc' : 'desc' }, { id: ascending ? 'asc' : 'desc' }],
            take: query.limit + 1,
        });
        const has_more = rows.length > query.limit;
        const page = rows.slice(0, query.limit);
        if (!ascending) page.reverse();
        return { data: await this.withSaved(ctx, page), has_more };
    }

    async thread(ctx: OrgContext, messageId: string) {
        const root = await this.messageForRead(ctx, messageId);
        if (root.parent_message_id) throw new BadRequestException({ message: 'Not a thread root', code: 'not_thread_root' });
        const replies = await this.prisma.message.findMany({
            where: { parent_message_id: root.id, status: { not: 'SCHEDULED' } },
            include: MESSAGE_INCLUDE,
            orderBy: { created_at: 'asc' },
            take: 500,
        });
        const following = ctx.membership_id
            ? !!(await this.prisma.messageThreadFollower.findUnique({ where: { root_message_id_membership_id: { root_message_id: root.id, membership_id: ctx.membership_id } } }))
            : false;
        const [rootSerialized, ...rest] = await this.withSaved(ctx, [root, ...replies]);
        return { root: rootSerialized, replies: rest, following };
    }

    async findOne(ctx: OrgContext, messageId: string) {
        const m = await this.messageForRead(ctx, messageId);
        return (await this.withSaved(ctx, [m]))[0];
    }

    async search(ctx: OrgContext, query: SearchMessagesQuery) {
        const rows = await this.prisma.message.findMany({
            where: {
                organization_id: ctx.organization_id,
                deleted_at: null,
                kind: { not: MessageKind.SYSTEM },
                status: { not: 'SCHEDULED' },
                ...(query.channel_id && { channel_id: query.channel_id }),
                channel: this.access.readableWhere(ctx),
                body_plain: { contains: query.q, mode: 'insensitive' },
            },
            include: { ...MESSAGE_INCLUDE, channel: { select: { id: true, name: true, kind: true, slug: true } } },
            orderBy: { created_at: 'desc' },
            take: query.limit,
        });
        const serialized = await this.withSaved(ctx, rows);
        return { data: serialized.map((m, i) => ({ ...m, channel: rows[i].channel })) };
    }

    // ------------------------------------------------------------------------------------------------
    // Writes
    // ------------------------------------------------------------------------------------------------

    async post(ctx: OrgContext, channelId: string, dto: PostMessageDto) {
        const authorId = this.access.requireMembership(ctx);
        const channel = await this.access.channelForMember(ctx, channelId);
        this.access.assertCanPost(channel, channel.me);
        await this.access.assertNotRestricted(ctx, channelId);

        if (dto.client_message_id) {
            const existing = await this.prisma.message.findFirst({ where: { channel_id: channelId, client_message_id: dto.client_message_id }, include: MESSAGE_INCLUDE });
            if (existing) return serializeMessage(existing, { is_saved: false });
        }

        let parentAuthorId: string | null = null;
        if (dto.parent_message_id) {
            const parent = await this.prisma.message.findFirst({ where: { id: dto.parent_message_id, channel_id: channelId }, select: { parent_message_id: true, deleted_at: true, author_membership_id: true } });
            if (!parent) throw new NotFoundException({ message: 'Thread not found', code: 'thread_not_found' });
            if (parent.parent_message_id) throw new BadRequestException({ message: 'Replies cannot have replies; reply in the thread instead', code: 'thread_depth' });
            if (parent.deleted_at) throw new BadRequestException({ message: 'This message was deleted', code: 'thread_deleted' });
            parentAuthorId = parent.author_membership_id;
        }
        if (dto.quoted_message_id) {
            const quoted = await this.prisma.message.findFirst({ where: { id: dto.quoted_message_id, organization_id: ctx.organization_id }, select: { channel_id: true } });
            if (!quoted) throw new NotFoundException({ message: 'Quoted message not found', code: 'message_not_found' });
            await this.access.channelForRead(ctx, quoted.channel_id);
        }

        const parsed = parseBody(dto.body);
        const memberIds = await this.access.memberIds(channelId);
        const mentionIds = await this.validMentionIds(ctx, parsed.mentioned_membership_ids);
        if (parsed.broadcast) await this.assertBroadcastAllowed(ctx, channel);
        const notified = new Set<string>(mentionIds);
        if (parsed.broadcast) memberIds.forEach((id) => notified.add(id));
        notified.delete(authorId);
        const notifiedMemberIds = [...notified].filter((id) => memberIds.includes(id));

        const attachments = dto.attachments ?? [];
        if (!dto.body.trim() && !attachments.length) throw new BadRequestException({ message: 'Write a message or attach a file', code: 'message_empty' });
        if (attachments.length) {
            // Only files uploaded to this channel or owned by the author can be attached (no linking of other people's documents).
            const docs = await this.prisma.document.count({
                where: {
                    id: { in: attachments.map((a) => a.document_id) },
                    organization_id: ctx.organization_id,
                    deleted_at: null,
                    OR: [{ owner_membership_id: authorId }, { attachments: { some: { entity_type: RecordEntityType.CHANNEL, entity_id: channelId } } }],
                },
            });
            if (docs !== new Set(attachments.map((a) => a.document_id)).size) throw new NotFoundException({ message: 'Attachment file not found', code: 'document_not_found' });
        }

        const now = new Date();
        const message = await this.prisma.$transaction(async (tx) => {
            const created = await tx.message.create({
                data: {
                    organization_id: ctx.organization_id,
                    channel_id: channelId,
                    kind: MessageKind.USER,
                    visibility: dto.visibility ?? 'INTERNAL',
                    status: 'SENT',
                    author_membership_id: authorId,
                    body: dto.body,
                    body_plain: parsed.plain,
                    parent_message_id: dto.parent_message_id ?? null,
                    quoted_message_id: dto.quoted_message_id ?? null,
                    client_message_id: dto.client_message_id ?? null,
                    sent_at: now,
                    has_links: parsed.has_links,
                    has_attachments: attachments.length > 0,
                    mentions: {
                        create: [
                            ...mentionIds.map((id) => ({ kind: MessageMentionKind.MEMBER, membership_id: id })),
                            ...(parsed.broadcast ? [{ kind: MessageMentionKind.CHANNEL, mentioned_channel_id: channelId }] : []),
                        ],
                    },
                    attachments: {
                        create: attachments.map((a, i) => ({
                            channel_id: channelId,
                            document_id: a.document_id,
                            kind: a.kind ?? attachmentKind(a.mime_type, a.file_name),
                            file_name: a.file_name,
                            mime_type: a.mime_type ?? null,
                            size_bytes: a.size_bytes ?? null,
                            uploaded_by_user_id: ctx.user_id,
                            sort_order: i,
                        })),
                    },
                },
                include: MESSAGE_INCLUDE,
            });
            await tx.channel.update({ where: { id: channelId }, data: { message_count: { increment: 1 }, last_message_at: now } });
            if (dto.parent_message_id) {
                await tx.message.update({ where: { id: dto.parent_message_id }, data: { reply_count: { increment: 1 }, last_reply_at: now } });
                const followers = [authorId, parentAuthorId, ...mentionIds].filter((id): id is string => !!id && memberIds.includes(id));
                for (const id of new Set(followers)) {
                    await tx.messageThreadFollower.upsert({
                        where: { root_message_id_membership_id: { root_message_id: dto.parent_message_id, membership_id: id } },
                        update: id === authorId ? { last_read_at: now } : {},
                        create: { root_message_id: dto.parent_message_id, membership_id: id, last_read_at: id === authorId ? now : null },
                    });
                }
            } else {
                await tx.channelReadState.updateMany({ where: { channel_id: channelId, membership_id: { in: memberIds.filter((id) => id !== authorId) } }, data: { unread_count: { increment: 1 } } });
            }
            if (notifiedMemberIds.length) {
                await tx.channelReadState.updateMany({ where: { channel_id: channelId, membership_id: { in: notifiedMemberIds } }, data: { mention_count: { increment: 1 } } });
            }
            if (!dto.parent_message_id) {
                await tx.channelReadState.upsert({
                    where: { channel_id_membership_id: { channel_id: channelId, membership_id: authorId } },
                    update: { last_read_message_id: created.id, last_read_at: now, unread_count: 0, mention_count: 0 },
                    create: { channel_id: channelId, membership_id: authorId, last_read_message_id: created.id, last_read_at: now },
                });
            }
            await tx.messageDraft.deleteMany({ where: { channel_id: channelId, membership_id: authorId, thread_root_message_id: dto.parent_message_id ?? null } });
            return created;
        });

        const serialized = serializeMessage(message);
        await this.audit.record(ctx, 'message.posted', { resource_type: 'message', resource_id: message.id, metadata: { channel_id: channelId, parent_message_id: dto.parent_message_id ?? null, mentions: mentionIds.length, broadcast: parsed.broadcast } });
        this.events.publish(ctx, {
            event_key: 'messaging.message.posted',
            module: ModuleKey.MESSAGING,
            entity_type: RecordEntityType.MESSAGE,
            entity_id: message.id,
            payload: {
                channel_id: channelId,
                channel_kind: channel.kind,
                channel_name: channel.name,
                message_id: message.id,
                parent_message_id: dto.parent_message_id ?? null,
                author_membership_id: authorId,
                mentioned_membership_ids: notifiedMemberIds,
                preview: preview(parsed.plain),
            },
        });
        this.realtime.toChannel(channelId, 'message.created', { channel_id: channelId, message: serialized });
        if (notifiedMemberIds.length) this.realtime.toMembers(notifiedMemberIds, 'mention.created', { channel_id: channelId, message_id: message.id });
        return { ...serialized, is_saved: false };
    }

    /** SYSTEM message (member joined/left, channel renamed/archived). Not counted as unread. */
    async postSystem(ctx: OrgContext, channelId: string, systemEvent: string, body: string) {
        const now = new Date();
        const message = await this.prisma.message.create({
            data: { organization_id: ctx.organization_id, channel_id: channelId, kind: MessageKind.SYSTEM, status: 'SENT', author_membership_id: ctx.membership_id, body, body_plain: body, system_event: systemEvent, sent_at: now },
            include: MESSAGE_INCLUDE,
        });
        await this.prisma.channel.update({ where: { id: channelId }, data: { message_count: { increment: 1 }, last_message_at: now } });
        this.realtime.toChannel(channelId, 'message.created', { channel_id: channelId, message: serializeMessage(message) });
        return message;
    }

    async edit(ctx: OrgContext, messageId: string, dto: EditMessageDto) {
        const me = this.access.requireMembership(ctx);
        const m = await this.messageForRead(ctx, messageId);
        if (m.author_membership_id !== me || m.kind !== MessageKind.USER) throw new ForbiddenException({ message: 'You can only edit your own messages', code: 'message_not_author' });
        if (m.deleted_at) throw new BadRequestException({ message: 'This message was deleted', code: 'message_deleted' });
        const channel = await this.access.channelForMember(ctx, m.channel_id);
        this.access.assertNotArchived(channel);
        const settings = await this.access.settings(ctx.organization_id);
        if (settings.edit_time_limit_minutes != null && Date.now() - m.created_at.getTime() > settings.edit_time_limit_minutes * 60_000) {
            throw new ForbiddenException({ message: `Messages can only be edited within ${settings.edit_time_limit_minutes} minutes`, code: 'edit_window_passed' });
        }
        if (dto.body === m.body) return (await this.withSaved(ctx, [m]))[0];
        const parsed = parseBody(dto.body);
        const mentionIds = await this.validMentionIds(ctx, parsed.mentioned_membership_ids);
        if (parsed.broadcast) await this.assertBroadcastAllowed(ctx, channel);

        const updated = await this.prisma.$transaction(async (tx) => {
            if (settings.preserve_edit_history) {
                const count = await tx.messageVersion.count({ where: { message_id: m.id } });
                await tx.messageVersion.create({ data: { message_id: m.id, version: count + 1, body: m.body, body_rich: m.body_rich ?? undefined, edited_by_user_id: ctx.user_id } });
            }
            await tx.messageMention.deleteMany({ where: { message_id: m.id, kind: { in: [MessageMentionKind.MEMBER, MessageMentionKind.CHANNEL] } } });
            return tx.message.update({
                where: { id: m.id },
                data: {
                    body: dto.body,
                    body_plain: parsed.plain,
                    has_links: parsed.has_links,
                    is_edited: true,
                    edited_at: new Date(),
                    mentions: {
                        create: [
                            ...mentionIds.map((id) => ({ kind: MessageMentionKind.MEMBER, membership_id: id })),
                            ...(parsed.broadcast ? [{ kind: MessageMentionKind.CHANNEL, mentioned_channel_id: m.channel_id }] : []),
                        ],
                    },
                },
                include: MESSAGE_INCLUDE,
            });
        });
        await this.audit.record(ctx, 'message.edited', { resource_type: 'message', resource_id: m.id, metadata: { channel_id: m.channel_id, before: { body: m.body }, after: { body: dto.body } } });
        this.events.publish(ctx, { event_key: 'messaging.message.updated', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: m.id, payload: { channel_id: m.channel_id, message_id: m.id } });
        const serialized = serializeMessage(updated);
        this.realtime.toChannel(m.channel_id, 'message.updated', { channel_id: m.channel_id, message: serialized });
        return (await this.withSaved(ctx, [updated]))[0];
    }

    async remove(ctx: OrgContext, messageId: string) {
        const me = this.access.requireMembership(ctx);
        const m = await this.messageForRead(ctx, messageId);
        if (m.deleted_at) return { success: true };
        const settings = await this.access.settings(ctx.organization_id);
        const own = m.author_membership_id === me;
        let reason: 'self' | 'admin';
        if (own && settings.allow_delete_own_messages && (settings.delete_own_time_limit_minutes == null || Date.now() - m.created_at.getTime() <= settings.delete_own_time_limit_minutes * 60_000)) {
            reason = 'self';
        } else if (ctx.can('messaging.messages.delete_any') && settings.allow_admin_delete_messages) {
            reason = 'admin';
        } else {
            throw new ForbiddenException({ message: own ? 'The time to delete this message has passed' : 'You can only delete your own messages', code: 'message_delete_denied' });
        }
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.message.update({ where: { id: m.id }, data: { deleted_at: now, deleted_by_user_id: ctx.user_id, delete_reason: reason, status: 'DELETED', pinned_at: null } });
            await tx.channelPin.deleteMany({ where: { message_id: m.id } });
            if (m.parent_message_id) await tx.message.update({ where: { id: m.parent_message_id }, data: { reply_count: { decrement: 1 } } });
        });
        await this.audit.record(ctx, 'message.deleted', { resource_type: 'message', resource_id: m.id, metadata: { channel_id: m.channel_id, reason, author_membership_id: m.author_membership_id } });
        this.events.publish(ctx, { event_key: 'messaging.message.deleted', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: m.id, payload: { channel_id: m.channel_id, reason } });
        this.realtime.toChannel(m.channel_id, 'message.deleted', { channel_id: m.channel_id, message_id: m.id, parent_message_id: m.parent_message_id, has_replies: m.reply_count > 0 });
        return { success: true };
    }

    async toggleReaction(ctx: OrgContext, messageId: string, emoji: string) {
        const me = this.access.requireMembership(ctx);
        const m = await this.messageForRead(ctx, messageId);
        if (m.deleted_at) throw new BadRequestException({ message: 'This message was deleted', code: 'message_deleted' });
        const channel = await this.access.channelForMember(ctx, m.channel_id);
        this.access.assertNotArchived(channel);
        const settings = await this.access.settings(ctx.organization_id);
        const allowed = (settings as { allowed_reactions?: string[] }).allowed_reactions ?? [];
        if (allowed.length && !allowed.includes(emoji)) throw new BadRequestException({ message: 'This reaction is not allowed in your organization', code: 'reaction_not_allowed' });

        const existing = await this.prisma.messageReaction.findFirst({ where: { message_id: m.id, emoji, membership_id: me } });
        if (existing) {
            await this.prisma.$transaction([
                this.prisma.messageReaction.delete({ where: { id: existing.id } }),
                this.prisma.message.update({ where: { id: m.id }, data: { reaction_count: { decrement: 1 } } }),
            ]);
        } else {
            await this.prisma.$transaction([
                this.prisma.messageReaction.create({ data: { message_id: m.id, emoji, membership_id: me } }),
                this.prisma.message.update({ where: { id: m.id }, data: { reaction_count: { increment: 1 } } }),
            ]);
        }
        const fresh = await this.prisma.message.findUniqueOrThrow({ where: { id: m.id }, include: MESSAGE_INCLUDE });
        const serialized = serializeMessage(fresh);
        this.audit.recordAsync(ctx, existing ? 'message.reaction_removed' : 'message.reaction_added', { resource_type: 'message', resource_id: m.id, metadata: { emoji } });
        this.events.publish(ctx, { event_key: existing ? 'messaging.reaction.removed' : 'messaging.reaction.added', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: m.id, payload: { channel_id: m.channel_id, emoji, author_membership_id: m.author_membership_id } });
        this.realtime.toChannel(m.channel_id, 'reaction.updated', { channel_id: m.channel_id, message_id: m.id, parent_message_id: m.parent_message_id, reactions: serialized.reactions });
        return { added: !existing, reactions: serialized.reactions };
    }

    async pin(ctx: OrgContext, messageId: string, pinned: boolean) {
        const me = this.access.requireMembership(ctx);
        const m = await this.messageForRead(ctx, messageId);
        if (m.deleted_at) throw new BadRequestException({ message: 'This message was deleted', code: 'message_deleted' });
        const channel = await this.access.channelForMember(ctx, m.channel_id);
        this.access.assertNotArchived(channel);
        if (pinned) {
            await this.prisma.$transaction([
                this.prisma.channelPin.upsert({ where: { channel_id_message_id: { channel_id: m.channel_id, message_id: m.id } }, update: {}, create: { channel_id: m.channel_id, message_id: m.id, pinned_by_membership_id: me } }),
                this.prisma.message.update({ where: { id: m.id }, data: { pinned_at: new Date() } }),
            ]);
        } else {
            await this.prisma.$transaction([
                this.prisma.channelPin.deleteMany({ where: { channel_id: m.channel_id, message_id: m.id } }),
                this.prisma.message.update({ where: { id: m.id }, data: { pinned_at: null } }),
            ]);
        }
        const fresh = await this.prisma.message.findUniqueOrThrow({ where: { id: m.id }, include: MESSAGE_INCLUDE });
        await this.audit.record(ctx, pinned ? 'message.pinned' : 'message.unpinned', { resource_type: 'message', resource_id: m.id, metadata: { channel_id: m.channel_id } });
        this.events.publish(ctx, { event_key: pinned ? 'messaging.message.pinned' : 'messaging.message.unpinned', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: m.id, payload: { channel_id: m.channel_id } });
        this.realtime.toChannel(m.channel_id, 'message.updated', { channel_id: m.channel_id, message: serializeMessage(fresh) });
        return (await this.withSaved(ctx, [fresh]))[0];
    }

    async pins(ctx: OrgContext, channelId: string) {
        await this.access.channelForRead(ctx, channelId);
        const pins = await this.prisma.channelPin.findMany({ where: { channel_id: channelId, message: { deleted_at: null } }, include: { message: { include: MESSAGE_INCLUDE } }, orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }] });
        return { data: await this.withSaved(ctx, pins.map((p) => p.message)) };
    }

    // ------------------------------------------------------------------------------------------------
    // Personal state: saved, read, drafts, threads & mentions inboxes
    // ------------------------------------------------------------------------------------------------

    async save(ctx: OrgContext, messageId: string, dto: SaveMessageDto, saved: boolean) {
        const me = this.access.requireMembership(ctx);
        const m = await this.messageForRead(ctx, messageId);
        if (saved) {
            await this.prisma.savedMessage.upsert({
                where: { membership_id_message_id: { membership_id: me, message_id: m.id } },
                update: { note: dto.note ?? undefined },
                create: { membership_id: me, message_id: m.id, note: dto.note ?? null },
            });
        } else {
            await this.prisma.savedMessage.deleteMany({ where: { membership_id: me, message_id: m.id } });
        }
        this.audit.recordAsync(ctx, saved ? 'message.saved' : 'message.unsaved', { resource_type: 'message', resource_id: m.id });
        this.realtime.toMembers([me], 'saved.updated', { message_id: m.id, is_saved: saved });
        return { message_id: m.id, is_saved: saved };
    }

    async savedList(ctx: OrgContext, query: InboxQuery) {
        const me = this.access.requireMembership(ctx);
        const rows = await this.prisma.savedMessage.findMany({
            where: { membership_id: me, message: { deleted_at: null, channel: this.access.readableWhere(ctx) } },
            include: { message: { include: { ...MESSAGE_INCLUDE, channel: { select: { id: true, name: true, kind: true, slug: true } } } } },
            orderBy: { created_at: 'desc' },
            take: query.limit,
        });
        return { data: rows.map((r) => ({ id: r.id, note: r.note, saved_at: r.created_at, message: { ...serializeMessage(r.message, { is_saved: true }), channel: r.message.channel } })) };
    }

    async markRead(ctx: OrgContext, channelId: string, dto: MarkReadDto) {
        const me = this.access.requireMembership(ctx);
        const channel = await this.access.channelForRead(ctx, channelId);
        if (!channel.me) return { channel_id: channelId, unread_count: 0, mention_count: 0 };
        const last = dto.message_id
            ? await this.prisma.message.findFirst({ where: { id: dto.message_id, channel_id: channelId }, select: { id: true } })
            : await this.prisma.message.findFirst({ where: { channel_id: channelId, parent_message_id: null }, orderBy: { created_at: 'desc' }, select: { id: true } });
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.channelReadState.upsert({
                where: { channel_id_membership_id: { channel_id: channelId, membership_id: me } },
                update: { last_read_message_id: last?.id ?? null, last_read_at: now, unread_count: 0, mention_count: 0, marked_unread_from_id: null },
                create: { channel_id: channelId, membership_id: me, last_read_message_id: last?.id ?? null, last_read_at: now },
            }),
            this.prisma.messageMention.updateMany({ where: { membership_id: me, read_at: null, message: { channel_id: channelId } }, data: { read_at: now } }),
            this.prisma.channelMember.update({ where: { id: channel.me.id }, data: { last_viewed_at: now } }),
        ]);
        this.realtime.toMembers([me], 'read', { channel_id: channelId, last_read_message_id: last?.id ?? null, unread_count: 0, mention_count: 0 });
        return { channel_id: channelId, last_read_message_id: last?.id ?? null, unread_count: 0, mention_count: 0 };
    }

    async markThreadRead(ctx: OrgContext, rootId: string) {
        const me = this.access.requireMembership(ctx);
        const root = await this.messageForRead(ctx, rootId);
        await this.prisma.messageThreadFollower.updateMany({ where: { root_message_id: root.id, membership_id: me }, data: { last_read_at: new Date() } });
        await this.prisma.messageMention.updateMany({ where: { membership_id: me, read_at: null, message: { parent_message_id: root.id } }, data: { read_at: new Date() } });
        return { success: true };
    }

    async follow(ctx: OrgContext, rootId: string, follow: boolean) {
        const me = this.access.requireMembership(ctx);
        const root = await this.messageForRead(ctx, rootId);
        if (follow) {
            await this.prisma.messageThreadFollower.upsert({
                where: { root_message_id_membership_id: { root_message_id: root.id, membership_id: me } },
                update: { muted: false },
                create: { root_message_id: root.id, membership_id: me, source: 'manual', last_read_at: new Date() },
            });
        } else {
            await this.prisma.messageThreadFollower.deleteMany({ where: { root_message_id: root.id, membership_id: me } });
        }
        return { following: follow };
    }

    async threadsInbox(ctx: OrgContext, query: InboxQuery) {
        const me = this.access.requireMembership(ctx);
        const rows = await this.prisma.messageThreadFollower.findMany({
            where: { membership_id: me, muted: false, root_message: { reply_count: { gt: 0 }, channel: this.access.readableWhere(ctx) } },
            include: { root_message: { include: { ...MESSAGE_INCLUDE, channel: { select: { id: true, name: true, kind: true, slug: true } } } } },
            orderBy: { root_message: { last_reply_at: 'desc' } },
            take: query.limit,
        });
        const items = await Promise.all(
            rows.map(async (r) => {
                const lastReplies = await this.prisma.message.findMany({ where: { parent_message_id: r.root_message_id, deleted_at: null }, include: MESSAGE_INCLUDE, orderBy: { created_at: 'desc' }, take: 2 });
                const unread = !!r.root_message.last_reply_at && (!r.last_read_at || r.root_message.last_reply_at > r.last_read_at);
                return { root: { ...serializeMessage(r.root_message), channel: r.root_message.channel }, last_replies: lastReplies.reverse().map((m) => serializeMessage(m)), unread, last_read_at: r.last_read_at };
            }),
        );
        return { data: query.unread ? items.filter((i) => i.unread) : items };
    }

    async mentionsInbox(ctx: OrgContext, query: InboxQuery) {
        const me = this.access.requireMembership(ctx);
        const rows = await this.prisma.messageMention.findMany({
            where: {
                membership_id: me,
                kind: MessageMentionKind.MEMBER,
                ...(query.unread && { read_at: null }),
                message: { deleted_at: null, channel: this.access.readableWhere(ctx) },
            },
            include: { message: { include: { ...MESSAGE_INCLUDE, channel: { select: { id: true, name: true, kind: true, slug: true } } } } },
            orderBy: { created_at: 'desc' },
            take: query.limit,
        });
        return { data: rows.map((r) => ({ id: r.id, read_at: r.read_at, created_at: r.created_at, message: { ...serializeMessage(r.message), channel: r.message.channel } })) };
    }

    async markMentionsRead(ctx: OrgContext) {
        const me = this.access.requireMembership(ctx);
        const res = await this.prisma.messageMention.updateMany({ where: { membership_id: me, read_at: null }, data: { read_at: new Date() } });
        return { updated: res.count };
    }

    async getDraft(ctx: OrgContext, channelId: string, threadRootId?: string) {
        const me = this.access.requireMembership(ctx);
        await this.access.channelForRead(ctx, channelId);
        return (await this.prisma.messageDraft.findFirst({ where: { channel_id: channelId, membership_id: me, thread_root_message_id: threadRootId ?? null } })) ?? null;
    }

    async saveDraft(ctx: OrgContext, channelId: string, dto: SaveDraftDto) {
        const me = this.access.requireMembership(ctx);
        await this.access.channelForMember(ctx, channelId);
        const threadRoot = dto.thread_root_message_id ?? null;
        const existing = await this.prisma.messageDraft.findFirst({ where: { channel_id: channelId, membership_id: me, thread_root_message_id: threadRoot } });
        if (!dto.body.trim()) {
            if (existing) await this.prisma.messageDraft.delete({ where: { id: existing.id } });
            return null;
        }
        if (threadRoot) {
            const root = await this.prisma.message.findFirst({ where: { id: threadRoot, channel_id: channelId }, select: { id: true } });
            if (!root) throw new NotFoundException({ message: 'Thread not found', code: 'thread_not_found' });
        }
        return existing
            ? this.prisma.messageDraft.update({ where: { id: existing.id }, data: { body: dto.body } })
            : this.prisma.messageDraft.create({ data: { channel_id: channelId, membership_id: me, thread_root_message_id: threadRoot, body: dto.body } });
    }

    async deleteDraft(ctx: OrgContext, channelId: string, threadRootId?: string) {
        const me = this.access.requireMembership(ctx);
        await this.prisma.messageDraft.deleteMany({ where: { channel_id: channelId, membership_id: me, thread_root_message_id: threadRootId ?? null } });
        return { success: true };
    }

    async drafts(ctx: OrgContext) {
        const me = this.access.requireMembership(ctx);
        const rows = await this.prisma.messageDraft.findMany({
            where: { membership_id: me, channel: this.access.readableWhere(ctx) },
            include: { channel: { select: { id: true, name: true, kind: true, slug: true } } },
            orderBy: { updated_at: 'desc' },
            take: 100,
        });
        return { data: rows };
    }

    // ------------------------------------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------------------------------------

    /** Message in a channel the caller may read (404 otherwise, so ids in private channels do not leak). */
    async messageForRead(ctx: OrgContext, messageId: string): Promise<MessageRow> {
        const m = await this.prisma.message.findFirst({ where: { id: messageId, organization_id: ctx.organization_id, channel: this.access.readableWhere(ctx) }, include: MESSAGE_INCLUDE });
        if (!m) throw new NotFoundException({ message: 'Message not found', code: 'message_not_found' });
        return m;
    }

    private async withSaved(ctx: OrgContext, rows: MessageRow[]) {
        if (!rows.length) return [];
        const saved = ctx.membership_id
            ? new Set((await this.prisma.savedMessage.findMany({ where: { membership_id: ctx.membership_id, message_id: { in: rows.map((r) => r.id) } }, select: { message_id: true } })).map((s) => s.message_id))
            : new Set<string>();
        return rows.map((r) => serializeMessage(r, { is_saved: saved.has(r.id) }));
    }

    private async validMentionIds(ctx: OrgContext, ids: string[]) {
        if (!ids.length) return [];
        const rows = await this.prisma.membership.findMany({ where: { id: { in: ids }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true } });
        return rows.map((r) => r.id);
    }

    private async assertBroadcastAllowed(ctx: OrgContext, channel: ChannelWithMe) {
        if (channel.kind === 'DIRECT' || channel.kind === 'GROUP_DIRECT') return;
        const settings = await this.access.settings(ctx.organization_id);
        const policy = settings.broadcast_mention_policy;
        if (policy === 'everyone' || ctx.can('messaging.channels.manage')) return;
        const role = channel.me?.role;
        if (policy === 'admins' && (role === 'OWNER' || role === 'ADMIN')) return;
        if (policy === 'owners' && role === 'OWNER') return;
        throw new ForbiddenException({ message: 'Only channel admins can notify everyone with @channel / @here', code: 'broadcast_mention_denied' });
    }

    /** Ids of channel members (for socket room joins). */
    activeMemberIds(channelId: string) {
        return this.prisma.channelMember.findMany({ where: { channel_id: channelId, ...ACTIVE_MEMBER, membership_id: { not: null } }, select: { membership_id: true } });
    }
}
