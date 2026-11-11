import type { ContractClauseStatus, ContractTemplateStatus } from "@/features/contracts/interfaces/contracts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const ContractTemplateStatusOptions: DropdownOption<ContractTemplateStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PUBLISHED", label: "Published" },
    { id: "DEPRECATED", label: "Deprecated" },
];
export const ContractTemplateStatusFilterOptions: DropdownOption<ContractTemplateStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ContractTemplateStatusOptions];

export const ContractClauseStatusOptions: DropdownOption<ContractClauseStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "ACTIVE", label: "Active" },
    { id: "DEPRECATED", label: "Deprecated" },
];

export const ContractClauseCategoryOptions: DropdownOption<string>[] = [
    { id: "payment", label: "Payment" },
    { id: "ip", label: "Intellectual property" },
    { id: "confidentiality", label: "Confidentiality" },
    { id: "privacy", label: "Privacy / data protection" },
    { id: "liability", label: "Liability" },
    { id: "warranty", label: "Warranty" },
    { id: "termination", label: "Termination" },
    { id: "renewal", label: "Renewal" },
    { id: "sla", label: "SLA" },
    { id: "security", label: "Security" },
    { id: "governing_law", label: "Governing law" },
    { id: "other", label: "Other" },
];
export const ContractClauseCategoryFilterOptions: DropdownOption<string>[] = [{ id: "all", label: "All categories" }, ...ContractClauseCategoryOptions];

export const ApprovalRuleFieldOptions: DropdownOption<string>[] = [
    { id: "total_value", label: "Total value" },
    { id: "recurring_value", label: "Recurring value" },
    { id: "one_time_value", label: "One-time value" },
    { id: "term_months", label: "Term (months)" },
    { id: "renewal_type", label: "Renewal type" },
    { id: "relation_kind", label: "Contract kind" },
    { id: "processes_personal_data", label: "Processes personal data" },
    { id: "currency", label: "Currency" },
];

export const ApprovalRuleOperatorOptions: DropdownOption<string>[] = [
    { id: ">", label: "greater than" },
    { id: ">=", label: "at least" },
    { id: "<", label: "less than" },
    { id: "<=", label: "at most" },
    { id: "=", label: "equals" },
    { id: "!=", label: "is not" },
];

/** Tabs of the library page. */
export const ContractLibraryTabOptions: DropdownOption<"templates" | "clauses" | "types" | "rules">[] = [
    { id: "templates", label: "Templates" },
    { id: "clauses", label: "Clauses" },
    { id: "types", label: "Contract types" },
    { id: "rules", label: "Approval rules" },
];
