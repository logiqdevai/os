export type EmployeeImportStatus = "PENDING" | "VALIDATING" | "PREVIEW" | "IMPORTING" | "COMPLETED" | "FAILED";

export interface ImportRowError {
    row: number;
    field?: string;
    message: string;
}

export interface EmployeeImportJob {
    id: string;
    status: EmployeeImportStatus;
    file_name: string | null;
    mapping: { columns: Record<string, string>; update_existing: boolean } | null;
    total_rows: number;
    created_rows: number;
    updated_rows: number;
    skipped_rows: number;
    error_rows: number;
    errors: ImportRowError[] | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

export interface ImportField {
    key: string;
    label: string;
    required?: boolean;
}

export interface EmployeeImportDetail extends EmployeeImportJob {
    columns: string[];
    sample: string[][];
    fields: ImportField[];
}

export interface EmployeeImportPreview {
    counts: { create: number; update: number; skip: number; errors: number; total: number };
    errors: ImportRowError[];
    preview: ({ row: number; action: "create" | "update" | "skip"; email: string; manager_email?: string } & Record<string, unknown>)[];
}
