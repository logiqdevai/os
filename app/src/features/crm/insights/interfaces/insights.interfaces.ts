import type { CompanyRef, MemberRef, Money } from "../../common/interfaces/crm-common.interfaces";
import type { ActivityType, Priority } from "../../activities/interfaces/activities.interfaces";

export interface CrmDashboard {
    currency: string | null;
    financials_hidden: boolean;
    kpis: {
        open_deals: number;
        pipeline_value: number | null;
        weighted_value: number | null;
        won_this_month: number;
        won_value_this_month: number | null;
        lost_this_month: number;
        win_rate_90d: number | null;
        avg_won_deal_90d: number | null;
        lead_conversion_90d: number | null;
        new_leads_this_month: number;
    };
    pipeline: { id: string; name: string; stages: { id: string; name: string; color: string | null; probability: number; count: number; value: number | null }[] };
    won_by_month: { month: string; count: number; value: number | null }[];
    closing_soon: {
        id: string;
        name: string;
        value: Money;
        currency: string;
        probability: number | null;
        expected_close_date: string | null;
        company: CompanyRef | null;
        stage: { id: string; name: string; color: string | null };
        owner: MemberRef | null;
        is_overdue: boolean;
    }[];
    my_activities: { id: string; type: ActivityType; title: string; starts_at: string | null; priority: Priority; deal: { id: string; name: string } | null; company: { id: string; name: string } | null; is_overdue: boolean }[] | null;
}

export interface ForecastDeal {
    id: string;
    name: string;
    value: Money;
    currency: string;
    probability: number | null;
    forecast_category: string;
    expected_close_date: string | null;
    stage: { name: string; probability: number };
    company: { id: string; name: string } | null;
    owner: MemberRef | null;
}

export interface ForecastBucket {
    key: string;
    label: string;
    from: string | null;
    count: number;
    total: number | null;
    weighted: number | null;
    commit: number | null;
    best_case: number | null;
    pipeline: number | null;
    won: number | null;
    won_count: number;
    deals: ForecastDeal[];
}

export interface CrmForecast {
    currency: string | null;
    financials_hidden: boolean;
    buckets: ForecastBucket[];
    totals: { count: number; total: number | null; weighted: number | null; commit: number | null; won: number | null };
}
