export type RetentionDataClass = "AUDIT_EVENTS" | "SESSIONS" | "INVITATIONS" | "WEBHOOK_DELIVERIES";
export type RetentionAction = "ARCHIVE" | "DELETE" | "ANONYMIZE";

/** OrganizationRetentionPolicy (01 §134) as returned by GET /retention-policies (defaults when never saved). */
export interface RetentionPolicy {
    data_class: RetentionDataClass;
    /** null = keep indefinitely. */
    retention_days: number | null;
    action: RetentionAction;
    legal_hold: boolean;
    legal_hold_reason: string | null;
    last_run_at: string | null;
    updated_at: string | null;
    updated_by: { id: string; user: { display_name: string | null; email: string } } | null;
    is_default: boolean;
    allowed_actions: RetentionAction[];
    min_days: number;
    /** Rows older than the period right now (what the next run would touch). */
    eligible: number;
}

export interface RetentionRunResult {
    data_class: RetentionDataClass;
    action: RetentionAction;
    affected: number;
    skipped?: "legal_hold" | "keep_forever" | "archive_not_available";
}
