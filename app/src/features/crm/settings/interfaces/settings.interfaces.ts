export const SettingKinds = {
    LEAD_SOURCES: "lead-sources",
    LEAD_STATUSES: "lead-statuses",
    LIFECYCLE_STAGES: "lifecycle-stages",
    LOSS_REASONS: "loss-reasons",
} as const;
export type SettingKind = (typeof SettingKinds)[keyof typeof SettingKinds];

export const LossReasonScopes = { DEAL: "DEAL", LEAD: "LEAD", BOTH: "BOTH" } as const;
export type LossReasonScope = (typeof LossReasonScopes)[keyof typeof LossReasonScopes];

export interface SettingOption {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    archived_at: string | null;
    is_default?: boolean;
    color?: string | null;
    is_converted?: boolean;
    is_lost?: boolean;
    is_customer?: boolean;
    applies_to?: LossReasonScope;
}

export interface CrmSettings {
    lead_sources: SettingOption[];
    lead_statuses: SettingOption[];
    lifecycle_stages: SettingOption[];
    loss_reasons: SettingOption[];
}

export interface SettingItemDto {
    name?: string;
    color?: string;
    is_default?: boolean;
    is_converted?: boolean;
    is_lost?: boolean;
    is_customer?: boolean;
    applies_to?: LossReasonScope;
}
