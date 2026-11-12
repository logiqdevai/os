import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { RetentionAction, RetentionDataClass } from "@/features/admin/retention/interfaces/retention.interfaces";

/** OrganizationRetentionDataClass (01 §134). */
export const RetentionDataClassOptions: DropdownOption<RetentionDataClass>[] = [
    { id: "AUDIT_EVENTS", label: "Audit events" },
    { id: "SESSIONS", label: "Sessions" },
    { id: "INVITATIONS", label: "Invitations" },
    { id: "WEBHOOK_DELIVERIES", label: "Webhook deliveries" },
];
export const RetentionDataClassDescriptionOptions: { id: RetentionDataClass; description: string }[] = [
    { id: "AUDIT_EVENTS", description: "Never deleted. Anonymize scrubs IP address and browser after the period; Archive keeps them as they are." },
    { id: "SESSIONS", description: "Ended sessions (signed out, revoked or expired) are deleted after the period." },
    { id: "INVITATIONS", description: "Accepted, cancelled and expired invitations are deleted after the period." },
    { id: "WEBHOOK_DELIVERIES", description: "Finished webhook deliveries (payloads and responses) are deleted after the period." },
];
export const getRetentionDataClassDescription = (id: string) => RetentionDataClassDescriptionOptions.find((o) => o.id === id)?.description ?? "";

/** OrganizationRetentionAction (01 §134). */
export const RetentionActionOptions: DropdownOption<RetentionAction>[] = [
    { id: "ARCHIVE", label: "Archive (keep)" },
    { id: "ANONYMIZE", label: "Anonymize" },
    { id: "DELETE", label: "Delete" },
];

/** Retention periods in days; "forever" = keep indefinitely. */
export const RetentionPeriodOptions: DropdownOption<string>[] = [
    { id: "forever", label: "Keep forever" },
    { id: "7", label: "7 days" },
    { id: "30", label: "30 days" },
    { id: "90", label: "90 days" },
    { id: "180", label: "6 months" },
    { id: "365", label: "1 year" },
    { id: "730", label: "2 years" },
    { id: "1825", label: "5 years" },
    { id: "2555", label: "7 years" },
];

/** Why a class was skipped in a retention run. */
export const RetentionSkipOptions: DropdownOption<string>[] = [
    { id: "legal_hold", label: "on legal hold" },
    { id: "keep_forever", label: "kept forever" },
    { id: "archive_not_available", label: "archive keeps data in place" },
];
