import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { parseCorsUrls, resolveCorsOrigins } from '@/shared/config/cors';
import { ACTIVE_MEMBER, MessagingAccessService, personName } from './services/messaging-access.service';
import { MessagingRealtimeService, callRoom, channelRoom, memberRoom, orgRoom } from './services/messaging-realtime.service';
import { CALL_ICE_SERVERS, ChannelCallsService, MAX_MEDIA_PEERS } from './services/calls.service';
import { PresenceService } from './services/presence.service';

/** Same origins as the HTTP CORS config in main.ts (evaluated per handshake, so env is always loaded). */
function allowedOrigins() {
    return resolveCorsOrigins({ nodeEnv: process.env.NODE_ENV, corsUrls: parseCorsUrls(process.env.CORS_URLS), appUrl: process.env.APP_URL, landingUrl: process.env.LANDING_URL });
}

interface SocketData {
    ctx: OrgContext;
    membership_id: string;
    name: string;
    /** Call whose media (WebRTC) this socket is connected to. */
    call_id?: string | null;
    media?: { muted: boolean; camera: boolean };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Upper bound for one relayed SDP / ICE payload (a normal SDP is 2–8 kB). */
const MAX_SIGNAL_BYTES = 64_000;

/**
 * Realtime for Messaging (namespace `/messaging`). Handshake: `auth.token` (user JWT or API key) or `Authorization: Bearer`,
 * plus `auth.organization_id` (or `X-Organization-Id`). Resolved with the same CredentialsService + AuthorizationService as REST;
 * the caller needs messaging.channels.read and a membership.
 *
 * Server → client: message.created {channel_id, message} · message.updated {channel_id, message} · message.deleted {channel_id, message_id, parent_message_id}
 *   · reaction.updated {channel_id, message_id, parent_message_id, reactions} · typing {channel_id, thread_root_id, membership_id, name}
 *   · read {channel_id, last_read_message_id} (own devices) · channel.created / channel.removed / channel.updated {channel_id} · member.updated {channel_id}
 *   · mention.created {channel_id, message_id} · saved.updated {message_id, is_saved} · presence {membership_id, state, status_text, status_emoji}
 * Client → server: typing {channel_id, thread_root_id?} · channel.watch {channel_id} (open channel you are not a member of) · channel.unwatch {channel_id}
 *
 * Calls (12 §44, WebRTC mesh, max MAX_MEDIA_PEERS media peers; the server only relays signaling, never media):
 *   → call.media.join {call_id} — needs messaging.calls.start + channel membership + live call (same checks as POST /messaging/calls/:id/join,
 *     which it runs: the participant row is created if missing). Ack {ok, peer_id, peers: [{peer_id, membership_id, name, media}], ice_servers, max_peers}
 *     or {ok: false, code: calls_disabled | call_ended | channel_not_member | call_full | permission_denied, message}. The newcomer sends the offers.
 *   → call.signal {call_id, to: peer_id, description?, candidate?} — relayed only between sockets in the same call room.
 *   → call.media.state {call_id, muted, camera} · call.media.leave {call_id} (closing the tab = leave; the participant row is closed when
 *     the member has no other socket in the call).
 *   ← call.peer.joined {call_id, peer_id, membership_id, name, media} · call.peer.left {call_id, peer_id | null, membership_id}
 *   · call.peer.state {call_id, peer_id, membership_id, muted, camera} · call.signal {call_id, from, membership_id, description?, candidate?} · call.ended {call_id}
 */
@WebSocketGateway({
    namespace: '/messaging',
    cors: {
        origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, !origin || allowedOrigins().includes(origin)),
        credentials: true,
    },
})
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(MessagingGateway.name);
    @WebSocketServer() server: Namespace;

    constructor(
        private readonly credentials: CredentialsService,
        private readonly authorization: AuthorizationService,
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly realtime: MessagingRealtimeService,
        private readonly presence: PresenceService,
        private readonly calls: ChannelCallsService,
    ) { }

    afterInit(server: Namespace) {
        this.realtime.attach(server);
    }

    async handleConnection(client: Socket) {
        try {
            const auth = (client.handshake.auth ?? {}) as { token?: string; organization_id?: string };
            const header = client.handshake.headers['authorization'];
            const token = auth.token || (typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : undefined);
            if (!token) throw new Error('Authentication required');
            const orgHeader = client.handshake.headers['x-organization-id'];
            const orgId = auth.organization_id || (typeof orgHeader === 'string' ? orgHeader : null);
            const principal = await this.credentials.resolve(token, client.handshake.address);
            const ctx = await this.authorization.buildContext(principal, orgId || null, principal.kind === 'api_key' ? 'api' : 'ui', {
                ip_address: client.handshake.address,
                user_agent: (client.handshake.headers['user-agent'] as string) ?? null,
            });
            if (!ctx.can('messaging.channels.read') || !ctx.membership_id) throw new Error('You do not have access to messaging');

            const [channels, membership] = await Promise.all([
                this.prisma.channelMember.findMany({ where: { membership_id: ctx.membership_id, ...ACTIVE_MEMBER, channel: { organization_id: ctx.organization_id, status: { not: 'DELETED' } } }, select: { channel_id: true } }),
                this.prisma.membership.findUnique({ where: { id: ctx.membership_id }, select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } }),
            ]);
            client.data = { ctx, membership_id: ctx.membership_id, name: personName(membership?.user) } satisfies SocketData;
            await client.join([memberRoom(ctx.membership_id), orgRoom(ctx.organization_id), ...channels.map((c) => channelRoom(c.channel_id))]);

            const view = await this.presence.connection(ctx.organization_id, ctx.membership_id, 1);
            this.realtime.toOrganization(ctx.organization_id, 'presence', view);
            client.emit('ready', { membership_id: ctx.membership_id, channel_ids: channels.map((c) => c.channel_id) });
        } catch (error) {
            const message = (error as { response?: { message?: string } })?.response?.message ?? (error as Error).message ?? 'Unauthorized';
            client.emit('error', { message, code: 'unauthorized' });
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: Socket) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx) return;
        if (data.call_id) await this.leaveMedia(client, data.call_id, true);
        try {
            const view = await this.presence.connection(data.ctx.organization_id, data.membership_id, -1);
            this.realtime.toOrganization(data.ctx.organization_id, 'presence', view);
        } catch (error) {
            this.logger.warn(`presence update failed: ${(error as Error).message}`);
        }
    }

    @SubscribeMessage('typing')
    typing(@ConnectedSocket() client: Socket, @MessageBody() body: { channel_id?: string; thread_root_id?: string | null }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.channel_id !== 'string') return;
        const room = channelRoom(body.channel_id);
        if (!client.rooms.has(room)) return;
        client.to(room).emit('typing', { channel_id: body.channel_id, thread_root_id: body.thread_root_id ?? null, membership_id: data.membership_id, name: data.name });
    }

    /** Watch an open channel you have not joined (preview mode) — visibility checked like REST. */
    @SubscribeMessage('channel.watch')
    async watch(@ConnectedSocket() client: Socket, @MessageBody() body: { channel_id?: string }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.channel_id !== 'string') return { ok: false };
        try {
            await this.access.channelForRead(data.ctx, body.channel_id);
            await client.join(channelRoom(body.channel_id));
            return { ok: true };
        } catch {
            return { ok: false };
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Calls — WebRTC signaling (12 §44)
    // ---------------------------------------------------------------------------------------------

    @SubscribeMessage('call.media.join')
    async mediaJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { call_id?: string; muted?: boolean; camera?: boolean }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.call_id !== 'string' || !UUID.test(body.call_id)) return { ok: false, code: 'invalid_request', message: 'call_id is required' };
        const callId = body.call_id;
        if (!data.ctx.can('messaging.calls.start')) return { ok: false, code: 'permission_denied', message: 'Joining calls needs messaging.calls.start' };
        try {
            // Same checks and participant row as REST join (calls enabled, channel member, call still live).
            await this.calls.join(data.ctx, callId);
        } catch (error) {
            const res = (error as { response?: { message?: string; code?: string } })?.response;
            return { ok: false, code: res?.code ?? 'call_join_failed', message: res?.message ?? (error as Error).message };
        }
        if (data.call_id && data.call_id !== callId) await this.leaveMedia(client, data.call_id, true);
        const room = callRoom(callId);
        const sockets = (await this.server.in(room).fetchSockets()).filter((s) => s.id !== client.id);
        if (sockets.length >= MAX_MEDIA_PEERS) {
            return { ok: false, code: 'call_full', message: `Audio is limited to ${MAX_MEDIA_PEERS} people in a huddle. You are listed in the call; use a meeting link for bigger groups.` };
        }
        data.call_id = callId;
        data.media = { muted: body.muted === true, camera: body.camera === true };
        await client.join(room);
        client.to(room).emit('call.peer.joined', { call_id: callId, peer_id: client.id, membership_id: data.membership_id, name: data.name, media: data.media });
        return {
            ok: true,
            peer_id: client.id,
            max_peers: MAX_MEDIA_PEERS,
            ice_servers: CALL_ICE_SERVERS,
            peers: sockets.map((s) => {
                const d = s.data as SocketData;
                return { peer_id: s.id, membership_id: d.membership_id, name: d.name, media: d.media ?? { muted: false, camera: false } };
            }),
        };
    }

    @SubscribeMessage('call.signal')
    signal(@ConnectedSocket() client: Socket, @MessageBody() body: { call_id?: string; to?: string; description?: unknown; candidate?: unknown }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || !body || typeof body.call_id !== 'string' || typeof body.to !== 'string' || data.call_id !== body.call_id) return;
        const room = callRoom(body.call_id);
        if (!client.rooms.has(room)) return;
        const target = this.server.sockets.get(body.to);
        if (!target || !target.rooms.has(room)) return;
        const payload = { description: body.description ?? null, candidate: body.candidate ?? null };
        if (JSON.stringify(payload).length > MAX_SIGNAL_BYTES) return;
        target.emit('call.signal', { call_id: body.call_id, from: client.id, membership_id: data.membership_id, ...payload });
    }

    @SubscribeMessage('call.media.state')
    mediaState(@ConnectedSocket() client: Socket, @MessageBody() body: { call_id?: string; muted?: boolean; camera?: boolean }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.call_id !== 'string' || data.call_id !== body.call_id || !client.rooms.has(callRoom(body.call_id))) return;
        data.media = { muted: body.muted === true, camera: body.camera === true };
        client.to(callRoom(body.call_id)).emit('call.peer.state', { call_id: body.call_id, peer_id: client.id, membership_id: data.membership_id, ...data.media });
    }

    /** Stop media in this tab. The participant row is closed by REST leave (the client calls it) or when the last tab of the member goes. */
    @SubscribeMessage('call.media.leave')
    async mediaLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { call_id?: string }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.call_id !== 'string' || data.call_id !== body.call_id) return { ok: false };
        await this.leaveMedia(client, body.call_id, false);
        return { ok: true };
    }

    private async leaveMedia(client: Socket, callId: string, syncParticipant: boolean) {
        const data = client.data as SocketData;
        const room = callRoom(callId);
        data.call_id = null;
        try {
            await client.leave(room);
            this.server.to(room).emit('call.peer.left', { call_id: callId, peer_id: client.id, membership_id: data.membership_id });
            if (!syncParticipant) return;
            // Closing the last tab of this member in the call = leaving the call (keeps ChannelCallParticipant rows in sync).
            const others = (await this.server.in(room).fetchSockets()).some((s) => (s.data as SocketData).membership_id === data.membership_id);
            if (!others) await this.calls.leave(data.ctx, callId);
        } catch (error) {
            this.logger.warn(`call media leave failed: ${(error as Error).message}`);
        }
    }

    @SubscribeMessage('channel.unwatch')
    async unwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { channel_id?: string }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.channel_id !== 'string') return { ok: false };
        const isMember = await this.prisma.channelMember.findFirst({ where: { channel_id: body.channel_id, membership_id: data.membership_id, ...ACTIVE_MEMBER }, select: { id: true } });
        if (!isMember) await client.leave(channelRoom(body.channel_id));
        return { ok: true };
    }
}
