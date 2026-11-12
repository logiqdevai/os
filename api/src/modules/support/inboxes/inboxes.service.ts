import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { slugify } from '@/modules/auth/services/organization-setup.service';
import { SupportSetupService } from '../common/support-setup.service';
import { MEMBER_SELECT, SUPPORT_PERMS } from '../common/support.constants';
import { CreateChannelDto, CreateInboxDto, UpdateAgentProfileDto, UpdateChannelDto, UpdateInboxDto } from './dto/inbox.dto';
import { ChannelAiConfig, mergeOwnedConfigKeys, OfficeHoursConfig, officeHoursStatus, readAiConfig, readOfficeHours, withConfigKey } from '../common/channel-config.utils';

const widgetKey = () => `wk_${randomBytes(18).toString('base64url')}`;

/** Inboxes, channels and agent routing profiles (13 §1, §2, §5). */
@Injectable()
export class InboxesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly setup: SupportSetupService,
    ) { }

    // --- Inboxes ---------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, includeArchived = false) {
        await this.setup.ensureDefaults(ctx.organization_id);
        return this.prisma.supportInbox.findMany({
            where: { organization_id: ctx.organization_id, ...(includeArchived ? {} : { archived_at: null }) },
            include: {
                team: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                default_assignee: { select: MEMBER_SELECT },
                channels: { select: { id: true, type: true, name: true, is_active: true, verified_at: true } },
                _count: { select: { conversations: { where: { status: { in: ['OPEN', 'PENDING'] } } }, tickets: { where: { closed_at: null, resolved_at: null } } } },
            },
            orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
        });
    }

    async findOne(ctx: OrgContext, id: string) {
        const inbox = await this.prisma.supportInbox.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { team: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } }, default_assignee: { select: MEMBER_SELECT }, channels: true },
        });
        if (!inbox) throw new NotFoundException({ message: 'Inbox not found', code: 'inbox_not_found' });
        return inbox;
    }

    async create(ctx: OrgContext, dto: CreateInboxDto) {
        await this.assertRefs(ctx, dto);
        const inbox = await this.prisma.supportInbox.create({ data: { ...dto, organization_id: ctx.organization_id, slug: await this.uniqueSlug(ctx, dto.name) } });
        await this.audit.record(ctx, 'support_inbox.created', { resource_type: 'support_inbox', resource_id: inbox.id, branch_id: inbox.branch_id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'support.inbox.created', module: ModuleKey.SUPPORT, entity_kind: 'support_inbox', entity_id: inbox.id, payload: { name: inbox.name } });
        return inbox;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateInboxDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto);
        const inbox = await this.prisma.supportInbox.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'support_inbox.updated', { resource_type: 'support_inbox', resource_id: id, branch_id: inbox.branch_id, metadata: { before: { name: before.name, routing_strategy: before.routing_strategy, team_id: before.team_id }, after: dto } });
        this.events.publish(ctx, { event_key: 'support.inbox.updated', module: ModuleKey.SUPPORT, entity_kind: 'support_inbox', entity_id: id, changes: dto as Record<string, unknown> });
        return inbox;
    }

    async archive(ctx: OrgContext, id: string) {
        const inbox = await this.findOne(ctx, id);
        if (inbox.is_default) throw new ConflictException({ message: 'Make another inbox the default before archiving this one', code: 'inbox_is_default' });
        const row = await this.prisma.supportInbox.update({ where: { id }, data: { archived_at: new Date() } });
        await this.prisma.supportChannel.updateMany({ where: { inbox_id: id }, data: { is_active: false } });
        await this.audit.record(ctx, 'support_inbox.archived', { resource_type: 'support_inbox', resource_id: id });
        this.events.publish(ctx, { event_key: 'support.inbox.archived', module: ModuleKey.SUPPORT, entity_kind: 'support_inbox', entity_id: id });
        return row;
    }

    // --- Channels --------------------------------------------------------------------------------

    async channels(ctx: OrgContext) {
        await this.setup.ensureDefaults(ctx.organization_id);
        return this.prisma.supportChannel.findMany({
            where: { organization_id: ctx.organization_id },
            include: { inbox: { select: { id: true, name: true } }, _count: { select: { conversations: true } } },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
        });
    }

    async channel(ctx: OrgContext, id: string) {
        const ch = await this.prisma.supportChannel.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { inbox: { select: { id: true, name: true } } } });
        if (!ch) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        return ch;
    }

    async createChannel(ctx: OrgContext, dto: CreateChannelDto) {
        await this.findOne(ctx, dto.inbox_id);
        if (dto.type === 'EMAIL' && !dto.email_address) throw new BadRequestException({ message: 'An email channel needs an inbound address', code: 'channel_email_required' });
        if (dto.type === 'PORTAL' && !ctx.can('portal.settings.manage')) {
            throw new ForbiddenException({ message: 'Connecting the portal channel also needs portal.settings.manage', code: 'permission_denied', permissions: ['portal.settings.manage'] });
        }
        const needsKey = dto.type === 'WIDGET' || dto.type === 'LIVE_CHAT';
        try {
            const ch = await this.prisma.supportChannel.create({
                data: {
                    organization_id: ctx.organization_id,
                    inbox_id: dto.inbox_id,
                    type: dto.type,
                    name: dto.name,
                    email_address: dto.email_address?.toLowerCase() ?? null,
                    allowed_origins: dto.allowed_origins ?? [],
                    // AI and office hours are set through their own endpoints (support.ai.configure / support.inboxes.manage).
                    config: (dto.config ? mergeOwnedConfigKeys(dto.config, null) : undefined) as Prisma.InputJsonValue,
                    ai_agent_enabled: false,
                    is_active: dto.is_active ?? true,
                    csat_enabled: dto.csat_enabled ?? true,
                    widget_key: needsKey ? widgetKey() : null,
                    // Portal, form and API channels are internal and need no external verification.
                    verified_at: dto.type === 'EMAIL' ? null : new Date(),
                },
            });
            await this.audit.record(ctx, 'support_channel.created', { resource_type: 'support_channel', resource_id: ch.id, metadata: { type: ch.type, inbox_id: ch.inbox_id, email_address: ch.email_address } });
            this.events.publish(ctx, { event_key: 'support.channel.created', module: ModuleKey.SUPPORT, entity_kind: 'support_channel', entity_id: ch.id, payload: { type: ch.type, name: ch.name } });
            return ch;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This email address is already connected', code: 'channel_email_taken' });
            throw e;
        }
    }

    async updateChannel(ctx: OrgContext, id: string, dto: UpdateChannelDto) {
        const before = await this.channel(ctx, id);
        if (dto.inbox_id) await this.findOne(ctx, dto.inbox_id);
        const { config, type, ...rest } = dto;
        void type; // the channel type cannot change
        try {
            const ch = await this.prisma.supportChannel.update({
                where: { id },
                data: { ...rest, ...(rest.email_address && { email_address: rest.email_address.toLowerCase(), verified_at: null }), ...(config !== undefined && { config: mergeOwnedConfigKeys(config, before.config) as Prisma.InputJsonValue }) },
            });
            await this.audit.record(ctx, 'support_channel.updated', { resource_type: 'support_channel', resource_id: id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: 'support.channel.updated', module: ModuleKey.SUPPORT, entity_kind: 'support_channel', entity_id: id, changes: dto as Record<string, unknown> });
            return ch;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'This email address is already connected', code: 'channel_email_taken' });
            throw e;
        }
    }

    /** Effective AI auto-answer and office-hours settings of a channel (with the live open/closed state). */
    async channelAutomation(ctx: OrgContext, id: string) {
        const ch = await this.channel(ctx, id);
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { business_hours: true, working_days: true, default_timezone: true } });
        const officeHours = readOfficeHours(ch.config);
        return { channel_id: ch.id, ai: readAiConfig(ch.config), office_hours: officeHours, office_hours_status: officeHoursStatus(officeHours, org) };
    }

    /** 13 §3 — AI auto-answer of one channel: off / suggest only / auto-reply above a confidence threshold. */
    async setAiAgent(ctx: OrgContext, id: string, ai: ChannelAiConfig) {
        const before = await this.channel(ctx, id);
        if (ai.mode !== 'OFF' && (before.type === 'PHONE' || before.type === 'API' || before.type === 'FORM')) {
            throw new BadRequestException({ message: 'The AI agent answers on chat, widget, email and portal channels only', code: 'channel_ai_unsupported' });
        }
        const previous = readAiConfig(before.config);
        await this.prisma.supportChannel.update({ where: { id }, data: { config: withConfigKey(before.config, 'ai', ai) as Prisma.InputJsonValue, ai_agent_enabled: ai.mode !== 'OFF' } });
        await this.audit.record(ctx, 'support_channel.ai_agent_updated', { resource_type: 'support_channel', resource_id: id, metadata: { before: previous, after: ai } });
        this.events.publish(ctx, { event_key: 'support.channel.ai_agent_updated', module: ModuleKey.SUPPORT, entity_kind: 'support_channel', entity_id: id, payload: { mode: ai.mode, previous_mode: previous.mode, min_confidence: ai.min_confidence, max_turns: ai.max_turns } });
        return this.channelAutomation(ctx, id);
    }

    /** 13 §5 — live-chat office hours: outside them the widget shows a "we'll reply by email" form. */
    async setOfficeHours(ctx: OrgContext, id: string, oh: OfficeHoursConfig) {
        const before = await this.channel(ctx, id);
        if (before.type !== 'WIDGET' && before.type !== 'LIVE_CHAT') throw new BadRequestException({ message: 'Office hours apply to widget and live chat channels', code: 'channel_no_widget' });
        const previous = readOfficeHours(before.config);
        await this.prisma.supportChannel.update({ where: { id }, data: { config: withConfigKey(before.config, 'office_hours', oh) as Prisma.InputJsonValue } });
        await this.audit.record(ctx, 'support_channel.office_hours_updated', { resource_type: 'support_channel', resource_id: id, metadata: { before: previous, after: oh } });
        this.events.publish(ctx, { event_key: 'support.channel.office_hours_updated', module: ModuleKey.SUPPORT, entity_kind: 'support_channel', entity_id: id, payload: { enabled: oh.enabled } });
        return this.channelAutomation(ctx, id);
    }

    async rotateWidgetKey(ctx: OrgContext, id: string) {
        const ch = await this.channel(ctx, id);
        if (ch.type !== 'WIDGET' && ch.type !== 'LIVE_CHAT') throw new BadRequestException({ message: 'Only widget and live chat channels have an embed key', code: 'channel_no_widget' });
        const row = await this.prisma.supportChannel.update({ where: { id }, data: { widget_key: widgetKey() } });
        await this.audit.record(ctx, 'support_channel.widget_key_rotated', { resource_type: 'support_channel', resource_id: id });
        return row;
    }

    /** Mark an email channel verified once forwarding was confirmed by an inbound message, or by an admin. */
    async verifyChannel(ctx: OrgContext, id: string) {
        const ch = await this.channel(ctx, id);
        const inbound = ch.type === 'EMAIL' ? await this.prisma.supportConversation.count({ where: { channel_id: id } }) : 1;
        const row = await this.prisma.supportChannel.update({ where: { id }, data: { verified_at: new Date() } });
        await this.audit.record(ctx, 'support_channel.verified', { resource_type: 'support_channel', resource_id: id, metadata: { inbound_seen: inbound > 0, manual: inbound === 0 } });
        return row;
    }

    // --- Agents (routing profiles) ---------------------------------------------------------------

    /** Active members with their support profile and open load, for assignee pickers and routing. */
    async agents(ctx: OrgContext, search?: string) {
        const members = await this.prisma.membership.findMany({
            where: {
                organization_id: ctx.organization_id,
                status: 'ACTIVE',
                ...(search && { user: { OR: [{ display_name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { first_name: { contains: search, mode: 'insensitive' } }, { last_name: { contains: search, mode: 'insensitive' } }] } }),
            },
            select: { ...MEMBER_SELECT },
            orderBy: { joined_at: 'asc' },
            take: 200,
        });
        const ids = members.map((m) => m.id);
        const [profiles, load] = await Promise.all([
            this.prisma.supportAgentProfile.findMany({ where: { membership_id: { in: ids } } }),
            this.prisma.supportConversation.groupBy({ by: ['assignee_membership_id'], where: { organization_id: ctx.organization_id, assignee_membership_id: { in: ids }, status: { in: ['OPEN', 'PENDING'] } }, _count: { _all: true } }),
        ]);
        return members.map((m) => ({
            ...m,
            profile: profiles.find((p) => p.membership_id === m.id) ?? null,
            open_conversations: load.find((l) => l.assignee_membership_id === m.id)?._count._all ?? 0,
        }));
    }

    async updateAgentProfile(ctx: OrgContext, membershipId: string, dto: UpdateAgentProfileDto) {
        const self = membershipId === ctx.membership_id;
        if (!self && !ctx.can(SUPPORT_PERMS.inboxesManage)) {
            throw new ForbiddenException({ message: 'Editing another agent needs support.inboxes.manage', code: 'permission_denied', permissions: [SUPPORT_PERMS.inboxesManage] });
        }
        const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organization_id: ctx.organization_id } });
        if (!m) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        const row = await this.prisma.supportAgentProfile.upsert({
            where: { membership_id: membershipId },
            update: dto,
            create: { ...dto, membership_id: membershipId, organization_id: ctx.organization_id },
        });
        await this.audit.record(ctx, 'support_agent_profile.updated', { resource_type: 'support_agent_profile', resource_id: membershipId, metadata: { after: dto } });
        return row;
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateInboxDto) {
        const checks: Promise<unknown>[] = [];
        const org = ctx.organization_id;
        if (dto.team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: org } }));
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: org } }));
        if (dto.default_assignee_membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: dto.default_assignee_membership_id, organization_id: org } }));
        if (dto.default_sla_policy_id) checks.push(this.prisma.slaPolicy.findFirstOrThrow({ where: { id: dto.default_sla_policy_id, organization_id: org } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Team, branch, member or SLA policy not found', code: 'reference_not_found' });
        }
    }

    private async uniqueSlug(ctx: OrgContext, name: string) {
        const base = slugify(name) || 'inbox';
        let slug = base;
        for (let i = 2; await this.prisma.supportInbox.findFirst({ where: { organization_id: ctx.organization_id, slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
        return slug;
    }
}
