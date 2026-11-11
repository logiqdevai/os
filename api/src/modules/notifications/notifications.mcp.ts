import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ActivityService } from './activity.service';
import { AnnouncementsService } from './announcements.service';
import { NotificationQuerySchema, ReadAllNotificationsSchema, UpdateNotificationSchema } from './dto/notification.dto';
import { UpdateRecipientSettingsSchema } from './dto/notification-preference.dto';
import { ActivityQuerySchema } from './dto/activity-query.schema';
import { CreateAnnouncementSchema } from './dto/announcement.dto';

/**
 * MCP adapter for 14. Own-inbox tools act as the caller (own rows only) and are listed to holders of
 * notifications.preferences.manage_own — the key every member role carries for self-service notifications.
 */
@Injectable()
export class NotificationsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly notifications: NotificationsService,
        private readonly prefs: NotificationPreferencesService,
        private readonly activity: ActivityService,
        private readonly announcements: AnnouncementsService,
    ) { }

    onModuleInit() {
        const OWN = 'notifications.preferences.manage_own';
        this.registry.registerMany([
            {
                name: 'notifications_notifications_list',
                description: 'List my notifications (state: unread | read | all | archived | snoozed | action; filter by module or category; search).',
                permission: OWN,
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'notification',
                input: NotificationQuerySchema,
                handler: (ctx, args) => this.notifications.findAll(ctx, args),
            },
            {
                name: 'notifications_notifications_counts',
                description: 'My unread, unseen and waiting-on-me notification counts.',
                permission: OWN,
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'notification',
                input: z.object({}),
                handler: (ctx) => this.notifications.counts(ctx),
            },
            {
                name: 'notifications_notifications_mark_read',
                description: 'Mark one of my notifications read/unread, archive it or snooze it.',
                permission: OWN,
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'notification',
                input: UpdateNotificationSchema,
                handler: (ctx, { id, ...dto }) => this.notifications.update(ctx, id, dto),
            },
            {
                name: 'notifications_notifications_read_all',
                description: 'Mark all my unread notifications read (optionally one module).',
                permission: OWN,
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'notification',
                input: ReadAllNotificationsSchema,
                handler: (ctx, args) => this.notifications.readAll(ctx, args),
            },
            {
                name: 'notifications_preferences_manage_own',
                description: 'Update my notification settings (level, channels, quiet hours, digest).',
                permission: OWN,
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'notification_recipient_settings',
                input: UpdateRecipientSettingsSchema,
                handler: (ctx, args) => this.prefs.updateSettings(ctx, args),
            },
            {
                name: 'notifications_activity_read',
                description: 'Read the activity feed (organization, project or customer scope; filter by module, actor, record, dates).',
                permission: 'notifications.activity.read',
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'activity_event',
                input: ActivityQuerySchema,
                handler: (ctx, args) => this.activity.findAll(ctx, args),
            },
            {
                name: 'notifications_announcements_create',
                description: 'Create a draft (or scheduled) announcement for members.',
                permission: 'notifications.announcements.manage',
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'announcement',
                sensitive: true,
                input: CreateAnnouncementSchema,
                handler: (ctx, args) => this.announcements.create(ctx, args),
            },
            {
                name: 'notifications_announcements_publish',
                description: 'Publish an announcement now (notifies its whole audience).',
                permission: 'notifications.announcements.manage',
                module: ModuleKey.NOTIFICATIONS,
                resource_type: 'announcement',
                sensitive: true,
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.announcements.publish(ctx, args.id),
            },
        ]);
    }
}
