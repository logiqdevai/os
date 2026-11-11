import type {
    ConditionOperator, DeliveryStatus, EventSource, InboundAuthScheme, InboundWebhookStatus, JobKind, JobRunStatus, JobStatus, OutboundWebhookStatus,
    RuleScopeType, RuleStatus, RunMode, RunStatus, StepStatus, TriggerKind, ApprovalDecision,
} from "@/features/automation/interfaces/automation.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for the automation enums (20). Filters spread the form lists. */
export const RuleStatusFormOptions: DropdownOption<RuleStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PUBLISHED", label: "Published" },
    { id: "ARCHIVED", label: "Archived" },
];
export const RuleStatusFilterOptions: DropdownOption<RuleStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...RuleStatusFormOptions];

export const TriggerKindFormOptions: DropdownOption<TriggerKind>[] = [
    { id: "EVENT", label: "When something happens" },
    { id: "SCHEDULE", label: "On a schedule" },
    { id: "MANUAL", label: "Run manually" },
    { id: "INBOUND_WEBHOOK", label: "Inbound webhook" },
    { id: "DATE_RELATIVE", label: "Date-relative" },
];
export const TriggerKindShortOptions: DropdownOption<TriggerKind>[] = [
    { id: "EVENT", label: "Event" },
    { id: "SCHEDULE", label: "Schedule" },
    { id: "MANUAL", label: "Manual" },
    { id: "INBOUND_WEBHOOK", label: "Webhook" },
    { id: "DATE_RELATIVE", label: "Date" },
];
export const TriggerKindFilterOptions: DropdownOption<TriggerKind | "all">[] = [{ id: "all", label: "All triggers" }, ...TriggerKindShortOptions];

export const RuleScopeFormOptions: DropdownOption<RuleScopeType>[] = [
    { id: "ORGANIZATION", label: "Whole organization" },
    { id: "BRANCH", label: "One branch" },
    { id: "TEAM", label: "One team" },
    { id: "PROJECT", label: "One project" },
    { id: "PROJECT_TYPE", label: "Project type" },
];

export const RunStatusFormOptions: DropdownOption<RunStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "RUNNING", label: "Running" },
    { id: "WAITING", label: "Waiting" },
    { id: "AWAITING_APPROVAL", label: "Awaiting approval" },
    { id: "RETRY_SCHEDULED", label: "Retry scheduled" },
    { id: "SUCCEEDED", label: "Succeeded" },
    { id: "FAILED", label: "Failed" },
    { id: "DEAD_LETTERED", label: "Dead-lettered" },
    { id: "SKIPPED", label: "Skipped" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const RunStatusFilterOptions: DropdownOption<RunStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...RunStatusFormOptions];

export const StepStatusOptions: DropdownOption<StepStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "RUNNING", label: "Running" },
    { id: "WAITING", label: "Waiting" },
    { id: "AWAITING_APPROVAL", label: "Awaiting approval" },
    { id: "SUCCEEDED", label: "Succeeded" },
    { id: "FAILED", label: "Failed" },
    { id: "SKIPPED", label: "Skipped" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const RunModeFormOptions: DropdownOption<RunMode>[] = [
    { id: "LIVE", label: "Live" },
    { id: "TEST", label: "Test" },
    { id: "DRY_RUN", label: "Dry run" },
];
export const RunModeFilterOptions: DropdownOption<RunMode | "all">[] = [{ id: "all", label: "All modes" }, ...RunModeFormOptions];

export const ApprovalDecisionOptions: DropdownOption<ApprovalDecision>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const ApprovalDecisionFilterOptions: DropdownOption<ApprovalDecision | "all">[] = [{ id: "all", label: "All decisions" }, ...ApprovalDecisionOptions];

export const ConditionOperatorOptions: DropdownOption<ConditionOperator>[] = [
    { id: "eq", label: "equals" },
    { id: "neq", label: "does not equal" },
    { id: "gt", label: "is greater than" },
    { id: "gte", label: "is at least" },
    { id: "lt", label: "is less than" },
    { id: "lte", label: "is at most" },
    { id: "contains", label: "contains" },
    { id: "not_contains", label: "does not contain" },
    { id: "starts_with", label: "starts with" },
    { id: "ends_with", label: "ends with" },
    { id: "in", label: "is one of (comma separated)" },
    { id: "not_in", label: "is none of" },
    { id: "exists", label: "is set" },
    { id: "not_exists", label: "is empty" },
    { id: "changed", label: "changed" },
];

export const OutboundWebhookStatusOptions: DropdownOption<OutboundWebhookStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "PAUSED", label: "Paused" },
    { id: "DISABLED", label: "Disabled" },
];
export const DeliveryStatusOptions: DropdownOption<DeliveryStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "RETRY_SCHEDULED", label: "Retry scheduled" },
    { id: "SUCCEEDED", label: "Delivered" },
    { id: "FAILED", label: "Failed" },
    { id: "DEAD_LETTERED", label: "Dead-lettered" },
];
export const DeliveryStatusFilterOptions: DropdownOption<DeliveryStatus | "all">[] = [{ id: "all", label: "All deliveries" }, ...DeliveryStatusOptions];
export const InboundWebhookStatusOptions: DropdownOption<InboundWebhookStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "PAUSED", label: "Paused" },
    { id: "REVOKED", label: "Revoked" },
];
export const InboundAuthSchemeOptions: DropdownOption<InboundAuthScheme>[] = [
    { id: "HMAC_SHA256", label: "HMAC-SHA256 signature" },
    { id: "BEARER_TOKEN", label: "Bearer token" },
    { id: "BASIC", label: "Basic auth" },
    { id: "NONE", label: "None (not recommended)" },
];

