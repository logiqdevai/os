import { ModuleKey, NotificationCategory, NotificationPriority, RecordEntityType } from 'generated/prisma';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

/** Who caused the notification (any OrgContext works; background jobs pass `systemContext(orgId)`). */
export type NotifyContext = Pick<OrgContext, 'organization_id' | 'membership_id' | 'user_id'> & { service_account_id?: string | null };

export interface NotificationActionDef {
    key: string;
    label: string;
    style?: 'primary' | 'default' | 'danger';
}

/**
 * Input of `NotificationsService.notify()` — the API other modules call to put a notification in members' inboxes.
 * Modules may also just publish an event with the payload contract documented in PROGRESS.md (fan-out does the rest).
 */
export interface NotifyInput {
    recipient_membership_ids: string[];
    /** Stable event key, e.g. `tasks.task.assigned` (registered in the event catalog on first use). */
    event_key: string;
    module: ModuleKey;
    title: string;
    body?: string | null;
    /** In-app deep link (e.g. `/tasks/WEB-142`); opened when the notification is clicked. */
    link?: string | null;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    /** assignee | owner | mention | approver | attendee | watcher | recipient | announcement … */
    audience_reason?: string;
    entity_type?: RecordEntityType | null;
    entity_id?: string | null;
    entity_label?: string | null;
    context_project_id?: string | null;
    context_company_id?: string | null;
    requires_action?: boolean;
    actions?: NotificationActionDef[];
    is_mandatory?: boolean;
    icon?: string | null;
    data?: Record<string, unknown>;
    expires_at?: Date | null;
    /** Redelivery-safe key; the same key never creates a second notification for a recipient. */
    idempotency_key?: string;
    platform_event_id?: string | null;
    /** Also notify the actor (default false: people are not told about their own actions). */
    include_actor?: boolean;
}

/** One recipient with its own category / reason (fan-out picks the strongest reason per person). */
export interface NotifyRecipient {
    membership_id: string;
    category: NotificationCategory;
    audience_reason: string;
    requires_action?: boolean;
    title?: string;
}
