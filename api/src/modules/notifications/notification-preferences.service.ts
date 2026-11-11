import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ModuleKey, NotificationCategory, NotificationChannel, NotificationPriority, NotificationRecipientType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SetEventPreferenceDto, SetSubscriptionDto, UpdateRecipientSettingsDto } from './dto/notification-preference.dto';

/** Platform event types this area emits itself (others register on first use by their module). */
const PLATFORM_EVENT_TYPES: { key: string; module: ModuleKey; name: string; category: NotificationCategory; priority?: NotificationPriority; description: string }[] = [
    { key: 'announcement.published', module: ModuleKey.NOTIFICATIONS, name: 'Announcement', category: NotificationCategory.ANNOUNCEMENT, priority: NotificationPriority.IMPORTANT, description: 'An organization announcement was published.' },
    { key: 'calendar.event_created', module: ModuleKey.CALENDAR, name: 'Event invitation', category: NotificationCategory.INVITATION, description: 'You were invited to a calendar event.' },
    { key: 'calendar.event_updated', module: ModuleKey.CALENDAR, name: 'Event updated', category: NotificationCategory.STATUS_CHANGE, description: 'An event you attend was rescheduled or changed.' },
    { key: 'calendar.event_cancelled', module: ModuleKey.CALENDAR, name: 'Event cancelled', category: NotificationCategory.STATUS_CHANGE, description: 'An event you attend was cancelled.' },
    { key: 'calendar.event_reminder', module: ModuleKey.CALENDAR, name: 'Event reminder', category: NotificationCategory.REMINDER, description: 'Reminder before an event starts.' },
    { key: 'calendar.attendee_responded', module: ModuleKey.CALENDAR, name: 'RSVP received', category: NotificationCategory.GENERAL, description: 'An attendee answered your invitation.' },
    { key: 'calendar.booking_created', module: ModuleKey.CALENDAR, name: 'New booking', category: NotificationCategory.GENERAL, priority: NotificationPriority.IMPORTANT, description: 'Someone booked time with you through a booking link.' },
    { key: 'calendar.booking_cancelled', module: ModuleKey.CALENDAR, name: 'Booking cancelled', category: NotificationCategory.STATUS_CHANGE, description: 'A booking with you was cancelled.' },
];

