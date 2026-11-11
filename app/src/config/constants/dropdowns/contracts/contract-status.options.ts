import type { ContractStatus, ContractVersionStatus } from "@/features/contracts/interfaces/contracts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for ContractStatus (04 §5). */
export const ContractStatusFormOptions: DropdownOption<ContractStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "INTERNAL_REVIEW", label: "Internal review" },
    { id: "CUSTOMER_REVIEW", label: "Customer review" },
    { id: "APPROVAL_REQUIRED", label: "Awaiting approval" },
    { id: "READY_FOR_SIGNATURE", label: "Ready for signature" },
    { id: "PARTIALLY_SIGNED", label: "Partially signed" },
    { id: "FULLY_SIGNED", label: "Fully signed" },
    { id: "ACTIVE", label: "Active" },
    { id: "EXPIRING", label: "Expiring" },
    { id: "RENEWED", label: "Renewed" },
    { id: "SUPERSEDED", label: "Superseded" },
    { id: "TERMINATED", label: "Terminated" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "ARCHIVED", label: "Archived" },
];

export const ContractStatusFilterOptions: DropdownOption<ContractStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ContractStatusFormOptions];

/** Canonical labels for ContractVersionStatus (04 §19–20). */
export const ContractVersionStatusOptions: DropdownOption<ContractVersionStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "IN_REVIEW", label: "In review" },
    { id: "APPROVED", label: "Approved" },
    { id: "LOCKED_FOR_SIGNATURE", label: "Locked for signature" },
    { id: "SIGNED", label: "Signed" },
    { id: "SUPERSEDED", label: "Superseded" },
];
