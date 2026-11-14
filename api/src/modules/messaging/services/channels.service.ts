import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelKind, ChannelMemberRole, ChannelMembershipSource, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AddChannelMembersDto, ChannelPreferencesDto, CreateChannelDto, OpenDmDto, UpdateChannelDto } from '../dto/channel.dto';
import { BrowseChannelsQuery } from '../dto/messaging-query.schema';
import { slugifyChannel } from '../utils/message-format.utils';
import { ACTIVE_MEMBER, DM_KINDS, MEMBERSHIP_PERSON_SELECT, MessagingAccessService, OPEN_CHANNEL_KINDS, USER_PUBLIC_SELECT, personName } from './messaging-access.service';
import { MessagesService } from './messages.service';
import { MessagingRealtimeService } from './messaging-realtime.service';

const CHANNEL_LIST_SELECT = {
    id: true, kind: true, visibility: true, status: true, slug: true, name: true, display_name: true, description: true, topic: true, purpose: true, icon: true,
    posting_policy: true, external_access_enabled: true, is_confidential: true, member_count: true, message_count: true, last_message_at: true,
    project_id: true, company_id: true, archived_at: true, created_at: true, owner_membership_id: true,
} satisfies Prisma.ChannelSelect;

/**
 * Channels, DMs and channel membership (12 §5–9, §33). Visibility and role checks come from MessagingAccessService;
 * every write is audited, published on the event bus and pushed to the channel's socket room.
 */
