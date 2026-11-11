import type {
    CustomFormFieldType, CustomFormKind, CustomFormStatus, FormSubmissionStatus, WikiChecklistAssigneeKind, WikiChecklistItemStatus, WikiChecklistKind,
    WikiChecklistRunStatus, WikiPageStatus, WikiPageType, WikiSpaceKind, WikiVisibility,
} from "@/features/docs/interfaces/docs.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for Business Docs enums (15). */
export const WikiSpaceKindFormOptions: DropdownOption<WikiSpaceKind>[] = [
    { id: "TOPIC", label: "Topic" },
    { id: "DEPARTMENT", label: "Department" },
    { id: "TEAM", label: "Team" },
    { id: "BRANCH", label: "Branch" },
    { id: "PROJECT", label: "Project" },
];
export const WikiSpaceKindFilterOptions: DropdownOption<WikiSpaceKind | "all">[] = [{ id: "all", label: "All kinds" }, ...WikiSpaceKindFormOptions];

export const WikiPageStatusOptions: DropdownOption<WikiPageStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PUBLISHED", label: "Published" },
    { id: "NEEDS_REVIEW", label: "Needs review" },
    { id: "ARCHIVED", label: "Archived" },
];

export const WikiPageTypeFormOptions: DropdownOption<WikiPageType>[] = [
    { id: "GENERAL", label: "Page" },
    { id: "POLICY", label: "Policy" },
    { id: "PROCEDURE", label: "Procedure" },
    { id: "RUNBOOK", label: "Runbook" },
    { id: "MEETING_NOTES", label: "Meeting notes" },
    { id: "DECISION_RECORD", label: "Decision record" },
    { id: "HANDBOOK_CHAPTER", label: "Handbook chapter" },
    { id: "ONBOARDING_GUIDE", label: "Onboarding guide" },
    { id: "OFFBOARDING_GUIDE", label: "Offboarding guide" },
    { id: "FAQ", label: "FAQ" },
];

export const WikiVisibilityFormOptions: DropdownOption<WikiVisibility>[] = [
    { id: "ORGANIZATION", label: "Everyone in the organization" },
    { id: "BRANCH", label: "A branch" },
    { id: "TEAM", label: "A team" },
    { id: "ROLE", label: "A role" },
    { id: "MEMBERS", label: "Space members only" },
];

export const WikiChecklistKindFormOptions: DropdownOption<WikiChecklistKind>[] = [
    { id: "ONBOARDING", label: "Onboarding" },
    { id: "OFFBOARDING", label: "Offboarding" },
];
export const WikiChecklistKindFilterOptions: DropdownOption<WikiChecklistKind | "all">[] = [{ id: "all", label: "All kinds" }, ...WikiChecklistKindFormOptions];

export const WikiChecklistAssigneeFormOptions: DropdownOption<WikiChecklistAssigneeKind>[] = [
    { id: "SUBJECT", label: "The new / leaving member" },
    { id: "MANAGER", label: "Their manager" },
    { id: "CHECKLIST_OWNER", label: "Checklist owner" },
    { id: "SPECIFIC_MEMBER", label: "A specific member" },
];

export const WikiChecklistRunStatusOptions: DropdownOption<WikiChecklistRunStatus>[] = [
    { id: "NOT_STARTED", label: "Not started" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const WikiChecklistRunStatusFilterOptions: DropdownOption<WikiChecklistRunStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...WikiChecklistRunStatusOptions];

export const WikiChecklistItemStatusOptions: DropdownOption<WikiChecklistItemStatus>[] = [
    { id: "PENDING", label: "To do" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "COMPLETED", label: "Done" },
    { id: "SKIPPED", label: "Skipped" },
];

export const CustomFormKindFormOptions: DropdownOption<CustomFormKind>[] = [
    { id: "CUSTOM", label: "Custom" },
    { id: "FEEDBACK_SURVEY", label: "Feedback survey" },
    { id: "CHECK_IN", label: "Check-in" },
    { id: "EQUIPMENT_REQUEST", label: "Equipment request" },
    { id: "INCIDENT_REPORT", label: "Incident report" },
    { id: "COMPLIANCE_ACKNOWLEDGEMENT", label: "Compliance acknowledgement" },
    { id: "EXIT_INTERVIEW", label: "Exit interview" },
];

export const CustomFormStatusOptions: DropdownOption<CustomFormStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PUBLISHED", label: "Open" },
    { id: "CLOSED", label: "Closed" },
    { id: "ARCHIVED", label: "Archived" },
];
export const CustomFormStatusFilterOptions: DropdownOption<CustomFormStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...CustomFormStatusOptions];

export const CustomFormFieldTypeOptions: DropdownOption<CustomFormFieldType>[] = [
    { id: "SHORT_TEXT", label: "Short text" },
    { id: "LONG_TEXT", label: "Long text" },
    { id: "NUMBER", label: "Number" },
    { id: "EMAIL", label: "Email" },
    { id: "SINGLE_CHOICE", label: "Single choice" },
    { id: "MULTI_CHOICE", label: "Multiple choice" },
    { id: "CHECKBOX", label: "Checkbox" },
    { id: "SCALE", label: "Scale" },
    { id: "DATE", label: "Date" },
    { id: "SECTION", label: "Section heading" },
];

export const FormSubmissionStatusOptions: DropdownOption<FormSubmissionStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "SUBMITTED", label: "Submitted" },
    { id: "UNDER_REVIEW", label: "Under review" },
    { id: "REVIEWED", label: "Reviewed" },
    { id: "REJECTED", label: "Rejected" },
];
