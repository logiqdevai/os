import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { DelegationStatus } from "@/features/admin/delegations/interfaces/delegations.interfaces";

/** DelegationStatus (01 §94) — computed from the dates by the API. */
export const DelegationStatusFormOptions: DropdownOption<DelegationStatus>[] = [
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "ACTIVE", label: "Active" },
    { id: "EXPIRED", label: "Expired" },
    { id: "REVOKED", label: "Revoked" },
];
export const DelegationStatusFilterOptions: DropdownOption<DelegationStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...DelegationStatusFormOptions];
