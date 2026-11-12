import { Injectable } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService } from '@/shared/events/events.service';
import { systemContext } from '../utils/system-context';

const CACHE_MS = 30_000;

export type NotificationWebhookEventKey = 'notification.created' | 'notification.delivered' | 'notification.failed';

/**
 * 14 §14 — `notification.*` events on the platform bus (PlatformEvent → 20 outbound webhooks and automation triggers) when the
 * organization turned on NotificationOrgSettings.webhook_events_enabled. Payloads carry ids, keys, channel and status only —
 * never titles or bodies (they may hold private content). The fan-out ignores NOTIFICATIONS events, so nothing loops.
 * `notification.read` is published by NotificationsService.update().
 */
@Injectable()
export class NotificationWebhookEvents {
    private readonly cache = new Map<string, { at: number; on: Promise<boolean> }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
    ) { }

    invalidate(organizationId: string) {
        this.cache.delete(organizationId);
    }

    enabled(organizationId: string) {
        const hit = this.cache.get(organizationId);
        if (hit && Date.now() - hit.at < CACHE_MS) return hit.on;
        const on = this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: organizationId }, select: { webhook_events_enabled: true } }).then((r) => !!r?.webhook_events_enabled);
        this.cache.set(organizationId, { at: Date.now(), on });
        on.catch(() => this.cache.delete(organizationId));
        return on;
    }

    async emit(organizationId: string, event_key: NotificationWebhookEventKey, notificationId: string, payload: Record<string, unknown>) {
        if (!(await this.enabled(organizationId).catch(() => false))) return;
        this.events.publish(systemContext(organizationId), { event_key, module: ModuleKey.NOTIFICATIONS, entity_type: 'NOTIFICATION', entity_id: notificationId, payload: { notification_id: notificationId, ...payload } });
    }

    /** One `notification.created` per recipient of an engine event. */
    async created(organizationId: string, eventId: string) {
        if (!(await this.enabled(organizationId).catch(() => false))) return;
        const rows = await this.prisma.notification.findMany({
            where: { organization_id: organizationId, event_id: eventId },
            select: { id: true, event_key: true, module: true, category: true, priority: true, recipient_membership_id: true, entity_type: true, entity_id: true, is_mandatory: true, created_at: true },
            take: 1000,
        });
        for (const n of rows) {
            this.events.publish(systemContext(organizationId), {
                event_key: 'notification.created', module: ModuleKey.NOTIFICATIONS, entity_type: 'NOTIFICATION', entity_id: n.id,
                payload: { notification_id: n.id, event_key: n.event_key, source_module: n.module, category: n.category, priority: n.priority, recipient_membership_id: n.recipient_membership_id, entity_type: n.entity_type, entity_id: n.entity_id, mandatory: n.is_mandatory },
            });
        }
    }
}
