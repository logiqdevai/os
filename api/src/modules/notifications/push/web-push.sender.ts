import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import { NotificationPushPlatform } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { WebPushKeysService } from './web-push-keys.service';

/** What the service worker (app/public/sw.js) receives. Keep it small: push services cap payloads at ~4 KB. */
export interface PushPayload {
    title: string;
    body: string | null;
    /** In-app path or absolute URL opened on click. */
    url: string;
    /** Notification id: the browser replaces an older notification with the same tag. */
    tag: string;
    organization_id?: string;
    icon?: string | null;
    require_interaction?: boolean;
    silent?: boolean;
}

export interface DeviceResult {
    device_id: string;
    ok: boolean;
    status_code: number | null;
    error: string | null;
    removed: boolean;
}

/** A device is disabled ("Needs re-registration") after this many consecutive failures. */
const MAX_FAILURES = 5;

/**
 * 14 §5 — Web Push protocol sender (RFC 8030 + VAPID, payload encrypted per RFC 8291 by `web-push`).
 * Subscriptions the push service reports as gone (404 / 410) are deleted; other failures count up and disable the device.
 */
@Injectable()
export class WebPushSender {
    private readonly logger = new Logger(WebPushSender.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly keys: WebPushKeysService,
    ) { }

    /** Active browser devices of a user. */
    activeDevices(userId: string) {
        return this.prisma.notificationPushDevice.findMany({
            where: { user_id: userId, platform: NotificationPushPlatform.WEB, disabled_at: null },
            select: { id: true, token: true, subscription: true, device_name: true },
            orderBy: { last_seen_at: { sort: 'desc', nulls: 'last' } },
            take: 10,
        });
    }

    async sendToDevice(device: { id: string; token: string; subscription: unknown }, payload: PushPayload, ttlSeconds = 24 * 3600): Promise<DeviceResult> {
        const sub = device.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
        if (!sub?.keys?.p256dh || !sub.keys.auth) {
            await this.prisma.notificationPushDevice.update({ where: { id: device.id }, data: { disabled_at: new Date() } }).catch(() => undefined);
            return { device_id: device.id, ok: false, status_code: null, error: 'Subscription keys missing', removed: false };
        }
        const vapid = await this.keys.keys();
        try {
            const res = await webPush.sendNotification(
                { endpoint: sub.endpoint ?? device.token, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                JSON.stringify(payload),
                { TTL: ttlSeconds, urgency: payload.require_interaction ? 'high' : 'normal', topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined, vapidDetails: { subject: vapid.subject, publicKey: vapid.public_key, privateKey: vapid.private_key } },
            );
            await this.prisma.notificationPushDevice.update({ where: { id: device.id }, data: { failure_count: 0, last_seen_at: new Date() } }).catch(() => undefined);
            return { device_id: device.id, ok: true, status_code: res.statusCode, error: null, removed: false };
        } catch (e) {
            const err = e as { statusCode?: number; body?: string; message?: string };
            const code = err.statusCode ?? null;
            if (code === 404 || code === 410) {
                // Expired or unsubscribed in the browser: the subscription will never work again.
                await this.prisma.notificationPushDevice.delete({ where: { id: device.id } }).catch(() => undefined);
                return { device_id: device.id, ok: false, status_code: code, error: 'Subscription expired; device removed', removed: true };
            }
            const updated = await this.prisma.notificationPushDevice.update({ where: { id: device.id }, data: { failure_count: { increment: 1 } }, select: { failure_count: true } }).catch(() => null);
            if (updated && updated.failure_count >= MAX_FAILURES) {
                await this.prisma.notificationPushDevice.update({ where: { id: device.id }, data: { disabled_at: new Date() } }).catch(() => undefined);
            }
            const error = `${code ?? 'network'}: ${(err.body || err.message || 'push failed').slice(0, 300)}`;
            this.logger.warn(`web push to device ${device.id} failed (${error})`);
            return { device_id: device.id, ok: false, status_code: code, error, removed: false };
        }
    }
}
