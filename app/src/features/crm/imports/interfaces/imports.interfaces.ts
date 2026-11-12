import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";

export type ImportEntity = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD" | "CRM_DEAL";
/** Prisma `CrmImportStatus`. */
export type ImportStatus = "PENDING" | "VALIDATING" | "PREVIEW" | "IMPORTING" | "COMPLETED" | "FAILED" | "ROLLED_BACK";
export type DuplicateMode = "skip" | "update" | "create";
export type RowPlan = "create" | "update" | "skip" | "error";

export interface DuplicateStrategy {
    mode: DuplicateMode;
    match_key: string;
}

export interface ImportTargetField {
    key: string;
    label: string;
    required: boolean;
    kind: string;
}

export interface ImportRowResult {
    row: number;
    plan: RowPlan;
    message?: string;
    label?: string;
    existing_id?: string;
}

export interface ImportJob {
    id: string;
    entity_type: ImportEntity;
    status: ImportStatus;
    file_name: string | null;
    field_mapping: Record<string, string> | null;
    duplicate_strategy: DuplicateStrategy | null;
    total_rows: number;
    imported_rows: number;
    updated_rows: number;
    skipped_rows: number;
    error_rows: number;
    processed_rows: number;
    created_count: number;
    started_by: MemberRef | null;
    started_at: string | null;
    completed_at: string | null;
    rolled_back_at: string | null;
    created_at: string;
    preview_summary: Record<RowPlan, number> | null;
    error_sample: ImportRowResult[];
    /** PREVIEW only: the first rows plus every error row of the last preview. */
    preview_rows?: ImportRowResult[];
    file: { headers: string[]; sample: string[][] } | null;
    target?: { fields: ImportTargetField[]; match_keys: { key: string; label: string }[] };
}

export type ImportJobListItem = Omit<ImportJob, "file" | "target" | "error_sample" | "preview_rows" | "preview_summary" | "processed_rows" | "created_count" | "field_mapping">;

export interface ImportPreview {
    summary: Record<RowPlan, number>;
    rows: ImportRowResult[];
    total_rows: number;
}

export interface SavedImportMapping {
    id: string;
    name: string;
    entity_type: ImportEntity;
    field_mapping: Record<string, string>;
    duplicate_strategy: DuplicateStrategy | null;
}
