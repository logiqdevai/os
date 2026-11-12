import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';

export const channelRoom = (channelId: string) => `c:${channelId}`;
export const memberRoom = (membershipId: string) => `m:${membershipId}`;
export const orgRoom = (organizationId: string) => `o:${organizationId}`;
/** Sockets with live media (WebRTC) in a call — signaling is relayed only between sockets of this room. */
export const callRoom = (callId: string) => `call:${callId}`;

/**
 * Server → client push for the Messaging socket namespace (`/messaging`). Services call this after a write committed;
 * it never throws (a realtime failure must not fail the REST call). Rooms: `c:<channelId>` per channel,
 * `m:<membershipId>` per member (all their tabs/devices), `o:<organizationId>` for presence.
 */
@Injectable()
export class MessagingRealtimeService {
    private readonly logger = new Logger(MessagingRealtimeService.name);
    private server: Namespace | null = null;

    attach(server: Namespace) {
        this.server = server;
    }

    toChannel(channelId: string, event: string, payload: unknown) {
        this.safe(() => this.server?.to(channelRoom(channelId)).emit(event, payload));
    }

    toMembers(membershipIds: string[], event: string, payload: unknown) {
        if (!membershipIds.length) return;
        this.safe(() => this.server?.to(membershipIds.map(memberRoom)).emit(event, payload));
    }

    toOrganization(organizationId: string, event: string, payload: unknown) {
        this.safe(() => this.server?.to(orgRoom(organizationId)).emit(event, payload));
    }

    /** Subscribe every open socket of these members to the channel room (after join / add / channel create). */
    joinChannel(membershipIds: string[], channelId: string) {
        if (!membershipIds.length) return;
        this.safe(() => this.server?.in(membershipIds.map(memberRoom)).socketsJoin(channelRoom(channelId)));
    }

    leaveChannel(membershipIds: string[], channelId: string) {
        if (!membershipIds.length) return;
        this.safe(() => this.server?.in(membershipIds.map(memberRoom)).socketsLeave(channelRoom(channelId)));
    }

    /** A member left a call (REST / MCP / other tab): drop their media sockets and tell the remaining peers. */
    leaveCall(membershipIds: string[], callId: string) {
        if (!membershipIds.length) return;
        this.safe(() => {
            this.server?.in(membershipIds.map(memberRoom)).socketsLeave(callRoom(callId));
            for (const membership_id of membershipIds) this.server?.to(callRoom(callId)).emit('call.peer.left', { call_id: callId, membership_id, peer_id: null });
        });
    }

    /** The call ended for everyone: close every media connection. */
    endCall(callId: string) {
        this.safe(() => {
            this.server?.to(callRoom(callId)).emit('call.ended', { call_id: callId });
            this.server?.in(callRoom(callId)).socketsLeave(callRoom(callId));
        });
    }

    private safe(fn: () => unknown) {
        try {
            fn();
        } catch (error) {
            this.logger.warn(`realtime emit failed: ${(error as Error).message}`);
        }
    }
}
