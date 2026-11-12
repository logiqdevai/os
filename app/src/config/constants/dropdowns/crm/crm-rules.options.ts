import type { AssignStrategy, RuleOperator, TargetMetric, TargetPeriod } from "@/features/crm/rules/interfaces/rules.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Condition operators of assignment / scoring rules. */
export const RuleOperatorOptions: DropdownOption<RuleOperator>[] = [
    { id: "equals", label: "is" },
    { id: "not_equals", label: "is not" },
    { id: "contains", label: "contains" },
    { id: "in", label: "is one of (comma-separated)" },
    { id: "gt", label: "greater than" },
    { id: "gte", label: "at least" },
    { id: "lt", label: "less than" },
    { id: "lte", label: "at most" },
    { id: "is_empty", label: "is empty" },
    { id: "is_not_empty", label: "is not empty" },
];

export const AssignStrategyOptions: DropdownOption<AssignStrategy>[] = [
    { id: "round_robin", label: "Round robin" },
    { id: "least_loaded", label: "Least loaded (fewest open leads)" },
];

/** Assignment target kind in the rule editor. */
export const AssignModeOptions: DropdownOption<"member" | "team" | "members">[] = [
    { id: "member", label: "A specific member" },
    { id: "team", label: "Rotate across a team" },
    { id: "members", label: "Rotate across chosen members" },
];

/** Prisma `CrmTargetPeriod`. */
export const TargetPeriodOptions: DropdownOption<TargetPeriod>[] = [
    { id: "MONTH", label: "Month" },
    { id: "QUARTER", label: "Quarter" },
    { id: "YEAR", label: "Year" },
];

/** Prisma `CrmTargetMetric`. */
export const TargetMetricOptions: DropdownOption<TargetMetric>[] = [
    { id: "REVENUE_WON", label: "Revenue won" },
    { id: "DEALS_WON", label: "Deals won" },
    { id: "PIPELINE_CREATED", label: "Pipeline created" },
];
