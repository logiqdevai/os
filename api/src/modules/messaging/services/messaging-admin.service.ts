import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
    ChannelInvitationStatus, ChannelKind, ChannelNotificationLevel, MessageKind, MessageReportStatus, MessagingIntegrationKind, MessagingIntegrationStatus, ModuleKey, Prisma,
} from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { sha256 } from '@/shared/authorization/credentials.service';
import { MessagingAccessService, personName } from './messaging-access.service';
import { MESSAGE_INCLUDE, serializeMessage } from './messages.service';
import { MessagingRealtimeService } from './messaging-realtime.service';
import { parseBody } from '../utils/message-format.utils';

// ---------------------------------------------------------------------------------------------- schemas

export const OverviewQuerySchema = z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') });
export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;

export const MessagingSettingsSchema = z.object({
    allow_delete_own_messages: z.boolean(),
    delete_own_time_limit_minutes: z.number().int().min(1).max(525_600).nullable(),
    allow_admin_delete_messages: z.boolean(),
    edit_time_limit_minutes: z.number().int().min(1).max(525_600).nullable(),
    preserve_edit_history: z.boolean(),
    allowed_reactions: z.array(z.string().min(1).max(64)).max(100),
    read_receipts_direct: z.boolean(),
    read_receipts_group: z.boolean(),
    read_receipts_customer: z.boolean(),
    presence_visibility: z.enum(['everyone', 'members', 'nobody']),
    default_notification_level: z.nativeEnum(ChannelNotificationLevel),
    external_access_enabled: z.boolean(),
    guest_access_enabled: z.boolean(),
    guest_default_expiry_days: z.number().int().min(1).max(3650).nullable(),
    broadcast_mention_policy: z.enum(['everyone', 'admins', 'owners']),
    announcement_policy: z.enum(['everyone', 'admins', 'owners']),
    auto_create_project_channels: z.boolean(),
    voice_messages_enabled: z.boolean(),
    calls_enabled: z.boolean(),
    call_provider: z.enum(['internal', 'google_meet', 'zoom', 'teams', 'custom']).nullable(),
    file_policy: z.object({ max_file_size_bytes: z.number().int().min(1024).max(2_147_483_647).nullable().optional(), blocked_extensions: z.array(z.string().max(20)).max(100).optional() }).nullable(),
    admin_private_message_access_enabled: z.boolean(),
    notification_previews_include_text: z.boolean(),
}).partial();
export type MessagingSettingsInput = z.infer<typeof MessagingSettingsSchema>;

export const GuestQuerySchema = z.object({ search: z.string().trim().max(100).optional(), expiring_days: z.coerce.number().int().min(1).max(365).optional() });
export type GuestQuery = z.infer<typeof GuestQuerySchema>;

export const UpdateGuestSchema = z.object({ access_expires_at: z.string().datetime().nullable(), external_label: z.string().trim().max(120).nullable().optional() });
export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

const INTEGRATION_KINDS = [MessagingIntegrationKind.INBOUND_WEBHOOK, MessagingIntegrationKind.BOT, MessagingIntegrationKind.CUSTOM] as const;
export const IntegrationSchema = z.object({
    kind: z.enum(INTEGRATION_KINDS).default(MessagingIntegrationKind.INBOUND_WEBHOOK),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    bot_display_name: z.string().trim().max(80).nullable().optional(),
    default_channel_id: z.string().uuid(),
    allowed_channel_ids: z.array(z.string().uuid()).max(50).default([]),
    rate_limit_per_minute: z.number().int().min(1).max(600).nullable().optional(),
});
export type IntegrationInput = z.infer<typeof IntegrationSchema>;
export const UpdateIntegrationSchema = IntegrationSchema.partial().extend({ status: z.enum([MessagingIntegrationStatus.ACTIVE, MessagingIntegrationStatus.DISABLED]).optional() });
export type UpdateIntegrationInput = z.infer<typeof UpdateIntegrationSchema>;

export const InboundHookSchema = z.object({
    text: z.string().trim().min(1).max(8000),
    channel_id: z.string().uuid().optional(),
    /** Provider event id for idempotency (retries post once). */
    event_id: z.string().max(200).optional(),
    source: z.string().max(60).optional(),
});
export type InboundHookInput = z.infer<typeof InboundHookSchema>;

