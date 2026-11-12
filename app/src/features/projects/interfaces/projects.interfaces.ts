import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

/** Membership + user as returned by the API (MEMBER_SELECT). */
export interface MemberRef {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export const ProjectStatusCategories = {
    DRAFT: "DRAFT",
    PLANNED: "PLANNED",
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    ON_HOLD: "ON_HOLD",
    BLOCKED: "BLOCKED",
    READY_FOR_COMPLETION: "READY_FOR_COMPLETION",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
    ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatusCategory = (typeof ProjectStatusCategories)[keyof typeof ProjectStatusCategories];

export const ProjectHealths = { HEALTHY: "HEALTHY", AT_RISK: "AT_RISK", BLOCKED: "BLOCKED", CRITICAL: "CRITICAL", UNKNOWN: "UNKNOWN" } as const;
export type ProjectHealth = (typeof ProjectHealths)[keyof typeof ProjectHealths];

export const ProjectPriorities = { CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" } as const;
export type ProjectPriority = (typeof ProjectPriorities)[keyof typeof ProjectPriorities];

export type ProjectVisibility = "INTERNAL" | "CUSTOMER_VISIBLE";
export type ProjectItemStatus = "PLANNED" | "IN_PROGRESS" | "AT_RISK" | "COMPLETED" | "CANCELLED";
export type DeliverableStatus = "PLANNED" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "SUBMITTED" | "CHANGES_REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskStatus = "OPEN" | "MONITORING" | "MITIGATED" | "ACCEPTED" | "RESOLVED" | "CLOSED";
export type ProjectIssueKind = "ISSUE" | "BLOCKER";
export type ProjectIssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";
export type ChangeRequestStatus = "REQUESTED" | "UNDER_REVIEW" | "ESTIMATING" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "SCHEDULED" | "IMPLEMENTED" | "CANCELLED";

export interface ProjectStatus {
    id: string;
    name: string;
    slug: string;
    category: ProjectStatusCategory;
    color: string | null;
    sort_order: number;
    is_default: boolean;
    allowed_transitions: string[];
    archived_at: string | null;
    _count?: { projects: number };
}

export interface ProjectType {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_default: boolean;
    archived_at: string | null;
    _count?: { projects: number };
}

export interface TemplateStructure {
    milestones?: { key?: string; name: string; offset_days?: number; customer_visible?: boolean; is_billing_milestone?: boolean }[];
    workstreams?: { name: string }[];
    deliverables?: { name: string; milestone_key?: string; customer_visible?: boolean }[];
    tasks?: { title: string; milestone_key?: string; priority?: string; estimate_points?: number }[];
    checklists?: { name: string; phase?: string; items?: string[] }[];
}

export interface ProjectTemplate {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    type: { id: string; name: string } | null;
    current_version: { id: string; version_number: number; structure: TemplateStructure; created_at: string } | null;
    _count?: { projects: number; versions: number };
}

export interface ProjectListItem {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    color: string | null;
    health: ProjectHealth;
    health_reason: string | null;
    progress_percent: number;
    priority: ProjectPriority;
    visibility: ProjectVisibility;
    planned_start: string | null;
    target_completion: string | null;
    budget_hours: string | null;
    budget_amount: string | null;
    currency: string | null;
    archived_at: string | null;
    completed_at: string | null;
    updated_at: string;
    status: { id: string; name: string; category: ProjectStatusCategory; color: string | null } | null;
    type: { id: string; name: string } | null;
    company: { id: string; name: string } | null;
    owner: MemberRef | null;
    team: { id: string; name: string; task_key: string | null } | null;
    is_favorite: boolean;
    task_counts: { total: number; done: number };
    next_milestone: { id: string; name: string; planned_date: string; overdue: boolean } | null;
    _count?: { members: number };
}

export interface ProjectMember {
    id: string;
    membership_id: string;
    role_label: string | null;
    allocation_percent: number | null;
    joined_at: string;
    membership: MemberRef;
    role: { id: string; name: string } | null;
}

export interface ProjectDetail extends ProjectListItem {
    status_id: string | null;
    type_id: string | null;
    company_id: string | null;
    owner_membership_id: string | null;
    team_id: string | null;
    health_mode: string;
    progress_mode: string;
    actual_start: string | null;
    customer_deadline: string | null;
    internal_deadline: string | null;
    reopened_at: string | null;
    branch: { id: string; name: string } | null;
    template: { id: string; name: string } | null;
    members: ProjectMember[];
    allowed_statuses: { id: string; name: string; slug: string; category: ProjectStatusCategory; color: string | null }[];
    summary: {
        tasks: { total: number; done: number; in_progress: number; open: number; overdue: number };
        milestones: { total: number; completed: number; overdue: number; next: { id: string; name: string; planned_date: string | null } | null };
        open_risks: number;
        open_issues: number;
        open_blockers: number;
        pending_change_requests: number;
        logged_hours: number;
        latest_update: { id: string; summary: string; health: ProjectHealth | null; published_at: string; progress_percent: number | null } | null;
    };
}

export interface Milestone {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    status: ProjectItemStatus;
    planned_date: string | null;
    actual_date: string | null;
    progress_percent: number;
    customer_visible: boolean;
    is_billing_milestone: boolean;
    owner_membership_id: string | null;
    owner: MemberRef | null;
    overdue?: boolean;
    completed_at: string | null;
    project?: { id: string; name: string; color: string | null; company?: { id: string; name: string } | null };
    _count?: { tasks: number; deliverables: number };
}

export interface Deliverable {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    status: DeliverableStatus;
    due_date: string | null;
    customer_visible: boolean;
    approval_mode: "ANY_ONE" | "ALL";
    milestone_id: string | null;
    milestone: { id: string; name: string } | null;
    owner_membership_id: string | null;
    owner: MemberRef | null;
    submitted_at: string | null;
    accepted_at: string | null;
    reviews?: { id: string; decision: DeliverableStatus; comment: string | null; decided_at: string; reviewer: MemberRef | null }[];
}

export interface Risk {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    probability: number | null;
    impact: number | null;
    severity: Severity;
    status: RiskStatus;
    mitigation: string | null;
    due_date: string | null;
    owner_membership_id: string | null;
    owner: MemberRef | null;
    created_at: string;
    project?: { id: string; name: string; color: string | null };
}

export interface Issue {
    id: string;
    project_id: string;
    kind: ProjectIssueKind;
    title: string;
    description: string | null;
    severity: Severity;
    priority: ProjectPriority;
    status: ProjectIssueStatus;
    target_resolution: string | null;
    resolution: string | null;
    owner_membership_id: string | null;
    owner: MemberRef | null;
    identified_at: string;
    project?: { id: string; name: string; color: string | null };
}

export interface Decision {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    decided_at: string;
    selected_option: string | null;
    reason: string | null;
    decision_maker_membership_id: string | null;
    owner: MemberRef | null;
    project?: { id: string; name: string; color: string | null };
}

export interface StatusUpdate {
    id: string;
    project_id: string;
    summary: string;
    completed_work: string | null;
    current_work: string | null;
    upcoming_work: string | null;
    risks_summary: string | null;
    blockers_summary: string | null;
    progress_percent: number | null;
    health: ProjectHealth | null;
    customer_visible: boolean;
    published_at: string | null;
    created_at: string;
    owner: MemberRef | null;
}

export interface ChangeRequest {
    id: string;
    project_id: string;
    number: number;
    title: string;
    description: string | null;
    priority: ProjectPriority;
    status: ChangeRequestStatus;
    timeline_impact_days: number | null;
    cost_impact_amount: string | null;
    currency: string | null;
    customer_visible: boolean;
    requested_at: string;
    rejected_reason: string | null;
    owner: MemberRef | null;
}

export interface Allocation {
    id: string;
    project_id: string;
    membership_id: string | null;
    role_label: string | null;
    allocation_percent: number | null;
    planned_hours: string | null;
    start_date: string | null;
    end_date: string | null;
    membership: MemberRef | null;
}

export interface PortfolioSummary {
    totals: {
        projects: number;
        active: number;
        on_track: number;
        at_risk: number;
        critical: number;
        unknown_health: number;
        completed: number;
        overdue_milestones: number;
        overdue_tasks: number;
        open_blockers: number;
        budget_hours: number;
        logged_hours: number;
    };
    by_status_category: Record<string, number>;
    by_health: Record<string, number>;
    at_risk: (Pick<ProjectListItem, "id" | "name" | "color" | "health" | "health_reason" | "progress_percent" | "target_completion" | "company" | "owner"> & { status: { name: string; category: ProjectStatusCategory } | null })[];
    upcoming_milestones: (Pick<Milestone, "id" | "name" | "planned_date" | "status" | "is_billing_milestone"> & { project: { id: string; name: string; color: string | null } })[];
    overdue_milestones: (Pick<Milestone, "id" | "name" | "planned_date" | "status"> & { project: { id: string; name: string; color: string | null } })[];
    budget: { project: { id: string; name: string; color: string | null }; budget_hours: number; logged_hours: number; burn_percent: number; budget_amount: string | null; currency: string | null }[];
}

export interface WorkloadPerson {
    membership: MemberRef;
    total_percent: number;
    total_hours: number;
    open_tasks: number;
    over_allocated: boolean;
    projects: { project: { id: string; name: string; color: string | null }; allocation_percent: number | null; planned_hours: number | null; role_label: string | null; source: "allocation" | "member" }[];
}

export interface CreateProjectDto {
    name: string;
    code?: string;
    description?: string;
    type_id?: string;
    status_id?: string;
    company_id?: string;
    owner_membership_id?: string;
    team_id?: string;
    template_id?: string;
    priority?: ProjectPriority;
    visibility?: ProjectVisibility;
    health?: ProjectHealth;
    health_reason?: string;
    planned_start?: string;
    target_completion?: string;
    budget_hours?: number;
    budget_amount?: number;
    currency?: string;
    member_ids?: string[];
}
export type UpdateProjectDto = Partial<Omit<CreateProjectDto, "template_id">>;

/** Child kinds of a project (API path segment). */
export type ProjectChildKind = "milestones" | "workstreams" | "deliverables" | "risks" | "issues" | "decisions" | "dependencies" | "status-updates" | "change-requests" | "allocations";

// --- Timeline (05 §24–26) ----------------------------------------------------------------------

export type DependencyItemType = "PROJECT" | "WORKSTREAM" | "MILESTONE" | "DELIVERABLE" | "TASK" | "EXTERNAL";

export interface TimelineMilestone {
    id: string;
    project_id: string;
    workstream_id: string | null;
    name: string;
    planned_date: string | null;
    actual_date: string | null;
    status: ProjectItemStatus;
    progress_percent: number;
    is_billing_milestone: boolean;
    customer_visible: boolean;
}

export interface TimelineWorkstream {
    id: string;
    project_id: string;
    name: string;
    planned_start: string | null;
    planned_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    status: ProjectItemStatus;
    progress_percent: number;
    color: string | null;
}

export interface TimelineDependency {
    id: string;
    project_id: string;
    source_type: DependencyItemType;
    source_id: string;
    target_type: DependencyItemType;
    target_id: string;
    type: string;
    status: string;
    lag_days: number | null;
}

export interface TimelineProject {
    id: string;
    name: string;
    code: string | null;
    color: string | null;
    health: ProjectHealth;
    progress_percent: number;
    planned_start: string | null;
    target_completion: string | null;
    actual_start: string | null;
    actual_completion: string | null;
    status: { id: string; name: string; category: ProjectStatusCategory } | null;
    company?: { id: string; name: string } | null;
    owner?: MemberRef | null;
}

export interface PortfolioTimeline {
    projects: TimelineProject[];
    milestones: TimelineMilestone[];
    workstreams: TimelineWorkstream[];
    dependencies: TimelineDependency[];
}

export interface TimelineTask {
    id: string;
    identifier: string;
    title: string;
    start_date: string | null;
    due_date: string | null;
    workstream_id: string | null;
    milestone_id: string | null;
    priority: string;
    completed_at: string | null;
    status: { id: string; name: string; category: string } | null;
    assignee: MemberRef | null;
}

export interface ProjectTimeline {
    project: TimelineProject;
    milestones: TimelineMilestone[];
    workstreams: TimelineWorkstream[];
    dependencies: TimelineDependency[];
    tasks: TimelineTask[];
    task_dependencies: { id: string; source_task_id: string; target_task_id: string; type: string }[];
    unscheduled_tasks: TimelineTask[];
    tasks_visible: boolean;
}

