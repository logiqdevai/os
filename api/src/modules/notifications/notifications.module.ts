import { Module } from '@nestjs/common';
import { ActivityController, AnnouncementsController, NotificationPreferencesController, NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ActivityService } from './activity.service';
import { AnnouncementsService } from './announcements.service';
import { InboxActionsService } from './inbox-actions.service';
import { NotificationsFanout } from './notifications.fanout';
import { NotificationsMcp } from './notifications.mcp';

/**
 * 14 Notifications & Activity Center. Other modules import this module and call `NotificationsService.notify()`,
 * or simply publish events with the payload contract (see notifications.fanout.ts / PROGRESS.md).
 */
@Module({
    // Order matters: /notifications/preferences/* must register before /notifications/:id.
    controllers: [NotificationPreferencesController, NotificationsController, ActivityController, AnnouncementsController],
    providers: [NotificationsService, NotificationPreferencesService, ActivityService, AnnouncementsService, InboxActionsService, NotificationsFanout, NotificationsMcp],
    exports: [NotificationsService, ActivityService],
})
export class NotificationsModule { }