const day = 86_400_000;
const GUEST_ROLES = ['GUEST', 'EXTERNAL'] as const;

/**
 * Messaging administration (12 §50, §53, §66, §80, §82, §104): usage overview (aggregates only, no per-person productivity),
 * guests & external participants, organization settings, and integrations / inbound webhooks that post into channels.
 */
@Injectable()
export class MessagingAdminService {
    private readonly hookHits = new Map<string, number[]>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly realtime: MessagingRealtimeService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // ------------------------------------------------------------------ overview

    async overview(ctx: OrgContext, query: OverviewQuery) {
        const days = Number(query.range.replace('d', ''));
        const now = new Date();
        const from = new Date(now.getTime() - days * day);
        const org = ctx.organization_id;
        const inRange: Prisma.MessageWhereInput = { organization_id: org, created_at: { gte: from }, kind: { not: MessageKind.SYSTEM } };
        const [
            channelsByKind, messages, dms, replies, reactions, files, fileBytes, guests, openReports, restrictions, calls, activeAuthors, topChannels, members,
        ] = await Promise.all([
            this.prisma.channel.groupBy({ by: ['kind', 'status'], where: { organization_id: org, status: { not: 'DELETED' } }, _count: { _all: true } }),
            this.prisma.message.count({ where: inRange }),
            this.prisma.message.count({ where: { ...inRange, channel: { kind: { in: [ChannelKind.DIRECT, ChannelKind.GROUP_DIRECT] } } } }),
            this.prisma.message.count({ where: { ...inRange, parent_message_id: { not: null } } }),
            this.prisma.messageReaction.count({ where: { message: { organization_id: org }, created_at: { gte: from } } }),
            this.prisma.messageAttachment.count({ where: { channel: { organization_id: org }, created_at: { gte: from } } }),
            this.prisma.messageAttachment.aggregate({ where: { channel: { organization_id: org } }, _sum: { size_bytes: true }, _count: { _all: true } }),
            this.prisma.channelMember.count({ where: { channel: { organization_id: org }, left_at: null, removed_at: null, OR: [{ external_user_id: { not: null } }, { role: { in: [...GUEST_ROLES] } }] } }),
            this.prisma.messageReport.count({ where: { organization_id: org, status: { in: [MessageReportStatus.OPEN, MessageReportStatus.UNDER_REVIEW] } } }),
            this.prisma.channelMemberRestriction.count({ where: { organization_id: org, lifted_at: null, OR: [{ expires_at: null }, { expires_at: { gt: now } }] } }),
            this.prisma.channelCall.count({ where: { organization_id: org, started_at: { gte: from } } }),
            this.prisma.message.groupBy({ by: ['author_membership_id'], where: { ...inRange, author_membership_id: { not: null } } }),
            this.prisma.message.groupBy({ by: ['channel_id'], where: { ...inRange, channel: { kind: { notIn: [ChannelKind.DIRECT, ChannelKind.GROUP_DIRECT] } } }, _count: { _all: true }, orderBy: { _count: { channel_id: 'desc' } }, take: 8 }),
            this.prisma.membership.count({ where: { organization_id: org, status: 'ACTIVE', type: 'INTERNAL' } }),
        ]);
        const channelNames = await this.prisma.channel.findMany({ where: { id: { in: topChannels.map((t) => t.channel_id) } }, select: { id: true, name: true, kind: true } });
        // Daily series (count per day; ranges are at most 90 days).
        const buckets = Array.from({ length: days }, (_, i) => {
            const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + i + 1));
            return { start, end: new Date(start.getTime() + day) };
        });
        const series = await Promise.all(buckets.map(async (b) => ({ date: b.start.toISOString().slice(0, 10), messages: await this.prisma.message.count({ where: { ...inRange, created_at: { gte: b.start, lt: b.end } } }) })));
        const byKind: Record<string, number> = {};
        let archived = 0;
        for (const g of channelsByKind) {
            if (g.status === 'ARCHIVED') archived += g._count._all;
            else byKind[g.kind] = (byKind[g.kind] ?? 0) + g._count._all;
        }
        return {
            range: query.range,
            totals: {
                messages, direct_messages: dms, thread_replies: replies, reactions, files, calls,
                active_members: activeAuthors.length, members, guests, open_reports: openReports, active_restrictions: restrictions,
                storage_bytes: Number(fileBytes._sum.size_bytes ?? 0), stored_files: fileBytes._count._all, archived_channels: archived,
            },
            channels_by_kind: byKind,
            top_channels: topChannels.map((t) => ({ channel_id: t.channel_id, name: channelNames.find((c) => c.id === t.channel_id)?.name ?? '—', kind: channelNames.find((c) => c.id === t.channel_id)?.kind ?? null, messages: t._count._all })),
            series,
        };
    }

    // ------------------------------------------------------------------ settings

    async getSettings(ctx: OrgContext) {
        const row = await this.prisma.messagingSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        return row ?? { ...(await this.access.settings(ctx.organization_id)), organization_id: ctx.organization_id, persisted: false };
    }

    async updateSettings(ctx: OrgContext, dto: MessagingSettingsInput) {
        const before = await this.prisma.messagingSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        const data = { ...dto, ...(dto.file_policy !== undefined && { file_policy: (dto.file_policy ?? Prisma.DbNull) as Prisma.InputJsonValue }) } as Prisma.MessagingSettingsUncheckedUpdateInput;
        const row = await this.prisma.messagingSettings.upsert({
            where: { organization_id: ctx.organization_id },
            update: data,
            create: { ...(data as Prisma.MessagingSettingsUncheckedCreateInput), organization_id: ctx.organization_id },
        });
        const changed = Object.keys(dto).filter((k) => JSON.stringify((before as Record<string, unknown> | null)?.[k]) !== JSON.stringify((row as Record<string, unknown>)[k]));
        const sensitive = changed.some((k) => ['external_access_enabled', 'guest_access_enabled', 'admin_private_message_access_enabled', 'file_policy', 'allow_admin_delete_messages'].includes(k));
        await this.audit.record(ctx, 'messaging.settings.updated', {
            resource_type: 'messaging_settings', resource_id: ctx.organization_id,
            metadata: { changed, before: before ? Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])) : null, after: Object.fromEntries(changed.map((k) => [k, (row as Record<string, unknown>)[k]])), sensitive },
        });
        this.events.publish(ctx, { event_key: 'messaging.settings.updated', module: ModuleKey.MESSAGING, entity_kind: 'messaging_settings', entity_id: ctx.organization_id, payload: { changed } });
        return row;
    }

    // ------------------------------------------------------------------ guests & external participants

    async guests(ctx: OrgContext, query: GuestQuery) {
        const now = new Date();
        const rows = await this.prisma.channelMember.findMany({
            where: {
                channel: { organization_id: ctx.organization_id, status: { not: 'DELETED' } },
                left_at: null,
                removed_at: null,
                OR: [{ external_user_id: { not: null } }, { role: { in: [...GUEST_ROLES] } }],
                ...(query.expiring_days && { access_expires_at: { lte: new Date(now.getTime() + query.expiring_days * day) } }),
            },
            include: {
                channel: { select: { id: true, name: true, kind: true } },
                external_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
                membership: { select: { id: true, user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } } },
            },
            orderBy: { joined_at: 'desc' },
            take: 500,
        });
        const people = new Map<string, { key: string; name: string; email: string | null; label: string | null; guest_kind: string | null; external: boolean; memberships: { id: string; channel: { id: string; name: string | null; kind: string }; role: string; access_expires_at: Date | null; joined_at: Date; last_viewed_at: Date | null }[] }>();
        for (const r of rows) {
            const user = r.external_user ?? r.membership?.user ?? null;
            const key = r.external_user_id ?? r.membership_id ?? r.id;
            const name = personName(user);
            if (query.search && !`${name} ${user?.email ?? ''} ${r.external_label ?? ''}`.toLowerCase().includes(query.search.toLowerCase())) continue;
            const p = people.get(key) ?? { key, name, email: user?.email ?? null, label: r.external_label, guest_kind: r.guest_kind, external: !!r.external_user_id, memberships: [] };
            p.memberships.push({ id: r.id, channel: r.channel, role: r.role, access_expires_at: r.access_expires_at, joined_at: r.joined_at, last_viewed_at: r.last_viewed_at });
            people.set(key, p);
        }
        const invitations = await this.prisma.channelInvitation.findMany({
            where: { organization_id: ctx.organization_id, status: ChannelInvitationStatus.PENDING },
            include: { channel: { select: { id: true, name: true } } },
            orderBy: { created_at: 'desc' },
            take: 200,
        });
        const settings = await this.access.settings(ctx.organization_id);
        return { guest_access_enabled: !!settings.guest_access_enabled, external_access_enabled: !!settings.external_access_enabled, data: [...people.values()], invitations };
    }

    private async guestMember(ctx: OrgContext, memberId: string) {
        const m = await this.prisma.channelMember.findFirst({ where: { id: memberId, channel: { organization_id: ctx.organization_id }, OR: [{ external_user_id: { not: null } }, { role: { in: [...GUEST_ROLES] } }] }, include: { channel: { select: { id: true, name: true } } } });
        if (!m) throw new NotFoundException({ message: 'Guest not found', code: 'guest_not_found' });
        return m;
    }

    async updateGuest(ctx: OrgContext, memberId: string, dto: UpdateGuestInput) {
        const m = await this.guestMember(ctx, memberId);
        const row = await this.prisma.channelMember.update({ where: { id: memberId }, data: { access_expires_at: dto.access_expires_at ? new Date(dto.access_expires_at) : null, ...(dto.external_label !== undefined && { external_label: dto.external_label }) } });
        await this.audit.record(ctx, 'messaging.guest.updated', { resource_type: 'channel_member', resource_id: memberId, metadata: { channel_id: m.channel_id, before: { access_expires_at: m.access_expires_at }, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.guest.updated', module: ModuleKey.MESSAGING, entity_kind: 'channel_member', entity_id: memberId, payload: { channel_id: m.channel_id } });
        return row;
    }

    async removeGuest(ctx: OrgContext, memberId: string) {
        const m = await this.guestMember(ctx, memberId);
        await this.prisma.channelMember.update({ where: { id: memberId }, data: { removed_at: new Date(), removed_by_user_id: ctx.user_id } });
        await this.prisma.channel.update({ where: { id: m.channel_id }, data: { member_count: { decrement: 1 } } }).catch(() => undefined);
        await this.audit.record(ctx, 'messaging.guest.removed', { resource_type: 'channel_member', resource_id: memberId, metadata: { channel_id: m.channel_id, external_user_id: m.external_user_id, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.guest.removed', module: ModuleKey.MESSAGING, entity_kind: 'channel_member', entity_id: memberId, payload: { channel_id: m.channel_id } });
        this.realtime.toChannel(m.channel_id, 'member.updated', { channel_id: m.channel_id });
        return { success: true };
    }

    async revokeInvitation(ctx: OrgContext, id: string) {
        const inv = await this.prisma.channelInvitation.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!inv) throw new NotFoundException({ message: 'Invitation not found', code: 'invitation_not_found' });
        if (inv.status !== ChannelInvitationStatus.PENDING) throw new ConflictException({ message: 'Only pending invitations can be revoked', code: 'invitation_not_pending' });
        await this.prisma.channelInvitation.update({ where: { id }, data: { status: ChannelInvitationStatus.REVOKED, revoked_at: new Date() } });
        await this.audit.record(ctx, 'messaging.guest.invitation_revoked', { resource_type: 'channel_invitation', resource_id: id, metadata: { email: inv.email, channel_id: inv.channel_id, sensitive: true } });
        return { success: true };
    }

    // ------------------------------------------------------------------ integrations

    private publicIntegration<T extends { inbound_token_hash: string | null; config: Prisma.JsonValue }>(row: T) {
        const { inbound_token_hash, config: _c, ...rest } = row;
        return { ...rest, has_token: !!inbound_token_hash };
    }

    async integrations(ctx: OrgContext) {
        const rows = await this.prisma.messagingIntegration.findMany({
            where: { organization_id: ctx.organization_id, disconnected_at: null },
            include: { default_channel: { select: { id: true, name: true, kind: true } }, _count: { select: { messages: true } } },
            orderBy: { created_at: 'desc' },
        });
        return { data: rows.map((r) => this.publicIntegration(r)) };
    }

    private async assertChannels(ctx: OrgContext, ids: string[]) {
        const unique = [...new Set(ids)];
        const n = await this.prisma.channel.count({ where: { id: { in: unique }, organization_id: ctx.organization_id, status: 'ACTIVE', kind: { notIn: [ChannelKind.DIRECT, ChannelKind.GROUP_DIRECT] } } });
        if (n !== unique.length) throw new NotFoundException({ message: 'Channel not found (integrations post to active channels, not DMs)', code: 'channel_not_found' });
    }

    async createIntegration(ctx: OrgContext, dto: IntegrationInput) {
        await this.assertChannels(ctx, [dto.default_channel_id, ...dto.allowed_channel_ids]);
        const token = `lqm_${randomBytes(24).toString('base64url')}`;
        try {
            const row = await this.prisma.messagingIntegration.create({
                data: {
                    organization_id: ctx.organization_id, kind: dto.kind, name: dto.name, description: dto.description ?? null, bot_display_name: dto.bot_display_name ?? dto.name,
                    default_channel_id: dto.default_channel_id, allowed_channel_ids: dto.allowed_channel_ids, rate_limit_per_minute: dto.rate_limit_per_minute ?? null,
                    inbound_token_hash: sha256(token), created_by_user_id: ctx.user_id,
                },
            });
            await this.audit.record(ctx, 'messaging.integration.created', { resource_type: 'messaging_integration', resource_id: row.id, metadata: { name: dto.name, kind: dto.kind, default_channel_id: dto.default_channel_id, sensitive: true } });
            this.events.publish(ctx, { event_key: 'messaging.integration.created', module: ModuleKey.MESSAGING, entity_kind: 'messaging_integration', entity_id: row.id, payload: { name: dto.name, kind: dto.kind } });
            return { ...this.publicIntegration(row), token, webhook_path: `/messaging/hooks/${token}` };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'An integration with this name exists', code: 'integration_name_taken' });
            throw error;
        }
    }

    private async integration(ctx: OrgContext, id: string) {
        const row = await this.prisma.messagingIntegration.findFirst({ where: { id, organization_id: ctx.organization_id, disconnected_at: null } });
        if (!row) throw new NotFoundException({ message: 'Integration not found', code: 'integration_not_found' });
        return row;
    }

    async updateIntegration(ctx: OrgContext, id: string, dto: UpdateIntegrationInput) {
        const before = await this.integration(ctx, id);
        await this.assertChannels(ctx, [...(dto.default_channel_id ? [dto.default_channel_id] : []), ...(dto.allowed_channel_ids ?? [])]);
        const row = await this.prisma.messagingIntegration.update({ where: { id }, data: { ...dto, ...(dto.status === MessagingIntegrationStatus.ACTIVE && { last_error: null, last_error_at: null }) } });
        await this.audit.record(ctx, 'messaging.integration.updated', { resource_type: 'messaging_integration', resource_id: id, metadata: { before: { name: before.name, status: before.status }, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.integration.updated', module: ModuleKey.MESSAGING, entity_kind: 'messaging_integration', entity_id: id, payload: { status: row.status } });
        return this.publicIntegration(row);
    }

    async rotateToken(ctx: OrgContext, id: string) {
        await this.integration(ctx, id);
        const token = `lqm_${randomBytes(24).toString('base64url')}`;
        await this.prisma.messagingIntegration.update({ where: { id }, data: { inbound_token_hash: sha256(token) } });
        await this.audit.record(ctx, 'messaging.integration.token_rotated', { resource_type: 'messaging_integration', resource_id: id, metadata: { sensitive: true } });
        return { token, webhook_path: `/messaging/hooks/${token}` };
    }

    async disconnectIntegration(ctx: OrgContext, id: string) {
        const row = await this.integration(ctx, id);
        await this.prisma.messagingIntegration.update({ where: { id }, data: { disconnected_at: new Date(), status: MessagingIntegrationStatus.DISABLED, inbound_token_hash: null } });
        await this.audit.record(ctx, 'messaging.integration.disconnected', { resource_type: 'messaging_integration', resource_id: id, metadata: { name: row.name, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.integration.disconnected', module: ModuleKey.MESSAGING, entity_kind: 'messaging_integration', entity_id: id, payload: { name: row.name } });
        return { success: true };
    }

    async testIntegration(ctx: OrgContext, id: string) {
        const row = await this.integration(ctx, id);
        if (row.status !== MessagingIntegrationStatus.ACTIVE) throw new ConflictException({ message: 'Enable the integration first', code: 'integration_disabled' });
        const msg = await this.postAsIntegration(row, { text: `Test message from ${row.name} ✅`, source: 'test' });
        this.audit.recordAsync(ctx, 'messaging.integration.tested', { resource_type: 'messaging_integration', resource_id: id });
        return msg;
    }

    /** Public inbound webhook: `POST /messaging/hooks/:token { text, channel_id?, event_id? }` (token = credential, rate limited). */
    async inbound(token: string, dto: InboundHookInput) {
        if (!/^lqm_[A-Za-z0-9_-]{20,}$/.test(token)) throw new UnauthorizedException({ message: 'Invalid token', code: 'hook_token_invalid' });
        const row = await this.prisma.messagingIntegration.findFirst({ where: { inbound_token_hash: sha256(token), disconnected_at: null } });
        if (!row) throw new UnauthorizedException({ message: 'Invalid token', code: 'hook_token_invalid' });
        if (row.status !== MessagingIntegrationStatus.ACTIVE) throw new ForbiddenException({ message: 'This integration is disabled', code: 'integration_disabled' });
        const limit = row.rate_limit_per_minute ?? 30;
        const now = Date.now();
        const hits = (this.hookHits.get(row.id) ?? []).filter((t) => t > now - 60_000);
        if (hits.length >= limit) {
            await this.prisma.messagingIntegration.update({ where: { id: row.id }, data: { last_error: 'Rate limit reached', last_error_at: new Date() } });
            throw new ForbiddenException({ message: `Rate limit of ${limit} messages per minute reached`, code: 'integration_rate_limited' });
        }
        this.hookHits.set(row.id, [...hits, now]);
        return this.postAsIntegration(row, dto);
    }

    private async postAsIntegration(row: { id: string; organization_id: string; name: string; bot_display_name: string | null; default_channel_id: string | null; allowed_channel_ids: string[] }, dto: InboundHookInput) {
        const channelId = dto.channel_id ?? row.default_channel_id;
        if (!channelId || (dto.channel_id && dto.channel_id !== row.default_channel_id && !row.allowed_channel_ids.includes(dto.channel_id))) {
            throw new ForbiddenException({ message: 'This integration may not post to that channel', code: 'integration_channel_denied' });
        }
        const channel = await this.prisma.channel.findFirst({ where: { id: channelId, organization_id: row.organization_id, status: 'ACTIVE' }, select: { id: true } });
        if (!channel) throw new NotFoundException({ message: 'Channel not found or archived', code: 'channel_not_found' });
        if (dto.event_id) {
            const dup = await this.prisma.message.findFirst({ where: { integration_id: row.id, external_event_id: dto.event_id }, select: { id: true } });
            if (dup) return { id: dup.id, duplicate: true };
        }
        const parsed = parseBody(dto.text);
        const now = new Date();
        const msg = await this.prisma.$transaction(async (tx) => {
            const m = await tx.message.create({
                data: {
                    organization_id: row.organization_id, channel_id: channelId, kind: MessageKind.INTEGRATION, status: 'SENT', integration_id: row.id, body: dto.text, body_plain: parsed.plain,
                    has_links: parsed.has_links, integration_source: dto.source ?? row.bot_display_name ?? row.name, external_event_id: dto.event_id ?? null, sent_at: now,
                    metadata: { bot_name: row.bot_display_name ?? row.name } as Prisma.InputJsonValue,
                },
                include: MESSAGE_INCLUDE,
            });
            await tx.channel.update({ where: { id: channelId }, data: { message_count: { increment: 1 }, last_message_at: now } });
            await tx.channelReadState.updateMany({ where: { channel_id: channelId }, data: { unread_count: { increment: 1 } } });
            await tx.messagingIntegration.update({ where: { id: row.id }, data: { last_event_at: now } });
            return m;
        });
        this.realtime.toChannel(channelId, 'message.created', { channel_id: channelId, message: serializeMessage(msg) });
        return { id: msg.id, duplicate: false };
    }
}
