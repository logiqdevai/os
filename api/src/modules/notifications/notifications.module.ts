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

/**
 * 14 Notifications & Activity Center. Other modules import this module and call `NotificationsService.notify()`,
 * or simply publish events with the payload contract (see notifications.fanout.ts / PROGRESS.md).
 */
@Module({
    // Email goes through 11 (CommDispatchService) with the organization's own Resend connection.
    imports: [CommunicationsModule],
    // Order matters: /notifications/preferences/* must register before /notifications/:id.
    controllers: [
        NotificationPreferencesController, NotificationsController, ActivityController, AnnouncementsController,
        NotificationEventTypesController, NotificationTemplatesController, NotificationDefaultsController, NotificationDeliveryRulesController, NotificationLogController, NotificationSettingsController,
    ],
    providers: [
        NotificationsService, NotificationPreferencesService, ActivityService, AnnouncementsService, InboxActionsService, NotificationsFanout, NotificationsMcp,
        NotificationRulesService, NotificationDeliveryService, NotificationAdminService, NotificationLogService, NotificationAdminMcp,
    ],
    exports: [NotificationsService, ActivityService],
})
export class NotificationsModule { }
