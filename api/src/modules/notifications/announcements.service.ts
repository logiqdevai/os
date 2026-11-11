import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AnnouncementStatus, ModuleKey, NotificationCategory, NotificationPriority, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AnnouncementQuery, CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { NotificationsService } from './notifications.service';
import { displayName, memberUserSelect, systemContext } from './utils/system-context';

interface Audience {
    membership_ids?: string[];
    team_ids?: string[];
    branch_ids?: string[];
}

const EVENT_KEY = 'announcement.published';

/**
 * 14 §4, §7 — system announcements. Publishing fans out one Notification per audience member (category ANNOUNCEMENT);
 * requires_ack makes it mandatory and "waiting on you" until acknowledged. Managed with notifications.announcements.manage*.
 */
@Injectable()
export class AnnouncementsService {
    private readonly logger = new Logger(AnnouncementsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly notifications: NotificationsService,
    ) { }

    async findAll(ctx: OrgContext, query: AnnouncementQuery) {
        const where: Prisma.AnnouncementWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.announcement.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'published_at', 'title'], 'created_at'),
                include: { created_by: { select: { id: true, user: { select: memberUserSelect } } }, _count: { select: { acknowledgements: true } } },
            }),
            this.prisma.announcement.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.announcement.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                created_by: { select: { id: true, user: { select: memberUserSelect } } },
                acknowledgements: { where: { membership_id: { not: null } }, orderBy: { acknowledged_at: 'desc' }, take: 100, include: { membership: { select: { id: true, user: { select: memberUserSelect } } } } },
                _count: { select: { acknowledgements: true } },
            },
        });
        if (!row) throw new NotFoundException({ message: 'Announcement not found', code: 'announcement_not_found' });
        const audience_size = (await this.expandAudience(ctx.organization_id, row.audience as Audience | null)).length;
        return { ...row, audience_size };
    }

    /** Audience picker data (members, teams, branches of this organization) for announcement managers. */
    async audienceOptions(ctx: OrgContext) {
        const org = ctx.organization_id;
        const [members, teams, branches] = await Promise.all([
            this.prisma.membership.findMany({ where: { organization_id: org, status: 'ACTIVE' }, select: { id: true, user: { select: memberUserSelect } }, orderBy: { user: { first_name: 'asc' } }, take: 1000 }),
            this.prisma.team.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true, _count: { select: { members: { where: { ended_at: null } } } } }, orderBy: { name: 'asc' } }),
            this.prisma.branch.findMany({ where: { organization_id: org, archived_at: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        ]);
        return {
            members: members.map((m) => ({ id: m.id, name: displayName(m.user), email: m.user.email })),
            teams: teams.map((t) => ({ id: t.id, name: t.name, member_count: t._count.members })),
            branches,
        };
    }

    async create(ctx: OrgContext, dto: CreateAnnouncementDto) {
        const publishAt = dto.publish_at ? new Date(dto.publish_at) : null;
        const row = await this.prisma.announcement.create({
            data: {
                organization_id: ctx.organization_id,
                title: dto.title,
                body: dto.body,
                severity: dto.severity ?? NotificationPriority.NORMAL,
                audience: (this.cleanAudience(dto.audience) ?? Prisma.DbNull) as Prisma.InputJsonValue,
                requires_ack: dto.requires_ack ?? false,
                publish_at: publishAt,
                expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
                status: publishAt && publishAt > new Date() ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
                created_by_membership_id: ctx.membership_id,
            },
        });
        await this.audit.record(ctx, 'announcement.created', { resource_type: 'announcement', resource_id: row.id, metadata: { after: { title: dto.title, severity: row.severity, requires_ack: row.requires_ack, status: row.status } } });
        this.events.publish(ctx, { event_key: 'notifications.announcement.created', module: ModuleKey.NOTIFICATIONS, entity_kind: 'announcement', entity_id: row.id, payload: { title: row.title } });
        return row;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateAnnouncementDto) {
        const before = await this.findOne(ctx, id);
        if (before.status !== AnnouncementStatus.DRAFT && before.status !== AnnouncementStatus.SCHEDULED) {
            throw new ConflictException({ message: 'Only draft or scheduled announcements can be edited', code: 'announcement_not_editable' });
        }
        const publishAt = dto.publish_at === undefined ? before.publish_at : dto.publish_at ? new Date(dto.publish_at) : null;
        const row = await this.prisma.announcement.update({
            where: { id },
            data: {
                title: dto.title,
                body: dto.body,
                severity: dto.severity,
                requires_ack: dto.requires_ack,
                ...(dto.audience !== undefined && { audience: (this.cleanAudience(dto.audience) ?? Prisma.DbNull) as Prisma.InputJsonValue }),
                publish_at: publishAt,
                ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }),
                status: publishAt && publishAt > new Date() ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
            },
        });
        await this.audit.record(ctx, 'announcement.updated', { resource_type: 'announcement', resource_id: id, metadata: { before: { title: before.title, status: before.status }, after: dto } });
        this.events.publish(ctx, { event_key: 'notifications.announcement.updated', module: ModuleKey.NOTIFICATIONS, entity_kind: 'announcement', entity_id: id, payload: { title: row.title }, changes: dto as Record<string, unknown> });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        if (before.status !== AnnouncementStatus.DRAFT && before.status !== AnnouncementStatus.SCHEDULED) {
            throw new ConflictException({ message: 'Published announcements are withdrawn, not deleted', code: 'announcement_not_deletable' });
        }
        await this.prisma.announcement.delete({ where: { id } });
        await this.audit.record(ctx, 'announcement.deleted', { resource_type: 'announcement', resource_id: id, metadata: { title: before.title } });
        return { success: true };
    }

    async publish(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        if (before.status !== AnnouncementStatus.DRAFT && before.status !== AnnouncementStatus.SCHEDULED) {
            throw new ConflictException({ message: 'This announcement is already published', code: 'announcement_already_published' });
        }
        const row = await this.prisma.announcement.update({ where: { id }, data: { status: AnnouncementStatus.LIVE, published_at: new Date(), publish_at: before.publish_at ?? new Date() } });
        const recipients = await this.expandAudience(ctx.organization_id, row.audience as Audience | null);
        const result = await this.notifications.notify(ctx, {
            recipient_membership_ids: recipients,
            include_actor: true,
            event_key: EVENT_KEY,
            module: ModuleKey.NOTIFICATIONS,
            category: NotificationCategory.ANNOUNCEMENT,
            priority: row.severity,
            audience_reason: 'announcement',
            title: row.title,
            body: row.body.length > 280 ? `${row.body.slice(0, 277)}…` : row.body,
            is_mandatory: row.requires_ack,
            requires_action: row.requires_ack,
            actions: row.requires_ack ? [{ key: 'acknowledge', label: 'Acknowledge', style: 'primary' }] : undefined,
            data: { announcement_id: row.id, requires_ack: row.requires_ack },
            expires_at: row.expires_at,
            idempotency_key: `announcement:${row.id}`,
        });
        await this.audit.record(ctx, 'announcement.published', { resource_type: 'announcement', resource_id: id, metadata: { recipients: result.created, requires_ack: row.requires_ack } });
        this.events.publish(ctx, {
            event_key: 'notifications.announcement.published',
            module: ModuleKey.NOTIFICATIONS,
            entity_kind: 'announcement',
            entity_id: id,
            payload: { title: row.title, recipients: result.created },
            activity: { summary: `Announcement published: ${row.title}`, entity_label: row.title },
        });
        return { ...row, recipients: result.created };
    }

    async withdraw(ctx: OrgContext, id: string) {
        const before = await this.findOne(ctx, id);
        if (before.status !== AnnouncementStatus.LIVE && before.status !== AnnouncementStatus.SCHEDULED) {
            throw new ConflictException({ message: 'Only live or scheduled announcements can be withdrawn', code: 'announcement_not_live' });
        }
        const now = new Date();
        const row = await this.prisma.announcement.update({ where: { id }, data: { status: AnnouncementStatus.WITHDRAWN, withdrawn_at: now } });
        // Withdrawn announcements leave every inbox (expired rows are hidden).
        await this.prisma.notification.updateMany({ where: { organization_id: ctx.organization_id, event_key: EVENT_KEY, data: { path: ['announcement_id'], equals: id } }, data: { expires_at: now, requires_action: false } });
        await this.audit.record(ctx, 'announcement.withdrawn', { resource_type: 'announcement', resource_id: id, metadata: { title: before.title } });
        this.events.publish(ctx, { event_key: 'notifications.announcement.withdrawn', module: ModuleKey.NOTIFICATIONS, entity_kind: 'announcement', entity_id: id, payload: { title: row.title } });
        return row;
    }

    /** LIVE announcements addressed to the caller, with their own acknowledgement (any member). */
    async live(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        const rows = await this.prisma.announcement.findMany({
            where: { organization_id: ctx.organization_id, status: AnnouncementStatus.LIVE, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
            orderBy: { published_at: 'desc' },
            take: 50,
            include: { acknowledgements: { where: { membership_id: ctx.membership_id }, select: { acknowledged_at: true } } },
        });
        const mine = await this.myAudienceKeys(ctx);
        return rows
            .filter((a) => this.matches(a.audience as Audience | null, ctx.membership_id, mine))
            .map(({ acknowledgements, ...a }) => ({ ...a, acknowledged_at: acknowledgements[0]?.acknowledged_at ?? null }));
    }

    async acknowledge(ctx: OrgContext, id: string) {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Only organization members can acknowledge', code: 'ack_requires_membership' });
        const row = await this.prisma.announcement.findFirst({ where: { id, organization_id: ctx.organization_id, status: AnnouncementStatus.LIVE } });
        if (!row || !this.matches(row.audience as Audience | null, ctx.membership_id, await this.myAudienceKeys(ctx))) {
            throw new NotFoundException({ message: 'Announcement not found', code: 'announcement_not_found' });
        }
        const ack = await this.prisma.announcementAcknowledgement.upsert({
            where: { announcement_id_membership_id: { announcement_id: id, membership_id: ctx.membership_id } },
            update: {},
            create: { organization_id: ctx.organization_id, announcement_id: id, membership_id: ctx.membership_id },
        });
        const now = new Date();
        await this.prisma.notification.updateMany({
            where: { organization_id: ctx.organization_id, recipient_membership_id: ctx.membership_id, event_key: EVENT_KEY, data: { path: ['announcement_id'], equals: id } },
            data: { requires_action: false, action_taken: 'acknowledge', action_taken_at: now, read_at: now, seen_at: now },
        });
        await this.audit.record(ctx, 'announcement.acknowledged', { resource_type: 'announcement', resource_id: id });
        return ack;
    }

    /** Publishes scheduled announcements and expires old ones (runs every minute; idempotent). */
    @Interval('announcements-scheduler', 60_000)
    async processSchedule() {
        try {
            const now = new Date();
            const due = await this.prisma.announcement.findMany({ where: { status: AnnouncementStatus.SCHEDULED, publish_at: { lte: now } }, take: 20 });
            for (const a of due) {
                await this.publish(systemContext(a.organization_id, a.created_by_membership_id), a.id).catch((e) => this.logger.warn(`scheduled announcement ${a.id}: ${(e as Error).message}`));
            }
            await this.prisma.announcement.updateMany({ where: { status: AnnouncementStatus.LIVE, expires_at: { lte: now } }, data: { status: AnnouncementStatus.EXPIRED } });
        } catch (error) {
            this.logger.warn(`announcement scheduler: ${(error as Error).message}`);
        }
    }

    private cleanAudience(a: Audience | null | undefined): Audience | null {
        if (!a) return null;
        const out: Audience = {};
        if (a.membership_ids?.length) out.membership_ids = a.membership_ids;
        if (a.team_ids?.length) out.team_ids = a.team_ids;
        if (a.branch_ids?.length) out.branch_ids = a.branch_ids;
        return Object.keys(out).length ? out : null;
    }

    private async myAudienceKeys(ctx: OrgContext) {
        const [teams, branches] = await Promise.all([
            this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } }),
            this.prisma.membershipBranch.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { branch_id: true } }),
        ]);
        return { teams: new Set(teams.map((t) => t.team_id)), branches: new Set(branches.map((b) => b.branch_id)) };
    }

    private matches(audience: Audience | null, membershipId: string, mine: { teams: Set<string>; branches: Set<string> }) {
        if (!audience || (!audience.membership_ids?.length && !audience.team_ids?.length && !audience.branch_ids?.length)) return true;
        return !!(audience.membership_ids?.includes(membershipId) || audience.team_ids?.some((t) => mine.teams.has(t)) || audience.branch_ids?.some((b) => mine.branches.has(b)));
    }

    /** Audience → active membership ids of this organization (teams and branches expanded at publish time). */
    private async expandAudience(organizationId: string, audience: Audience | null) {
        const active = { organization_id: organizationId, status: 'ACTIVE' as const };
        if (!audience || (!audience.membership_ids?.length && !audience.team_ids?.length && !audience.branch_ids?.length)) {
            return (await this.prisma.membership.findMany({ where: active, select: { id: true } })).map((m) => m.id);
        }
        const rows = await this.prisma.membership.findMany({
            where: {
                ...active,
                OR: [
                    ...(audience.membership_ids?.length ? [{ id: { in: audience.membership_ids } }] : []),
                    ...(audience.team_ids?.length ? [{ teams: { some: { team_id: { in: audience.team_ids }, ended_at: null } } }] : []),
                    ...(audience.branch_ids?.length ? [{ branches: { some: { branch_id: { in: audience.branch_ids }, ended_at: null } } }] : []),
                ],
            },
            select: { id: true },
        });
        return rows.map((m) => m.id);
    }
}
