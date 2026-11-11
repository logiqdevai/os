import type { CompanyRef, ContactRef, MemberRef, Money, TagRef } from "../../common/interfaces/crm-common.interfaces";

export const DealStatuses = { OPEN: "OPEN", WON: "WON", LOST: "LOST", ABANDONED: "ABANDONED" } as const;
export type DealStatus = (typeof DealStatuses)[keyof typeof DealStatuses];

export const ForecastCategories = { PIPELINE: "PIPELINE", BEST_CASE: "BEST_CASE", COMMIT: "COMMIT", CLOSED_WON: "CLOSED_WON", CLOSED_LOST: "CLOSED_LOST" } as const;
export type ForecastCategory = (typeof ForecastCategories)[keyof typeof ForecastCategories];

export interface DealStageRef {
    id: string;
    name: string;
    probability: number;
    is_won: boolean;
    is_lost: boolean;
    color: string | null;
    sort_order: number;
    stale_after_days?: number | null;
}

export interface Deal {
    id: string;
    name: string;
    pipeline_id: string;
    stage_id: string;
    company_id: string | null;
    primary_contact_id: string | null;
    owner_membership_id: string | null;
    secondary_owner_membership_id: string | null;
    project_manager_membership_id: string | null;
    team_id: string | null;
    branch_id: string | null;
    status: DealStatus;
    value: Money;
    recurring_value: Money;
    one_time_value: Money;
    discount_amount: Money;
    discount_percent: Money;
    tax_amount: Money;
    currency: string;
    probability: number | null;
    forecast_category: ForecastCategory;
    expected_close_date: string | null;
    actual_close_date: string | null;
    deal_type: string | null;
    lead_source_id: string | null;
    competitor: string | null;
    lost_reason: string | null;
    won_note: string | null;
    next_step: string | null;
    description: string | null;
    stage_entered_at: string;
    last_activity_at: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    company?: CompanyRef | null;
    primary_contact?: ContactRef | null;
    owner?: MemberRef | null;
    stage: DealStageRef;
    pipeline: { id: string; name: string };
    weighted_value?: number | null;
    is_stale?: boolean;
    tags?: TagRef[];
    financials_hidden?: boolean;
}

export interface DealLineItem {
    id: string;
    product_id: string | null;
    name: string;
    description: string | null;
    quantity: string;
    unit_price: string;
    discount_percent: string | null;
    discount_amount: string;
    tax_percent: string | null;
    net_amount: string;
    tax_amount: string;
    gross_amount: string;
    is_recurring: boolean;
    billing_frequency: string | null;
    sort_order: number;
}

export interface DealStageHistory {
    id: string;
    from_stage: { id: string; name: string } | null;
    to_stage: { id: string; name: string };
    changed_at: string;
    duration_seconds: number | null;
}

export interface DealDetail extends Deal {
    secondary_owner?: MemberRef | null;
    project_manager?: MemberRef | null;
    team?: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
    lead_source?: { id: string; name: string } | null;
    loss_reason?: { id: string; name: string } | null;
    contacts: { contact_id: string; role: string | null; contact: ContactRef }[];
    line_items: DealLineItem[];
    stage_history: DealStageHistory[];
    pipeline_stages: DealStageRef[];
    converted_from_leads: { id: string; name: string }[];
    days_in_stage: number;
}

export interface BoardStage extends DealStageRef {
    forecast_category: ForecastCategory;
    deals: Deal[];
    count: number;
    total_value: number | null;
    weighted_value: number | null;
}

export interface DealBoard {
    pipeline: { id: string; name: string; currency: string | null; is_default: boolean };
    stages: BoardStage[];
    totals: { open_count: number; open_value: number | null; weighted_value: number | null };
    financials_hidden: boolean;
}

export interface DealList {
    data: Deal[];
    pagination: { total: number; page: number; limit: number; total_pages: number; has_next: boolean; has_prev: boolean };
    summary: { count: number; total_value: number | null };
}

export interface CreateDealDto {
    name: string;
    pipeline_id?: string;
    stage_id?: string;
    company_id?: string;
    primary_contact_id?: string;
    owner_membership_id?: string;
    value?: number;
    currency?: string;
    probability?: number;
    expected_close_date?: string;
    deal_type?: string;
    lead_source_id?: string;
    competitor?: string;
    next_step?: string;
    description?: string;
}
export type UpdateDealDto = Omit<Partial<CreateDealDto>, "pipeline_id" | "stage_id">;

export interface ChangeStageDto {
    stage_id: string;
    probability?: number;
    lost_reason_id?: string;
    lost_reason?: string;
    competitor?: string;
    won_note?: string;
    actual_close_date?: string;
    /** Won: mark a prospect company as customer (default true). */
    set_customer?: boolean;
}

export interface LineItemInput {
    name: string;
    description?: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_percent?: number;
    is_recurring?: boolean;
    billing_frequency?: string;
}