/** 14 §6 — the caller's own notification preferences (settings, per event type, follow / mute). */
@Injectable()
export class NotificationPreferencesService implements OnModuleInit {
    private readonly logger = new Logger(NotificationPreferencesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    onModuleInit() {
        setImmediate(() => this.ensurePlatformTypes().catch((e) => this.logger.warn(`event catalog not registered: ${(e as Error).message}`)));
    }

    private async ensurePlatformTypes() {
        const existing = await this.prisma.notificationEventType.findMany({ where: { organization_id: null, key: { in: PLATFORM_EVENT_TYPES.map((t) => t.key) } }, select: { key: true } });
        const have = new Set(existing.map((e) => e.key));
        for (const t of PLATFORM_EVENT_TYPES.filter((x) => !have.has(x.key))) {
            await this.prisma.notificationEventType.create({ data: { ...t, organization_id: null, default_channels: [NotificationChannel.IN_APP] } });
        }
    }

    private me(ctx: OrgContext) {
        if (!ctx.membership_id) throw new ForbiddenException({ message: 'Only organization members have notification preferences', code: 'preferences_require_membership' });
        return ctx.membership_id;
    }

    async getSettings(ctx: OrgContext) {
        const membership_id = this.me(ctx);
        const [row, org] = await Promise.all([
            this.prisma.notificationRecipientSettings.findUnique({ where: { membership_id } }),
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id } }),
        ]);
        const enabled_channels = org?.enabled_channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
        if (row) return { ...row, organization: { enabled_channels } };
        // Defaults (no row yet) — same values as the column defaults.
        return {
            id: null, organization_id: ctx.organization_id, membership_id, recipient_type: NotificationRecipientType.MEMBERSHIP,
            level: org?.default_level ?? 'ALL', in_app_enabled: true, email_enabled: true, sms_enabled: false, push_enabled: true, desktop_enabled: true,
            sound_enabled: true, dnd_enabled: false, dnd_start_time: null, dnd_end_time: null, dnd_weekdays: [], dnd_until: null, timezone: null,
            dnd_allow_critical: true, digest_frequency: org?.default_digest_frequency ?? 'IMMEDIATE', digest_channel: 'EMAIL', digest_hour: null, digest_weekday: null,
            show_previews: !(org?.hide_previews_by_default ?? false), thread_notifications: true, reaction_notifications: true, keyword_notifications: true, language: null,
            organization: { enabled_channels },
        };
    }

    async updateSettings(ctx: OrgContext, dto: UpdateRecipientSettingsDto) {
        const membership_id = this.me(ctx);
        const data = { ...dto, dnd_until: dto.dnd_until === undefined ? undefined : dto.dnd_until ? new Date(dto.dnd_until) : null };
        await this.prisma.notificationRecipientSettings.upsert({
            where: { membership_id },
            update: data,
            create: { ...data, organization_id: ctx.organization_id, membership_id, recipient_type: NotificationRecipientType.MEMBERSHIP },
        });
        await this.audit.record(ctx, 'notification.preferences_updated', { resource_type: 'notification_recipient_settings', resource_id: membership_id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'notification.preferences.updated', module: ModuleKey.NOTIFICATIONS, entity_kind: 'notification_recipient_settings', entity_id: membership_id, changes: dto as Record<string, unknown> });
        return this.getSettings(ctx);
    }

    /** Event types with the EFFECTIVE value per channel and where it comes from (own / organization / platform), locked when mandatory. */
    async listEventPreferences(ctx: OrgContext) {
        const membership_id = this.me(ctx);
        const [types, prefs, defaults, org] = await Promise.all([
            this.prisma.notificationEventType.findMany({
                where: { is_active: true, deprecated_at: null, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
                orderBy: [{ module: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
                select: { id: true, key: true, name: true, description: true, module: true, category: true, priority: true, default_channels: true, mandatory_by_default: true, forced_channels: true },
            }),
            this.prisma.notificationPreference.findMany({ where: { organization_id: ctx.organization_id, membership_id, event_type_id: { not: null } } }),
            this.prisma.notificationOrgDefault.findMany({ where: { organization_id: ctx.organization_id } }),
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id } }),
        ]);
        const channels = (org?.enabled_channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL]).filter((c) => c === NotificationChannel.IN_APP || c === NotificationChannel.EMAIL);
        const enabledModules = new Set(ctx.effective.modules);
        return types
            .filter((t) => !enabledModules.size || enabledModules.has(t.module))
            .map((t) => {
                const eventDefault = defaults.find((d) => d.event_type_id === t.id);
                const moduleDefault = defaults.find((d) => d.module === t.module && !d.event_type_id);
                const mandatory = t.mandatory_by_default || !!eventDefault?.is_mandatory || !!moduleDefault?.is_mandatory;
                return {
                    event_type: { id: t.id, key: t.key, name: t.name, description: t.description, module: t.module, category: t.category, priority: t.priority },
                    mandatory,
                    channels: channels.map((channel) => {
                        const own = prefs.find((p) => p.event_type_id === t.id && p.channel === channel);
                        const orgDefault = eventDefault ?? moduleDefault;
                        const forced = mandatory && (t.forced_channels.includes(channel) || channel === NotificationChannel.IN_APP);
                        if (forced) return { channel, enabled: true, source: 'organization' as const, locked: true };
                        if (own) return { channel, enabled: own.enabled, source: 'own' as const, locked: false };
                        if (orgDefault) return { channel, enabled: orgDefault.enabled && orgDefault.channels.includes(channel), source: 'organization' as const, locked: false };
                        return { channel, enabled: t.default_channels.includes(channel), source: 'platform' as const, locked: false };
                    }),
                };
            });
    }

    async setEventPreference(ctx: OrgContext, eventTypeId: string, dto: SetEventPreferenceDto) {
        const membership_id = this.me(ctx);
        const type = await this.prisma.notificationEventType.findFirst({ where: { id: eventTypeId, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] } });
        if (!type) throw new NotFoundException({ message: 'Event type not found', code: 'event_type_not_found' });
        const list = await this.listEventPreferences(ctx);
        const row = list.find((r) => r.event_type.id === eventTypeId);
        if (row?.channels.find((c) => c.channel === dto.channel)?.locked) {
            throw new ConflictException({ message: 'This notification is mandatory in your organization and cannot be turned off', code: 'notification_mandatory' });
        }
        const recipient_key = `m:${membership_id}`;
        const scope_key = `event:${type.key}`;
        const pref = await this.prisma.notificationPreference.upsert({
            where: { organization_id_recipient_key_scope_key_channel: { organization_id: ctx.organization_id, recipient_key, scope_key, channel: dto.channel } },
            update: { enabled: dto.enabled, delivery_mode: dto.delivery_mode },
            create: {
                organization_id: ctx.organization_id, recipient_type: NotificationRecipientType.MEMBERSHIP, membership_id, recipient_key,
                event_type_id: type.id, scope_key, channel: dto.channel, enabled: dto.enabled, delivery_mode: dto.delivery_mode,
            },
        });
        await this.audit.record(ctx, 'notification.preference_set', { resource_type: 'notification_preference', resource_id: pref.id, metadata: { event_key: type.key, channel: dto.channel, enabled: dto.enabled } });
        return pref;
    }

    async resetEventPreference(ctx: OrgContext, eventTypeId: string) {
        const membership_id = this.me(ctx);
        const res = await this.prisma.notificationPreference.deleteMany({ where: { organization_id: ctx.organization_id, membership_id, event_type_id: eventTypeId } });
        await this.audit.record(ctx, 'notification.preference_reset', { resource_type: 'notification_event_type', resource_id: eventTypeId, metadata: { removed: res.count } });
        return { removed: res.count };
    }

    async listSubscriptions(ctx: OrgContext, state?: 'following' | 'muted') {
        const membership_id = this.me(ctx);
        return this.prisma.notificationPreference.findMany({
            where: {
                organization_id: ctx.organization_id, membership_id, entity_id: { not: null },
                ...(state === 'following' ? { is_following: true } : state === 'muted' ? { enabled: false } : {}),
            },
            orderBy: { updated_at: 'desc' },
        });
    }

    async setSubscription(ctx: OrgContext, dto: SetSubscriptionDto) {
        const membership_id = this.me(ctx);
        const recipient_key = `m:${membership_id}`;
        const scope_key = `record:${dto.entity_type}:${dto.entity_id}`;
        const data: Prisma.NotificationPreferenceUncheckedCreateInput = {
            organization_id: ctx.organization_id, recipient_type: NotificationRecipientType.MEMBERSHIP, membership_id, recipient_key,
            entity_type: dto.entity_type, entity_id: dto.entity_id, entity_label: dto.entity_label ?? null, scope_key, channel: null,
            enabled: dto.state === 'follow', is_following: dto.state === 'follow', muted_until: dto.state === 'mute' && dto.muted_until ? new Date(dto.muted_until) : null,
        };
        // channel = null rows cannot use the compound unique (NULLs are distinct), so find + update.
        const existing = await this.prisma.notificationPreference.findFirst({ where: { organization_id: ctx.organization_id, recipient_key, scope_key, channel: null } });
        const row = existing
            ? await this.prisma.notificationPreference.update({ where: { id: existing.id }, data: { enabled: data.enabled, is_following: data.is_following, muted_until: data.muted_until, entity_label: data.entity_label ?? existing.entity_label } })
            : await this.prisma.notificationPreference.create({ data });
        await this.audit.record(ctx, `notification.record_${dto.state}`, { resource_type: 'notification_preference', resource_id: row.id, metadata: { entity_type: dto.entity_type, entity_id: dto.entity_id } });
        return row;
    }

    async removeSubscription(ctx: OrgContext, id: string) {
        const membership_id = this.me(ctx);
        const res = await this.prisma.notificationPreference.deleteMany({ where: { id, organization_id: ctx.organization_id, membership_id, entity_id: { not: null } } });
        if (!res.count) throw new NotFoundException({ message: 'Subscription not found', code: 'subscription_not_found' });
        await this.audit.record(ctx, 'notification.record_unsubscribed', { resource_type: 'notification_preference', resource_id: id });
        return { success: true };
    }
}
