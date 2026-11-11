import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { RoleStatus, RoleType } from "@/features/admin/roles/interfaces/roles.interfaces";
import type { InvitationStatus } from "@/features/admin/invitations/interfaces/invitations.interfaces";
import type { BranchKind, BranchStatus } from "@/features/admin/branches/interfaces/branches.interfaces";

/** Role.status (01 §109). */
export const RoleStatusFormOptions: DropdownOption<RoleStatus>[] = [
    { id: "PUBLISHED", label: "Published" },
    { id: "DRAFT", label: "Draft" },
    { id: "DEPRECATED", label: "Deprecated" },
];
export const RoleStatusFilterOptions: DropdownOption<RoleStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...RoleStatusFormOptions];

/** Role.type (01 §45). */
export const RoleTypeFormOptions: DropdownOption<RoleType>[] = [
    { id: "SYSTEM", label: "System" },
    { id: "ORGANIZATION", label: "Organization" },
    { id: "BRANCH", label: "Branch" },
    { id: "TEAM", label: "Team" },
    { id: "PROJECT", label: "Project" },
    { id: "CUSTOMER_PORTAL", label: "Client portal" },
];
/** Types an organization can give its own custom roles. */
export const CustomRoleTypeOptions = RoleTypeFormOptions.filter((o) => ["ORGANIZATION", "BRANCH", "TEAM", "PROJECT"].includes(o.id));

/** Where a role comes from. */
export const RoleSourceFilterOptions: DropdownOption<"all" | "templates" | "custom">[] = [
    { id: "all", label: "All roles" },
    { id: "templates", label: "System templates" },
    { id: "custom", label: "Custom roles" },
];

/** Invitation.status (01 §66). */
export const InvitationStatusFormOptions: DropdownOption<InvitationStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "REJECTED", label: "Declined" },
];
export const InvitationStatusFilterOptions: DropdownOption<InvitationStatus | "all">[] = [{ id: "all", label: "All invitations" }, ...InvitationStatusFormOptions];

/** Invitation expiry choices (days). */
export const InvitationExpiryOptions: DropdownOption<"3" | "7" | "14" | "30">[] = [
    { id: "3", label: "3 days" },
    { id: "7", label: "7 days" },
    { id: "14", label: "14 days" },
    { id: "30", label: "30 days" },
];

/** Branch.kind (01 §16). */
export const BranchKindFormOptions: DropdownOption<BranchKind>[] = [
    { id: "OPERATIONAL", label: "Operational" },
    { id: "OFFICE", label: "Office" },
    { id: "REGIONAL_UNIT", label: "Regional unit" },
    { id: "SUBSIDIARY_REFERENCE", label: "Subsidiary (reference)" },
    { id: "SERVICE_CENTER", label: "Service center" },
    { id: "REMOTE", label: "Remote" },
];

/** Branch.status (01 §19). */
export const BranchStatusFormOptions: DropdownOption<BranchStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "PLANNED", label: "Planned" },
    { id: "TEMPORARILY_CLOSED", label: "Temporarily closed" },
    { id: "SUSPENDED", label: "Suspended" },
    { id: "ARCHIVED", label: "Archived" },
];

/** Permission grant effect (01 §53). */
export const PermissionEffectFormOptions: DropdownOption<"ALLOW" | "DENY">[] = [
    { id: "ALLOW", label: "Allow" },
    { id: "DENY", label: "Deny (always wins)" },
];

/** Simulate / explain reasons (AuthorizationService.explain). */
export const AccessReasonOptions: DropdownOption<string>[] = [
    { id: "allowed", label: "Allowed" },
    { id: "out_of_scope", label: "Allowed, but not for this record (outside the scope)" },
    { id: "membership_inactive", label: "The membership is not active" },
    { id: "module_disabled", label: "The module is disabled for the organization or this member" },
    { id: "explicit_deny", label: "An explicit deny blocks it (deny always wins)" },
    { id: "not_granted", label: "No role or grant gives this permission" },
    { id: "unknown_permission", label: "Unknown permission" },
];

/** Week start day (1 = Monday). */
export const WeekStartOptions: DropdownOption<"1" | "6" | "7">[] = [
    { id: "1", label: "Monday" },
    { id: "6", label: "Saturday" },
    { id: "7", label: "Sunday" },
];
