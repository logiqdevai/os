import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { BadgeVariant } from "@/components/ui/badge";
import type { InvitationStatus, PortalClientStatus, PortalFeature, PortalMembershipStatus, ProfileChangeStatus } from "@/features/client-portal/interfaces/client-portal.interfaces";

/** Canonical labels for 07 Client portal enums. */
export const PortalClientStatusOptions: DropdownOption<PortalClientStatus>[] = [
    { id: "enabled", label: "Portal on" },
    { id: "disabled", label: "Portal off" },
    { id: "not_set_up", label: "Not set up" },
];
export const PortalClientStatusFilterOptions: DropdownOption<PortalClientStatus | "all">[] = [{ id: "all", label: "All clients" }, ...PortalClientStatusOptions];

export const PortalMembershipStatusOptions: DropdownOption<PortalMembershipStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "SUSPENDED", label: "Suspended" },
    { id: "DEACTIVATED", label: "Deactivated" },
    { id: "INVITED", label: "Invited" },
];
export const PortalMembershipStatusFilterOptions: DropdownOption<PortalMembershipStatus | "all">[] = [{ id: "all", label: "Any status" }, ...PortalMembershipStatusOptions.filter((o) => o.id !== "INVITED")];

export const InvitationStatusOptions: DropdownOption<InvitationStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "REJECTED", label: "Declined" },
];
export const InvitationStatusFilterOptions: DropdownOption<InvitationStatus | "all">[] = [{ id: "all", label: "Any status" }, ...InvitationStatusOptions];

export const ProfileChangeStatusOptions: DropdownOption<ProfileChangeStatus>[] = [
    { id: "PENDING", label: "Waiting for review" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "AUTO_APPLIED", label: "Applied automatically" },
];
export const ProfileChangeStatusFilterOptions: DropdownOption<ProfileChangeStatus | "all">[] = [{ id: "all", label: "Any status" }, ...ProfileChangeStatusOptions];

export const PortalFeatureOptions: DropdownOption<PortalFeature>[] = [
    { id: "projects", label: "Projects & approvals" },
    { id: "requests", label: "Requests" },
    { id: "conversations", label: "Messages" },
    { id: "documents", label: "Documents" },
    { id: "proposals", label: "Proposals" },
    { id: "contracts", label: "Contracts" },
    { id: "billing", label: "Invoices & billing" },
    { id: "knowledge", label: "Help center" },
];

export const PortalApprovalStateOptions: DropdownOption<"awaiting" | "changes_requested" | "decided" | "everything">[] = [
    { id: "awaiting", label: "Waiting for the client" },
    { id: "changes_requested", label: "Changes requested" },
    { id: "decided", label: "Decided" },
    { id: "everything", label: "All" },
];

/** Readable names for portal.* permission keys (role matrix, team pages). */
export const PortalPermissionOptions: DropdownOption<string>[] = [
    { id: "portal.projects.read", label: "See projects" },
    { id: "portal.deliverables.approve", label: "Approve deliverables" },
    { id: "portal.requests.create", label: "Open and follow requests" },
    { id: "portal.conversations.participate", label: "Message the team" },
    { id: "portal.documents.read", label: "See documents" },
    { id: "portal.documents.upload", label: "Upload documents" },
    { id: "portal.proposals.read", label: "See proposals" },
    { id: "portal.proposals.accept", label: "Accept proposals" },
    { id: "portal.contracts.read", label: "See contracts" },
    { id: "portal.contracts.sign", label: "Sign contracts" },
    { id: "portal.invoices.read", label: "See invoices" },
    { id: "portal.invoices.pay", label: "Pay invoices" },
    { id: "portal.subscriptions.manage", label: "Manage subscriptions" },
    { id: "portal.users.manage", label: "Manage company users" },
    { id: "portal.settings.manage", label: "Edit company profile" },
];

export const PortalClientStatusTone: Record<PortalClientStatus, BadgeVariant> = { enabled: "success", disabled: "neutral", not_set_up: "outline" };
export const PortalMembershipStatusTone: Record<PortalMembershipStatus, BadgeVariant> = { ACTIVE: "success", SUSPENDED: "warning", DEACTIVATED: "neutral", INVITED: "info" };
export const InvitationStatusTone: Record<InvitationStatus, BadgeVariant> = { PENDING: "info", ACCEPTED: "success", EXPIRED: "warning", CANCELLED: "neutral", REJECTED: "neutral" };
export const ProfileChangeStatusTone: Record<ProfileChangeStatus, BadgeVariant> = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral", AUTO_APPLIED: "info" };

