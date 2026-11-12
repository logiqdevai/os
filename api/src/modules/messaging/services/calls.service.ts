import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelCallKind, ChannelCallStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { MEMBERSHIP_PERSON_SELECT, MessagingAccessService } from './messaging-access.service';
import { MessagesService } from './messages.service';
import { MessagingRealtimeService } from './messaging-realtime.service';

/** WebRTC mesh: every peer sends its media to every other peer, so the media part of a call is capped (12 §44). */
export const MAX_MEDIA_PEERS = 6;
/** Public STUN only; there is no TURN configuration in the schema, so peers behind symmetric NATs fall back to "who is in the call". */
export const CALL_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export const StartCallSchema = z.object({
    kind: z.nativeEnum(ChannelCallKind).default(ChannelCallKind.HUDDLE),
    title: z.string().trim().max(120).optional(),
    /** External meeting link (Meet, Zoom, Teams …) when the organization uses one; media is not hosted by the platform. */
    meeting_url: z.string().url().max(500).optional(),
});
export type StartCallInput = z.infer<typeof StartCallSchema>;

export const CallQuerySchema = z.object({
    status: z.enum(['active', 'recent']).default('active'),
    channel_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type CallQuery = z.infer<typeof CallQuerySchema>;

const LIVE: ChannelCallStatus[] = [ChannelCallStatus.RINGING, ChannelCallStatus.IN_PROGRESS];

const CALL_INCLUDE = {
    channel: { select: { id: true, name: true, kind: true, slug: true } },
    started_by: { select: MEMBERSHIP_PERSON_SELECT },
    participants: { orderBy: { invited_at: 'asc' }, include: { membership: { select: MEMBERSHIP_PERSON_SELECT } } },
} satisfies Prisma.ChannelCallInclude;

/**
 * Huddles and calls (12 §44). The platform models the session — who started it, who is in it, when it ended — and
 * announces it in the channel. Media is peer-to-peer WebRTC (audio, optional camera) for up to MAX_MEDIA_PEERS people,
 * signaled over the `/messaging` socket (MessagingGateway `call.media.*`, same membership checks as REST); the server
 * never sees audio or video. An optional meeting_url (Meet, Zoom, Teams) still works for larger meetings, and when media
 * fails the huddle degrades to a presence session ("who is in the call"). Participant rows stay the source of truth.
 */
@Injectable()
export class ChannelCallsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly messages: MessagesService,
        private readonly realtime: MessagingRealtimeService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    private async enabled(ctx: OrgContext) {
        const settings = await this.access.settings(ctx.organization_id);
        if (!settings.calls_enabled) throw new ForbiddenException({ message: 'Calls are turned off for your organization. An administrator can turn them on in Messages → Settings.', code: 'calls_disabled' });
        return settings;
    }

    private serialize(call: Prisma.ChannelCallGetPayload<{ include: typeof CALL_INCLUDE }>) {
        const active = call.participants.filter((p) => p.joined_at && !p.left_at);
        return { ...call, active_participant_ids: active.map((p) => p.membership_id).filter(Boolean), live: LIVE.includes(call.status) };
    }

    private async load(ctx: OrgContext, callId: string) {
        const call = await this.prisma.channelCall.findFirst({ where: { id: callId, organization_id: ctx.organization_id, channel: this.access.readableWhere(ctx) }, include: CALL_INCLUDE });
        if (!call) throw new NotFoundException({ message: 'Call not found', code: 'call_not_found' });
        return call;
    }

    private async broadcast(callId: string) {
        const call = await this.prisma.channelCall.findUniqueOrThrow({ where: { id: callId }, include: CALL_INCLUDE });
        const out = this.serialize(call);
        this.realtime.toChannel(call.channel_id, 'call.updated', { channel_id: call.channel_id, call: out });
        return out;
    }

    async list(ctx: OrgContext, query: CallQuery) {
        const rows = await this.prisma.channelCall.findMany({
            where: {
                organization_id: ctx.organization_id,
                channel: this.access.readableWhere(ctx),
                ...(query.channel_id && { channel_id: query.channel_id }),
                ...(query.status === 'active' ? { status: { in: LIVE } } : { status: { notIn: LIVE } }),
            },
            include: CALL_INCLUDE,
            orderBy: { started_at: 'desc' },
            take: query.limit,
        });
        const settings = await this.access.settings(ctx.organization_id);
        return { calls_enabled: !!settings.calls_enabled, provider: settings.call_provider ?? 'internal', media: { kind: 'webrtc_mesh', max_peers: MAX_MEDIA_PEERS }, data: rows.map((r) => this.serialize(r)) };
    }

    async get(ctx: OrgContext, callId: string) {
        return this.serialize(await this.load(ctx, callId));
    }

    /** Start a huddle / call in a channel, or join the one already running there. */
    async start(ctx: OrgContext, channelId: string, dto: StartCallInput) {
        const me = this.access.requireMembership(ctx);
        const settings = await this.enabled(ctx);
        const channel = await this.access.channelForMember(ctx, channelId);
        this.access.assertNotArchived(channel);
        const running = await this.prisma.channelCall.findFirst({ where: { channel_id: channelId, status: { in: LIVE } }, select: { id: true } });
        if (running) return this.join(ctx, running.id);
        const now = new Date();
        const call = await this.prisma.channelCall.create({
            data: {
                organization_id: ctx.organization_id,
                channel_id: channelId,
                kind: dto.kind,
                status: ChannelCallStatus.IN_PROGRESS,
                started_by_membership_id: me,
                title: dto.title ?? null,
                provider: dto.meeting_url ? 'external' : settings.call_provider ?? 'internal',
                meeting_url: dto.meeting_url ?? null,
                started_at: now,
                participant_count: 1,
                participants: { create: { membership_id: me, invited_at: now, joined_at: now, state: 'joined' } },
            },
        });
        const label = dto.kind === ChannelCallKind.HUDDLE ? 'huddle' : `${dto.kind.toLowerCase()} call`;
        const msg = await this.messages.postSystem(ctx, channelId, 'call_started', `started a ${label}${dto.title ? `: ${dto.title}` : ''}`);
        await this.prisma.channelCall.update({ where: { id: call.id }, data: { message_id: msg.id } });
        await this.audit.record(ctx, 'messaging.call.started', { resource_type: 'channel_call', resource_id: call.id, metadata: { channel_id: channelId, kind: dto.kind, external: !!dto.meeting_url } });
        const members = await this.access.memberIds(channelId);
        this.events.publish(ctx, {
            event_key: 'messaging.call.started', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: channelId,
            payload: { call_id: call.id, kind: dto.kind, channel_name: channel.name, recipient_membership_ids: channel.kind === 'DIRECT' || channel.kind === 'GROUP_DIRECT' ? members.filter((m) => m !== me) : [], link: `/messages/c/${channelId}` },
        });
        return this.broadcast(call.id);
    }

    async join(ctx: OrgContext, callId: string) {
        const me = this.access.requireMembership(ctx);
        await this.enabled(ctx);
        const call = await this.load(ctx, callId);
        if (!LIVE.includes(call.status)) throw new ConflictException({ message: 'This call has ended', code: 'call_ended' });
        await this.access.channelForMember(ctx, call.channel_id);
        // Already in (e.g. the starter connecting media, or a second tab): nothing to record.
        if (call.participants.some((p) => p.membership_id === me && p.joined_at && !p.left_at)) return this.serialize(call);
        const now = new Date();
        await this.prisma.channelCallParticipant.upsert({
            where: { call_id_membership_id: { call_id: callId, membership_id: me } },
            update: { joined_at: now, left_at: null, state: 'joined' },
            create: { call_id: callId, membership_id: me, invited_at: now, joined_at: now, state: 'joined' },
        });
        await this.recount(callId);
        this.audit.recordAsync(ctx, 'messaging.call.joined', { resource_type: 'channel_call', resource_id: callId, metadata: { channel_id: call.channel_id } });
        return this.broadcast(callId);
    }

    async leave(ctx: OrgContext, callId: string) {
        const me = this.access.requireMembership(ctx);
        const call = await this.load(ctx, callId);
        if (!LIVE.includes(call.status)) return this.serialize(call);
        await this.prisma.channelCallParticipant.updateMany({ where: { call_id: callId, membership_id: me, left_at: null }, data: { left_at: new Date(), state: 'left' } });
        this.realtime.leaveCall([me], callId);
        const remaining = await this.recount(callId);
        this.audit.recordAsync(ctx, 'messaging.call.left', { resource_type: 'channel_call', resource_id: callId, metadata: { channel_id: call.channel_id } });
        if (remaining === 0) return this.finish(ctx, call, 'last_participant_left');
        return this.broadcast(callId);
    }

    /** End for everyone: the starter, a channel admin or messaging.channels.manage. */
    async end(ctx: OrgContext, callId: string) {
        const me = this.access.requireMembership(ctx);
        const call = await this.load(ctx, callId);
        if (!LIVE.includes(call.status)) return this.serialize(call);
        const channel = await this.access.channelForRead(ctx, call.channel_id);
        if (call.started_by_membership_id !== me && !this.access.isChannelAdmin(ctx, channel.me)) throw new ForbiddenException({ message: 'Only the person who started the call or a channel admin can end it for everyone', code: 'call_end_denied' });
        return this.finish(ctx, call, 'ended');
    }

    private async recount(callId: string) {
        const active = await this.prisma.channelCallParticipant.count({ where: { call_id: callId, joined_at: { not: null }, left_at: null } });
        const total = await this.prisma.channelCallParticipant.count({ where: { call_id: callId, joined_at: { not: null } } });
        await this.prisma.channelCall.update({ where: { id: callId }, data: { participant_count: total } });
        return active;
    }

    private async finish(ctx: OrgContext, call: { id: string; channel_id: string; started_at: Date; kind: ChannelCallKind }, reason: string) {
        const now = new Date();
        const duration = Math.max(0, Math.round((now.getTime() - call.started_at.getTime()) / 1000));
        const done = await this.prisma.channelCall.updateMany({ where: { id: call.id, status: { in: LIVE } }, data: { status: ChannelCallStatus.ENDED, ended_at: now, duration_seconds: duration } });
        if (done.count) {
            await this.prisma.channelCallParticipant.updateMany({ where: { call_id: call.id, left_at: null, joined_at: { not: null } }, data: { left_at: now, state: 'left' } });
            const mins = Math.max(1, Math.round(duration / 60));
            await this.messages.postSystem(ctx, call.channel_id, 'call_ended', `${call.kind === ChannelCallKind.HUDDLE ? 'Huddle' : 'Call'} ended · ${mins} min`);
            await this.audit.record(ctx, 'messaging.call.ended', { resource_type: 'channel_call', resource_id: call.id, metadata: { channel_id: call.channel_id, duration_seconds: duration, reason } });
            this.realtime.endCall(call.id);
            this.events.publish(ctx, { event_key: 'messaging.call.ended', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: call.channel_id, payload: { call_id: call.id, duration_seconds: duration } });
        }
        return this.broadcast(call.id);
    }
}