@Injectable()
export class ChannelsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly messages: MessagesService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly realtime: MessagingRealtimeService,
    ) { }

    /** Sidebar: the caller's channels and DMs with unread / mention counts, favorites and mute state. */
    /**
     * 12 §9 — organization-wide channels (`auto_join`) include every member. Joins the caller to any they are not in
     * yet; a member who left a channel (left_at set) is not re-added. Idempotent and cheap after the first call.
     */
    private async joinAutoJoinChannels(ctx: OrgContext, membershipId: string) {
        // First use of Messaging in an organization: create the organization-wide #general channel.
        if (!(await this.prisma.channel.count({ where: { organization_id: ctx.organization_id } }))) {
            try {
                await this.prisma.channel.create({
                    data: {
                        organization_id: ctx.organization_id, kind: 'PUBLIC', visibility: 'DISCOVERABLE', slug: 'general', name: 'general', display_name: 'general',
                        description: 'Company-wide announcements and chat', auto_join: true, owner_membership_id: membershipId, created_by_membership_id: membershipId, member_count: 0,
                    },
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
            }
        }
        const missing = await this.prisma.channel.findMany({
            where: { organization_id: ctx.organization_id, auto_join: true, status: 'ACTIVE', members: { none: { membership_id: membershipId } } },
            select: { id: true },
        });
        for (const c of missing) {
            const created = await this.prisma.channelMember.createMany({ data: [{ channel_id: c.id, membership_id: membershipId, source: 'ORGANIZATION_DEFAULT' }], skipDuplicates: true });
            if (created.count) await this.prisma.channel.update({ where: { id: c.id }, data: { member_count: { increment: 1 } } });
        }
    }

    /** Auto-join affects every member: organization-level permission, open channel kinds only. */
    private assertAutoJoin(ctx: OrgContext, autoJoin: boolean | undefined, kind: string) {
        if (!autoJoin) return;
        if (!ctx.can('messaging.channels.manage')) throw new ForbiddenException({ message: 'Making a channel organization-wide needs messaging.channels.manage', code: 'permission_denied', permissions: ['messaging.channels.manage'] });
        if (kind !== 'PUBLIC' && kind !== 'ANNOUNCEMENT') throw new BadRequestException({ message: 'Only public or announcement channels can include everyone automatically', code: 'auto_join_kind' });
    }

    async mine(ctx: OrgContext, includeArchived = false) {
        const me = this.access.requireMembership(ctx);
        await this.joinAutoJoinChannels(ctx, me);
        const rows = await this.prisma.channelMember.findMany({
            where: { membership_id: me, ...ACTIVE_MEMBER, channel: { organization_id: ctx.organization_id, status: includeArchived ? { not: 'DELETED' } : 'ACTIVE' } },
            include: {
                channel: {
                    select: {
                        ...CHANNEL_LIST_SELECT,
                        members: {
                            where: { ...ACTIVE_MEMBER, membership_id: { not: me } },
                            take: 9,
                            select: { membership_id: true, external_user_id: true, membership: { select: MEMBERSHIP_PERSON_SELECT } },
                        },
                    },
                },
            },
        });
        const reads = await this.prisma.channelReadState.findMany({ where: { membership_id: me, channel_id: { in: rows.map((r) => r.channel_id) } } });
        const readBy = new Map(reads.map((r) => [r.channel_id, r]));
        const data = rows.map((r) => {
            const { members, ...channel } = r.channel;
            const dm = DM_KINDS.includes(channel.kind);
            const participants = dm ? members.filter((m) => m.membership).map((m) => ({ membership_id: m.membership_id, name: personName(m.membership!.user), profile_photo_url: m.membership!.user.profile_photo_url })) : [];
            const read = readBy.get(channel.id);
            return {
                ...channel,
                label: dm ? participants.map((p) => p.name).join(', ') || 'Just you' : channel.name,
                participants,
                my_role: r.role,
                is_favorite: r.is_favorite,
                muted_until: r.muted_until,
                last_viewed_at: r.last_viewed_at,
                unread_count: read?.unread_count ?? 0,
                mention_count: read?.mention_count ?? 0,
                last_read_message_id: read?.last_read_message_id ?? null,
            };
        });
        data.sort((a, b) => (b.last_message_at?.getTime() ?? 0) - (a.last_message_at?.getTime() ?? 0));
        return { data };
    }

    /** Channel browser: open (discoverable) channels with a joined flag. */
    async browse(ctx: OrgContext, query: BrowseChannelsQuery) {
        const where: Prisma.ChannelWhereInput = {
            organization_id: ctx.organization_id,
            kind: { in: OPEN_CHANNEL_KINDS },
            visibility: 'DISCOVERABLE',
            status: query.archived ? 'ARCHIVED' : 'ACTIVE',
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { topic: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const order = query.order_by === 'member_count' || query.order_by === 'last_message_at' ? { [query.order_by]: query.order_direction } : { name: 'asc' as const };
        const [items, total] = await Promise.all([
            this.prisma.channel.findMany({
                where,
                select: { ...CHANNEL_LIST_SELECT, members: ctx.membership_id ? { where: { membership_id: ctx.membership_id, ...ACTIVE_MEMBER }, select: { id: true } } : false },
                orderBy: order,
                ...skipTake(query),
            }),
            this.prisma.channel.count({ where }),
        ]);
        return paginate(items.map(({ members, ...c }) => ({ ...c, is_member: !!(members as unknown[] | undefined)?.length })), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const channel = await this.access.channelForRead(ctx, id);
        const [pins, read, participants] = await Promise.all([
            this.prisma.channelPin.count({ where: { channel_id: id, message: { deleted_at: null } } }),
            ctx.membership_id ? this.prisma.channelReadState.findUnique({ where: { channel_id_membership_id: { channel_id: id, membership_id: ctx.membership_id } } }) : null,
            DM_KINDS.includes(channel.kind)
                ? this.prisma.channelMember.findMany({ where: { channel_id: id, ...ACTIVE_MEMBER, membership_id: { not: ctx.membership_id ?? undefined } }, select: { membership_id: true, membership: { select: MEMBERSHIP_PERSON_SELECT } } })
                : [],
        ]);
        const people = participants.filter((p) => p.membership).map((p) => ({ membership_id: p.membership_id, name: personName(p.membership!.user), profile_photo_url: p.membership!.user.profile_photo_url, job_title: p.membership!.job_title }));
        const { me, settings: _settings, membership_rules: _rules, dm_key: _dm, ...rest } = channel;
        const [team, project] = await Promise.all([
            channel.team_id ? this.prisma.team.findUnique({ where: { id: channel.team_id }, select: { id: true, name: true } }) : null,
            channel.project_id ? this.prisma.project.findFirst({ where: { AND: [{ id: channel.project_id }, this.projectScope(ctx)] }, select: { id: true, name: true, code: true } }) : null,
        ]);
        return {
            ...rest,
            team,
            project,
            label: DM_KINDS.includes(channel.kind) ? people.map((p) => p.name).join(', ') || 'Just you' : channel.name,
            participants: people,
            pin_count: pins,
            is_member: !!me,
            my_role: me?.role ?? null,
            is_favorite: me?.is_favorite ?? false,
            muted_until: me?.muted_until ?? null,
            unread_count: read?.unread_count ?? 0,
            mention_count: read?.mention_count ?? 0,
            last_read_message_id: read?.last_read_message_id ?? null,
            can_manage: this.access.isChannelAdmin(ctx, me),
            can_post: !!me && channel.status === 'ACTIVE' && me.role !== 'READ_ONLY',
        };
    }

    /** Projects the caller may link a channel to (their project read scope), as a Prisma filter. */
    private projectScope(ctx: OrgContext): Prisma.ProjectWhereInput {
        const scope = ctx.scopeOf('projects.projects.read');
        if (!scope) return { id: { in: [] } };
        if (scope.organization) return {};
        const or: Prisma.ProjectWhereInput[] = [{ id: { in: scope.project_ids } }, { team_id: { in: scope.team_ids } }, { branch_id: { in: scope.branch_ids } }, { company_id: { in: scope.customer_ids } }];
        if (ctx.membership_id) or.push({ owner_membership_id: ctx.membership_id }, { members: { some: { membership_id: ctx.membership_id, is_active: true } } });
        return { OR: or };
    }

    /** Teams and projects a new channel can be created for, with the people who belong to each (12 §7, §26). */
    async sources(ctx: OrgContext, search?: string) {
        const q = search?.trim();
        const [teams, projects] = await Promise.all([
            this.prisma.team.findMany({
                where: { organization_id: ctx.organization_id, archived_at: null, ...(q && { name: { contains: q, mode: 'insensitive' } }) },
                orderBy: { name: 'asc' }, take: 100,
                select: { id: true, name: true, members: { where: { ended_at: null, membership: { status: 'ACTIVE' } }, select: { membership_id: true } } },
            }),
            ctx.can('projects.projects.read')
                ? this.prisma.project.findMany({
                    where: { AND: [{ organization_id: ctx.organization_id, archived_at: null }, this.projectScope(ctx), ...(q ? [{ OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { code: { contains: q, mode: 'insensitive' as const } }] }] : [])] },
                    orderBy: { updated_at: 'desc' }, take: 100,
                    select: { id: true, name: true, code: true, owner_membership_id: true, members: { where: { is_active: true, left_at: null, membership: { status: 'ACTIVE' } }, select: { membership_id: true } } },
                })
                : [],
        ]);
        return {
            teams: teams.map((t) => ({ id: t.id, name: t.name, member_ids: t.members.map((m) => m.membership_id) })),
            projects: projects.map((p) => ({ id: p.id, name: p.name, code: p.code, member_ids: [...new Set([...(p.owner_membership_id ? [p.owner_membership_id] : []), ...p.members.map((m) => m.membership_id)])] })),
        };
    }

    async create(ctx: OrgContext, dto: CreateChannelDto) {
        const owner = this.access.requireMembership(ctx);
        const slug = slugifyChannel(dto.name);
        if (!slug) throw new BadRequestException({ message: 'Use letters or numbers in the channel name', code: 'channel_name_invalid' });
        // A linked team / project adds everyone in it; both must belong to this organization (and the project be visible to the caller).
        const source = await this.sources(ctx);
        const team = dto.team_id ? source.teams.find((t) => t.id === dto.team_id) : undefined;
        const project = dto.project_id ? source.projects.find((p) => p.id === dto.project_id) : undefined;
        if (dto.team_id && !team) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        if (dto.project_id && !project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        const wanted = [...new Set([...(dto.membership_ids ?? []), ...(team?.member_ids ?? []), ...(project?.member_ids ?? [])])];
        const others = (await this.access.assertOrgMembers(ctx, wanted)).filter((id) => id !== owner);
        const kind = dto.kind ?? 'PUBLIC';
        this.assertAutoJoin(ctx, dto.auto_join, kind);
        try {
            const channel = await this.prisma.$transaction(async (tx) => {
                const c = await tx.channel.create({
                    data: {
                        organization_id: ctx.organization_id,
                        kind,
                        visibility: kind === 'PRIVATE' ? 'HIDDEN' : 'DISCOVERABLE',
                        slug,
                        name: slug,
                        display_name: dto.name,
                        description: dto.description ?? null,
                        topic: dto.topic ?? null,
                        purpose: dto.purpose ?? null,
                        auto_join: dto.auto_join ?? false,
                        team_id: team?.id ?? null,
                        project_id: project?.id ?? null,
                        owner_membership_id: owner,
                        created_by_membership_id: owner,
                        member_count: others.length + 1,
                    },
                });
                await tx.channelMember.createMany({
                    data: [
                        { channel_id: c.id, membership_id: owner, role: ChannelMemberRole.OWNER, source: ChannelMembershipSource.MANUAL },
                        ...others.map((id) => ({ channel_id: c.id, membership_id: id, role: ChannelMemberRole.MEMBER, source: ChannelMembershipSource.MANUAL, invited_by_user_id: ctx.user_id })),
                    ],
                });
                await tx.channelReadState.createMany({ data: [owner, ...others].map((id) => ({ channel_id: c.id, membership_id: id })), skipDuplicates: true });
                return c;
            });
            await this.audit.record(ctx, 'channel.created', { resource_type: 'channel', resource_id: channel.id, metadata: { after: { name: slug, kind, members: others.length + 1 } } });
            this.events.publish(ctx, {
                event_key: 'messaging.channel.created', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: channel.id,
                payload: { name: slug, kind, member_ids: [owner, ...others] },
                activity: kind === 'PUBLIC' ? { summary: `created #${slug}`, entity_label: `#${slug}` } : undefined,
            });
            this.realtime.joinChannel([owner, ...others], channel.id);
            this.realtime.toMembers([owner, ...others], 'channel.created', { channel_id: channel.id });
            return this.findOne(ctx, channel.id);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException({ message: `A channel named #${slug} already exists`, code: 'channel_conflict' });
            }
            throw error;
        }
    }

    async update(ctx: OrgContext, id: string, dto: UpdateChannelDto) {
        const channel = await this.access.channelForRead(ctx, id);
        if (DM_KINDS.includes(channel.kind)) throw new BadRequestException({ message: 'Direct messages have no name or topic', code: 'dm_not_editable' });
        if (dto.topic !== undefined && Object.keys(dto).length === 1) {
            // Topic: any member may change it (12 §48), unless archived.
            if (!channel.me && !this.access.isChannelAdmin(ctx, null)) throw new ForbiddenException({ message: 'Join the channel first', code: 'channel_not_member' });
        } else {
            this.access.assertChannelAdmin(ctx, channel.me);
        }
        this.access.assertNotArchived(channel);
        this.assertAutoJoin(ctx, dto.auto_join, channel.kind);
        const data: Prisma.ChannelUpdateInput = { description: dto.description, topic: dto.topic, purpose: dto.purpose, auto_join: dto.auto_join };
        let renamedTo: string | null = null;
        if (dto.name !== undefined) {
            const slug = slugifyChannel(dto.name);
            if (!slug) throw new BadRequestException({ message: 'Use letters or numbers in the channel name', code: 'channel_name_invalid' });
            if (slug !== channel.slug) renamedTo = slug;
            Object.assign(data, { slug, name: slug, display_name: dto.name });
        }
        try {
            await this.prisma.channel.update({ where: { id }, data });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'A channel with this name already exists', code: 'channel_conflict' });
            throw error;
        }
        await this.audit.record(ctx, 'channel.updated', { resource_type: 'channel', resource_id: id, metadata: { before: { name: channel.name, topic: channel.topic, description: channel.description, purpose: channel.purpose }, after: dto } });
        this.events.publish(ctx, { event_key: 'messaging.channel.updated', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { name: renamedTo ?? channel.name }, changes: dto as Record<string, unknown> });
        if (renamedTo) await this.messages.postSystem(ctx, id, 'channel_renamed', `renamed the channel from #${channel.name} to #${renamedTo}`);
        else if (dto.topic !== undefined && dto.topic !== channel.topic) await this.messages.postSystem(ctx, id, 'topic_changed', dto.topic ? `set the topic: ${dto.topic}` : 'cleared the topic');
        this.realtime.toChannel(id, 'channel.updated', { channel_id: id });
        return this.findOne(ctx, id);
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        const channel = await this.access.channelForRead(ctx, id);
        if (DM_KINDS.includes(channel.kind)) throw new BadRequestException({ message: 'Direct messages cannot be archived', code: 'dm_not_archivable' });
        this.access.assertChannelAdmin(ctx, channel.me);
        if ((channel.status === 'ARCHIVED') === archived) return this.findOne(ctx, id);
        if (!archived) {
            await this.prisma.channel.update({ where: { id }, data: { status: 'ACTIVE', archived_at: null, archived_by_user_id: null, archive_reason: null } });
            await this.messages.postSystem(ctx, id, 'channel_unarchived', 'unarchived the channel');
        } else {
            await this.messages.postSystem(ctx, id, 'channel_archived', 'archived the channel');
            await this.prisma.channel.update({ where: { id }, data: { status: 'ARCHIVED', archived_at: new Date(), archived_by_user_id: ctx.user_id, archive_reason: 'manual' } });
        }
        await this.audit.record(ctx, archived ? 'channel.archived' : 'channel.unarchived', { resource_type: 'channel', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'messaging.channel.archived' : 'messaging.channel.unarchived', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { name: channel.name } });
        this.realtime.toChannel(id, 'channel.updated', { channel_id: id });
        return this.findOne(ctx, id);
    }

    async join(ctx: OrgContext, id: string) {
        const me = this.access.requireMembership(ctx);
        const channel = await this.access.channelForRead(ctx, id);
        if (channel.me) return this.findOne(ctx, id);
        if (!OPEN_CHANNEL_KINDS.includes(channel.kind)) throw new ForbiddenException({ message: 'Ask a member to add you to this channel', code: 'channel_invite_only' });
        this.access.assertNotArchived(channel);
        await this.addMemberRows(ctx, id, [me], ChannelMembershipSource.JOINED);
        await this.audit.record(ctx, 'channel.member_joined', { resource_type: 'channel', resource_id: id, metadata: { membership_id: me } });
        this.events.publish(ctx, { event_key: 'messaging.member.joined', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { membership_id: me, name: channel.name } });
        await this.messages.postSystem(ctx, id, 'member_joined', 'joined the channel');
        this.realtime.joinChannel([me], id);
        this.realtime.toChannel(id, 'member.updated', { channel_id: id });
        this.realtime.toMembers([me], 'channel.created', { channel_id: id });
        return this.findOne(ctx, id);
    }

    async leave(ctx: OrgContext, id: string) {
        const me = this.access.requireMembership(ctx);
        const channel = await this.access.channelForMember(ctx, id);
        if (channel.me.is_required) throw new ForbiddenException({ message: 'This channel is required for you and cannot be left', code: 'channel_required' });
        if (channel.kind === ChannelKind.DIRECT) throw new BadRequestException({ message: 'You cannot leave a direct message', code: 'dm_not_leavable' });
        await this.prisma.channelMember.update({ where: { id: channel.me.id }, data: { left_at: new Date(), is_favorite: false } });
        await this.refreshMemberCount(id);
        await this.audit.record(ctx, 'channel.member_left', { resource_type: 'channel', resource_id: id, metadata: { membership_id: me } });
        this.events.publish(ctx, { event_key: 'messaging.member.left', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { membership_id: me } });
        await this.messages.postSystem(ctx, id, 'member_left', 'left the channel');
        this.realtime.leaveChannel([me], id);
        this.realtime.toChannel(id, 'member.updated', { channel_id: id });
        this.realtime.toMembers([me], 'channel.removed', { channel_id: id });
        return { success: true };
    }

    async members(ctx: OrgContext, id: string) {
        await this.access.channelForRead(ctx, id);
        const rows = await this.prisma.channelMember.findMany({
            where: { channel_id: id, ...ACTIVE_MEMBER },
            select: {
                id: true, role: true, source: true, joined_at: true, external_label: true, guest_kind: true, membership_id: true, external_user_id: true,
                membership: { select: MEMBERSHIP_PERSON_SELECT },
                external_user: { select: USER_PUBLIC_SELECT },
            },
            orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
            take: 1000,
        });
        return {
            data: rows.map((r) => {
                const user = r.membership?.user ?? r.external_user;
                return {
                    id: r.id, role: r.role, source: r.source, joined_at: r.joined_at, membership_id: r.membership_id, external_user_id: r.external_user_id,
                    external: !!r.external_user_id, external_label: r.external_label,
                    name: personName(user), email: user?.email ?? null, profile_photo_url: user?.profile_photo_url ?? null, job_title: r.membership?.job_title ?? null,
                };
            }),
        };
    }

    async addMembers(ctx: OrgContext, id: string, dto: AddChannelMembersDto) {
        const channel = await this.access.channelForRead(ctx, id);
        if (channel.kind === ChannelKind.DIRECT) throw new BadRequestException({ message: 'Start a group message to add more people', code: 'dm_fixed_members' });
        if (!channel.me && !ctx.can('messaging.channels.manage')) throw new ForbiddenException({ message: 'Join the channel first', code: 'channel_not_member' });
        this.access.assertNotArchived(channel);
        const ids = await this.access.assertOrgMembers(ctx, dto.membership_ids ?? []);
        const externals = [...new Set(dto.external_user_ids ?? [])];
        if (externals.length) {
            if (!ctx.can('messaging.external_users.manage')) throw new ForbiddenException({ message: 'You do not have permission to add external people (messaging.external_users.manage)', code: 'permission_denied' });
            if (!channel.external_access_enabled) throw new BadRequestException({ message: 'External access is turned off for this channel', code: 'channel_external_disabled' });
            const portal = await this.prisma.customerPortalMembership.findMany({ where: { organization_id: ctx.organization_id, user_id: { in: externals } }, select: { user_id: true } });
            if (new Set(portal.map((p) => p.user_id)).size !== externals.length) throw new NotFoundException({ message: 'External person not found in this organization', code: 'external_user_not_found' });
        }
        if (!ids.length && !externals.length) throw new BadRequestException({ message: 'Choose at least one person', code: 'members_required' });

        const added = await this.addMemberRows(ctx, id, ids, ChannelMembershipSource.MANUAL);
        for (const userId of externals) {
            await this.prisma.channelMember.upsert({
                where: { channel_id_external_user_id: { channel_id: id, external_user_id: userId } },
                update: { left_at: null, removed_at: null, role: ChannelMemberRole.EXTERNAL },
                create: { channel_id: id, external_user_id: userId, role: ChannelMemberRole.EXTERNAL, source: ChannelMembershipSource.CUSTOMER, guest_kind: 'CUSTOMER', invited_by_user_id: ctx.user_id },
            });
        }
        await this.refreshMemberCount(id);
        await this.audit.record(ctx, 'channel.members_added', { resource_type: 'channel', resource_id: id, metadata: { membership_ids: added, external_user_ids: externals } });
        this.events.publish(ctx, { event_key: 'messaging.member.added', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { membership_ids: added, external_user_ids: externals, name: channel.name } });
        if (added.length || externals.length) {
            const names = await this.namesOf(added);
            await this.messages.postSystem(ctx, id, 'member_added', `added ${[...names, ...(externals.length ? [`${externals.length} external ${externals.length === 1 ? 'person' : 'people'}`] : [])].join(', ')}`);
        }
        this.realtime.joinChannel(added, id);
        this.realtime.toMembers(added, 'channel.created', { channel_id: id });
        this.realtime.toChannel(id, 'member.updated', { channel_id: id });
        return this.members(ctx, id);
    }

    async removeMember(ctx: OrgContext, id: string, channelMemberId: string) {
        const channel = await this.access.channelForRead(ctx, id);
        if (DM_KINDS.includes(channel.kind)) throw new BadRequestException({ message: 'People cannot be removed from direct messages', code: 'dm_fixed_members' });
        this.access.assertChannelAdmin(ctx, channel.me);
        const row = await this.prisma.channelMember.findFirst({ where: { id: channelMemberId, channel_id: id, ...ACTIVE_MEMBER } });
        if (!row) throw new NotFoundException({ message: 'Member is not in this channel', code: 'channel_member_not_found' });
        if (row.role === ChannelMemberRole.OWNER && !ctx.can('messaging.channels.manage')) throw new ForbiddenException({ message: 'The channel owner cannot be removed', code: 'channel_owner' });
        await this.prisma.channelMember.update({ where: { id: row.id }, data: { removed_at: new Date(), removed_by_user_id: ctx.user_id } });
        await this.refreshMemberCount(id);
        await this.audit.record(ctx, 'channel.member_removed', { resource_type: 'channel', resource_id: id, metadata: { membership_id: row.membership_id, external_user_id: row.external_user_id } });
        this.events.publish(ctx, { event_key: 'messaging.member.removed', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: id, payload: { membership_id: row.membership_id, external_user_id: row.external_user_id } });
        if (row.membership_id) {
            const [name] = await this.namesOf([row.membership_id]);
            await this.messages.postSystem(ctx, id, 'member_removed', `removed ${name}`);
            this.realtime.leaveChannel([row.membership_id], id);
            this.realtime.toMembers([row.membership_id], 'channel.removed', { channel_id: id });
        }
        this.realtime.toChannel(id, 'member.updated', { channel_id: id });
        return { success: true };
    }

    async preferences(ctx: OrgContext, id: string, dto: ChannelPreferencesDto) {
        const channel = await this.access.channelForMember(ctx, id);
        const row = await this.prisma.channelMember.update({
            where: { id: channel.me.id },
            data: { is_favorite: dto.is_favorite, muted_until: dto.muted_until === undefined ? undefined : dto.muted_until ? new Date(dto.muted_until) : null },
            select: { is_favorite: true, muted_until: true },
        });
        this.audit.recordAsync(ctx, 'channel.preferences_updated', { resource_type: 'channel', resource_id: id, metadata: { after: dto } });
        this.realtime.toMembers([channel.me.membership_id as string], 'channel.updated', { channel_id: id });
        return { channel_id: id, ...row };
    }

    /** Open (or create once) the DM / group DM with these members. `dm_key` = sorted participant ids, so it is never created twice. */
    async openDm(ctx: OrgContext, dto: OpenDmDto) {
        const me = this.access.requireMembership(ctx);
        const others = (await this.access.assertOrgMembers(ctx, dto.membership_ids)).filter((id) => id !== me);
        const participants = [me, ...others].sort();
        const dm_key = participants.join(':');
        const existing = await this.prisma.channel.findFirst({ where: { organization_id: ctx.organization_id, dm_key } });
        if (existing) {
            // Re-activate my membership if I left a group DM earlier.
            await this.prisma.channelMember.updateMany({ where: { channel_id: existing.id, membership_id: me, NOT: { left_at: null } }, data: { left_at: null } });
            return this.findOne(ctx, existing.id);
        }
        const kind = participants.length > 2 ? ChannelKind.GROUP_DIRECT : ChannelKind.DIRECT;
        let channelId: string;
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const c = await tx.channel.create({
                    data: { organization_id: ctx.organization_id, kind, visibility: 'HIDDEN', dm_key, created_by_membership_id: me, member_count: participants.length },
                });
                await tx.channelMember.createMany({ data: participants.map((id) => ({ channel_id: c.id, membership_id: id, role: ChannelMemberRole.MEMBER, source: ChannelMembershipSource.MANUAL })) });
                await tx.channelReadState.createMany({ data: participants.map((id) => ({ channel_id: c.id, membership_id: id })), skipDuplicates: true });
                return c;
            });
            channelId = created.id;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const again = await this.prisma.channel.findFirstOrThrow({ where: { organization_id: ctx.organization_id, dm_key } });
                return this.findOne(ctx, again.id);
            }
            throw error;
        }
        await this.audit.record(ctx, 'channel.dm_opened', { resource_type: 'channel', resource_id: channelId, metadata: { kind, participants } });
        this.events.publish(ctx, { event_key: 'messaging.channel.created', module: ModuleKey.MESSAGING, entity_type: RecordEntityType.CHANNEL, entity_id: channelId, payload: { kind, member_ids: participants } });
        this.realtime.joinChannel(participants, channelId);
        this.realtime.toMembers(participants, 'channel.created', { channel_id: channelId });
        return this.findOne(ctx, channelId);
    }

    private async addMemberRows(ctx: OrgContext, channelId: string, membershipIds: string[], source: ChannelMembershipSource) {
        const added: string[] = [];
        for (const id of membershipIds) {
            const existing = await this.prisma.channelMember.findUnique({ where: { channel_id_membership_id: { channel_id: channelId, membership_id: id } } });
            if (existing && !existing.left_at && !existing.removed_at) continue;
            if (existing) {
                await this.prisma.channelMember.update({ where: { id: existing.id }, data: { left_at: null, removed_at: null, removed_by_user_id: null, joined_at: new Date(), source } });
            } else {
                await this.prisma.channelMember.create({ data: { channel_id: channelId, membership_id: id, role: ChannelMemberRole.MEMBER, source, invited_by_user_id: source === 'JOINED' ? null : ctx.user_id } });
            }
            await this.prisma.channelReadState.upsert({
                where: { channel_id_membership_id: { channel_id: channelId, membership_id: id } },
                update: { unread_count: 0, mention_count: 0, last_read_at: new Date() },
                create: { channel_id: channelId, membership_id: id, last_read_at: new Date() },
            });
            added.push(id);
        }
        if (added.length) await this.refreshMemberCount(channelId);
        return added;
    }

    private async refreshMemberCount(channelId: string) {
        const count = await this.prisma.channelMember.count({ where: { channel_id: channelId, ...ACTIVE_MEMBER } });
        await this.prisma.channel.update({ where: { id: channelId }, data: { member_count: count } });
    }

    private async namesOf(membershipIds: string[]) {
        if (!membershipIds.length) return [];
        const rows = await this.prisma.membership.findMany({ where: { id: { in: membershipIds } }, select: { id: true, user: { select: USER_PUBLIC_SELECT } } });
        const byId = new Map(rows.map((r) => [r.id, personName(r.user)]));
        return membershipIds.map((id) => byId.get(id) ?? 'someone');
    }
}
