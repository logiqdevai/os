import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, ChannelKind, ChannelMember, ChannelMemberRole, MessagingSettings, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/** Kinds every member with messaging.channels.read can see and join (when DISCOVERABLE). All other kinds are members-only. */
export const OPEN_CHANNEL_KINDS: ChannelKind[] = [ChannelKind.PUBLIC, ChannelKind.ANNOUNCEMENT, ChannelKind.PROJECT];
export const DM_KINDS: ChannelKind[] = [ChannelKind.DIRECT, ChannelKind.GROUP_DIRECT];

export const USER_PUBLIC_SELECT = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } as const;
export const MEMBERSHIP_PERSON_SELECT = { id: true, job_title: true, user: { select: USER_PUBLIC_SELECT } } as const;

/** An active participant row: not left, not removed. */
export const ACTIVE_MEMBER: Prisma.ChannelMemberWhereInput = { left_at: null, removed_at: null };

export type ChannelWithMe = Channel & { me: ChannelMember | null };

const DEFAULT_SETTINGS = {
    allow_delete_own_messages: true,
    delete_own_time_limit_minutes: null,
    allow_admin_delete_messages: true,
    edit_time_limit_minutes: null,
    preserve_edit_history: true,
    broadcast_mention_policy: 'admins',
} satisfies Partial<MessagingSettings>;

export type EffectiveMessagingSettings = typeof DEFAULT_SETTINGS & Partial<MessagingSettings>;

export const personName = (u: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) =>
    u ? u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown' : 'Unknown';

/**
 * Channel visibility and participation rules shared by every messaging service, the socket gateway and MCP:
 *  - organization isolation: always `organization_id = ctx.organization_id`;
 *  - open channels (PUBLIC/ANNOUNCEMENT/PROJECT + DISCOVERABLE) are readable by anyone holding messaging.channels.read;
 *  - private channels, DMs, customer and record conversations are readable by their active members only (404 otherwise);
 *  - posting needs an active membership, a non-archived channel and the channel posting policy.
 */
@Injectable()
export class MessagingAccessService {
    constructor(private readonly prisma: PrismaService) { }

    requireMembership(ctx: OrgContext): string {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Messaging needs a member identity (service accounts cannot hold channel membership)', code: 'messaging_member_required' });
        return ctx.membership_id;
    }

    /** Where-clause of the channels the caller may read. */
    readableWhere(ctx: OrgContext): Prisma.ChannelWhereInput {
        const open: Prisma.ChannelWhereInput = { kind: { in: OPEN_CHANNEL_KINDS }, visibility: 'DISCOVERABLE' };
        return {
            organization_id: ctx.organization_id,
            status: { not: 'DELETED' },
            OR: ctx.membership_id ? [open, { members: { some: { membership_id: ctx.membership_id, ...ACTIVE_MEMBER } } }] : [open],
        };
    }

    async channelForRead(ctx: OrgContext, channelId: string): Promise<ChannelWithMe> {
        const channel = await this.prisma.channel.findFirst({ where: { id: channelId, ...this.readableWhere(ctx) } });
        if (!channel) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        const me = ctx.membership_id
            ? await this.prisma.channelMember.findFirst({ where: { channel_id: channelId, membership_id: ctx.membership_id, ...ACTIVE_MEMBER } })
            : null;
        return { ...channel, me };
    }

    /** Caller must be an active member (to post, react, pin…). */
    async channelForMember(ctx: OrgContext, channelId: string): Promise<ChannelWithMe & { me: ChannelMember }> {
        const channel = await this.channelForRead(ctx, channelId);
        if (!channel.me) throw new ForbiddenException({ message: 'Join the channel first', code: 'channel_not_member' });
        return channel as ChannelWithMe & { me: ChannelMember };
    }

    assertNotArchived(channel: Channel) {
        if (channel.status === 'ARCHIVED') throw new ForbiddenException({ message: 'This channel is archived and read-only', code: 'channel_archived' });
    }

    assertCanPost(channel: Channel, me: ChannelMember) {
        this.assertNotArchived(channel);
        const role = me.role;
        if (role === ChannelMemberRole.READ_ONLY) throw new ForbiddenException({ message: 'You can read this channel but not post in it', code: 'channel_read_only' });
        const isAdmin = role === ChannelMemberRole.OWNER || role === ChannelMemberRole.ADMIN;
        if (channel.posting_policy === 'ADMINS_ONLY' && !isAdmin) throw new ForbiddenException({ message: 'Only channel admins can post here', code: 'channel_posting_restricted' });
        if (channel.posting_policy === 'OWNERS_ONLY' && role !== ChannelMemberRole.OWNER) throw new ForbiddenException({ message: 'Only channel owners can post here', code: 'channel_posting_restricted' });
        if (channel.posting_policy === 'INTERNAL_MEMBERS_ONLY' && (role === ChannelMemberRole.EXTERNAL || role === ChannelMemberRole.GUEST)) {
            throw new ForbiddenException({ message: 'Only internal members can post here', code: 'channel_posting_restricted' });
        }
    }

    /** Channel admin: OWNER/ADMIN member role, or the organization-wide messaging.channels.manage permission. */
    isChannelAdmin(ctx: OrgContext, me: ChannelMember | null) {
        return ctx.can('messaging.channels.manage') || me?.role === ChannelMemberRole.OWNER || me?.role === ChannelMemberRole.ADMIN;
    }

    assertChannelAdmin(ctx: OrgContext, me: ChannelMember | null) {
        if (!this.isChannelAdmin(ctx, me)) throw new ForbiddenException({ message: 'Only channel owners and admins can change this channel', code: 'channel_admin_required' });
    }

    async settings(organizationId: string): Promise<EffectiveMessagingSettings> {
        const row = await this.prisma.messagingSettings.findUnique({ where: { organization_id: organizationId } });
        return { ...DEFAULT_SETTINGS, ...(row ?? {}) } as EffectiveMessagingSettings;
    }

    /** Active internal members of the organization among these ids (rejects ids from other tenants). */
    async assertOrgMembers(ctx: OrgContext, membershipIds: string[]) {
        const unique = [...new Set(membershipIds)];
        if (!unique.length) return [];
        const rows = await this.prisma.membership.findMany({ where: { id: { in: unique }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true } });
        if (rows.length !== unique.length) throw new NotFoundException({ message: 'One or more members were not found', code: 'membership_not_found' });
        return unique;
    }

    /** Ids of the active internal members of a channel. */
    async memberIds(channelId: string): Promise<string[]> {
        const rows = await this.prisma.channelMember.findMany({ where: { channel_id: channelId, membership_id: { not: null }, ...ACTIVE_MEMBER }, select: { membership_id: true } });
        return rows.map((r) => r.membership_id as string);
    }
}
