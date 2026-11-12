import type { MemberRef, Paginated } from "@/features/projects/interfaces/projects.interfaces";

export type { MemberRef, Paginated };

export const TaskStatusCategories = {
    BACKLOG: "BACKLOG",
    TODO: "TODO",
    IN_PROGRESS: "IN_PROGRESS",
    IN_REVIEW: "IN_REVIEW",
    BLOCKED: "BLOCKED",
    DONE: "DONE",
    CANCELLED: "CANCELLED",
} as const;
export type TaskStatusCategory = (typeof TaskStatusCategories)[keyof typeof TaskStatusCategories];

export const TaskPriorities = { NONE: "NONE", LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", URGENT: "URGENT" } as const;
export type TaskPriority = (typeof TaskPriorities)[keyof typeof TaskPriorities];

export type TaskCommentVisibility = "INTERNAL" | "CUSTOMER_VISIBLE";
export type TaskDependencyType = "BLOCKS" | "RELATED" | "DUPLICATE_OF";
export type CycleStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type ReleaseStatus = "PLANNED" | "IN_PROGRESS" | "RELEASED" | "CANCELLED";
export type DeploymentStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "ROLLED_BACK";

export interface TaskStatus {
    id: string;
    name: string;
    slug: string;
    category: TaskStatusCategory;
    color: string | null;
    sort_order: number;
    is_default: boolean;
    team_id: string | null;
    allowed_transitions: string[];
    archived_at: string | null;
    _count?: { tasks: number };
}

export interface TaskType {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    is_default: boolean;
    archived_at: string | null;
    _count?: { tasks: number };
}

export interface TaskLabel {
    id: string;
    name: string;
    color: string | null;
    archived_at?: string | null;
    _count?: { assignments: number };
}

export interface TaskRef {
    id: string;
    number: number;
    identifier: string;
    title: string;
    priority: TaskPriority;
    due_date: string | null;
    status: { id: string; name: string; category: TaskStatusCategory; color: string | null } | null;
    assignee: MemberRef | null;
}

export interface Task {
    id: string;
    number: number;
    identifier: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    team_id: string | null;
    project_id: string | null;
    milestone_id: string | null;
    cycle_id: string | null;
    release_id: string | null;
    parent_task_id: string | null;
    status_id: string | null;
    type_id: string | null;
    assignee_membership_id: string | null;
    estimate_points: string | null;
    estimate_hours: string | null;
    start_date: string | null;
    due_date: string | null;
    completed_at: string | null;
    customer_visible: boolean;
    blocked: boolean;
    blocked_reason: string | null;
    rank: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    status: { id: string; name: string; slug: string; category: TaskStatusCategory; color: string | null } | null;
    type: { id: string; name: string; icon: string | null; color: string | null } | null;
    team: { id: string; name: string; task_key: string | null } | null;
    project: { id: string; name: string; color: string | null } | null;
    milestone: { id: string; name: string } | null;
    cycle: { id: string; number: number; name: string | null } | null;
    assignee: MemberRef | null;
    labels: TaskLabel[];
    _count: { subtasks: number; comments: number; checklist_items: number; attachments: number };
}

export interface TaskDetail extends Task {
    project: { id: string; name: string; color: string | null; visibility: string; company: { id: string; name: string } | null } | null;
    reporter: MemberRef | null;
    release: { id: string; name: string; version: string | null } | null;
    parent: TaskRef | null;
    subtasks: TaskRef[];
    assignees: { membership_id: string; membership: MemberRef }[];
    watchers: { membership_id: string; membership: MemberRef }[];
    checklist_items: { id: string; title: string; is_completed: boolean; sort_order: number }[];
    dependencies_from: { id: string; type: TaskDependencyType; target: TaskRef }[];
    dependencies_to: { id: string; type: TaskDependencyType; source: TaskRef }[];
    attachments: { id: string; created_at: string; document: { id: string; title: string | null; filename: string; mimetype: string | null; size: number | null; external_url: string | null; url: string | null } }[];
    workflow_statuses: TaskStatus[];
    is_watching: boolean;
}

export interface TaskComment {
    id: string;
    body: string;
    visibility: TaskCommentVisibility;
    parent_comment_id: string | null;
    author_membership_id: string | null;
    author: MemberRef | null;
    edited_at: string | null;
    created_at: string;
}

export interface TaskActivity {
    status_history: { id: string; changed_at: string; from_status: { name: string } | null; to_status: { name: string; category: TaskStatusCategory } | null; changed_by: MemberRef | null }[];
    events: { id: string; event_type: string; created_at: string; actor: { display_name: string | null; first_name: string | null; last_name: string | null; email: string } | null; changes: Record<string, unknown> | null }[];
}

export interface BoardData {
    team: { id: string; name: string; task_key: string | null } | null;
    statuses: TaskStatus[];
    tasks: Task[];
}

export interface CycleProgress {
    total: number;
    done: number;
    in_progress: number;
    cancelled: number;
    points_total: number;
    points_done: number;
    percent: number;
}

export interface Cycle {
    id: string;
    number: number;
    name: string | null;
    goal: string | null;
    status: CycleStatus;
    starts_at: string;
    ends_at: string;
    completed_at: string | null;
    team: { id: string; name: string; task_key: string | null } | null;
    project: { id: string; name: string } | null;
    progress: CycleProgress;
}

export interface CycleDetail extends Cycle {
    burndown: { date: string; remaining: number | null; ideal: number }[];
    tasks: Task[];
}

export interface ReleaseDeployment {
    id: string;
    environment: string;
    status: DeploymentStatus;
    url: string | null;
    deployed_at: string | null;
    created_at: string;
}

export interface Release {
    id: string;
    name: string;
    version: string | null;
    status: ReleaseStatus;
    target_date: string | null;
    released_at: string | null;
    notes: string | null;
    /** Set when a person published the notes; editing them afterwards makes them a draft again. */
    notes_published_at?: string | null;
    customer_visible: boolean;
    team: { id: string; name: string } | null;
    project: { id: string; name: string; color: string | null } | null;
    deployments: ReleaseDeployment[];
    progress?: { total: number; done: number };
    tasks?: Task[];
}

export interface WorkloadRow {
    open: number;
    in_progress: number;
    overdue: number;
    blocked: number;
    points: number;
    due_this_week: number;
    urgent: number;
}

export interface TaskWorkload {
    people: (WorkloadRow & { membership: MemberRef | null; flags: string[] })[];
    unassigned: WorkloadRow;
    total_open: number;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    team_id?: string;
    project_id?: string;
    milestone_id?: string;
    parent_task_id?: string;
    cycle_id?: string;
    type_id?: string;
    status_id?: string;
    priority?: TaskPriority;
    assignee_membership_id?: string | null;
    label_ids?: string[];
    estimate_points?: number | null;
    start_date?: string | null;
    due_date?: string | null;
    customer_visible?: boolean;
    checklist?: string[];
}

export interface UpdateTaskDto extends Partial<Omit<CreateTaskDto, "checklist" | "project_id" | "cycle_id" | "milestone_id" | "parent_task_id">> {
    project_id?: string | null;
    cycle_id?: string | null;
    milestone_id?: string | null;
    parent_task_id?: string | null;
    blocked?: boolean;
    blocked_reason?: string;
}

/** GET /tasks/reports (06 §11). Days are decimals; medians are null when there is no data. */
export interface TaskReport {
    range: { from: string; to: string };
    truncated: boolean;
    totals: {
        created: number;
        completed: number;
        open: number;
        overdue: number;
        blocked: number;
        median_lead_days: number | null;
        median_cycle_days: number | null;
        avg_cycle_days: number | null;
        throughput_per_week: number;
    };
    weekly: { week_start: string; created: number; completed: number; median_cycle_days: number | null; median_lead_days: number | null }[];
    by_assignee: { membership: MemberRef | null; completed: number; open: number; median_cycle_days: number | null }[];
    by_priority: { priority: TaskPriority; completed: number; open: number }[];
    by_label: { label: { id: string; name: string; color: string | null }; completed: number; open: number }[];
    burnup: {
        cycle: { id: string; number: number; name: string | null; status: CycleStatus; starts_at: string; ends_at: string; team_id: string | null };
        days: { date: string; scope: number; completed: number; scope_points: number; completed_points: number }[];
    } | null;
}

/** POST /releases/:id/notes/draft — AI notes (not saved) or, without AI, a draft grouped from the task list. */
export type ReleaseNotesDraft =
    | { available: true; notes: string; model: string; fallback: string; task_count: number }
    | { available: false; reason: string; message: string; fallback: string; task_count: number };
