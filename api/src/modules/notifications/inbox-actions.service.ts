import { BadRequestException, Injectable } from '@nestjs/common';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AnnouncementsService } from './announcements.service';
import { NotificationsService } from './notifications.service';

/**
 * 14 §7 — inline actions from the inbox. Actions owned by this module (acknowledge an announcement) run here;
 * actions of other modules (approve, complete …) are performed on the source record with that module's own
 * permission, so the inbox only offers "open" for them and records nothing.
 */
@Injectable()
export class InboxActionsService {
    constructor(
        private readonly notifications: NotificationsService,
        private readonly announcements: AnnouncementsService,
    ) { }

    async act(ctx: OrgContext, id: string, action: string) {
        const row = await this.notifications.findOne(ctx, id);
        const offered = Array.isArray(row.actions) ? (row.actions as { key: string }[]).map((a) => a.key) : [];
        if (!offered.includes(action)) throw new BadRequestException({ message: 'This action is not available on this notification', code: 'notification_action_unavailable' });
        if (row.event_key === 'announcement.published' && action === 'acknowledge') {
            const announcementId = (row.data as { announcement_id?: string } | null)?.announcement_id;
            if (announcementId) await this.announcements.acknowledge(ctx, announcementId);
            return this.notifications.findOne(ctx, id);
        }
        return this.notifications.recordAction(ctx, id, action);
    }
}
