import type { CommMessageKind, CommMessageStatus, CommRecipientStatus } from "@/features/communications/interfaces/communications.interfaces";

export const CommMessageStatusFormOptions: { id: CommMessageStatus; label: string }[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "QUEUED", label: "Queued" },
    { id: "SENDING", label: "Sending" },
    { id: "SENT", label: "Sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "FAILED", label: "Failed" },
    { id: "BOUNCED", label: "Bounced" },
    { id: "CANCELLED", label: "Not sent" },
];
export const CommMessageStatusFilterOptions: { id: CommMessageStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...CommMessageStatusFormOptions];

export const CommMessageKindFormOptions: { id: CommMessageKind; label: string }[] = [
    { id: "CUSTOMER", label: "Customer" },
    { id: "CAMPAIGN", label: "Campaign" },
    { id: "TRANSACTIONAL", label: "Transactional" },
    { id: "NOTIFICATION", label: "Notification" },
    { id: "INTERNAL", label: "Internal" },
];
export const CommMessageKindFilterOptions: { id: CommMessageKind | "all"; label: string }[] = [{ id: "all", label: "All kinds" }, ...CommMessageKindFormOptions];

export const CommRecipientStatusFormOptions: { id: CommRecipientStatus; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "EXCLUDED", label: "Excluded" },
    { id: "QUEUED", label: "Queued" },
    { id: "SENT", label: "Sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "OPENED", label: "Opened" },
    { id: "CLICKED", label: "Clicked" },
    { id: "REPLIED", label: "Replied" },
    { id: "BOUNCED", label: "Bounced" },
    { id: "FAILED", label: "Failed" },
    { id: "UNSUBSCRIBED", label: "Unsubscribed" },
];
export const CommRecipientStatusFilterOptions: { id: CommRecipientStatus | "all"; label: string }[] = [{ id: "all", label: "All recipients" }, ...CommRecipientStatusFormOptions];

/** Why a recipient was skipped (CampaignRecipient.exclusion_reason / audience resolution). */
export const AudienceExclusionReasonOptions: { id: string; label: string }[] = [
    { id: "suppressed", label: "Suppressed" },
    { id: "no_consent", label: "No opt-in" },
    { id: "invalid_address", label: "Invalid address" },
    { id: "excluded_by_audience", label: "Excluded list or segment" },
    { id: "duplicate", label: "Duplicate" },
    { id: "topic_unsubscribed", label: "Unsubscribed from topic" },
    { id: "cancelled", label: "Campaign cancelled" },
];

export const CommDeliveryEventTypeOptions: { id: string; label: string }[] = [
    { id: "QUEUED", label: "Queued" },
    { id: "SENT", label: "Sent" },
    { id: "DEFERRED", label: "Delayed" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "OPENED", label: "Opened" },
    { id: "CLICKED", label: "Clicked" },
    { id: "REPLIED", label: "Replied" },
    { id: "READ", label: "Read" },
    { id: "BOUNCED", label: "Bounced" },
    { id: "COMPLAINED", label: "Marked as spam" },
    { id: "FAILED", label: "Failed" },
    { id: "UNSUBSCRIBED", label: "Unsubscribed" },
];
