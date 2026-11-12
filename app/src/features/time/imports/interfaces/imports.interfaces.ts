import type { TimeMember } from "@/features/time/settings/interfaces/time-settings.interfaces";

export type TimeImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface TimeImportJob {
    id: string;
    status: TimeImportStatus;
    mapping: { file_name?: string; columns?: Record<string, string> } | null;
    total_rows: number;
    imported_rows: number;
    skipped_rows: number;
    failed_rows: number;
    errors: { row: number; field?: string; message: string }[] | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    created_by: TimeMember | null;
}

export interface TimeImportDetail extends TimeImportJob {
    file_name: string | null;
    columns: string[];
    sample: string[][];
    fields: { key: string; label: string; required?: boolean }[];
}

export interface TimeImportPreview {
    counts: { total: number; valid: number; errors: number; minutes: number };
    errors: { row: number; field?: string; message: string }[];
    preview: ({ row: number; date?: string; duration_minutes?: number; description?: string } & Record<string, unknown>)[];
}
