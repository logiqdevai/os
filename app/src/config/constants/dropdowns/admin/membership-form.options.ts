import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type MembershipType = "INTERNAL" | "EXTERNAL_COLLABORATOR" | "GUEST";

/** Membership.status labels (01 §24). */
export const MembershipStatusFormOptions: DropdownOption<MembershipStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "INVITED", label: "Invited" },
    { id: "SUSPENDED", label: "Suspended" },
    { id: "DEACTIVATED", label: "Offboarded" },
];
export const MembershipStatusFilterOptions: DropdownOption<MembershipStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...MembershipStatusFormOptions];

/** Membership.type labels (01 §77–78). */
export const MembershipTypeFormOptions: DropdownOption<MembershipType>[] = [
    { id: "INTERNAL", label: "Internal" },
    { id: "EXTERNAL_COLLABORATOR", label: "External collaborator" },
    { id: "GUEST", label: "Guest" },
];
export const MembershipTypeFilterOptions: DropdownOption<MembershipType | "all">[] = [{ id: "all", label: "All types" }, ...MembershipTypeFormOptions];

/** Membership.provisioning_source (01 §65, §67). */
export const ProvisioningSourceOptions: DropdownOption<string>[] = [
    { id: "MANUAL", label: "Added manually" },
    { id: "INVITATION_LINK", label: "Invitation" },
    { id: "BULK_IMPORT", label: "Bulk import" },
    { id: "SSO", label: "Single sign-on" },
    { id: "SCIM", label: "SCIM provisioning" },
    { id: "API", label: "API" },
];
