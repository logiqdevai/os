import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelRestrictionKind, MessageReportStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBERSHIP_PERSON_SELECT, MessagingAccessService } from './messaging-access.service';
import { MessagingRealtimeService } from './messaging-realtime.service';

export const REPORT_REASONS = ['spam', 'abuse', 'sensitive_data', 'off_topic', 'other'] as const;

export const ReportMessageSchema = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(1000).optional() });
export type ReportMessageInput = z.infer<typeof ReportMessageSchema>;

export const ReportQuerySchema = z.object({
    status: z.nativeEnum(MessageReportStatus).optional(),
    channel_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const DecideReportSchema = z.object({
    status: z.enum([MessageReportStatus.UNDER_REVIEW, MessageReportStatus.ACTIONED, MessageReportStatus.DISMISSED]),
    /** hide = remove from view, content kept for audit; delete = content erased; mute / ban = restriction on the author in the channel. */
    action: z.enum(['none', 'hide', 'delete', 'mute', 'ban', 'warning']).default('none'),
    reason: z.string().trim().max(500).optional(),
    resolution_note: z.string().trim().max(2000).optional(),
    restriction_hours: z.number().int().min(1).max(24 * 365).optional(),
});
export type DecideReportInput = z.infer<typeof DecideReportSchema>;

export const CreateRestrictionSchema = z.object({
    membership_id: z.string().uuid(),
    channel_id: z.string().uuid().nullable().optional(),
    kind: z.nativeEnum(ChannelRestrictionKind),
    reason: z.string().trim().max(500).optional(),
    expires_at: z.string().datetime().nullable().optional(),
});
export type CreateRestrictionInput = z.infer<typeof CreateRestrictionSchema>;

const REPORT_INCLUDE = {
    reporter: { select: MEMBERSHIP_PERSON_SELECT },
    message: {
        select: {
            id: true, body: true, body_plain: true, created_at: true, deleted_at: true, delete_reason: true, metadata: true, channel_id: true, author_membership_id: true,
            author: { select: MEMBERSHIP_PERSON_SELECT },
            channel: { select: { id: true, name: true, kind: true, slug: true } },
        },
    },
} satisfies Prisma.MessageReportInclude;

/**
 * Moderation (12 §49–50, §64): members report messages; moderators (messaging.moderation.manage) review the queue and
 * hide / delete the message or mute / ban the author. Moderators see only the reported message and a little context,
 * even in private channels. Every decision is audited with the report id.
 */
@Injectable()
export class MessagingModerationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly realtime: MessagingRealtimeService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    async report(ctx: OrgContext, messageId: string, dto: ReportMessageInput) {
        const me = this.access.requireMembership(ctx);
        const msg = await this.prisma.message.findFirst({ where: { id: messageId, organization_id: ctx.organization_id, channel: this.access.readableWhere(ctx) }, select: { id: true, channel_id: true, author_membership_id: true, deleted_at: true } });
        if (!msg) throw new NotFoundException({ message: 'Message not found', code: 'message_not_found' });
        if (msg.deleted_at) throw new BadRequestException({ message: 'This message was already removed', code: 'message_deleted' });
        if (msg.author_membership_id === me) throw new BadRequestException({ message: 'You cannot report your own message', code: 'report_own_message' });
        const existing = await this.prisma.messageReport.findFirst({ where: { message_id: messageId, reporter_membership_id: me, status: { in: [MessageReportStatus.OPEN, MessageReportStatus.UNDER_REVIEW] } } });
        if (existing) return { id: existing.id, status: existing.status, duplicate: true };
        const report = await this.prisma.messageReport.create({ data: { organization_id: ctx.organization_id, message_id: messageId, reporter_membership_id: me, reason: dto.reason, details: dto.details ?? null } });
        await this.audit.record(ctx, 'message.reported', { resource_type: 'message', resource_id: messageId, metadata: { report_id: report.id, reason: dto.reason, channel_id: msg.channel_id } });
        // No PRIVATE content in the event: moderators open the queue.
        this.events.publish(ctx, { event_key: 'messaging.message.reported', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: messageId, payload: { report_id: report.id, reason: dto.reason, link: '/messages/admin/moderation' } });
        return { id: report.id, status: report.status, duplicate: false };
    }

    async reports(ctx: OrgContext, query: ReportQuery) {
        const where: Prisma.MessageReportWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status ? { status: query.status } : { status: { in: [MessageReportStatus.OPEN, MessageReportStatus.UNDER_REVIEW] } }),
            ...(query.channel_id && { message: { channel_id: query.channel_id } }),
        };
        const [rows, counts] = await Promise.all([
            this.prisma.messageReport.findMany({ where, include: REPORT_INCLUDE, orderBy: { created_at: 'desc' }, take: query.limit }),
            this.prisma.messageReport.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id }, _count: { _all: true } }),
        ]);
        return { data: rows.map((r) => this.serialize(r)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
    }

    private serialize(r: Prisma.MessageReportGetPayload<{ include: typeof REPORT_INCLUDE }>) {
        const erased = r.message.delete_reason === 'moderation_deleted';
        return { ...r, message: { ...r.message, body: erased ? '' : r.message.body, body_plain: erased ? '' : r.message.body_plain, hidden: !!r.message.deleted_at } };
    }

    /** A report with the reported message and up to 3 messages before and after it (context for the reviewer). */
    async reportDetail(ctx: OrgContext, id: string) {
        const report = await this.prisma.messageReport.findFirst({ where: { id, organization_id: ctx.organization_id }, include: REPORT_INCLUDE });
        if (!report) throw new NotFoundException({ message: 'Report not found', code: 'report_not_found' });
        const ctxSelect = { id: true, body_plain: true, created_at: true, deleted_at: true, author: { select: MEMBERSHIP_PERSON_SELECT } } as const;
        const [before, after, restrictions] = await Promise.all([
            this.prisma.message.findMany({ where: { channel_id: report.message.channel_id, parent_message_id: null, created_at: { lt: report.message.created_at } }, orderBy: { created_at: 'desc' }, take: 3, select: ctxSelect }),
            this.prisma.message.findMany({ where: { channel_id: report.message.channel_id, parent_message_id: null, created_at: { gt: report.message.created_at } }, orderBy: { created_at: 'asc' }, take: 3, select: ctxSelect }),
            report.message.author_membership_id
                ? this.prisma.channelMemberRestriction.findMany({ where: { organization_id: ctx.organization_id, membership_id: report.message.author_membership_id }, orderBy: { created_at: 'desc' }, take: 10 })
                : Promise.resolve([]),
        ]);
        this.audit.recordAsync(ctx, 'message.report_viewed', { resource_type: 'message_report', resource_id: id, metadata: { message_id: report.message_id } });
        const hide = (m: { deleted_at: Date | null; body_plain: string | null }) => ({ ...m, body_plain: m.deleted_at ? '' : m.body_plain });
        return { ...this.serialize(report), context: { before: before.reverse().map(hide), after: after.map(hide) }, author_restrictions: restrictions };
    }

    async decide(ctx: OrgContext, id: string, dto: DecideReportInput) {
        const report = await this.prisma.messageReport.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { message: { select: { id: true, channel_id: true, author_membership_id: true, deleted_at: true, parent_message_id: true, reply_count: true, metadata: true } } } });
        if (!report) throw new NotFoundException({ message: 'Report not found', code: 'report_not_found' });
        if (report.status === MessageReportStatus.ACTIONED || report.status === MessageReportStatus.DISMISSED) throw new ConflictException({ message: 'This report was already decided', code: 'report_closed' });
        if (dto.action !== 'none' && dto.action !== 'warning' && dto.status !== MessageReportStatus.ACTIONED) throw new BadRequestException({ message: 'Use status ACTIONED with an action', code: 'report_status_invalid' });
        const m = report.message;
        const now = new Date();
        if (dto.action === 'hide' || dto.action === 'delete') {
            if (dto.action === 'delete' && !ctx.can('messaging.messages.delete_any')) throw new ForbiddenException({ message: 'Deleting other people\'s messages needs messaging.messages.delete_any', code: 'permission_denied', permissions: ['messaging.messages.delete_any'] });
            if (!m.deleted_at) {
                await this.prisma.$transaction([
                    this.prisma.message.update({
                        where: { id: m.id },
                        data: {
                            deleted_at: now,
                            deleted_by_user_id: ctx.user_id,
                            delete_reason: dto.action === 'delete' ? 'moderation_deleted' : 'moderation_hidden',
                            status: 'DELETED',
                            pinned_at: null,
                            metadata: { ...((m.metadata as Record<string, unknown>) ?? {}), moderation: { action: dto.action, reason: dto.reason ?? null, report_id: id, at: now.toISOString() } } as Prisma.InputJsonValue,
                            ...(dto.action === 'delete' && { body: '', body_plain: '', body_rich: Prisma.DbNull }),
                        },
                    }),
                    this.prisma.channelPin.deleteMany({ where: { message_id: m.id } }),
                    ...(m.parent_message_id ? [this.prisma.message.update({ where: { id: m.parent_message_id }, data: { reply_count: { decrement: 1 } } })] : []),
                ]);
                this.realtime.toChannel(m.channel_id, 'message.deleted', { channel_id: m.channel_id, message_id: m.id, parent_message_id: m.parent_message_id, has_replies: m.reply_count > 0 });
            }
        }
        if ((dto.action === 'mute' || dto.action === 'ban') && m.author_membership_id) {
            if (dto.action === 'ban' && !ctx.can('messaging.channel_members.manage')) throw new ForbiddenException({ message: 'Banning needs messaging.channel_members.manage', code: 'permission_denied', permissions: ['messaging.channel_members.manage'] });
            await this.restrict(ctx, {
                membership_id: m.author_membership_id,
                channel_id: m.channel_id,
                kind: dto.action === 'ban' ? ChannelRestrictionKind.BANNED : ChannelRestrictionKind.MUTED,
                reason: dto.reason ?? `Report ${id}`,
                expires_at: dto.restriction_hours ? new Date(now.getTime() + dto.restriction_hours * 3600_000).toISOString() : null,
            });
        }
        const actionTaken = { none: 'none', warning: 'warning', hide: 'message_hidden', delete: 'message_deleted', mute: 'member_muted', ban: 'member_banned' }[dto.action];
        const updated = await this.prisma.messageReport.update({
            where: { id },
            data: { status: dto.status, reviewed_by_user_id: ctx.user_id, reviewed_at: now, action_taken: actionTaken, resolution_note: dto.resolution_note ?? dto.reason ?? null },
        });
        // Close other open reports of the same message with the same outcome.
        if (dto.status !== MessageReportStatus.UNDER_REVIEW) {
            await this.prisma.messageReport.updateMany({ where: { message_id: m.id, id: { not: id }, status: { in: [MessageReportStatus.OPEN, MessageReportStatus.UNDER_REVIEW] } }, data: { status: dto.status, reviewed_by_user_id: ctx.user_id, reviewed_at: now, action_taken: actionTaken } });
        }
        await this.audit.record(ctx, `message.report_${dto.status.toLowerCase()}`, {
            resource_type: 'message_report', resource_id: id,
            metadata: { message_id: m.id, channel_id: m.channel_id, action: dto.action, reason: dto.reason, author_membership_id: m.author_membership_id, sensitive: dto.action !== 'none' },
        });
        this.events.publish(ctx, { event_key: 'messaging.report.decided', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MESSAGE, entity_id: m.id, payload: { report_id: id, status: dto.status, action: dto.action } });
        return updated;
    }

    // ------------------------------------------------------------------ restrictions

    async restrictions(ctx: OrgContext, active = true) {
        const now = new Date();
        const rows = await this.prisma.channelMemberRestriction.findMany({
            where: { organization_id: ctx.organization_id, ...(active ? { lifted_at: null, OR: [{ expires_at: null }, { expires_at: { gt: now } }] } : {}) },
            include: { membership: { select: MEMBERSHIP_PERSON_SELECT }, channel: { select: { id: true, name: true, kind: true } } },
            orderBy: { created_at: 'desc' },
            take: 200,
        });
        return { data: rows };
    }

    async restrict(ctx: OrgContext, dto: CreateRestrictionInput) {
        const [target] = await this.access.assertOrgMembers(ctx, [dto.membership_id]);
        if (target === ctx.membership_id) throw new BadRequestException({ message: 'You cannot restrict yourself', code: 'restrict_self' });
        if (dto.channel_id && !(await this.prisma.channel.findFirst({ where: { id: dto.channel_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        if (dto.kind === ChannelRestrictionKind.BANNED && !ctx.can('messaging.channel_members.manage')) throw new ForbiddenException({ message: 'Banning needs messaging.channel_members.manage', code: 'permission_denied', permissions: ['messaging.channel_members.manage'] });
        const row = await this.prisma.channelMemberRestriction.create({
            data: { organization_id: ctx.organization_id, channel_id: dto.channel_id ?? null, membership_id: target, kind: dto.kind, reason: dto.reason ?? null, expires_at: dto.expires_at ? new Date(dto.expires_at) : null, created_by_user_id: ctx.user_id },
        });
        // A ban in a channel also removes the person from it (private channels become unreadable for them).
        if (dto.kind === ChannelRestrictionKind.BANNED) {
            await this.prisma.channelMember.updateMany({ where: { membership_id: target, removed_at: null, ...(dto.channel_id ? { channel_id: dto.channel_id } : { channel: { organization_id: ctx.organization_id, kind: { notIn: ['DIRECT', 'GROUP_DIRECT'] } } }) }, data: { removed_at: new Date(), removed_by_user_id: ctx.user_id } });
            this.realtime.toMembers([target], 'channel.removed', { channel_id: dto.channel_id ?? null });
        }
        await this.audit.record(ctx, `messaging.member.${dto.kind === ChannelRestrictionKind.BANNED ? 'banned' : 'muted'}`, { resource_type: 'membership', resource_id: target, metadata: { restriction_id: row.id, channel_id: dto.channel_id ?? null, reason: dto.reason, expires_at: dto.expires_at ?? null, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.member.restricted', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.MEMBERSHIP, entity_id: target, payload: { kind: dto.kind, channel_id: dto.channel_id ?? null } });
        return row;
    }

    async lift(ctx: OrgContext, id: string) {
        const row = await this.prisma.channelMemberRestriction.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Restriction not found', code: 'restriction_not_found' });
        if (row.lifted_at) return row;
        const updated = await this.prisma.channelMemberRestriction.update({ where: { id }, data: { lifted_at: new Date(), lifted_by_user_id: ctx.user_id } });
        await this.audit.record(ctx, 'messaging.member.restriction_lifted', { resource_type: 'membership', resource_id: row.membership_id, metadata: { restriction_id: id, kind: row.kind, channel_id: row.channel_id } });
        this.events.publish(ctx, { event_key: 'messaging.member.restriction_lifted', module: ModuleKey.MESSAGING, entity_kind: 'channel_member_restriction', entity_id: id, payload: { kind: row.kind } });
        return updated;
    }
}
