import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { parseCorsUrls, resolveCorsOrigins } from '@/shared/config/cors';
import { ACTIVE_MEMBER, MessagingAccessService, personName } from './services/messaging-access.service';
import { MessagingRealtimeService, channelRoom, memberRoom, orgRoom } from './services/messaging-realtime.service';
import { PresenceService } from './services/presence.service';

/** Same origins as the HTTP CORS config in main.ts (evaluated per handshake, so env is always loaded). */
function allowedOrigins() {
    return resolveCorsOrigins({ nodeEnv: process.env.NODE_ENV, corsUrls: parseCorsUrls(process.env.CORS_URLS), appUrl: process.env.APP_URL, landingUrl: process.env.LANDING_URL });
}

interface SocketData {
    ctx: OrgContext;
    membership_id: string;
    name: string;
}

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

    @SubscribeMessage('channel.unwatch')
    async unwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { channel_id?: string }) {
        const data = client.data as SocketData | undefined;
        if (!data?.ctx || typeof body?.channel_id !== 'string') return { ok: false };
        const isMember = await this.prisma.channelMember.findFirst({ where: { channel_id: body.channel_id, membership_id: data.membership_id, ...ACTIVE_MEMBER }, select: { id: true } });
        if (!isMember) await client.leave(channelRoom(body.channel_id));
        return { ok: true };
    }
}
