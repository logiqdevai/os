import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
    ModuleKey,
    NotificationCategory,
    NotificationChannel,
    NotificationEventStatus,
    NotificationLevel,
    NotificationPriority,
    NotificationRecipientType,
    Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { BulkNotificationDto, NotificationQuery, NotificationState, ReadAllNotificationsDto, UpdateNotificationDto } from './dto/notification.dto';
import { NotifyContext, NotifyInput, NotifyRecipient } from './interfaces/notify.interface';
import { humanizeEventKey, memberUserSelect } from './utils/system-context';
import { NotificationRulesService } from './delivery/notification-rules.service';
import { NotificationDeliveryService } from './delivery/notification-delivery.service';
import { NotificationWebhookEvents } from './delivery/notification-webhook-events.service';

type EventTypeRow = { id: string; key: string; mandatory_by_default: boolean; category: NotificationCategory; priority: NotificationPriority };

const IMPORTANT_CATEGORIES: NotificationCategory[] = [NotificationCategory.MENTION, NotificationCategory.DIRECT_MESSAGE, NotificationCategory.APPROVAL, NotificationCategory.SECURITY, NotificationCategory.SLA];
const DIRECT_CATEGORIES: NotificationCategory[] = [NotificationCategory.MENTION, NotificationCategory.DIRECT_MESSAGE, NotificationCategory.REPLY];

const listInclude = {
    actor: { select: { id: true, user: { select: memberUserSelect } } },
    event_type: { select: { id: true, key: true, name: true } },
} satisfies Prisma.NotificationInclude;

/**
 * 14 — the signed-in member's inbox (own rows only: recipient_membership_id = caller) and the `notify()` engine
 * every module uses to create in-app notifications (dedupe per event + recipient, preferences, mandatory events).
 */
