import type { CommConsentStatus, CommSenderDomainStatus, CommSenderIdentityStatus, CommSuppressionReason, SegmentEntityType } from "@/features/communications/interfaces/communications.interfaces";

export const CommSuppressionReasonFormOptions: { id: CommSuppressionReason; label: string }[] = [
    { id: "MANUAL", label: "Added manually" },
    { id: "UNSUBSCRIBE", label: "Unsubscribed" },
    { id: "HARD_BOUNCE", label: "Hard bounce" },
    { id: "SOFT_BOUNCE", label: "Soft bounce" },
    { id: "COMPLAINT", label: "Spam complaint" },
    { id: "INVALID_ADDRESS", label: "Invalid address" },
    { id: "CONSENT_WITHDRAWN", label: "Consent withdrawn" },
];
export const CommSuppressionReasonFilterOptions: { id: CommSuppressionReason | "all"; label: string }[] = [{ id: "all", label: "All reasons" }, ...CommSuppressionReasonFormOptions];

export const CommConsentStatusFormOptions: { id: CommConsentStatus; label: string }[] = [
    { id: "OPTED_IN", label: "Opted in" },
    { id: "PENDING_DOUBLE_OPT_IN", label: "Waiting for confirmation" },
    { id: "OPTED_OUT", label: "Opted out" },
    { id: "UNKNOWN", label: "Unknown" },
];
export const CommConsentStatusFilterOptions: { id: CommConsentStatus | "all"; label: string }[] = [{ id: "all", label: "All consent states" }, ...CommConsentStatusFormOptions];

export const SegmentEntityTypeFormOptions: { id: SegmentEntityType; label: string }[] = [
    { id: "CRM_CONTACT", label: "CRM contacts" },
    { id: "CRM_COMPANY", label: "Contacts of companies" },
    { id: "MEMBERSHIP", label: "Team members" },
];

export const SegmentOperatorOptions: { id: string; label: string }[] = [
    { id: "eq", label: "is" },
    { id: "neq", label: "is not" },
    { id: "in", label: "is any of" },
    { id: "not_in", label: "is none of" },
    { id: "contains", label: "contains" },
    { id: "not_contains", label: "does not contain" },
    { id: "starts_with", label: "starts with" },
    { id: "is_set", label: "is set" },
    { id: "is_not_set", label: "is empty" },
    { id: "before", label: "is before" },
    { id: "after", label: "is after" },
    { id: "within_days", label: "in the last (days)" },
    { id: "older_than_days", label: "more than (days) ago" },
    { id: "has", label: "has" },
    { id: "not_has", label: "does not have" },
];

export const CommSenderDomainStatusOptions: { id: CommSenderDomainStatus; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "VERIFIED", label: "Verified" },
    { id: "FAILED", label: "Failed" },
    { id: "DISABLED", label: "Disabled" },
];
export const CommSenderIdentityStatusOptions: { id: CommSenderIdentityStatus; label: string }[] = [
    { id: "PENDING_VERIFICATION", label: "Not verified" },
    { id: "VERIFIED", label: "Verified" },
    { id: "FAILED", label: "Failed" },
    { id: "DISABLED", label: "Disabled" },
];