export const JobKindFormOptions: DropdownOption<JobKind>[] = [
    { id: "CRON", label: "Cron expression" },
    { id: "INTERVAL", label: "Every N seconds" },
    { id: "ONCE", label: "Once" },
];
export const JobStatusOptions: DropdownOption<JobStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "PAUSED", label: "Paused" },
    { id: "DISABLED", label: "Disabled" },
    { id: "COMPLETED", label: "Completed" },
];
export const JobStatusFilterOptions: DropdownOption<JobStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...JobStatusOptions];
export const JobRunStatusOptions: DropdownOption<JobRunStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "RUNNING", label: "Running" },
    { id: "SUCCEEDED", label: "Succeeded" },
    { id: "FAILED", label: "Failed" },
    { id: "SKIPPED", label: "Skipped" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "TIMED_OUT", label: "Timed out" },
];

export const EventSourceOptions: DropdownOption<EventSource>[] = [
    { id: "MODULE", label: "Module" },
    { id: "API", label: "API" },
    { id: "INBOUND_WEBHOOK", label: "Inbound webhook" },
    { id: "SCHEDULED_JOB", label: "Scheduled job" },
    { id: "AUTOMATION", label: "Automation" },
    { id: "SYSTEM", label: "System" },
];
export const EventSourceFilterOptions: DropdownOption<EventSource | "all">[] = [{ id: "all", label: "All sources" }, ...EventSourceOptions];
export const EventStateFilterOptions: DropdownOption<"all" | "matched" | "unmatched" | "failed" | "pending">[] = [
    { id: "all", label: "Any state" },
    { id: "matched", label: "Started workflows" },
    { id: "unmatched", label: "No workflow matched" },
    { id: "pending", label: "Not processed yet" },
    { id: "failed", label: "Processing failed" },
];

/** Quick schedules in the workflow builder. */
export const SchedulePresetOptions: DropdownOption<string>[] = [
    { id: "0 * * * *", label: "Every hour" },
    { id: "0 9 * * *", label: "Every day at 09:00" },
    { id: "0 9 * * 1-5", label: "Weekdays at 09:00" },
    { id: "0 9 * * 1", label: "Every Monday at 09:00" },
    { id: "0 9 1 * *", label: "First day of the month at 09:00" },
    { id: "custom", label: "Custom cron expression" },
];

export const ModuleKeyOptions: DropdownOption<string>[] = [
    { id: "ADMINISTRATION", label: "Administration" },
    { id: "CRM", label: "CRM" },
    { id: "PROPOSALS", label: "Proposals" },
    { id: "CONTRACTS", label: "Contracts" },
    { id: "PROJECTS", label: "Projects" },
    { id: "TASKS", label: "Tasks" },
    { id: "FINANCE", label: "Billing" },
    { id: "INCOME_EXPENSE", label: "Income & expenses" },
    { id: "EMPLOYEES", label: "People" },
    { id: "COMMUNICATION", label: "Campaigns" },
    { id: "MESSAGING", label: "Messages" },
    { id: "SUPPORT", label: "Support" },
    { id: "NOTIFICATIONS", label: "Notifications" },
    { id: "BUSINESS_DOCS", label: "Docs" },
    { id: "DOCUMENTS", label: "Files" },
    { id: "TIME_TRACKING", label: "Time" },
    { id: "CALENDAR", label: "Calendar" },
    { id: "AUTOMATION", label: "Automation" },
    { id: "CUSTOMER_PORTAL", label: "Client portal" },
];
export const ModuleKeyFilterOptions: DropdownOption<string>[] = [{ id: "all", label: "All modules" }, ...ModuleKeyOptions];
