import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { ContractAnalytics } from "@/features/contracts/interfaces/contracts.interfaces";

/** Stages of the contract cycle-time breakdown (04 analytics). */
export const ContractCycleStageOptions: DropdownOption<ContractAnalytics["cycle_by_stage"][number]["stage"]>[] = [
    { id: "draft_to_approval", label: "Draft to approval" },
    { id: "approval", label: "Approval decision" },
    { id: "approval_to_signature", label: "Approval to signed" },
    { id: "signature", label: "Signature turnaround" },
];

/** ContractRiskLevel labels (null = not scored). */
export const ContractRiskLevelOptions: DropdownOption<string>[] = [
    { id: "LOW", label: "Low" },
    { id: "MEDIUM", label: "Medium" },
    { id: "HIGH", label: "High" },
    { id: "CRITICAL", label: "Critical" },
    { id: "none", label: "Not scored" },
];

export const ContractAnalyticsPeriodOptions: DropdownOption<string>[] = [
    { id: "90", label: "Last 90 days" },
    { id: "180", label: "Last 6 months" },
    { id: "365", label: "Last 12 months" },
    { id: "730", label: "Last 2 years" },
];

/** ContractAiFindingKind labels (AI review findings, 04 §73). */
export const ContractAiFindingKindOptions: DropdownOption<string>[] = [
    { id: "MISSING_CLAUSE", label: "Missing clause" },
    { id: "CONFLICTING_DATES", label: "Conflicting dates" },
    { id: "UNUSUAL_PAYMENT_TERMS", label: "Unusual payment terms" },
    { id: "LIABILITY_DIFFERENCE", label: "Liability difference" },
    { id: "TERMINATION_DIFFERENCE", label: "Termination difference" },
    { id: "SCOPE_INCONSISTENCY", label: "Scope inconsistency" },
    { id: "RENEWAL_PROVISION", label: "Renewal provision" },
    { id: "NON_STANDARD_CLAUSE", label: "Non-standard clause" },
];

/** ContractAiFindingStatus labels. */
export const ContractAiFindingStatusOptions: DropdownOption<string>[] = [
    { id: "OPEN", label: "Open" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "DISMISSED", label: "Dismissed" },
];