@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly typeCache = new Map<string, Promise<EventTypeRow>>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly rules: NotificationRulesService,
        private readonly delivery: NotificationDeliveryService,
        private readonly webhooks: NotificationWebhookEvents,
    ) { }

    // ---------------------------------------------------------------- inbox (own rows only)

    /** Base filter for the caller's own inbox. Service accounts have no inbox. */
    private mine(ctx: OrgContext): Prisma.NotificationWhereInput {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Only organization members have an inbox', code: 'inbox_requires_membership' });
        return { organization_id: ctx.organization_id, recipient_membership_id: ctx.membership_id };
    }

    private stateWhere(state: NotificationState): Prisma.NotificationWhereInput {
        const now = new Date();
        const notSnoozed: Prisma.NotificationWhereInput = { OR: [{ snoozed_until: null }, { snoozed_until: { lte: now } }] };
        switch (state) {
            case 'unread':
                return { AND: [{ read_at: null, archived_at: null }, notSnoozed] };
            case 'read':
                return { read_at: { not: null }, archived_at: null };
            case 'archived':
                return { archived_at: { not: null } };
            case 'snoozed':
                return { archived_at: null, snoozed_until: { gt: now } };
            case 'action':
                return { requires_action: true, action_taken: null, archived_at: null };
            default:
                return { AND: [{ archived_at: null }, notSnoozed] };
        }
    }

    private notExpired(): Prisma.NotificationWhereInput {
        return { OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] };
    }

    async findAll(ctx: OrgContext, query: NotificationQuery) {
        const where: Prisma.NotificationWhereInput = {
            AND: [
                this.mine(ctx),
                this.stateWhere(query.state),
                this.notExpired(),
                ...(query.module ? [{ module: query.module }] : []),
                ...(query.category ? [{ category: query.category }] : []),
                ...(query.search
                    ? [{ OR: [
                        { title: { contains: query.search, mode: 'insensitive' as const } },
                        { body: { contains: query.search, mode: 'insensitive' as const } },
                        { entity_label: { contains: query.search, mode: 'insensitive' as const } },
                    ] }]
                    : []),
            ],
        };
        const [items, total] = await Promise.all([
            this.prisma.notification.findMany({ where, ...skipTake(query), orderBy: [{ last_event_at: 'desc' }, { created_at: 'desc' }], include: listInclude }),
            this.prisma.notification.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    /** Badge counts: unread (list highlight), unseen (bell badge), action (waiting on you). */
    async counts(ctx: OrgContext) {
        const base = this.mine(ctx);
        const live = this.notExpired();
        const [unread, unseen, action] = await Promise.all([
            this.prisma.notification.count({ where: { AND: [base, live, this.stateWhere('unread')] } }),
            this.prisma.notification.count({ where: { AND: [base, live, this.stateWhere('unread'), { seen_at: null }] } }),
            this.prisma.notification.count({ where: { AND: [base, live, this.stateWhere('action')] } }),
        ]);
        return { unread, unseen, action };
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.notification.findFirst({
            where: { id, ...this.mine(ctx) },
            include: { ...listInclude, event_type: { select: { id: true, key: true, name: true, description: true, available_actions: true } } },
        });
        // 404 (never 403) so other people's notifications do not leak.
        if (!row) throw new NotFoundException({ message: 'Notification not found', code: 'notification_not_found' });
        return row;
    }

    async update(ctx: OrgContext, id: string, dto: UpdateNotificationDto) {
        const before = await this.findOne(ctx, id);
        const now = new Date();
        const data: Prisma.NotificationUpdateInput = {};
        if (dto.read !== undefined) {
            data.read_at = dto.read ? before.read_at ?? now : null;
            if (dto.read) data.seen_at = before.seen_at ?? now;
        }
        if (dto.archived !== undefined) data.archived_at = dto.archived ? before.archived_at ?? now : null;
        if (dto.snoozed_until !== undefined) data.snoozed_until = dto.snoozed_until ? new Date(dto.snoozed_until) : null;
        const row = await this.prisma.notification.update({ where: { id }, data, include: listInclude });
        // Personal read/archive state is not audited, except mandatory / security notifications (14 §13).
        if (before.is_mandatory && dto.read) {
            await this.audit.record(ctx, 'notification.read', { resource_type: 'notification', resource_id: id, metadata: { event_key: before.event_key, mandatory: true } });
        }
        if (dto.read && !before.read_at) {
            this.events.publish(ctx, { event_key: 'notification.read', module: ModuleKey.NOTIFICATIONS, entity_type: 'NOTIFICATION', entity_id: id, payload: { event_key: before.event_key } });
        }
        return row;
    }

    /** Marks read + seen and returns the deep link to navigate to (14 §7 ROUTING). */
    async open(ctx: OrgContext, id: string) {
        const row = await this.update(ctx, id, { read: true });
        return { id: row.id, action_url: row.action_url };
    }

    /** Inline action from the inbox (e.g. announcement acknowledge). Owning modules handle their own actions. */
    async recordAction(ctx: OrgContext, id: string, action: string) {
        const before = await this.findOne(ctx, id);
        const row = await this.prisma.notification.update({
            where: { id },
            data: { action_taken: action, action_taken_at: new Date(), requires_action: false, read_at: before.read_at ?? new Date(), seen_at: before.seen_at ?? new Date() },
            include: listInclude,
        });
        await this.audit.record(ctx, 'notification.action_taken', { resource_type: 'notification', resource_id: id, metadata: { action, event_key: before.event_key, entity_type: before.entity_type, entity_id: before.entity_id } });
        return row;
    }

    async markSeen(ctx: OrgContext) {
        const res = await this.prisma.notification.updateMany({ where: { ...this.mine(ctx), seen_at: null }, data: { seen_at: new Date() } });
        return { updated: res.count };
    }

    async readAll(ctx: OrgContext, dto: ReadAllNotificationsDto) {
        const now = new Date();
        const res = await this.prisma.notification.updateMany({
            where: { AND: [this.mine(ctx), this.stateWhere('unread'), ...(dto.module ? [{ module: dto.module }] : [])] },
            data: { read_at: now, seen_at: now },
        });
        this.audit.recordAsync(ctx, 'notification.read_all', { resource_type: 'notification', metadata: { count: res.count, module: dto.module ?? null } });
        return { updated: res.count };
    }

    async bulk(ctx: OrgContext, dto: BulkNotificationDto) {
        const now = new Date();
        const data: Prisma.NotificationUpdateManyMutationInput =
            dto.action === 'read' ? { read_at: now, seen_at: now }
                : dto.action === 'unread' ? { read_at: null }
                    : dto.action === 'archive' ? { archived_at: now }
                        : { archived_at: null };
        const res = await this.prisma.notification.updateMany({ where: { ...this.mine(ctx), id: { in: dto.ids } }, data });
        this.audit.recordAsync(ctx, `notification.bulk_${dto.action}`, { resource_type: 'notification', metadata: { count: res.count, ids: dto.ids } });
        return { updated: res.count };
    }

    // ---------------------------------------------------------------- engine

    /** Resolve (or register on first use) the catalog entry for an event key. Organization types override platform ones. */
    async resolveEventType(organizationId: string, key: string, module: ModuleKey, category: NotificationCategory = NotificationCategory.GENERAL, priority: NotificationPriority = NotificationPriority.NORMAL): Promise<EventTypeRow> {
        const cacheKey = `${organizationId}:${key}`;
        let pending = this.typeCache.get(cacheKey);
        if (!pending) {
            pending = (async () => {
                const select = { id: true, key: true, mandatory_by_default: true, category: true, priority: true } as const;
                const existing = await this.prisma.notificationEventType.findFirst({
                    where: { key, OR: [{ organization_id: organizationId }, { organization_id: null }] },
                    orderBy: { organization_id: { sort: 'asc', nulls: 'last' } },
                    select,
                });
                if (existing) return existing;
                return this.prisma.notificationEventType.create({
                    data: { organization_id: null, key, module, name: humanizeEventKey(key), category, priority, default_channels: [NotificationChannel.IN_APP] },
                    select,
                });
            })();
            this.typeCache.set(cacheKey, pending);
            pending.catch(() => this.typeCache.delete(cacheKey));
        }
        return pending;
    }

    /** Public API for other modules: create in-app notifications for members. Never throws for bad recipients. */
    async notify(ctx: NotifyContext, input: NotifyInput) {
        const recipients: NotifyRecipient[] = [...new Set(input.recipient_membership_ids.filter(Boolean))].map((membership_id) => ({
            membership_id,
            category: input.category ?? NotificationCategory.GENERAL,
            audience_reason: input.audience_reason ?? 'recipient',
            requires_action: input.requires_action,
        }));
        return this.deliver(ctx, input, recipients);
    }

    /** Engine core shared by notify() and the event-bus fan-out. One NotificationEvent per idempotency key. */
    async deliver(ctx: NotifyContext, input: NotifyInput, recipients: NotifyRecipient[]) {
        const orgId = ctx.organization_id;
        let list = recipients.filter((r) => r.membership_id && (input.include_actor || r.membership_id !== ctx.membership_id));
        if (!list.length) return { event_id: null, created: 0 };

        // Only active members of this organization (tenant isolation even when a module passes a wrong id).
        const active = await this.prisma.membership.findMany({ where: { id: { in: list.map((r) => r.membership_id) }, organization_id: orgId, status: 'ACTIVE' }, select: { id: true } });
        const activeIds = new Set(active.map((m) => m.id));
        list = list.filter((r) => activeIds.has(r.membership_id));
        if (!list.length) return { event_id: null, created: 0 };

        const type = await this.resolveEventType(orgId, input.event_key, input.module, input.category, input.priority);
        const mandatory = !!input.is_mandatory || type.mandatory_by_default;
        const priority = input.priority ?? type.priority;
        if (!mandatory) list = await this.applyPreferences(orgId, list, type.id, input, priority);
        // Organization delivery rules (14 §9): suppress / deduplicate / throttle / coalesce. Mandatory events are never filtered.
        if (!mandatory && list.length) {
            const keep = await this.rules.applyInApp(
                { organization_id: orgId, event_type_id: type.id, event_key: input.event_key, module: input.module, entity_type: input.entity_type, entity_id: input.entity_id, actor_membership_id: ctx.membership_id },
                list.map((r) => r.membership_id),
                { title: input.title, body: input.body, link: input.link },
            );
            list = list.filter((r) => keep.has(r.membership_id));
        }
        if (!list.length) return { event_id: null, created: 0 };

        const idempotency_key = input.idempotency_key ?? randomUUID();
        let event = await this.prisma.notificationEvent.findUnique({ where: { organization_id_idempotency_key: { organization_id: orgId, idempotency_key } }, select: { id: true } });
        if (!event) {
            try {
                event = await this.prisma.notificationEvent.create({
                    data: {
                        organization_id: orgId,
                        event_type_id: type.id,
                        event_key: input.event_key,
                        idempotency_key,
                        entity_type: input.entity_type ?? null,
                        entity_id: input.entity_id ?? null,
                        entity_label: input.entity_label ?? null,
                        context_project_id: input.context_project_id ?? null,
                        context_company_id: input.context_company_id ?? null,
                        actor_membership_id: ctx.membership_id ?? null,
                        actor_user_id: ctx.user_id ?? null,
                        actor_service_account_id: ctx.service_account_id ?? null,
                        payload: (input.data ?? {}) as Prisma.InputJsonValue,
                        targets: { membership_ids: list.map((r) => r.membership_id) } as Prisma.InputJsonValue,
                        expires_at: input.expires_at ?? null,
                        platform_event_id: input.platform_event_id ?? null,
                        status: NotificationEventStatus.PROCESSING,
                    },
                    select: { id: true },
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                    event = await this.prisma.notificationEvent.findUnique({ where: { organization_id_idempotency_key: { organization_id: orgId, idempotency_key } }, select: { id: true } });
                } else throw error;
            }
        }

        const now = new Date();
        const res = await this.prisma.notification.createMany({
            skipDuplicates: true, // (event_id, recipient_membership_id) is unique: redelivered events never duplicate.
            data: list.map((r) => ({
                organization_id: orgId,
                event_id: event.id,
                event_type_id: type.id,
                event_key: input.event_key,
                module: input.module,
                category: r.category,
                priority,
                recipient_type: NotificationRecipientType.MEMBERSHIP,
                recipient_membership_id: r.membership_id,
                audience_reason: r.audience_reason,
                title: (r.title ?? input.title).slice(0, 300),
                body: input.body ? input.body.slice(0, 2000) : null,
                icon: input.icon ?? null,
                action_url: input.link ?? null,
                entity_type: input.entity_type ?? null,
                entity_id: input.entity_id ?? null,
                entity_label: input.entity_label ?? null,
                context_project_id: input.context_project_id ?? null,
                context_company_id: input.context_company_id ?? null,
                actor_membership_id: ctx.membership_id ?? null,
                actor_user_id: ctx.user_id ?? null,
                data: (input.data ?? undefined) as Prisma.InputJsonValue,
                is_mandatory: mandatory,
                requires_action: !!r.requires_action,
                actions: (input.actions ?? undefined) as unknown as Prisma.InputJsonValue,
                group_key: input.entity_id ? `${input.event_key}:${input.entity_id}` : null,
                last_event_at: now,
                expires_at: input.expires_at ?? null,
            })),
        });
        await this.prisma.notificationEvent.update({
            where: { id: event.id },
            data: { status: NotificationEventStatus.PROCESSED, processed_at: now, notification_count: { increment: res.count } },
        });
        // Other channels (email, SMS, push): preferences, quiet hours, digests and the org's own provider decide per recipient.
        if (res.count) {
            this.delivery.planAsync(orgId, event.id);
            // 14 §14 — notification.created for outbound webhooks / automation (only when the organization turned it on).
            this.webhooks.created(orgId, event.id).catch((e) => this.logger.warn(`notification.created not published: ${(e as Error).message}`));
        }
        if (mandatory && res.count) {
            this.audit.recordAsync(ctx as OrgContext, 'notification.mandatory_delivered', { resource_type: 'notification_event', resource_id: event.id, metadata: { event_key: input.event_key, count: res.count } });
        }
        return { event_id: event.id, created: res.count };
    }

    /**
     * Preference layers (14 §6) for the in-app channel: per-record mute → per-event-type → per-module → recipient
     * level / master switch. Mandatory events skip this.
     */
    private async applyPreferences(orgId: string, list: NotifyRecipient[], eventTypeId: string, input: NotifyInput, priority: NotificationPriority) {
        const ids = list.map((r) => r.membership_id);
        const now = new Date();
        const scopeKeys = [`module:${input.module}`, ...(input.entity_type && input.entity_id ? [`record:${input.entity_type}:${input.entity_id}`] : [])];
        const [settings, prefs] = await Promise.all([
            this.prisma.notificationRecipientSettings.findMany({ where: { organization_id: orgId, membership_id: { in: ids } }, select: { membership_id: true, level: true, in_app_enabled: true } }),
            this.prisma.notificationPreference.findMany({
                where: {
                    organization_id: orgId,
                    membership_id: { in: ids },
                    OR: [{ event_type_id: eventTypeId }, { scope_key: { in: scopeKeys } }],
                    AND: [{ OR: [{ channel: null }, { channel: NotificationChannel.IN_APP }] }],
                },
                select: { membership_id: true, event_type_id: true, scope_key: true, enabled: true, muted_until: true, level: true },
            }),
        ]);
        const settingsBy = new Map(settings.map((s) => [s.membership_id, s]));
        return list.filter((r) => {
            const s = settingsBy.get(r.membership_id);
            const mine = prefs.filter((p) => p.membership_id === r.membership_id);
            const muted = (p: (typeof prefs)[number]) => !p.enabled && (!p.muted_until || p.muted_until > now);
            const record = mine.find((p) => p.scope_key.startsWith('record:'));
            if (record && muted(record)) return false;
            const evt = mine.find((p) => p.event_type_id === eventTypeId);
            if (evt) return evt.enabled || !muted(evt);
            const mod = mine.find((p) => p.scope_key.startsWith('module:'));
            if (mod && muted(mod)) return false;
            if (s && !s.in_app_enabled) return false;
            const level = mod?.level ?? s?.level ?? NotificationLevel.ALL;
            if (level === NotificationLevel.NONE) return false;
            if (level === NotificationLevel.IMPORTANT_ONLY) return priority === NotificationPriority.IMPORTANT || priority === NotificationPriority.CRITICAL || IMPORTANT_CATEGORIES.includes(r.category);
            if (level === NotificationLevel.MENTIONS_AND_DIRECT) return DIRECT_CATEGORIES.includes(r.category);
            return true;
        });
    }
}
