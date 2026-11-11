import type { BadgeVariant } from "@/components/ui/badge";
import type { CycleStatus, FeedbackKind, FeedbackVisibility, GoalStatus, ReviewStatus, ReviewType } from "@/features/people/performance/interfaces/performance.interfaces";
import type { SkillCategory, SkillProficiency } from "@/features/people/skills/interfaces/skills.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const ReviewStatusFormOptions: DropdownOption<ReviewStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "SELF_ASSESSMENT", label: "Self assessment" },
    { id: "MANAGER_ASSESSMENT", label: "Manager assessment" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "COMPLETED", label: "Completed" },
    { id: "ACKNOWLEDGED", label: "Acknowledged" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const ReviewStatusFilterOptions: DropdownOption<ReviewStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ReviewStatusFormOptions];
export const ReviewStatusTone: Record<ReviewStatus, BadgeVariant> = {
    DRAFT: "neutral", SELF_ASSESSMENT: "info", MANAGER_ASSESSMENT: "violet", SUBMITTED: "warning", COMPLETED: "success", ACKNOWLEDGED: "success", CANCELLED: "neutral",
};

export const ReviewTypeFormOptions: DropdownOption<ReviewType>[] = [
    { id: "ANNUAL", label: "Annual" },
    { id: "SEMI_ANNUAL", label: "Semi-annual" },
    { id: "QUARTERLY", label: "Quarterly" },
    { id: "PROBATION", label: "Probation" },
    { id: "PROJECT", label: "Project" },
    { id: "ONE_ON_ONE", label: "One-on-one" },
    { id: "AD_HOC", label: "Ad hoc" },
];

export const CycleStatusFormOptions: DropdownOption<CycleStatus>[] = [
    { id: "PLANNED", label: "Planned" },
    { id: "ACTIVE", label: "Active" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const CycleStatusTone: Record<CycleStatus, BadgeVariant> = { PLANNED: "neutral", ACTIVE: "info", COMPLETED: "success", CANCELLED: "neutral" };

export const GoalStatusFormOptions: DropdownOption<GoalStatus>[] = [
    { id: "NOT_STARTED", label: "Not started" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "AT_RISK", label: "At risk" },
    { id: "ACHIEVED", label: "Achieved" },
    { id: "PARTIALLY_ACHIEVED", label: "Partially achieved" },
    { id: "MISSED", label: "Missed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const GoalStatusTone: Record<GoalStatus, BadgeVariant> = {
    NOT_STARTED: "neutral", IN_PROGRESS: "info", AT_RISK: "warning", ACHIEVED: "success", PARTIALLY_ACHIEVED: "violet", MISSED: "danger", CANCELLED: "neutral",
};

export const FeedbackKindFormOptions: DropdownOption<FeedbackKind>[] = [
    { id: "PEER_FEEDBACK", label: "Peer feedback" },
    { id: "RECOGNITION", label: "Recognition" },
    { id: "ACHIEVEMENT", label: "Achievement" },
    { id: "MANAGER_FEEDBACK", label: "Manager feedback" },
    { id: "PERFORMANCE_NOTE", label: "Performance note" },
    { id: "EMPLOYEE_FEEDBACK", label: "Upward feedback" },
];
export const FeedbackVisibilityFormOptions: DropdownOption<FeedbackVisibility>[] = [
    { id: "MANAGERS_ONLY", label: "Managers only" },
    { id: "EMPLOYEE_VISIBLE", label: "Visible to the employee" },
    { id: "PUBLIC", label: "Public" },
];

export const SkillCategoryFormOptions: DropdownOption<SkillCategory>[] = [
    { id: "TECHNICAL", label: "Technical" },
    { id: "PROGRAMMING_LANGUAGE", label: "Programming language" },
    { id: "FRAMEWORK", label: "Framework" },
    { id: "PLATFORM", label: "Platform" },
    { id: "TOOL", label: "Tool" },
    { id: "DOMAIN", label: "Domain" },
    { id: "SOFT_SKILL", label: "Soft skill" },
    { id: "OTHER", label: "Other" },
];
export const SkillCategoryFilterOptions: DropdownOption<SkillCategory | "all">[] = [{ id: "all", label: "All categories" }, ...SkillCategoryFormOptions];

export const SkillProficiencyFormOptions: DropdownOption<SkillProficiency>[] = [
    { id: "BEGINNER", label: "Beginner" },
    { id: "INTERMEDIATE", label: "Intermediate" },
    { id: "ADVANCED", label: "Advanced" },
    { id: "EXPERT", label: "Expert" },
];
export const SkillProficiencyFilterOptions: DropdownOption<SkillProficiency | "all">[] = [{ id: "all", label: "Any level" }, ...SkillProficiencyFormOptions];
