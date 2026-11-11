import type { ProposalApprovalDecision, ProposalStatus, ProposalVersionStatus } from "@/features/proposals/interfaces/proposals.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { BadgeVariant } from "@/components/ui/badge";

/** Canonical labels for Proposal.status (ProposalStatus). */
export const ProposalStatusFormOptions: DropdownOption<ProposalStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "IN_REVIEW", label: "In review" },
    { id: "PENDING_APPROVAL", label: "Awaiting approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "SENT", label: "Sent" },
    { id: "VIEWED", label: "Viewed" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "REJECTED", label: "Rejected" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
];

/** Badge tone per status (visual only). One map so a status looks the same on every screen. */
export const ProposalStatusTone: Record<ProposalStatus, BadgeVariant> = {
    DRAFT: "neutral",
    IN_REVIEW: "warning",
    PENDING_APPROVAL: "warning",
    APPROVED: "info",
    SENT: "info",
    VIEWED: "violet",
    CHANGES_REQUESTED: "warning",
    ACCEPTED: "success",
    REJECTED: "danger",
    EXPIRED: "neutral",
    CANCELLED: "neutral",
};

/** List view tabs; each maps to API filters. */
export const ProposalViewFilterOptions: (DropdownOption & { status?: string; owner?: "me"; expiring_within_days?: number })[] = [
    { id: "all", label: "All" },
    { id: "mine", label: "My proposals", owner: "me" },
    { id: "drafts", label: "Drafts", status: "DRAFT" },
    { id: "approval", label: "Awaiting approval", status: "IN_REVIEW,PENDING_APPROVAL,APPROVED" },
    { id: "open", label: "With customer", status: "SENT,VIEWED,CHANGES_REQUESTED" },
    { id: "expiring", label: "Expiring soon", expiring_within_days: 7 },
    { id: "accepted", label: "Accepted", status: "ACCEPTED" },
    { id: "lost", label: "Lost", status: "REJECTED,EXPIRED" },
    { id: "cancelled", label: "Cancelled", status: "CANCELLED" },
];

export const ProposalVersionStatusFormOptions: DropdownOption<ProposalVersionStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "IN_REVIEW", label: "In review" },
    { id: "APPROVED", label: "Approved" },
    { id: "SENT", label: "Sent" },
    { id: "SUPERSEDED", label: "Superseded" },
];

export const ProposalVersionStatusTone: Record<ProposalVersionStatus, BadgeVariant> = {
    DRAFT: "warning",
    IN_REVIEW: "warning",
    APPROVED: "info",
    SENT: "info",
    SUPERSEDED: "neutral",
};

export const ProposalApprovalDecisionOptions: DropdownOption<ProposalApprovalDecision>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
];

export const ProposalApprovalDecisionTone: Record<ProposalApprovalDecision, BadgeVariant> = {
    PENDING: "info",
    APPROVED: "success",
    REJECTED: "danger",
    CHANGES_REQUESTED: "warning",
};

/** ProposalEventType labels for the activity timeline. */
export const ProposalEventTypeOptions: DropdownOption[] = [
    { id: "CREATED", label: "Created" },
    { id: "VERSION_CREATED", label: "Version created" },
    { id: "SUBMITTED_FOR_REVIEW", label: "Submitted for approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "SENT", label: "Sent" },
    { id: "VIEWED", label: "Viewed by customer" },
    { id: "DOWNLOADED", label: "Downloaded" },
    { id: "OPTIONAL_ITEM_TOGGLED", label: "Optional items changed" },
    { id: "COMMENTED", label: "Customer commented" },
    { id: "CHANGES_REQUESTED", label: "Customer requested changes" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "REJECTED", label: "Declined / lost" },
    { id: "SIGNED", label: "Signed" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "CONVERTED", label: "Converted to contract" },
];
