import type { CommTemplateStatus } from "@/features/communications/interfaces/communications.interfaces";

/** CommTemplateCategory (schema enum). */
export const CommTemplateCategoryFormOptions: { id: string; label: string }[] = [
    { id: "MARKETING_CAMPAIGN", label: "Marketing campaign" },
    { id: "GENERAL_ANNOUNCEMENT", label: "Announcement" },
    { id: "PROJECT_UPDATE", label: "Project update" },
    { id: "DEVELOPMENT_UPDATE", label: "Development update" },
    { id: "FEATURE_RELEASE", label: "Feature release" },
    { id: "MILESTONE_COMPLETION", label: "Milestone completed" },
    { id: "PROJECT_CREATED", label: "Project created" },
    { id: "PROJECT_COMPLETED", label: "Project completed" },
    { id: "WELCOME", label: "Welcome" },
    { id: "CUSTOMER_ONBOARDING", label: "Customer onboarding" },
    { id: "CUSTOMER_FOLLOW_UP", label: "Follow-up" },
    { id: "FEEDBACK_REQUEST", label: "Feedback request" },
    { id: "MEETING_INVITATION", label: "Meeting invitation" },
    { id: "MEETING_REMINDER", label: "Meeting reminder" },
    { id: "APPROVAL_REQUEST", label: "Approval request" },
    { id: "INVOICE_NOTIFICATION", label: "Invoice" },
    { id: "PAYMENT_CONFIRMATION", label: "Payment confirmation" },
    { id: "PAYMENT_REMINDER", label: "Payment reminder" },
    { id: "FAILED_PAYMENT", label: "Failed payment" },
    { id: "SUBSCRIPTION_RENEWAL", label: "Subscription renewal" },
    { id: "CONTRACT_RENEWAL", label: "Contract renewal" },
    { id: "CONTRACT_EXPIRATION_REMINDER", label: "Contract expiry reminder" },
    { id: "MAINTENANCE_ANNOUNCEMENT", label: "Maintenance" },
    { id: "SERVICE_INTERRUPTION", label: "Service interruption" },
    { id: "DOWNTIME_NOTIFICATION", label: "Downtime" },
    { id: "BUG_FIX", label: "Bug fix" },
    { id: "SUPPORT_RESPONSE", label: "Support response" },
    { id: "HOLIDAY_GREETING", label: "Holiday greeting" },
    { id: "NOTIFICATION", label: "Notification" },
    { id: "OTHER", label: "Other" },
];
export const CommTemplateCategoryFilterOptions: { id: string; label: string }[] = [{ id: "all", label: "All categories" }, ...CommTemplateCategoryFormOptions];

export const CommTemplateStatusFormOptions: { id: CommTemplateStatus; label: string }[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "ACTIVE", label: "Published" },
    { id: "ARCHIVED", label: "Archived" },
];
export const CommTemplateStatusFilterOptions: { id: CommTemplateStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...CommTemplateStatusFormOptions];

/** Variables offered by the editor (resolved from CRM / organization data at send time). */
export const CommTemplateVariableOptions: { id: string; label: string }[] = [
    { id: "first_name", label: "First name" },
    { id: "last_name", label: "Last name" },
    { id: "full_name", label: "Full name" },
    { id: "email", label: "Email" },
    { id: "company_name", label: "Company" },
    { id: "job_title", label: "Job title" },
    { id: "organization_name", label: "Your organization" },
    { id: "unsubscribe_url", label: "Unsubscribe link" },
];
