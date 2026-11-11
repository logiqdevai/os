export interface RunningTimer {
    id: string;
    membership_id: string;
    project_id: string | null;
    task_id: string | null;
    activity_type_id: string | null;
    description: string | null;
    is_billable: boolean | null;
    started_at: string;
    paused_at: string | null;
    paused_minutes: number;
    elapsed_seconds: number;
    is_paused: boolean;
    project: { id: string; name: string; code: string | null; color: string | null } | null;
    task: { id: string; number: number; title: string; team: { task_key: string | null } | null } | null;
    activity_type: { id: string; name: string; color: string | null } | null;
}

export interface StartTimerDto {
    project_id?: string | null;
    task_id?: string | null;
    activity_type_id?: string | null;
    description?: string | null;
    is_billable?: boolean | null;
    stop_current?: boolean;
}
