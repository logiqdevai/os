import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";

export type ReportKey = "pipeline" | "win-loss" | "conversion" | "activity";

export interface ReportParams {
    from?: string;
    to?: string;
    pipeline_id?: string;
    owner?: string;
    team_id?: string;
}

interface OwnerRow {
    owner_membership_id: string | null;
    owner: MemberRef | null;
}

export interface PipelineReport {
    report: "pipeline";
    financials_hidden: boolean;
    currency: string | null;
    pipeline: { id: string; name: string };
    totals: { count: number; value: number | null; weighted: number | null };
    by_stage: { stage_id: string; stage: string; color: string | null; probability: number; count: number; value: number | null; weighted: number | null }[];
    by_owner: (OwnerRow & { count: number; overdue: number; value: number | null; weighted: number | null })[];
}

export interface WinLossReport {
    report: "win-loss";
    financials_hidden: boolean;
    currency: string | null;
    from: string;
    to: string;
    totals: { won: number; lost: number; win_rate: number | null; won_value: number | null; lost_value: number | null; avg_won_value: number | null; avg_sales_cycle_days: number | null };
    by_owner: (OwnerRow & { won: number; lost: number; win_rate: number | null; won_value: number | null })[];
    lost_reasons: { reason: string; count: number; share: number | null; value: number | null }[];
    by_month: { month: string; won: number; lost: number; won_value: number | null }[];
}

export interface ConversionReport {
    report: "conversion";
    from: string;
    to: string;
    totals: { created: number; converted: number; lost: number; open: number; conversion_rate: number | null; avg_days_to_convert: number | null };
    funnel: { step: string; count: number }[];
    by_source: { source: string; created: number; converted: number; lost: number; won: number; conversion_rate: number | null }[];
    by_month: { month: string; created: number; converted: number }[];
}

export interface ActivityReport {
    report: "activity";
    from: string;
    to: string;
    totals: { completed: number; overdue: number; upcoming: number };
    by_type: { type: string; count: number }[];
    by_owner: (OwnerRow & { total: number; counts: Record<string, number> })[];
    by_week: { week: string; completed: number }[];
}

export interface ReportByKey {
    pipeline: PipelineReport;
    "win-loss": WinLossReport;
    conversion: ConversionReport;
    activity: ActivityReport;
}
