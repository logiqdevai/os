import type { TimeMember } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type TimeRateKind = "BILLING" | "COST";
export type BillingRateScope = "ORGANIZATION" | "PRODUCT" | "PROJECT" | "MEMBER" | "PROJECT_MEMBER";
export type RateStatusFilter = "active" | "scheduled" | "expired" | "archived" | "all";

export interface BillingRate {
    id: string;
    kind: TimeRateKind;
    scope: BillingRateScope;
    project_id: string | null;
    membership_id: string | null;
    product_id: string | null;
    activity_type_id: string | null;
    name: string | null;
    currency: string;
    hourly_rate: string;
    effective_from: string;
    effective_to: string | null;
    notes: string | null;
    archived_at: string | null;
    project: { id: string; name: string; code: string | null } | null;
    membership: TimeMember | null;
    activity_type: { id: string; name: string } | null;
    product: { id: string; name: string } | null;
    _count: { billed_entries: number; costed_entries: number };
}

export interface BillingRateDto {
    kind?: TimeRateKind;
    scope: BillingRateScope;
    project_id?: string;
    membership_id?: string;
    activity_type_id?: string;
    name?: string;
    currency: string;
    hourly_rate: number;
    effective_from: string;
    effective_to?: string | null;
    notes?: string;
}

export type UpdateBillingRateDto = Partial<Pick<BillingRateDto, "name" | "notes" | "effective_to" | "hourly_rate" | "currency" | "effective_from">>;
