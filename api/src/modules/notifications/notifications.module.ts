import { Module } from '@nestjs/common';
import { ActivityController, AnnouncementsController, NotificationPreferencesController, NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ActivityService } from './activity.service';
import { AnnouncementsService } from './announcements.service';
import { InboxActionsService } from './inbox-actions.service';
import { NotificationsFanout } from './notifications.fanout';
import { NotificationsMcp } from './notifications.mcp';
import { CommunicationsModule } from '@/modules/communications/communications.module';
import { NotificationRulesService } from './delivery/notification-rules.service';
import { NotificationDeliveryService } from './delivery/notification-delivery.service';
import { NotificationAdminService } from './admin/notification-admin.service';
import { NotificationLogService } from './admin/notification-log.service';
import { NotificationAdminMcp } from './admin/notification-admin.mcp';
import {
    NotificationDefaultsController, NotificationDeliveryRulesController, NotificationEventTypesController, NotificationLogController, NotificationSettingsController, NotificationTemplatesController,
} from './admin/notification-admin.controller';
import { NotificationWebhookEvents } from './delivery/notification-webhook-events.service';
import { WebPushKeysService } from './push/web-push-keys.service';
import { WebPushSender } from './push/web-push.sender';
import { PushDevicesService } from './push/push-devices.service';
import { MyNotificationDigestsController, NotificationDevicesController } from './push/push-devices.controller';
import { NotificationRetentionService } from './retention/notification-retention.service';

/**
 * 14 Notifications & Activity Center. Other modules import this module and call `NotificationsService.notify()`,
 * or simply publish events with the payload contract (see notifications.fanout.ts / PROGRESS.md).
 */
@Module({
    // Email and SMS go through 11 (CommDispatchService) with the organization's own Resend / Twilio connection; push uses platform VAPID keys.
    imports: [CommunicationsModule],
    // Order matters: /notifications/preferences/*, /devices, /digests must register before /notifications/:id.
    controllers: [
        NotificationPreferencesController, NotificationDevicesController, MyNotificationDigestsController, NotificationsController, ActivityController, AnnouncementsController,
        NotificationEventTypesController, NotificationTemplatesController, NotificationDefaultsController, NotificationDeliveryRulesController, NotificationLogController, NotificationSettingsController,
    ],
    providers: [
        NotificationsService, NotificationPreferencesService, ActivityService, AnnouncementsService, InboxActionsService, NotificationsFanout, NotificationsMcp,
        NotificationRulesService, NotificationDeliveryService, NotificationAdminService, NotificationLogService, NotificationAdminMcp,
        NotificationWebhookEvents, WebPushKeysService, WebPushSender, PushDevicesService, NotificationRetentionService,
    ],
    exports: [NotificationsService, ActivityService],
})
export class NotificationsModule { }
