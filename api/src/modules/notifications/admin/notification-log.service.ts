import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, NotificationDeliveryStatus, NotificationSkipReason, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { memberUserSelect } from '../utils/system-context';
import { NotificationDeliveryService } from '../delivery/notification-delivery.service';
import { DeliveryQuery, DigestQuery, EventLogQuery } from '../dto/notification-admin.dto';

const day = (v: string | undefined, end = false) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : v) : undefined);
const range = (q: { from?: string; to?: string }) => (q.from || q.to ? { ...(q.from && { gte: day(q.from) }), ...(q.to && { lte: day(q.to, true) }) } : undefined);

/** Retrying makes sense for failures, "no provider connected" (after Resend / Twilio is connected) and push "no device" (after a browser registered). */
const RETRYABLE: NotificationDeliveryStatus[] = [NotificationDeliveryStatus.FAILED, NotificationDeliveryStatus.SKIPPED];

/**
 * 14 §9, §13 — the delivery log for support and audit (notifications.audit.read, sensitive: shows addresses and content):
 * per-channel deliveries, ingested events and digests. Opening one delivery's rendered content is itself audited.
 */
@Injectable()
export class NotificationLogService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly engine: NotificationDeliveryService,
    ) { }

    async deliveries(ctx: OrgContext, q: DeliveryQuery) {
        const created = range(q);
        const where: Prisma.NotificationDeliveryWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.status?.length && { status: { in: q.status } }),
            ...(q.channel && { channel: q.channel }),
            ...(q.skip_reason && { skip_reason: q.skip_reason }),
            ...(created && { created_at: created }),
            ...((q.event_key || q.membership_id || q.search) && {
                notification: {
                    ...(q.event_key && { event_key: q.event_key }),
                    ...(q.membership_id && { recipient_membership_id: q.membership_id }),
                    ...(q.search && { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { event_key: { contains: q.search, mode: 'insensitive' } }] }),
                },
            }),
        };
        const since = new Date(Date.now() - 86_400_000);
        const [rows, total, last24] = await Promise.all([
            this.prisma.notificationDelivery.findMany({
                where, ...skipTake(q), orderBy: { created_at: q.order_direction ?? 'desc' },
                select: {
                    id: true, channel: true, status: true, skip_reason: true, attempt_count: true, max_attempts: true, next_attempt_at: true, sent_at: true, delivered_at: true, failed_at: true,
                    failure_reason: true, destination: true, provider: true, opened_at: true, digest_id: true, comm_message_id: true, created_at: true,
                    notification: { select: { id: true, title: true, event_key: true, module: true, recipient_membership: { select: { id: true, user: { select: memberUserSelect } } } } },
                },
            }),
            this.prisma.notificationDelivery.count({ where }),
            this.prisma.notificationDelivery.groupBy({ by: ['status'], where: { organization_id: ctx.organization_id, created_at: { gte: since } }, _count: { _all: true } }),
        ]);
        const count = (s: NotificationDeliveryStatus[]) => last24.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count._all, 0);
        return {
            ...paginate(rows, total, q),
            stats: {
                total_24h: last24.reduce((n, x) => n + x._count._all, 0),
                sent_24h: count([NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED]),
                failed_24h: count([NotificationDeliveryStatus.FAILED]),
                skipped_24h: count([NotificationDeliveryStatus.SKIPPED]),
                pending_24h: count([NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED, NotificationDeliveryStatus.DIGESTED]),
            },
        };
    }

    async delivery(ctx: OrgContext, id: string) {
        const d = await this.prisma.notificationDelivery.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                notification: { select: { id: true, title: true, body: true, event_key: true, module: true, action_url: true, created_at: true, event_id: true, recipient_membership: { select: { id: true, user: { select: memberUserSelect } } } } },
                template: { select: { id: true, channel: true, locale: true, version: true, organization_id: true } },
                digest: { select: { id: true, frequency: true, status: true, scheduled_for: true, sent_at: true } },
            },
        });
        // Purged rows (retention) and other organizations' rows are 404.
        if (!d) throw new NotFoundException({ message: 'Delivery not found', code: 'delivery_not_found' });
        this.audit.recordAsync(ctx, 'notification.delivery_viewed', { resource_type: 'notification_delivery', resource_id: id, metadata: { channel: d.channel, sensitive: true } });
        return { ...d, rendered_body: d.preview_hidden ? null : d.rendered_body, can_retry: !d.digest_id && ['EMAIL', 'SMS', 'PUSH'].includes(d.channel) && RETRYABLE.includes(d.status)
            && (d.status !== NotificationDeliveryStatus.SKIPPED || d.skip_reason === NotificationSkipReason.CHANNEL_NOT_AVAILABLE || (d.channel === 'PUSH' && d.skip_reason === NotificationSkipReason.NO_DEVICE)) };
    }

    async retry(ctx: OrgContext, id: string) {
        const d = await this.prisma.notificationDelivery.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { id: true, status: true, skip_reason: true, channel: true, digest_id: true } });
        if (!d) throw new NotFoundException({ message: 'Delivery not found', code: 'delivery_not_found' });
        const ok = d.status === NotificationDeliveryStatus.FAILED || (d.status === NotificationDeliveryStatus.SKIPPED && d.skip_reason === NotificationSkipReason.CHANNEL_NOT_AVAILABLE);
        const retryable = d.status === NotificationDeliveryStatus.SKIPPED && d.skip_reason === NotificationSkipReason.NO_DEVICE && d.channel === 'PUSH';
        if (!(ok || retryable) || !['EMAIL', 'SMS', 'PUSH'].includes(d.channel) || d.digest_id) {
            throw new ConflictException({ message: 'Only failed email, SMS or push deliveries (or ones skipped because no provider or device was available) can be retried', code: 'delivery_not_retryable' });
        }
        await this.engine.retry(id);
        await this.audit.record(ctx, 'notification.delivery_retried', { resource_type: 'notification_delivery', resource_id: id, metadata: { previous_status: d.status, skip_reason: d.skip_reason } });
        this.events.publish(ctx, { event_key: 'notification.delivery.retried', module: ModuleKey.NOTIFICATIONS, entity_kind: 'notification_delivery', entity_id: id, payload: {} });
        return this.delivery(ctx, id);
    }

    async eventLog(ctx: OrgContext, q: EventLogQuery) {
        const received = range(q);
        const where: Prisma.NotificationEventWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.status && { status: q.status }),
            ...(q.event_key && { event_key: q.event_key }),
            ...(received && { received_at: received }),
            ...(q.search && { OR: [{ event_key: { contains: q.search, mode: 'insensitive' } }, { entity_label: { contains: q.search, mode: 'insensitive' } }, { idempotency_key: { contains: q.search, mode: 'insensitive' } }] }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.notificationEvent.findMany({
                where, ...skipTake(q), orderBy: { received_at: q.order_direction ?? 'desc' },
                select: { id: true, event_key: true, idempotency_key: true, entity_type: true, entity_id: true, entity_label: true, status: true, notification_count: true, error: true, received_at: true, processed_at: true, actor: { select: { id: true, user: { select: memberUserSelect } } } },
            }),
            this.prisma.notificationEvent.count({ where }),
        ]);
        return paginate(rows, total, q);
    }

    async digests(ctx: OrgContext, q: DigestQuery) {
        const scheduled = range(q);
        const where: Prisma.NotificationDigestWhereInput = {
            organization_id: ctx.organization_id,
            ...(q.status && { status: q.status }),
            ...(q.membership_id && { membership_id: q.membership_id }),
            ...(scheduled && { scheduled_for: scheduled }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.notificationDigest.findMany({
                where, ...skipTake(q), orderBy: { scheduled_for: q.order_direction ?? 'desc' },
                select: { id: true, frequency: true, channel: true, status: true, item_count: true, period_start: true, scheduled_for: true, sent_at: true, failure_reason: true, comm_message_id: true, membership: { select: { id: true, user: { select: memberUserSelect } } } },
            }),
            this.prisma.notificationDigest.count({ where }),
        ]);
        return paginate(rows, total, q);
    }
}
