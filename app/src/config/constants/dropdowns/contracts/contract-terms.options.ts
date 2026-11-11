import type { ContractPartyType, ContractRelationKind, ContractRenewalType, ContractTerminationType } from "@/features/contracts/interfaces/contracts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const ContractRelationKindOptions: DropdownOption<ContractRelationKind>[] = [
    { id: "STANDALONE", label: "Standalone" },
    { id: "AMENDMENT", label: "Amendment" },
    { id: "RENEWAL", label: "Renewal" },
    { id: "SOW", label: "Statement of work" },
    { id: "CHANGE_ORDER", label: "Change order" },
    { id: "TERMINATION_AGREEMENT", label: "Termination agreement" },
];

/** Kinds offered by "Create amendment". */
export const ContractAmendmentKindOptions: DropdownOption<"AMENDMENT" | "CHANGE_ORDER" | "SOW">[] = [
    { id: "AMENDMENT", label: "Amendment" },
    { id: "CHANGE_ORDER", label: "Change order" },
    { id: "SOW", label: "Statement of work" },
];

export const ContractRenewalTypeFormOptions: DropdownOption<ContractRenewalType>[] = [
    { id: "NONE", label: "No renewal" },
    { id: "MANUAL", label: "Manual renewal" },
    { id: "AUTOMATIC", label: "Automatic renewal" },
    { id: "EVERGREEN", label: "Evergreen" },
];
export const ContractRenewalTypeFilterOptions: DropdownOption<ContractRenewalType | "all">[] = [{ id: "all", label: "All renewal types" }, ...ContractRenewalTypeFormOptions];

export const RenewalWindowOptions: DropdownOption<string>[] = [
    { id: "30", label: "Next 30 days" },
    { id: "60", label: "Next 60 days" },
    { id: "90", label: "Next 90 days" },
    { id: "180", label: "Next 180 days" },
    { id: "365", label: "Next 12 months" },
];

export const RenewalDecisionOptions: DropdownOption<"RENEW" | "DO_NOT_RENEW">[] = [
    { id: "RENEW", label: "Renew" },
    { id: "DO_NOT_RENEW", label: "Do not renew" },
];

export const RenewalValueChangeOptions: DropdownOption<"none" | "percent" | "amount">[] = [
    { id: "none", label: "Keep the same value" },
    { id: "percent", label: "Change by percent" },
    { id: "amount", label: "Change by amount" },
];

export const ContractPartyTypeFormOptions: DropdownOption<ContractPartyType>[] = [
    { id: "AGENCY", label: "Agency (us)" },
    { id: "CUSTOMER", label: "Customer" },
    { id: "VENDOR", label: "Vendor" },
    { id: "PARTNER", label: "Partner" },
    { id: "CONTRACTOR", label: "Contractor" },
    { id: "EMPLOYEE", label: "Employee" },
    { id: "OTHER", label: "Other" },
];

export const ContractTerminationTypeOptions: DropdownOption<ContractTerminationType>[] = [
    { id: "FOR_CONVENIENCE", label: "For convenience" },
    { id: "FOR_CAUSE", label: "For cause" },
    { id: "MUTUAL", label: "Mutual agreement" },
    { id: "EXPIRY", label: "Expiry" },
    { id: "OTHER", label: "Other" },
];

export const TerminationObligationHandlingOptions: DropdownOption<"keep" | "waive" | "cancel">[] = [
    { id: "keep", label: "Keep open obligations" },
    { id: "waive", label: "Waive open obligations" },
    { id: "cancel", label: "Cancel open obligations" },
];

export const BillingFrequencyOptions: DropdownOption<string>[] = [
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "annual", label: "Annual" },
    { id: "milestone", label: "By milestone" },
    { id: "custom", label: "Custom" },
];
