export type TimeSuggestionSource = "CALENDAR" | "COMMIT" | "TASK_ACTIVITY" | "ATTENDANCE" | "AI";
export type TimeSuggestionStatus = "PENDING" | "ACCEPTED" | "DISMISSED" | "EXPIRED";

export interface TimeSuggestion {
    id: string;
    source: TimeSuggestionSource;
    status: TimeSuggestionStatus;
    date: string;
    start_at: string | null;
    end_at: string | null;
    duration_minutes: number;
    project_id: string | null;
    task_id: string | null;
    activity_type_id: string | null;
    description: string | null;
    is_billable: boolean | null;
    confidence: string | null;
    rationale: string | null;
    project: { id: string; name: string; code: string | null; color: string | null } | null;
    task: { id: string; number: number; title: string; team: { task_key: string | null } | null } | null;
    activity_type: { id: string; name: string } | null;
}

export interface AcceptSuggestionDto {
    duration_minutes?: number;
    project_id?: string | null;
    task_id?: string | null;
    activity_type_id?: string | null;
    description?: string | null;
    is_billable?: boolean;
}
