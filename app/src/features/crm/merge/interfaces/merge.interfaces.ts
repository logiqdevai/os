import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";

export type MergeEntity = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD" | "CRM_DEAL";
export type DuplicateEntity = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD";

export interface DuplicateRecord {
    id: string;
    label: string;
    sub: string;
    created_at: string;
    owner: MemberRef | null;
}

export interface DuplicatePair {
    records: [DuplicateRecord, DuplicateRecord];
    reasons: string[];
    score: number;
}

export interface DuplicatesResult {
    entity_type: DuplicateEntity;
    total: number;
    min_score: number;
    match_keys: string[];
    can_merge: boolean;
    data: DuplicatePair[];
}

export interface DuplicateRule {
    id: string | null;
    entity_type: DuplicateEntity;
    match_keys: string[];
    min_score: number;
    auto_check: boolean;
    enabled: boolean;
}

export interface MergeFieldComparison {
    field: string;
    values: { record_id: string; value: unknown; label: string | null }[];
    differs: boolean;
    suggested_record_id: string;
}

export interface MergePreview {
    entity_type: MergeEntity;
    records: { id: string; label: string; created_at: string; updated_at: string; archived_at: string | null; custom_fields: Record<string, unknown> }[];
    fields: MergeFieldComparison[];
    moves: Record<string, number>;
    can_assign: boolean;
}

export interface MergeDto {
    entity_type: MergeEntity;
    survivor_id: string;
    merged_ids: string[];
    field_choices: Record<string, string>;
    expected_updated_at?: Record<string, string>;
}

export interface MergeResult {
    survivor_id: string;
    merged_ids: string[];
    moved_counts: Record<string, number>;
    kept_on_merged: string[];
}
