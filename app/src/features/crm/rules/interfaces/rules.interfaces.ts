import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";

export type RuleOperator = "equals" | "not_equals" | "contains" | "in" | "gt" | "gte" | "lt" | "lte" | "is_empty" | "is_not_empty";

export interface RuleCondition {
    field: string;
    operator: RuleOperator;
    value?: string | number | boolean | string[] | null;
}

export type AssignStrategy = "round_robin" | "least_loaded";
export type AssignTo = { membership_id: string } | { team_id: string; strategy: AssignStrategy } | { membership_ids: string[]; strategy: AssignStrategy };

export interface AssignmentRule {
    id: string;
    name: string;
    conditions: RuleCondition[];
    assign_to: AssignTo;
    priority: number;
    enabled: boolean;
}

export interface ScoringRule {
    id: string;
    name: string;
    description: string | null;
    conditions: RuleCondition[];
    points: number;
    enabled: boolean;
    sort_order: number;
}

export interface RuleField {
    key: string;
    label: string;
    type: "id" | "text" | "number";
    options?: { value: string; label: string }[] | null;
}

export type TargetPeriod = "MONTH" | "QUARTER" | "YEAR";
export type TargetMetric = "REVENUE_WON" | "PIPELINE_CREATED" | "DEALS_WON";

export interface SalesTarget {
    id: string;
    owner_membership_id: string | null;
    team_id: string | null;
    pipeline_id: string | null;
    owner: MemberRef | null;
    team: { id: string; name: string } | null;
    pipeline: { id: string; name: string } | null;
    period: TargetPeriod;
    period_start: string;
    period_end: string;
    metric: TargetMetric;
    /** null without crm.financials.read for money metrics. */
    amount: number | null;
    actual: number | null;
    currency: string;
    attainment_percent: number | null;
    elapsed_percent: number;
}

export interface TargetAttainment {
    date: string;
    financials_hidden: boolean;
    targets: SalesTarget[];
}

export interface SaveTargetDto {
    owner_membership_id?: string | null;
    team_id?: string | null;
    pipeline_id?: string | null;
    period: TargetPeriod;
    period_start: string;
    metric: TargetMetric;
    amount: number;
    currency?: string;
}
