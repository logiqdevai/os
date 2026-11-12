import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import {
    CommChannel, CommMessageKind, CommMessageSource, CommMessageStatus, IntegrationCategory, IntegrationProvider, IntegrationStatus, NotificationChannel, NotificationDeliveryMode,
    NotificationDeliveryStatus, NotificationDigestFrequency, NotificationDigestStatus, NotificationPriority, NotificationRecipientType, NotificationSkipReason, Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CommDispatchService } from '@/modules/communications/delivery/comm-dispatch.service';
import { displayName } from '../utils/system-context';
import { emailLayout, nextDigestAt, quietHoursEnd, renderVars, zoneOr } from '../utils/delivery.utils';
import { WebPushSender } from '../push/web-push.sender';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationWebhookEvents } from './notification-webhook-events.service';

const NO_PROVIDER: Partial<Record<NotificationChannel, string>> = {
    EMAIL: 'No email provider connected. Connect Resend in Admin → Integrations.',
    SMS: 'No SMS provider connected. Connect Twilio in Admin → Integrations.',
};
const TICK_BATCH = 100;
const DIGEST_BATCH = 25;
/** Channels delivered outside the app. IN_APP is the Notification row itself; DESKTOP has no provider yet. */
const EXTERNAL: NotificationChannel[] = [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH];
const COMM_CHANNELS: NotificationChannel[] = [NotificationChannel.EMAIL, NotificationChannel.SMS];
const SMS_MAX = 480;

const recipientUserSelect = { id: true, email: true, phone: true, display_name: true, first_name: true, last_name: true, timezone: true, language: true } as const;

type DeliveryWithContext = Prisma.NotificationDeliveryGetPayload<{
    include: {
        notification: {
            include: {
                recipient_membership: { select: { id: true; user: { select: typeof recipientUserSelect } } };
                actor: { select: { user: { select: { display_name: true; first_name: true; last_name: true; email: true } } } };
                organization: { select: { display_name: true; default_timezone: true } };
            };
        };
    };
}>;

/**
 * 14 §5, §6, §8, §9 — channel delivery beyond in-app: EMAIL and SMS through 11 Communication (CommMessage kind NOTIFICATION,
 * the organization's own Resend / Twilio connection — never provider keys from .env), PUSH through Web Push to the recipient's
 * browsers (platform VAPID keys). Every selected channel gets a NotificationDelivery row:
 *  - skipped (with skip_reason) when the organization or recipient turned it off, there is no address / phone / device,
 *    a delivery rule applies, or no provider is connected (CHANNEL_NOT_AVAILABLE);
 *  - EMAIL / SMS held (PENDING + next_attempt_at, skip_reason QUIET_HOURS) during the recipient's Do Not Disturb; PUSH is
 *    SKIPPED with QUIET_HOURS instead (a late lock-screen ping is noise — the inbox row stays);
 *  - EMAIL DIGESTED into a NotificationDigest when the recipient (or the organization default) batches it;
 *  - mandatory events use their forced channels regardless of preferences; mandatory / CRITICAL ones pass quiet hours
 *    unless the recipient turned dnd_allow_critical off.
 * Selection: SMS is opt-in (master switch sms_enabled, off by default, plus the event's default or the recipient's per-event
 * switch); PUSH mirrors the inbox (on unless switched off per event / by an organization default / by push_enabled) once the
 * organization enabled the channel and the user registered a browser. Background ticks send due deliveries, sync statuses
 * from 11 and send digests. Status changes emit notification.delivered / notification.failed (14 §14).
 */
