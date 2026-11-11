import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleKey, NotificationCategory, NotificationPriority } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { NotificationsService } from './notifications.service';
import { NotifyRecipient } from './interfaces/notify.interface';
import { displayName, memberUserSelect } from './utils/system-context';

/**
 * Event-bus fan-out (14 §2): turns module events into in-app notifications. PAYLOAD CONTRACT (documented in PROGRESS.md):
 *   assignee_membership_id | assignee_membership_ids   → ASSIGNMENT  ("X assigned <label> to you")
 *   owner_membership_id                                → ASSIGNMENT  (send only when ownership is newly given)
 *   mentioned_membership_ids                           → MENTION
 *   approver_membership_ids                            → APPROVAL    (requires_action: shows in "Waiting on you")
 *   attendee_membership_ids                            → INVITATION
 *   watcher_membership_ids                             → STATUS_CHANGE
 *   recipient_membership_ids                           → notification_category ?? GENERAL
 * Optional: link (in-app path), notification_title, notification_body, notification_priority, entity_label, project_id, company_id.
 * One notification per person per event: the strongest reason wins (order above, mention first). The actor is never notified.
 */
const RULES: { field: string[]; category: NotificationCategory; reason: string; requires_action?: boolean }[] = [
    { field: ['mentioned_membership_ids'], category: NotificationCategory.MENTION, reason: 'mention' },
    { field: ['approver_membership_ids'], category: NotificationCategory.APPROVAL, reason: 'approver', requires_action: true },
    { field: ['assignee_membership_ids', 'assignee_membership_id'], category: NotificationCategory.ASSIGNMENT, reason: 'assignee' },
    { field: ['owner_membership_id'], category: NotificationCategory.ASSIGNMENT, reason: 'owner' },
    { field: ['attendee_membership_ids'], category: NotificationCategory.INVITATION, reason: 'attendee' },
    { field: ['watcher_membership_ids'], category: NotificationCategory.STATUS_CHANGE, reason: 'watcher' },
    { field: ['recipient_membership_ids'], category: NotificationCategory.GENERAL, reason: 'recipient' },
];

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : typeof v === 'string' && v ? [v] : []);

@Injectable()
export class NotificationsFanout implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotificationsFanout.name);
    private readonly listener = (event: PublishedEvent) => {
        this.handle(event).catch((error) => this.logger.warn(`fan-out of ${event.event_key} failed: ${(error as Error).message}`));
    };

    constructor(
        private readonly events: EventsService,
        private readonly notifications: NotificationsService,
        private readonly prisma: PrismaService,
    ) { }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    private async handle(event: PublishedEvent) {
        // Notifications' own events (read receipts, announcements) fan out explicitly, never through the bus.
        if (event.module === ModuleKey.NOTIFICATIONS) return;
        const p = (event.payload ?? {}) as Record<string, unknown>;

        const picked = new Map<string, NotifyRecipient>();
        for (const rule of RULES) {
            const category = rule.reason === 'recipient' && str(p.notification_category) && (NotificationCategory as Record<string, string>)[p.notification_category as string]
                ? (p.notification_category as NotificationCategory)
                : rule.category;
            for (const id of rule.field.flatMap((f) => ids(p[f]))) {
                if (!picked.has(id)) picked.set(id, { membership_id: id, category, audience_reason: rule.reason, requires_action: rule.requires_action });
            }
        }
        if (event.actor_membership_id) picked.delete(event.actor_membership_id);
        if (!picked.size) return;

        const label = str(event.activity?.entity_label) ?? str(p.entity_label) ?? str(p.name) ?? str(p.title);
        const actor = event.actor_membership_id
            ? await this.prisma.membership.findUnique({ where: { id: event.actor_membership_id }, select: { user: { select: memberUserSelect } } })
            : null;
        const who = actor ? displayName(actor.user) : 'Someone';
        const override = str(p.notification_title);
        const summary = str(event.activity?.summary);
        const recipients = [...picked.values()].map((r) => ({ ...r, title: override ?? this.defaultTitle(r.category, who, label) ?? summary ?? undefined }));
        const fallbackTitle = override ?? summary ?? (label ? `${label} was updated` : 'You have a new notification');
        const priority = str(p.notification_priority) && (NotificationPriority as Record<string, string>)[p.notification_priority as string] ? (p.notification_priority as NotificationPriority) : undefined;

        const ctx = { organization_id: event.organization_id, membership_id: event.actor_membership_id, user_id: null };
        await this.notifications.deliver(
            ctx,
            {
                recipient_membership_ids: [],
                event_key: event.event_key,
                module: event.module,
                title: fallbackTitle,
                body: str(p.notification_body) ?? (override && summary && override !== summary ? summary : null),
                link: str(p.link) ?? str(p.action_url),
                priority,
                entity_type: event.entity_type ?? null,
                entity_id: event.entity_id ?? null,
                entity_label: label,
                context_project_id: str(event.activity?.project_id) ?? str(p.project_id),
                context_company_id: str(event.activity?.company_id) ?? str(p.company_id),
                idempotency_key: `platform:${event.id}`,
                platform_event_id: event.id,
                data: { platform_event_id: event.id },
            },
            recipients,
        );
        await this.prisma.platformEvent.update({ where: { id: event.id }, data: { notifications_processed_at: new Date() } }).catch(() => undefined);
    }

    private defaultTitle(category: NotificationCategory, who: string, label: string | null) {
        const thing = label ?? 'an item';
        switch (category) {
            case NotificationCategory.MENTION:
                return `${who} mentioned you in ${thing}`;
            case NotificationCategory.APPROVAL:
                return `${who} requested your approval: ${thing}`;
            case NotificationCategory.ASSIGNMENT:
                return `${who} assigned ${thing} to you`;
            case NotificationCategory.INVITATION:
                return `${who} invited you to ${thing}`;
            default:
                return null;
        }
    }
}
