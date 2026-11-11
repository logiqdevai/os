import type { CycleStatus, DeploymentStatus, ReleaseStatus, TaskCommentVisibility, TaskDependencyType, TaskPriority, TaskStatusCategory } from "@/features/tasks/interfaces/tasks.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for 06 Tasks enums. Filter lists spread these. */

export const TaskPriorityFormOptions: DropdownOption<TaskPriority>[] = [
    { id: "URGENT", label: "Urgent" },
    { id: "HIGH", label: "High" },
    { id: "MEDIUM", label: "Medium" },
    { id: "LOW", label: "Low" },
    { id: "NONE", label: "No priority" },
];
export const TaskPriorityFilterOptions: DropdownOption<TaskPriority | "all">[] = [{ id: "all", label: "Any priority" }, ...TaskPriorityFormOptions];

export const TaskStatusCategoryFormOptions: DropdownOption<TaskStatusCategory>[] = [
    { id: "BACKLOG", label: "Backlog" },
    { id: "TODO", label: "Todo" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "IN_REVIEW", label: "In review" },
    { id: "BLOCKED", label: "Blocked" },
    { id: "DONE", label: "Done" },
    { id: "CANCELLED", label: "Canceled" },
];
export const TaskStatusCategoryFilterOptions: DropdownOption<TaskStatusCategory | "all">[] = [{ id: "all", label: "Any status" }, ...TaskStatusCategoryFormOptions];

export const TaskDueFilterOptions: DropdownOption<"all" | "overdue" | "today" | "week" | "none">[] = [
    { id: "all", label: "Any due date" },
    { id: "overdue", label: "Overdue" },
    { id: "today", label: "Due today" },
    { id: "week", label: "Due in 7 days" },
    { id: "none", label: "No due date" },
];

export const TaskGroupByOptions: DropdownOption<"status" | "priority" | "project" | "assignee" | "none">[] = [
    { id: "status", label: "Group by status" },
    { id: "priority", label: "Group by priority" },
    { id: "project", label: "Group by project" },
    { id: "assignee", label: "Group by assignee" },
    { id: "none", label: "No grouping" },
];

export const TaskCommentVisibilityFormOptions: DropdownOption<TaskCommentVisibility>[] = [
    { id: "INTERNAL", label: "Internal" },
    { id: "CUSTOMER_VISIBLE", label: "Visible to customer" },
];

export const TaskDependencyTypeFormOptions: DropdownOption<TaskDependencyType>[] = [
    { id: "BLOCKS", label: "Blocks" },
    { id: "RELATED", label: "Related to" },
    { id: "DUPLICATE_OF", label: "Duplicate of" },
];

export const CycleStatusFormOptions: DropdownOption<CycleStatus>[] = [
    { id: "PLANNED", label: "Upcoming" },
    { id: "ACTIVE", label: "Active" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const ReleaseStatusFormOptions: DropdownOption<ReleaseStatus>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "RELEASED", label: "Released" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const DeploymentStatusFormOptions: DropdownOption<DeploymentStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "IN_PROGRESS", label: "Deploying" },
    { id: "SUCCEEDED", label: "Succeeded" },
    { id: "FAILED", label: "Failed" },
    { id: "ROLLED_BACK", label: "Rolled back" },
];

export const DeploymentEnvironmentOptions: DropdownOption<"development" | "staging" | "production">[] = [
    { id: "development", label: "Development" },
    { id: "staging", label: "Staging" },
    { id: "production", label: "Production" },
];

export const CarryOverOptions: DropdownOption<"next" | "backlog">[] = [
    { id: "next", label: "Move to the next cycle" },
    { id: "backlog", label: "Move back to the backlog" },
];
