import type { ContractObligationStatus, ContractObligationType } from "@/features/contracts/interfaces/contracts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const ObligationTypeFormOptions: DropdownOption<ContractObligationType>[] = [
    { id: "DELIVERABLE", label: "Deliverable" },
    { id: "PAYMENT", label: "Payment" },
    { id: "REPORTING", label: "Reporting" },
    { id: "RENEWAL_NOTICE", label: "Renewal notice" },
    { id: "SLA", label: "SLA" },
    { id: "SECURITY_REVIEW", label: "Security review" },
    { id: "CUSTOMER_APPROVAL", label: "Customer approval" },
    { id: "OTHER", label: "Other" },
];
export const ObligationTypeFilterOptions: DropdownOption<ContractObligationType | "all">[] = [{ id: "all", label: "All types" }, ...ObligationTypeFormOptions];

export const ObligationStatusFormOptions: DropdownOption<ContractObligationStatus>[] = [
    { id: "OPEN", label: "Open" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "FULFILLED", label: "Fulfilled" },
    { id: "OVERDUE", label: "Overdue" },
    { id: "WAIVED", label: "Waived" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const ObligationStatusFilterOptions: DropdownOption<ContractObligationStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ObligationStatusFormOptions];

export const ObligationFrequencyOptions: DropdownOption<string>[] = [
    { id: "none", label: "One-off" },
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "annual", label: "Annual" },
];

/** Quick views on the obligations list. */
export const ObligationViewOptions: DropdownOption<"all" | "overdue" | "due_30" | "mine">[] = [
    { id: "all", label: "All" },
    { id: "overdue", label: "Overdue" },
    { id: "due_30", label: "Due in 30 days" },
    { id: "mine", label: "Assigned to me" },
];
