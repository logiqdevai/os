import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationDigestStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { systemContext } from '../utils/system-context';

/** Used when an organization has no settings row yet (same as the column default). */
export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 365;
const BATCH = 1000;

/**
 * 14 §9, §11 — daily purge of old notifications per organization (NotificationOrgSettings.retention_days; null = keep forever).
 * Deletes only notifications that were READ or ARCHIVED and are older than the period. Never deletes mandatory notifications
 * (security alerts, legal notices — 14 §13), unread ones or ones still waiting on an action. Deliveries go with their
 * notification (cascade); finished digests and events with no notifications left are removed too. audit_events are never touched.
 */
@Injectable()
export class NotificationRetentionService {
    private readonly logger = new Logger(NotificationRetentionService.name);
    private running = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    @Cron('30 3 * * *', { name: 'notifications-retention-daily' })
    async runDaily() {
        if (this.running) return;
        this.running = true;
        try {
            const [orgs, settings] = await Promise.all([
                this.prisma.organization.findMany({ select: { id: true } }),
                this.prisma.notificationOrgSettings.findMany({ select: { organization_id: true, retention_days: true } }),
            ]);
            const days = new Map(settings.map((s) => [s.organization_id, s.retention_days]));
            for (const org of orgs) {
                const period = days.has(org.id) ? days.get(org.id) : DEFAULT_NOTIFICATION_RETENTION_DAYS;
                if (!period) continue; // keep forever
                await this.purge(org.id, period).catch((e) => this.logger.warn(`notification retention failed for ${org.id}: ${(e as Error).message}`));
            }
        } finally {
            this.running = false;
        }
    }

    async purge(organizationId: string, retentionDays: number) {
        const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
        let notifications = 0;
        for (;;) {
            const ids = await this.prisma.notification.findMany({
                where: {
                    organization_id: organizationId,
                    is_mandatory: false,
                    created_at: { lt: cutoff },
                    last_event_at: { lt: cutoff },
                    AND: [
                        { OR: [{ read_at: { not: null } }, { archived_at: { not: null } }] },
                        { OR: [{ requires_action: false }, { action_taken: { not: null } }] },
                    ],
                },
                select: { id: true },
                take: BATCH,
            });
            if (!ids.length) break;
            const res = await this.prisma.notification.deleteMany({ where: { id: { in: ids.map((r) => r.id) } } });
            notifications += res.count;
            if (ids.length < BATCH) break;
        }
        const digests = await this.prisma.notificationDigest.deleteMany({
            where: { organization_id: organizationId, period_end: { lt: cutoff }, status: { in: [NotificationDigestStatus.SENT, NotificationDigestStatus.EMPTY, NotificationDigestStatus.FAILED] }, deliveries: { none: {} } },
        });
        const events = await this.prisma.notificationEvent.deleteMany({ where: { organization_id: organizationId, received_at: { lt: cutoff }, notifications: { none: {} } } });
        if (notifications || digests.count || events.count) {
            await this.audit.record(systemContext(organizationId), 'notification.retention_purged', {
                resource_type: 'notification', metadata: { retention_days: retentionDays, cutoff: cutoff.toISOString(), notifications, digests: digests.count, events: events.count },
            });
            this.logger.log(`purged ${notifications} notifications, ${digests.count} digests, ${events.count} events for ${organizationId}`);
        }
        return { notifications, digests: digests.count, events: events.count };
    }
}
