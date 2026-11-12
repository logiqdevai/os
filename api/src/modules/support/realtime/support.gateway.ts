import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayInit, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ConversationsService } from '../conversations/conversations.service';
import { SupportWidgetService } from '../widget/widget.service';
import { SupportRealtimeService, supportConversationRoom, supportOrgRoom, supportVisitorRoom } from './support-realtime.service';

type SocketData = { kind: 'agent'; ctx: OrgContext } | { kind: 'visitor'; conversation_id: string };

/**
 * Realtime for Support (namespace `/support`). Two kinds of clients:
 * - Agents: `auth.token` (user JWT or API key) + `auth.organization_id`, resolved exactly like REST; needs support.conversations.read.
 *   Joins the organization room; `conversation.watch {conversation_id}` joins a conversation room after the same scope check as REST.
 * - Website visitors: `auth.widget_key` + `auth.widget_token` (the hashed conversation token from the widget). Joins only that
 *   conversation's visitor room. The embedding site's Origin must be allowed by the channel.
 * Server → client: `inbox.updated` {} · `conversation.updated` {conversation_id?, event_key?} · `message.new` {} (visitors).
 * The origin is open at the transport layer because the widget runs on customer sites; authentication happens in the handshake.
 */
@WebSocketGateway({
    namespace: '/support',
    cors: { origin: (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true), credentials: false },
})
export class SupportGateway implements OnGatewayInit, OnGatewayConnection {
    private readonly logger = new Logger(SupportGateway.name);
    @WebSocketServer() server: Namespace;

    constructor(
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
            client.data = { kind: 'agent', ctx } satisfies SocketData;
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

    @SubscribeMessage('conversation.unwatch')
    async unwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { conversation_id?: string }) {
        if (typeof body?.conversation_id === 'string') await client.leave(supportConversationRoom(body.conversation_id));
        return { ok: true };
    }
}