@Injectable()
export class NotificationDeliveryService {
    private readonly logger = new Logger(NotificationDeliveryService.name);
    private ticking = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly dispatch: CommDispatchService,
        private readonly rules: NotificationRulesService,
        private readonly push: WebPushSender,
        private readonly webhooks: NotificationWebhookEvents,
    ) { }

    private appUrl(path: string | null | undefined) {
        const base = (this.config.get<string>('APP_URL') || 'http://localhost:5173').replace(/\/+$/, '');
        if (!path) return `${base}/notifications`;
        return /^https?:\/\//.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    private providerAvailable(organizationId: string, category: IntegrationCategory, provider: IntegrationProvider) {
        return this.prisma.integrationConnection
            .count({ where: { organization_id: organizationId, category, provider, status: IntegrationStatus.ACTIVE, disconnected_at: null } })
            .then((n) => n > 0);
    }

    /** Whether the organization has an active Resend connection (BYOK). Never returns secrets. */
    emailAvailable(organizationId: string) {
        return this.providerAvailable(organizationId, IntegrationCategory.EMAIL, IntegrationProvider.RESEND);
    }

    /** Whether the organization has an active Twilio connection (BYOK). Never returns secrets. */
    smsAvailable(organizationId: string) {
        return this.providerAvailable(organizationId, IntegrationCategory.SMS, IntegrationProvider.TWILIO);
    }

    private channelAvailable(organizationId: string, channel: NotificationChannel) {
        if (channel === NotificationChannel.EMAIL) return this.emailAvailable(organizationId);
        if (channel === NotificationChannel.SMS) return this.smsAvailable(organizationId);
        return Promise.resolve(true);
    }

    // ------------------------------------------------------------------ planning (called after in-app notifications exist)

    /** Fire-and-forget entry point used by NotificationsService.deliver(). */
    planAsync(organizationId: string, eventId: string) {
        setImmediate(() => this.plan(organizationId, eventId).catch((e) => this.logger.warn(`delivery planning failed for event ${eventId}: ${(e as Error).message}`)));
    }

    async plan(organizationId: string, eventId: string) {
        const notifications = await this.prisma.notification.findMany({
            where: { organization_id: organizationId, event_id: eventId, recipient_membership_id: { not: null } },
            select: {
                id: true, event_type_id: true, event_key: true, module: true, priority: true, is_mandatory: true, recipient_membership_id: true, entity_type: true, entity_id: true, actor_membership_id: true, expires_at: true,
                deliveries: { select: { channel: true } },
                recipient_membership: { select: { user: { select: { id: true, email: true, phone: true, timezone: true } } } },
            },
        });
        if (!notifications.length) return;
        const typeId = notifications[0].event_type_id;
        const memberIds = notifications.map((n) => n.recipient_membership_id as string);
        const userIds = [...new Set(notifications.map((n) => n.recipient_membership?.user?.id).filter((x): x is string => !!x))];
        const [type, org, orgSettings, defaults, settings, prefs, devices] = await Promise.all([
            this.prisma.notificationEventType.findUnique({ where: { id: typeId }, select: { id: true, module: true, default_channels: true, forced_channels: true, supports_digest: true } }),
            this.prisma.organization.findUnique({ where: { id: organizationId }, select: { default_timezone: true } }),
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: organizationId } }),
            this.prisma.notificationOrgDefault.findMany({ where: { organization_id: organizationId, OR: [{ event_type_id: typeId }, { module: notifications[0].module, event_type_id: null }] } }),
            this.prisma.notificationRecipientSettings.findMany({ where: { organization_id: organizationId, membership_id: { in: memberIds } } }),
            this.prisma.notificationPreference.findMany({ where: { organization_id: organizationId, membership_id: { in: memberIds }, event_type_id: typeId, channel: { in: EXTERNAL } } }),
            this.prisma.notificationPushDevice.groupBy({ by: ['user_id'], where: { user_id: { in: userIds }, platform: 'WEB', disabled_at: null }, _count: { _all: true } }),
        ]);
        if (!type) return;
        const orgDefault = defaults.find((d) => d.event_type_id === typeId) ?? defaults.find((d) => !d.event_type_id) ?? null;
        const orgChannels = orgSettings?.enabled_channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
        const deviceCount = new Map(devices.map((d) => [d.user_id, d._count._all]));
        const now = new Date();

        for (const n of notifications) {
            const mid = n.recipient_membership_id as string;
            const s = settings.find((x) => x.membership_id === mid) ?? null;
            const user = n.recipient_membership?.user ?? null;
            for (const channel of EXTERNAL) {
                if (n.deliveries.some((d) => d.channel === channel)) continue;
                const own = prefs.find((p) => p.membership_id === mid && p.channel === channel) ?? null;
                const forced = n.is_mandatory && type.forced_channels.includes(channel);
                const orgOn = orgChannels.includes(channel);
                // Layers (14 §6): own choice → organization default (event, then module) → platform default of the event type.
                let selected: boolean;
                if (channel === NotificationChannel.PUSH) {
                    selected = forced || (own ? own.enabled : orgDefault ? orgDefault.enabled : true);
                    // Push only records a row when it could reach someone (no row per notification for orgs / people without push).
                    if (!forced && (!orgOn || (s && !s.push_enabled) || !user || !deviceCount.get(user.id))) selected = false;
                } else {
                    selected = forced || (own ? own.enabled : orgDefault ? orgDefault.enabled && orgDefault.channels.includes(channel) : type.default_channels.includes(channel));
                }
                if (!selected) continue;

                const destination = channel === NotificationChannel.EMAIL ? user?.email ?? null
                    : channel === NotificationChannel.SMS ? user?.phone ?? null
                        : user && deviceCount.get(user.id) ? `${deviceCount.get(user.id)} browser${deviceCount.get(user.id) === 1 ? '' : 's'}` : null;
                const row = await this.prisma.notificationDelivery.create({
                    data: { organization_id: organizationId, notification_id: n.id, channel, status: NotificationDeliveryStatus.PENDING, destination, max_attempts: orgSettings?.max_delivery_attempts ?? 5, expires_at: n.expires_at },
                }).catch((e) => {
                    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null; // planned concurrently
                    throw e;
                });
                if (!row) continue;
                const skip = (reason: NotificationSkipReason, detail: string | null = null) =>
                    this.prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: reason, failure_reason: detail } });

                const label = channel === NotificationChannel.EMAIL ? 'Email' : channel === NotificationChannel.SMS ? 'SMS' : 'Push';
                const masterOn = !s ? channel !== NotificationChannel.SMS : channel === NotificationChannel.EMAIL ? s.email_enabled : channel === NotificationChannel.SMS ? s.sms_enabled : s.push_enabled;
                if (!forced && !orgOn) { await skip(NotificationSkipReason.CHANNEL_DISABLED, `${label} is turned off for the organization`); continue; }
                if (!forced && !masterOn) { await skip(NotificationSkipReason.PREFERENCE_OFF, `The recipient turned ${label === 'SMS' ? 'SMS' : label.toLowerCase()} off`); continue; }
                if (!destination) {
                    if (channel === NotificationChannel.PUSH) await skip(NotificationSkipReason.NO_DEVICE, 'No browser registered for push');
                    else await skip(NotificationSkipReason.NO_ADDRESS, channel === NotificationChannel.SMS ? 'No phone number on the recipient profile' : null);
                    continue;
                }
                if (!n.is_mandatory) {
                    const ruled = await this.rules.externalSkip({ organization_id: organizationId, event_type_id: n.event_type_id, event_key: n.event_key, module: n.module, entity_type: n.entity_type, entity_id: n.entity_id, actor_membership_id: n.actor_membership_id }, channel, mid);
                    if (ruled) { await skip(ruled.reason, ruled.detail); continue; }
                }

                const tz = zoneOr(s?.timezone, n.recipient_membership?.user?.timezone, org?.default_timezone);
                const urgent = n.is_mandatory || n.priority === NotificationPriority.CRITICAL;
                if (channel === NotificationChannel.EMAIL) {
                    const frequency = own?.delivery_mode === NotificationDeliveryMode.DIGEST
                        ? (s?.digest_frequency && s.digest_frequency !== NotificationDigestFrequency.IMMEDIATE ? s.digest_frequency : orgDefault?.digest_frequency ?? NotificationDigestFrequency.DAILY)
                        : s?.digest_frequency && s.digest_frequency !== NotificationDigestFrequency.IMMEDIATE ? s.digest_frequency
                            : !s && orgDefault?.delivery_mode === NotificationDeliveryMode.DIGEST ? orgDefault.digest_frequency
                                : !s && orgSettings?.default_digest_frequency && orgSettings.default_digest_frequency !== NotificationDigestFrequency.IMMEDIATE ? orgSettings.default_digest_frequency
                                    : null;
                    if (frequency && frequency !== NotificationDigestFrequency.IMMEDIATE && type.supports_digest && !urgent && own?.delivery_mode !== NotificationDeliveryMode.IMMEDIATE) {
                        const digest = await this.openDigest(organizationId, mid, frequency, tz, s?.digest_hour ?? orgSettings?.default_digest_hour ?? 8, s?.digest_weekday ?? orgSettings?.default_digest_weekday ?? 1);
                        await this.prisma.$transaction([
                            this.prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: NotificationDeliveryStatus.DIGESTED, digest_id: digest.id, next_attempt_at: digest.scheduled_for } }),
                            this.prisma.notificationDigest.update({ where: { id: digest.id }, data: { item_count: { increment: 1 } } }),
                        ]);
                        continue;
                    }
                }
                const quietUntil = urgent && (s?.dnd_allow_critical ?? true) ? null : quietHoursEnd(s, tz, now);
                if (quietUntil) {
                    if (channel === NotificationChannel.PUSH) await skip(NotificationSkipReason.QUIET_HOURS, 'Quiet hours: shown in the inbox only');
                    else await this.prisma.notificationDelivery.update({ where: { id: row.id }, data: { skip_reason: NotificationSkipReason.QUIET_HOURS, next_attempt_at: quietUntil } });
                    continue;
                }
                await this.send(row.id);
            }
        }
    }

    private async openDigest(organizationId: string, membershipId: string, frequency: NotificationDigestFrequency, tz: string, hour: number, weekday: number) {
        const now = new Date();
        const existing = await this.prisma.notificationDigest.findFirst({
            where: { organization_id: organizationId, membership_id: membershipId, frequency, channel: NotificationChannel.EMAIL, status: NotificationDigestStatus.OPEN, module: null, entity_id: null, scheduled_for: { gt: now } },
            orderBy: { scheduled_for: 'asc' },
        });
        if (existing) return existing;
        const at = nextDigestAt(frequency, tz, hour, weekday, now);
        return this.prisma.notificationDigest.create({
            data: { organization_id: organizationId, recipient_type: NotificationRecipientType.MEMBERSHIP, membership_id: membershipId, frequency, channel: NotificationChannel.EMAIL, period_start: now, period_end: at, scheduled_for: at },
        });
    }

    // ------------------------------------------------------------------ sending one delivery

    /** Claims a due PENDING email / SMS / push delivery and sends it. Never throws. */
    async send(deliveryId: string) {
        const now = new Date();
        const claimed = await this.prisma.notificationDelivery.updateMany({
            where: { id: deliveryId, channel: { in: EXTERNAL }, status: NotificationDeliveryStatus.PENDING, comm_message_id: null, OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: now } }] },
            data: { status: NotificationDeliveryStatus.QUEUED, skip_reason: null, attempt_count: { increment: 1 }, last_attempted_at: now },
        });
        if (!claimed.count) return;
        const d = await this.load(deliveryId);
        if (!d) return;
        try {
            if (d.expires_at && d.expires_at < now) {
                await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: NotificationDeliveryStatus.EXPIRED, skip_reason: NotificationSkipReason.EXPIRED } });
                return;
            }
            if (d.channel === NotificationChannel.PUSH) await this.sendPush(d);
            else await this.sendComm(d);
        } catch (error) {
            this.logger.warn(`notification delivery ${deliveryId} failed: ${(error as Error).message}`);
            await this.markFailed(d, (error as Error).message);
        }
    }

    private async markFailed(d: { id: string; organization_id: string; notification_id: string; channel: NotificationChannel }, reason: string) {
        const updated = await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: NotificationDeliveryStatus.FAILED, failed_at: new Date(), failure_reason: reason.slice(0, 1000), next_attempt_at: null } }).catch(() => null);
        if (updated) void this.webhooks.emit(d.organization_id, 'notification.failed', d.notification_id, { delivery_id: d.id, channel: d.channel, reason: reason.slice(0, 300) });
    }

    /** EMAIL / SMS: hand the rendered message to 11 (CommMessage kind NOTIFICATION) with the organization's own provider. */
    private async sendComm(d: DeliveryWithContext) {
        const channel = d.channel;
        if (!(await this.channelAvailable(d.organization_id, channel))) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.CHANNEL_NOT_AVAILABLE, failure_reason: NO_PROVIDER[channel] ?? null } });
            return;
        }
        const user = d.notification.recipient_membership?.user;
        const to = (channel === NotificationChannel.EMAIL ? user?.email : user?.phone) ?? d.destination;
        if (!to) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.NO_ADDRESS } });
            return;
        }
        const rendered = await this.render(d);
        const orgSettings = await this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: d.organization_id }, select: { email_sender_identity_id: true, sms_sender_identity_id: true } });
        const isSms = channel === NotificationChannel.SMS;
        const message = await this.prisma.commMessage.create({
            data: {
                organization_id: d.organization_id, channel: isSms ? CommChannel.SMS : CommChannel.EMAIL, kind: CommMessageKind.NOTIFICATION, source: CommMessageSource.NOTIFICATION, status: CommMessageStatus.QUEUED,
                subject: isSms ? null : rendered.subject, body_html: isSms ? null : rendered.html, body_text: isSms ? rendered.sms : rendered.text,
                sender_identity_id: (isSms ? orgSettings?.sms_sender_identity_id : orgSettings?.email_sender_identity_id) ?? null,
                recipient_kind: 'MEMBERSHIP', to_address: to, to_name: rendered.toName, recipient_membership_id: d.notification.recipient_membership_id,
                notification_id: d.notification_id, notification_delivery_id: d.id, source_entity_type: d.notification.entity_type, source_entity_id: d.notification.entity_id,
                tracking_enabled: false, queued_at: new Date(), recipients: { create: { role: 'TO', kind: 'MEMBERSHIP', address: to, name: rendered.toName, membership_id: d.notification.recipient_membership_id } },
            },
        });
        await this.prisma.notificationDelivery.update({
            where: { id: d.id },
            data: {
                comm_message_id: message.id, template_id: rendered.templateId, locale: rendered.locale, rendered_subject: isSms ? null : rendered.subject,
                rendered_body: rendered.previewHidden ? null : isSms ? rendered.sms : rendered.text, preview_hidden: rendered.previewHidden, destination: to, provider: isSms ? 'twilio' : 'resend',
            },
        });
        await this.dispatch.dispatch(message.id);
        await this.syncFromMessage(d.id);
    }

    /** PUSH: Web Push to every active browser of the recipient; expired subscriptions are removed by the sender. */
    private async sendPush(d: DeliveryWithContext) {
        const userId = d.notification.recipient_membership?.user?.id;
        const devices = userId ? (await this.push.activeDevices(userId)).filter((x) => !!x.subscription) : [];
        if (!devices.length) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.NO_DEVICE, failure_reason: 'No browser registered for push' } });
            return;
        }
        const rendered = await this.render(d);
        const n = d.notification;
        const payload = {
            title: rendered.previewHidden ? `New notification · ${n.organization.display_name}` : rendered.pushTitle,
            body: rendered.previewHidden ? null : rendered.pushBody,
            url: n.action_url ?? `/notifications/${n.id}`,
            tag: n.id,
            organization_id: d.organization_id,
            require_interaction: n.is_mandatory || n.priority === NotificationPriority.CRITICAL,
        };
        const ttl = n.expires_at ? Math.max(60, Math.floor((n.expires_at.getTime() - Date.now()) / 1000)) : 24 * 3600;
        const results = [];
        for (const device of devices) results.push(await this.push.sendToDevice(device, payload, ttl));
        const ok = results.find((r) => r.ok);
        const common = { provider: 'web-push', template_id: rendered.templateId, locale: rendered.locale, rendered_subject: payload.title, rendered_body: payload.body, preview_hidden: rendered.previewHidden, provider_response: results as unknown as Prisma.InputJsonValue };
        if (ok) {
            const sentAt = new Date();
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { ...common, status: NotificationDeliveryStatus.SENT, sent_at: sentAt, push_device_id: ok.device_id, destination: `${results.filter((r) => r.ok).length} of ${results.length} browser${results.length === 1 ? '' : 's'}`, failure_reason: null, next_attempt_at: null } });
            void this.webhooks.emit(d.organization_id, 'notification.delivered', d.notification_id, { delivery_id: d.id, channel: d.channel, sent_at: sentAt.toISOString() });
            return;
        }
        if (results.every((r) => r.removed)) {
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { ...common, status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.NO_DEVICE, failure_reason: 'Every browser subscription had expired and was removed' } });
            return;
        }
        const reason = results.map((r) => r.error).filter(Boolean).join('; ') || 'Push failed';
        if (d.attempt_count < d.max_attempts) {
            const settings = await this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: d.organization_id }, select: { retry_backoff_seconds: true } });
            const delay = (settings?.retry_backoff_seconds ?? 60) * 2 ** Math.max(0, d.attempt_count - 1) * 1000;
            await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { ...common, status: NotificationDeliveryStatus.PENDING, failure_reason: reason.slice(0, 1000), next_attempt_at: new Date(Date.now() + delay) } });
            return;
        }
        await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: common });
        await this.markFailed(d, reason);
    }

    private load(id: string): Promise<DeliveryWithContext | null> {
        return this.prisma.notificationDelivery.findUnique({
            where: { id },
            include: {
                notification: {
                    include: {
                        recipient_membership: { select: { id: true, user: { select: recipientUserSelect } } },
                        actor: { select: { user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
                        organization: { select: { display_name: true, default_timezone: true } },
                    },
                },
            },
        });
    }

    /** Template of the delivery's channel: organization override → platform default (recipient language → any) → built-in layout. */
    private async render(d: DeliveryWithContext) {
        const n = d.notification;
        const user = n.recipient_membership?.user;
        const lang = user?.language?.slice(0, 2) ?? null;
        const [templates, settings, orgSettings] = await Promise.all([
            this.prisma.notificationTemplate.findMany({ where: { event_type_id: n.event_type_id, channel: d.channel, is_active: true, OR: [{ organization_id: d.organization_id }, { organization_id: null }] } }),
            n.recipient_membership_id ? this.prisma.notificationRecipientSettings.findUnique({ where: { membership_id: n.recipient_membership_id }, select: { show_previews: true } }) : null,
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: d.organization_id }, select: { hide_previews_by_default: true } }),
        ]);
        const rank = (t: { organization_id: string | null; locale: string | null }) => (t.organization_id ? 0 : 2) + (t.locale && t.locale === lang ? 0 : t.locale ? 9 : 1);
        const template = templates.filter((t) => !t.locale || t.locale === lang).sort((a, b) => rank(a) - rank(b))[0] ?? null;
        const previewHidden = settings ? !settings.show_previews : !!orgSettings?.hide_previews_by_default;
        const url = this.appUrl(n.action_url ?? `/notifications/${n.id}`);
        const ctx: Record<string, unknown> = {
            ...((n.data as Record<string, unknown> | null) ?? {}),
            title: n.title, body: n.body ?? '', entity_label: n.entity_label ?? '', url, link: url, organization: { name: n.organization.display_name },
            actor: { name: n.actor ? displayName(n.actor.user) : 'Someone' }, recipient: { name: displayName(user) },
        };
        const subject = (template?.subject ? renderVars(template.subject, ctx) : n.title).slice(0, 250) || n.title;
        const heading = template ? renderVars(template.title, ctx) : n.title;
        const bodyText = previewHidden ? 'You have a new notification. Open it to see the details.' : template ? renderVars(template.body, ctx) : n.body ?? '';
        const cta = { label: template?.cta_label ? renderVars(template.cta_label, ctx) : 'Open', url: template?.cta_url ? renderVars(template.cta_url, ctx) || url : url };
        const html = !previewHidden && template?.html_body
            ? renderVars(template.html_body, ctx, true)
            : emailLayout({ orgName: n.organization.display_name, heading: previewHidden ? 'New notification' : heading, paragraphs: [bodyText], cta, footer: 'You get this email because of your notification settings. Change them in Notifications → Preferences.' });
        // SMS: plain text with the link; previews hidden → no content at all.
        const smsCore = previewHidden ? `New notification from ${n.organization.display_name}.` : `${n.organization.display_name}: ${heading}${bodyText ? ` — ${bodyText}` : ''}`;
        const smsLink = ` ${cta.url}`;
        const sms = (smsCore.length + smsLink.length > SMS_MAX ? `${smsCore.slice(0, SMS_MAX - smsLink.length - 1)}…` : smsCore) + smsLink;
        return {
            subject: previewHidden ? `New notification from ${n.organization.display_name}` : subject,
            html,
            text: `${previewHidden ? 'New notification' : heading}\n\n${bodyText}\n\n${cta.label}: ${cta.url}`,
            sms,
            pushTitle: heading.slice(0, 120),
            pushBody: (template ? bodyText : n.body ?? '').slice(0, 240) || null,
            toName: user ? displayName(user) : null,
            templateId: template?.id ?? null,
            locale: template?.locale ?? lang,
            previewHidden,
        };
    }

    /** Copy the 11 message state onto the delivery; status transitions emit notification.delivered / notification.failed. */
    async syncFromMessage(deliveryId: string) {
        const d = await this.prisma.notificationDelivery.findUnique({ where: { id: deliveryId }, select: { id: true, organization_id: true, notification_id: true, channel: true, comm_message_id: true, status: true } });
        if (!d?.comm_message_id) return;
        const m = await this.prisma.commMessage.findUnique({
            where: { id: d.comm_message_id },
            select: { status: true, sent_at: true, delivered_at: true, failed_at: true, first_opened_at: true, first_clicked_at: true, failure_reason: true, last_error: true, next_attempt_at: true, provider_message_id: true, cancelled_at: true },
        });
        if (!m) return;
        const data: Prisma.NotificationDeliveryUpdateInput = { provider_message_id: m.provider_message_id, opened_at: m.first_opened_at, clicked_at: m.first_clicked_at };
        let next: NotificationDeliveryStatus;
        switch (m.status) {
            case CommMessageStatus.SENT:
                next = NotificationDeliveryStatus.SENT;
                Object.assign(data, { status: next, sent_at: m.sent_at, next_attempt_at: null, failure_reason: null });
                break;
            case CommMessageStatus.DELIVERED:
                next = NotificationDeliveryStatus.DELIVERED;
                Object.assign(data, { status: next, sent_at: m.sent_at, delivered_at: m.delivered_at ?? m.sent_at, next_attempt_at: null });
                break;
            case CommMessageStatus.FAILED:
            case CommMessageStatus.BOUNCED:
                next = NotificationDeliveryStatus.FAILED;
                Object.assign(data, { status: next, failed_at: m.failed_at ?? new Date(), failure_reason: (m.failure_reason ?? m.last_error ?? 'Send failed').slice(0, 1000), next_attempt_at: null });
                break;
            case CommMessageStatus.CANCELLED:
                next = NotificationDeliveryStatus.SKIPPED;
                Object.assign(data, { status: next, skip_reason: NotificationSkipReason.NO_ADDRESS, failure_reason: m.failure_reason ?? `Blocked by an ${d.channel === NotificationChannel.SMS ? 'SMS' : 'email'} suppression`, next_attempt_at: null });
                break;
            default:
                next = NotificationDeliveryStatus.QUEUED;
                Object.assign(data, { status: next, next_attempt_at: m.next_attempt_at, failure_reason: m.last_error });
        }
        await this.prisma.notificationDelivery.update({ where: { id: d.id }, data });
        const delivered: NotificationDeliveryStatus[] = [NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED];
        if (delivered.includes(next) && !delivered.includes(d.status)) {
            void this.webhooks.emit(d.organization_id, 'notification.delivered', d.notification_id, { delivery_id: d.id, channel: d.channel, status: next });
        } else if (next === NotificationDeliveryStatus.FAILED && d.status !== NotificationDeliveryStatus.FAILED) {
            void this.webhooks.emit(d.organization_id, 'notification.failed', d.notification_id, { delivery_id: d.id, channel: d.channel, reason: (m.failure_reason ?? m.last_error ?? 'Send failed').slice(0, 300) });
        }
    }

    // ------------------------------------------------------------------ admin retry

    /** Put a FAILED / unavailable delivery back in the queue (email / SMS: a new 11 message is created). */
    async retry(deliveryId: string) {
        await this.prisma.notificationDelivery.update({
            where: { id: deliveryId },
            data: { status: NotificationDeliveryStatus.PENDING, skip_reason: null, failure_reason: null, failed_at: null, comm_message_id: null, push_device_id: null, next_attempt_at: null, attempt_count: 0 },
        });
        await this.send(deliveryId);
    }

    // ------------------------------------------------------------------ background work

    @Interval(30_000)
    async tick() {
        if (this.ticking) return;
        this.ticking = true;
        try {
            const now = new Date();
            const due = await this.prisma.notificationDelivery.findMany({
                where: { channel: { in: EXTERNAL }, status: NotificationDeliveryStatus.PENDING, comm_message_id: null, OR: [{ next_attempt_at: null, created_at: { lt: new Date(now.getTime() - 60_000) } }, { next_attempt_at: { lte: now } }] },
                select: { id: true }, orderBy: { created_at: 'asc' }, take: TICK_BATCH,
            });
            for (const d of due) await this.send(d.id);
            const inFlight = await this.prisma.notificationDelivery.findMany({ where: { channel: { in: COMM_CHANNELS }, status: NotificationDeliveryStatus.QUEUED, comm_message_id: { not: null } }, select: { id: true }, take: TICK_BATCH * 2 });
            for (const d of inFlight) await this.syncFromMessage(d.id);
            const digests = await this.prisma.notificationDigest.findMany({ where: { status: NotificationDigestStatus.OPEN, scheduled_for: { lte: now } }, select: { id: true }, orderBy: { scheduled_for: 'asc' }, take: DIGEST_BATCH });
            for (const g of digests) await this.sendDigest(g.id);
        } catch (error) {
            this.logger.warn(`delivery tick failed: ${(error as Error).message}`);
        } finally {
            this.ticking = false;
        }
    }

    /** 14 §8 — one email with every notification held for the period (EMPTY when nothing is left unread). */
    async sendDigest(digestId: string) {
        const claimed = await this.prisma.notificationDigest.updateMany({ where: { id: digestId, status: NotificationDigestStatus.OPEN }, data: { status: NotificationDigestStatus.SENDING, attempt_count: { increment: 1 } } });
        if (!claimed.count) return;
        const g = await this.prisma.notificationDigest.findUnique({
            where: { id: digestId },
            include: {
                membership: { select: { id: true, user: { select: { email: true, display_name: true, first_name: true, last_name: true, timezone: true } } } },
                organization: { select: { display_name: true, default_timezone: true } },
                deliveries: { include: { notification: { select: { id: true, title: true, body: true, action_url: true, created_at: true, read_at: true, archived_at: true } } }, orderBy: { created_at: 'asc' } },
            },
        });
        if (!g) return;
        const items = g.deliveries.filter((d) => !d.notification.archived_at);
        const finish = (data: Prisma.NotificationDigestUpdateInput) => this.prisma.notificationDigest.update({ where: { id: g.id }, data });
        try {
            if (!items.length) {
                await finish({ status: NotificationDigestStatus.EMPTY, item_count: 0 });
                return;
            }
            const to = g.membership?.user?.email;
            if (!to) {
                await finish({ status: NotificationDigestStatus.FAILED, failed_at: new Date(), failure_reason: 'The recipient has no email address' });
                await this.prisma.notificationDelivery.updateMany({ where: { digest_id: g.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.NO_ADDRESS } });
                return;
            }
            if (!(await this.emailAvailable(g.organization_id))) {
                await finish({ status: NotificationDigestStatus.FAILED, failed_at: new Date(), failure_reason: NO_PROVIDER.EMAIL });
                await this.prisma.notificationDelivery.updateMany({ where: { digest_id: g.id }, data: { status: NotificationDeliveryStatus.SKIPPED, skip_reason: NotificationSkipReason.CHANNEL_NOT_AVAILABLE, failure_reason: NO_PROVIDER.EMAIL } });
                return;
            }
            const tz = zoneOr(g.membership?.user?.timezone, g.organization.default_timezone);
            const fmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
            const label = g.frequency === NotificationDigestFrequency.WEEKLY ? 'weekly' : g.frequency === NotificationDigestFrequency.HOURLY ? 'hourly' : 'daily';
            const subject = `Your ${label} summary: ${items.length} notification${items.length === 1 ? '' : 's'}`;
            const html = emailLayout({
                orgName: g.organization.display_name, heading: subject, paragraphs: [`Here is what happened since ${fmt(g.period_start)}.`],
                items: items.slice(0, 50).map((d) => ({ title: d.notification.title, body: d.notification.body, url: this.appUrl(d.notification.action_url ?? `/notifications/${d.notification.id}`), when: fmt(d.notification.created_at) })),
                cta: { label: 'Open notifications', url: this.appUrl('/notifications') },
                footer: 'You get summaries instead of single emails because of your notification settings (Notifications → Preferences).',
            });
            const text = `${subject}\n\n${items.slice(0, 50).map((d) => `- ${d.notification.title}`).join('\n')}\n\n${this.appUrl('/notifications')}`;
            const orgSettings = await this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: g.organization_id }, select: { email_sender_identity_id: true } });
            const message = await this.prisma.commMessage.create({
                data: {
                    organization_id: g.organization_id, channel: CommChannel.EMAIL, kind: CommMessageKind.NOTIFICATION, source: CommMessageSource.NOTIFICATION, status: CommMessageStatus.QUEUED,
                    subject, body_html: html, body_text: text, sender_identity_id: orgSettings?.email_sender_identity_id ?? null, recipient_kind: 'MEMBERSHIP', to_address: to,
                    to_name: displayName(g.membership?.user), recipient_membership_id: g.membership_id, tracking_enabled: false, queued_at: new Date(),
                    recipients: { create: { role: 'TO', kind: 'MEMBERSHIP', address: to, name: displayName(g.membership?.user), membership_id: g.membership_id } },
                },
            });
            const status = await this.dispatch.dispatch(message.id);
            const sent = await this.prisma.commMessage.findUnique({ where: { id: message.id }, select: { provider_message_id: true, last_error: true, sent_at: true } });
            if (status === CommMessageStatus.SENT) {
                await finish({ status: NotificationDigestStatus.SENT, sent_at: sent?.sent_at ?? new Date(), comm_message_id: message.id, provider_message_id: sent?.provider_message_id ?? null, item_count: items.length, rendered_subject: subject, rendered_body: text });
                await this.prisma.notificationDelivery.updateMany({ where: { digest_id: g.id }, data: { sent_at: sent?.sent_at ?? new Date(), comm_message_id: message.id, provider: 'resend' } });
            } else if (status === CommMessageStatus.QUEUED) {
                // 11 retries the message with backoff; the digest is considered handed over.
                await finish({ status: NotificationDigestStatus.SENT, comm_message_id: message.id, item_count: items.length, rendered_subject: subject, failure_reason: sent?.last_error ?? null });
            } else {
                await finish({ status: NotificationDigestStatus.FAILED, failed_at: new Date(), comm_message_id: message.id, failure_reason: (sent?.last_error ?? 'Send failed').slice(0, 1000) });
            }
        } catch (error) {
            this.logger.warn(`digest ${digestId} failed: ${(error as Error).message}`);
            await finish({ status: NotificationDigestStatus.FAILED, failed_at: new Date(), failure_reason: (error as Error).message.slice(0, 1000) }).catch(() => undefined);
        }
    }
}
