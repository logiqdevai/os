import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';

export const supportOrgRoom = (organizationId: string) => `support:org:${organizationId}`;
export const supportConversationRoom = (conversationId: string) => `support:conv:${conversationId}`;
export const supportVisitorRoom = (conversationId: string) => `support:visitor:${conversationId}`;

/** Conversation events that change what a visitor sees (new public message or status). */
const VISITOR_EVENTS = new Set([
    'support.conversation.replied',
    'support.conversation.resolved',
    'support.conversation.reopened',
    'support.conversation.merged',
    'support.ticket.replied',
]);

/**
 * Pushes support changes to Socket.IO rooms of the `/support` namespace. It listens to the platform event bus, so every
 * channel (UI, API, MCP, automation, portal, widget, inbound email) triggers the same push without extra code.
 * Payloads carry ids only — clients refetch through REST, which applies scope and visibility rules:
 * - org room (agents holding support.conversations.read): `inbox.updated` {} — refresh lists and counts
 * - conversation room (agents who passed the scope check): `conversation.updated` {conversation_id, event_key}
 * - visitor room (widget token holder): `message.new` / `conversation.updated` {} — never internal notes.
 */
@Injectable()
export class SupportRealtimeService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SupportRealtimeService.name);
    private server: Namespace | null = null;
    private readonly listener = (e: PublishedEvent) => this.onEvent(e);

    constructor(private readonly events: EventsService) { }

    attach(server: Namespace) {
        this.server = server;
    }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    private onEvent(e: PublishedEvent) {
        if (!this.server || !e.event_key.startsWith('support.')) return;
        try {
            const payload = (e.payload ?? {}) as Record<string, unknown>;
            const conversationId =
                e.entity_type === 'SUPPORT_CONVERSATION' ? e.entity_id : typeof payload.conversation_id === 'string' ? payload.conversation_id : null;
            if (!conversationId) return;
            this.server.to(supportOrgRoom(e.organization_id)).emit('inbox.updated', {});
            this.server.to(supportConversationRoom(conversationId)).emit('conversation.updated', { conversation_id: conversationId, event_key: e.event_key });
            const merged = typeof payload.into_conversation_id === 'string' ? payload.into_conversation_id : null;
            if (e.event_key === 'support.conversation.replied' && payload.kind === 'INTERNAL_NOTE') return;
            if (VISITOR_EVENTS.has(e.event_key)) this.server.to(supportVisitorRoom(conversationId)).emit(e.event_key.endsWith('replied') ? 'message.new' : 'conversation.updated', {});
            if (merged) this.server.to(supportVisitorRoom(conversationId)).emit('conversation.updated', {});
        } catch (error) {
            this.logger.warn(`support realtime push failed: ${(error as Error).message}`);
        }
    }
}
