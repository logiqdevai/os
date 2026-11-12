import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayInit, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ConversationsService } from '../conversations/conversations.service';
import { SupportWidgetService } from '../widget/widget.service';
import { SupportRealtimeService, supportConversationRoom, supportOrgRoom, supportVisitorRoom } from './support-realtime.service';

type SocketData = { kind: 'agent'; ctx: OrgContext; name: string } | { kind: 'visitor'; conversation_id: string };

/** Minimum gap between two typing signals of one socket (the client also throttles). */
const TYPING_GAP_MS = 1500;

/**
 * Realtime for Support (namespace `/support`). Two kinds of clients:
 * - Agents: `auth.token` (user JWT or API key) + `auth.organization_id`, resolved exactly like REST; needs support.conversations.read.
 *   Joins the organization room; `conversation.watch {conversation_id}` joins a conversation room after the same scope check as REST.
 * - Website visitors: `auth.widget_key` + `auth.widget_token` (the hashed conversation token from the widget). Joins only that
 *   conversation's visitor room. The embedding site's Origin must be allowed by the channel.
 * Server → client: `inbox.updated` {} · `conversation.updated` {conversation_id?, event_key?} · `message.new` {} (visitors)
 *   · `typing` — agents watching: {conversation_id, from: 'visitor' | 'agent' | 'ai', name, membership_id?, internal, active};
 *     visitors: {from: 'team' | 'ai', name, active} (internal-note typing and agent identities beyond a first name never reach visitors).
 * Client → server: `typing` {conversation_id, internal?, active?} (agents, after `conversation.watch`; public typing needs
 *   support.conversations.reply) · `typing` {active?} (visitors).
 * The origin is open at the transport layer because the widget runs on customer sites; authentication happens in the handshake.
 */
@WebSocketGateway({
    namespace: '/support',
    cors: { origin: (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true), credentials: false },
})
export class SupportGateway implements OnGatewayInit, OnGatewayConnection {
    private readonly logger = new Logger(SupportGateway.name);
    private readonly lastTyping = new WeakMap<Socket, number>();
    @WebSocketServer() server: Namespace;

    constructor(
        private readonly prisma: PrismaService,
        private readonly credentials: CredentialsService,
        private readonly authorization: AuthorizationService,
        private readonly conversations: ConversationsService,
        private readonly widget: SupportWidgetService,
        private readonly realtime: SupportRealtimeService,
    ) { }

    afterInit(server: Namespace) {
        this.realtime.attach(server);
    }

    async handleConnection(client: Socket) {
        try {
            const auth = (client.handshake.auth ?? {}) as { token?: string; organization_id?: string; widget_key?: string; widget_token?: string };
            if (auth.widget_key && auth.widget_token) {
                const origin = typeof client.handshake.headers.origin === 'string' ? client.handshake.headers.origin : null;
                await this.widget.channelByKey(auth.widget_key, origin);
                const conv = await this.widget.verify(auth.widget_key, auth.widget_token);
                client.data = { kind: 'visitor', conversation_id: conv.id } satisfies SocketData;
                await client.join(supportVisitorRoom(conv.merged_into_conversation_id ?? conv.id));
                client.emit('ready', { kind: 'visitor' });
                return;
            }
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
            if (!ctx.can('support.conversations.read')) throw new Error('You do not have access to the support inbox');
            const me = ctx.membership_id
                ? await this.prisma.membership.findUnique({ where: { id: ctx.membership_id }, select: { user: { select: { first_name: true, display_name: true } } } })
                : null;
            client.data = { kind: 'agent', ctx, name: me?.user.first_name || me?.user.display_name || 'Support' } satisfies SocketData;
            await client.join(supportOrgRoom(ctx.organization_id));
            client.emit('ready', { kind: 'agent' });
        } catch (error) {
            const message = (error as { response?: { message?: string } })?.response?.message ?? (error as Error).message ?? 'Unauthorized';
            client.emit('error', { message, code: 'unauthorized' });
            client.disconnect(true);
        }
    }

    /** Agents: receive updates of one conversation (scope-checked like GET /support/conversations/:id). */
    @SubscribeMessage('conversation.watch')
    async watch(@ConnectedSocket() client: Socket, @MessageBody() body: { conversation_id?: string }) {
        const data = client.data as SocketData | undefined;
        if (data?.kind !== 'agent' || typeof body?.conversation_id !== 'string') return { ok: false };
        try {
            await this.conversations.findBase(data.ctx, body.conversation_id);
            for (const room of client.rooms) if (room.startsWith('support:conv:')) await client.leave(room);
            await client.join(supportConversationRoom(body.conversation_id));
            return { ok: true };
        } catch {
            return { ok: false };
        }
    }

    /**
     * Typing indicator (13 §1). Visitors: relayed to the agents watching their conversation. Agents: only for a conversation
     * they watch (the room join passed the REST scope check); public typing reaches the visitor as "<first name> is typing",
     * internal-note typing stays with the team (collision detection).
     */
    @SubscribeMessage('typing')
    typing(@ConnectedSocket() client: Socket, @MessageBody() body: { conversation_id?: string; internal?: boolean; active?: boolean }) {
        const data = client.data as SocketData | undefined;
        if (!data) return;
        const active = body?.active !== false;
        const now = Date.now();
        if (active && now - (this.lastTyping.get(client) ?? 0) < TYPING_GAP_MS) return;
        this.lastTyping.set(client, active ? now : 0);
        if (data.kind === 'visitor') {
            const room = [...client.rooms].find((r) => r.startsWith('support:visitor:'));
            const conversationId = room?.slice('support:visitor:'.length);
            if (conversationId) this.realtime.toWatchers(conversationId, 'typing', { conversation_id: conversationId, from: 'visitor', name: null, internal: false, active });
            return;
        }
        if (typeof body?.conversation_id !== 'string' || !client.rooms.has(supportConversationRoom(body.conversation_id))) return;
        const internal = body.internal === true || !data.ctx.can('support.conversations.reply');
        client.to(supportConversationRoom(body.conversation_id)).emit('typing', { conversation_id: body.conversation_id, from: 'agent', name: data.name, membership_id: data.ctx.membership_id, internal, active });
        if (!internal) this.realtime.toVisitor(body.conversation_id, 'typing', { from: 'team', name: data.name, active });
    }

    @SubscribeMessage('conversation.unwatch')
    async unwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { conversation_id?: string }) {
        if (typeof body?.conversation_id === 'string') await client.leave(supportConversationRoom(body.conversation_id));
        return { ok: true };
    }
}