/** Customer-facing labels of 05 DeliverableStatus (portal and approvals overview). */
export const DeliverableReviewStatusOptions: DropdownOption<string>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "READY_FOR_REVIEW", label: "Ready for review" },
    { id: "SUBMITTED", label: "Waiting for review" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
    { id: "ACCEPTED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const DeliverableReviewStatusTone: Record<string, BadgeVariant> = { PLANNED: "neutral", IN_PROGRESS: "info", READY_FOR_REVIEW: "info", SUBMITTED: "info", CHANGES_REQUESTED: "warning", ACCEPTED: "success", REJECTED: "danger", CANCELLED: "neutral" };

/** Badge tone of a customer-facing request status category (13 TicketStatusCategory). */
export const PortalRequestCategoryTone: Record<string, BadgeVariant> = { NEW: "info", OPEN: "info", PENDING_CUSTOMER: "warning", ON_HOLD: "neutral", RESOLVED: "success", CLOSED: "neutral" };

/** Request types a client may open from the portal (07 §5). */
export const PortalRequestTypeOptions: DropdownOption<string>[] = [
    { id: "QUESTION", label: "Question" },
    { id: "BUG", label: "Something is broken" },
    { id: "FEATURE_REQUEST", label: "New feature" },
    { id: "CHANGE_REQUEST", label: "Change request" },
    { id: "BILLING", label: "Billing" },
    { id: "ACCOUNT", label: "Account & access" },
    { id: "OTHER", label: "Other" },
];

export const PortalRequestStateOptions: DropdownOption<string>[] = [
    { id: "open", label: "Open" },
    { id: "closed", label: "Closed" },
    { id: "everything", label: "All" },
];

export const PortalPriorityOptions: DropdownOption<string>[] = [
    { id: "LOW", label: "Low — whenever possible" },
    { id: "NORMAL", label: "Normal" },
    { id: "HIGH", label: "High — affects our work" },
    { id: "URGENT", label: "Urgent — something is down" },
];

/** Customer-facing labels of 03/04/08 statuses shown in the portal. */
export const PortalAgreementStatusOptions: DropdownOption<string>[] = [
    { id: "SENT", label: "Waiting for you" },
    { id: "VIEWED", label: "Viewed" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "REJECTED", label: "Declined" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CUSTOMER_REVIEW", label: "For your review" },
    { id: "READY_FOR_SIGNATURE", label: "Ready to sign" },
    { id: "PARTIALLY_SIGNED", label: "Partly signed" },
    { id: "FULLY_SIGNED", label: "Signed" },
    { id: "ACTIVE", label: "Active" },
    { id: "EXPIRING", label: "Expiring soon" },
    { id: "RENEWED", label: "Renewed" },
    { id: "SUPERSEDED", label: "Replaced" },
    { id: "TERMINATED", label: "Terminated" },
    { id: "ARCHIVED", label: "Archived" },
];

export const PortalInvoiceStatusOptions: DropdownOption<string>[] = [
    { id: "OPEN", label: "Open" },
    { id: "PENDING", label: "Processing" },
    { id: "PAID", label: "Paid" },
    { id: "PARTIALLY_PAID", label: "Partly paid" },
    { id: "OVERDUE", label: "Overdue" },
    { id: "REFUNDED", label: "Refunded" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "VOID", label: "Void" },
];
export const PortalInvoiceStatusTone: Record<string, BadgeVariant> = { OPEN: "info", PENDING: "info", PAID: "success", PARTIALLY_PAID: "warning", OVERDUE: "danger", REFUNDED: "neutral", CANCELLED: "neutral", VOID: "neutral" };
export const PortalInvoiceFilterOptions: DropdownOption<string>[] = [
    { id: "all", label: "All invoices" },
    { id: "outstanding", label: "To pay" },
    { id: "paid", label: "Paid" },
];

export const ProjectHealthOptions: DropdownOption<string>[] = [
    { id: "HEALTHY", label: "On track" },
    { id: "AT_RISK", label: "At risk" },
    { id: "BLOCKED", label: "Blocked" },
    { id: "CRITICAL", label: "Critical" },
    { id: "UNKNOWN", label: "Not rated" },
];
export const ProjectHealthTone: Record<string, BadgeVariant> = { HEALTHY: "success", AT_RISK: "warning", BLOCKED: "danger", CRITICAL: "danger", UNKNOWN: "neutral" };
