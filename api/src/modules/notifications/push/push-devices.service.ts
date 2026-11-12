import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, NotificationPushPlatform, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MyDigestQuery, RegisterPushDeviceInput } from '../dto/notification-device.dto';
import { WebPushKeysService } from './web-push-keys.service';
import { WebPushSender } from './web-push.sender';

/** Never return tokens or subscription keys (write-only, mockup 14 "Devices"). */
const deviceSelect = {
    id: true, platform: true, provider: true, device_name: true, app_version: true, locale: true, last_seen_at: true, failure_count: true, disabled_at: true, created_at: true,
} satisfies Prisma.NotificationPushDeviceSelect;

/** "Chrome on Windows" from a user agent (labels only; nothing is fingerprinted). */
export function deviceLabel(ua: string | null | undefined) {
    if (!ua) return 'Browser';
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
    return os ? `${browser} on ${os}` : browser;
}

/**
 * 14 §5 — the caller's own push devices (user-level, not tenant data: a device belongs to the User; membership_id only records
 * where it was registered) and own digest history. Service accounts and API keys without a user have no devices.
 */
@Injectable()
export class PushDevicesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly keys: WebPushKeysService,
        private readonly sender: WebPushSender,
    ) { }

    private user(ctx: OrgContext) {
        if (!ctx.user_id || !ctx.membership_id) throw new ForbiddenException({ message: 'Only signed-in members have push devices', code: 'devices_require_user' });
        return ctx.user_id;
    }

    /** VAPID public key for `pushManager.subscribe({ applicationServerKey })`. */
    async config(ctx: OrgContext) {
        this.user(ctx);
        const org = await this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { enabled_channels: true } });
        return { public_key: await this.keys.publicKey(), organization_enabled: (org?.enabled_channels ?? []).includes('PUSH') };
    }

    async list(ctx: OrgContext) {
        const user_id = this.user(ctx);
        return this.prisma.notificationPushDevice.findMany({ where: { user_id }, select: deviceSelect, orderBy: [{ disabled_at: { sort: 'asc', nulls: 'first' } }, { last_seen_at: { sort: 'desc', nulls: 'last' } }] });
    }

    /** Idempotent: the same browser endpoint updates its row (and moves to the caller if another user had it on a shared browser). */
    async register(ctx: OrgContext, dto: RegisterPushDeviceInput, userAgent?: string | null) {
        const user_id = this.user(ctx);
        const token = dto.subscription.endpoint;
        const data = {
            user_id, membership_id: ctx.membership_id, provider: 'web-push', subscription: dto.subscription as unknown as Prisma.InputJsonValue,
            device_name: dto.device_name || deviceLabel(userAgent), app_version: dto.app_version ?? null, locale: dto.locale ?? null, last_seen_at: new Date(), failure_count: 0, disabled_at: null,
        };
        const existing = await this.prisma.notificationPushDevice.findUnique({ where: { platform_token: { platform: NotificationPushPlatform.WEB, token } }, select: { id: true, user_id: true } });
        const row = existing
            ? await this.prisma.notificationPushDevice.update({ where: { id: existing.id }, data, select: deviceSelect })
            : await this.prisma.notificationPushDevice.create({ data: { ...data, platform: NotificationPushPlatform.WEB, token }, select: deviceSelect });
        if (!existing || existing.user_id !== user_id) {
            await this.audit.record(ctx, 'notification.device_registered', { resource_type: 'notification_push_device', resource_id: row.id, metadata: { platform: row.platform, device_name: row.device_name } });
            this.events.publish(ctx, { event_key: 'notification.device.registered', module: ModuleKey.NOTIFICATIONS, entity_kind: 'notification_push_device', entity_id: row.id, payload: { platform: row.platform } });
        }
        return row;
    }

    private async own(ctx: OrgContext, id: string) {
        const user_id = this.user(ctx);
        const row = await this.prisma.notificationPushDevice.findFirst({ where: { id, user_id }, select: { ...deviceSelect, token: true, subscription: true } });
        // 404 for anyone else's device.
        if (!row) throw new NotFoundException({ message: 'Device not found', code: 'device_not_found' });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        const row = await this.own(ctx, id);
        await this.prisma.notificationPushDevice.delete({ where: { id } });
        await this.audit.record(ctx, 'notification.device_removed', { resource_type: 'notification_push_device', resource_id: id, metadata: { platform: row.platform, device_name: row.device_name } });
        this.events.publish(ctx, { event_key: 'notification.device.removed', module: ModuleKey.NOTIFICATIONS, entity_kind: 'notification_push_device', entity_id: id, payload: { platform: row.platform } });
        return { success: true };
    }

    /** "Send test notification": one push to this device, result returned (re-enables a disabled device when it works). */
    async test(ctx: OrgContext, id: string) {
        const row = await this.own(ctx, id);
        if (row.platform !== NotificationPushPlatform.WEB) return { ok: false, error: 'Only browser devices can receive pushes today' };
        const res = await this.sender.sendToDevice(row, { title: 'Test notification', body: 'Push notifications work on this device.', url: '/notifications/preferences/devices', tag: `test-${id}`, organization_id: ctx.organization_id });
        if (res.ok && row.disabled_at) await this.prisma.notificationPushDevice.update({ where: { id }, data: { disabled_at: null, failure_count: 0 } });
        this.audit.recordAsync(ctx, 'notification.device_tested', { resource_type: 'notification_push_device', resource_id: id, metadata: { ok: res.ok, status_code: res.status_code } });
        return { ok: res.ok, removed: res.removed, error: res.error };
    }

    /** Own digest history (14 §8): what was batched for me and when it went out. */
    async digests(ctx: OrgContext, q: MyDigestQuery) {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Only organization members have digests', code: 'digests_require_membership' });
        const where: Prisma.NotificationDigestWhereInput = { organization_id: ctx.organization_id, membership_id: ctx.membership_id, ...(q.status && { status: q.status }) };
        const [rows, total] = await Promise.all([
            this.prisma.notificationDigest.findMany({
                where, ...skipTake(q), orderBy: { scheduled_for: 'desc' },
                select: { id: true, frequency: true, channel: true, module: true, status: true, item_count: true, period_start: true, period_end: true, scheduled_for: true, sent_at: true, failure_reason: true },
            }),
            this.prisma.notificationDigest.count({ where }),
        ]);
        return paginate(rows, total, q);
    }
}
