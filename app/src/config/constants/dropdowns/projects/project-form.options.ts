import type {
    ChangeRequestStatus,
    DeliverableStatus,
    ProjectHealth,
    ProjectIssueKind,
    ProjectIssueStatus,
    ProjectItemStatus,
    ProjectPriority,
    ProjectStatusCategory,
    ProjectVisibility,
    RiskStatus,
    Severity,
} from "@/features/projects/interfaces/projects.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for 05 Projects enums. Filter lists spread these. */

export const ProjectHealthFormOptions: DropdownOption<ProjectHealth>[] = [
    { id: "HEALTHY", label: "On track" },
    { id: "AT_RISK", label: "At risk" },
    { id: "BLOCKED", label: "Blocked" },
    { id: "CRITICAL", label: "Off track" },
    { id: "UNKNOWN", label: "No update" },
];
export const ProjectHealthFilterOptions: DropdownOption<ProjectHealth | "all">[] = [{ id: "all", label: "Any health" }, ...ProjectHealthFormOptions];

export const ProjectPriorityFormOptions: DropdownOption<ProjectPriority>[] = [
    { id: "CRITICAL", label: "Critical" },
    { id: "HIGH", label: "High" },
    { id: "MEDIUM", label: "Medium" },
    { id: "LOW", label: "Low" },
];
export const ProjectPriorityFilterOptions: DropdownOption<ProjectPriority | "all">[] = [{ id: "all", label: "Any priority" }, ...ProjectPriorityFormOptions];

export const ProjectVisibilityFormOptions: DropdownOption<ProjectVisibility>[] = [
    { id: "INTERNAL", label: "Internal only" },
    { id: "CUSTOMER_VISIBLE", label: "Visible to the customer" },
];

export const ProjectStatusCategoryFormOptions: DropdownOption<ProjectStatusCategory>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PLANNED", label: "Planned" },
    { id: "NOT_STARTED", label: "Not started" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "ON_HOLD", label: "On hold" },
    { id: "BLOCKED", label: "Blocked" },
    { id: "READY_FOR_COMPLETION", label: "Ready for completion" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "ARCHIVED", label: "Archived" },
];

/** Status-category presets for the project list filter. */
export const ProjectStageFilterOptions: DropdownOption<"all" | "active" | "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED">[] = [
    { id: "active", label: "Active" },
    { id: "all", label: "All stages" },
    { id: "PLANNED", label: "Planned" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "ON_HOLD", label: "On hold" },
    { id: "COMPLETED", label: "Completed" },
];

export const ProjectItemStatusFormOptions: DropdownOption<ProjectItemStatus>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "AT_RISK", label: "At risk" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const ProjectItemStatusFilterOptions: DropdownOption<ProjectItemStatus | "all">[] = [{ id: "all", label: "Any status" }, ...ProjectItemStatusFormOptions];

export const DeliverableStatusFormOptions: DropdownOption<DeliverableStatus>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "READY_FOR_REVIEW", label: "Ready for review" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CANCELLED", label: "Cancelled" },
];
/** Statuses the team may set directly (decisions go through review). */
export const DeliverableEditableStatusOptions = DeliverableStatusFormOptions.filter((o) => ["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CANCELLED"].includes(o.id));

export const SeverityFormOptions: DropdownOption<Severity>[] = [
    { id: "CRITICAL", label: "Critical" },
    { id: "HIGH", label: "High" },
    { id: "MEDIUM", label: "Medium" },
    { id: "LOW", label: "Low" },
];
export const SeverityFilterOptions: DropdownOption<Severity | "all">[] = [{ id: "all", label: "Any severity" }, ...SeverityFormOptions];

export const RiskStatusFormOptions: DropdownOption<RiskStatus>[] = [
    { id: "OPEN", label: "Open" },
    { id: "MONITORING", label: "Monitoring" },
    { id: "MITIGATED", label: "Mitigated" },
    { id: "ACCEPTED", label: "Accepted" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "CLOSED", label: "Closed" },
];

export const IssueKindFormOptions: DropdownOption<ProjectIssueKind>[] = [
    { id: "ISSUE", label: "Issue" },
    { id: "BLOCKER", label: "Blocker" },
];

export const IssueStatusFormOptions: DropdownOption<ProjectIssueStatus>[] = [
    { id: "OPEN", label: "Open" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "CLOSED", label: "Closed" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const ChangeRequestStatusFormOptions: DropdownOption<ChangeRequestStatus>[] = [
    { id: "REQUESTED", label: "Requested" },
    { id: "UNDER_REVIEW", label: "Under review" },
    { id: "ESTIMATING", label: "Estimating" },
    { id: "AWAITING_APPROVAL", label: "Awaiting approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "IMPLEMENTED", label: "Implemented" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const RaidKindOptions: DropdownOption<"risks" | "issues" | "decisions">[] = [
    { id: "risks", label: "Risks" },
    { id: "issues", label: "Issues & blockers" },
    { id: "decisions", label: "Decisions" },
];

/** Workspace tabs of a project. */
export const ProjectTabOptions: DropdownOption<"overview" | "tasks" | "timeline" | "milestones" | "deliverables" | "raid" | "updates" | "governance" | "closeout" | "members" | "settings">[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    { id: "timeline", label: "Timeline" },
    { id: "milestones", label: "Milestones" },
    { id: "deliverables", label: "Deliverables" },
    { id: "raid", label: "RAID" },
    { id: "updates", label: "Updates" },
    { id: "members", label: "Members" },
    { id: "settings", label: "Settings" },
];

/** Semantic color tokens selectable for statuses, labels and projects. */
export const ColorTokenFormOptions: DropdownOption<"neutral" | "info" | "success" | "warning" | "danger" | "violet">[] = [
    { id: "neutral", label: "Gray" },
    { id: "info", label: "Blue" },
    { id: "success", label: "Green" },
    { id: "warning", label: "Amber" },
    { id: "danger", label: "Red" },
    { id: "violet", label: "Violet" },
];

/** Timeline (Gantt) zoom levels. */
export const TimelineZoomOptions: DropdownOption<"week" | "month" | "quarter">[] = [
    { id: "week", label: "Weeks" },
    { id: "month", label: "Months" },
    { id: "quarter", label: "Quarters" },
];

/** Portfolio timeline grouping. */
export const TimelineGroupOptions: DropdownOption<"none" | "customer" | "owner" | "status">[] = [
    { id: "none", label: "No grouping" },
    { id: "customer", label: "Group by customer" },
    { id: "owner", label: "Group by owner" },
    { id: "status", label: "Group by status" },
];

