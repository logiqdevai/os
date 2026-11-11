import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { ServiceAccountStatus } from "@/features/admin/service-accounts/interfaces/service-accounts.interfaces";
import type { McpToolCallStatus } from "@/features/admin/mcp-calls/interfaces/mcp-calls.interfaces";
import type { AuditActorType, AuditOutcome } from "@/features/admin/audit/interfaces/audit.interfaces";
import type { IntegrationCategory, IntegrationMode, IntegrationStatus } from "@/features/admin/integrations/interfaces/integrations.interfaces";

/** ServiceAccount.status (01 §76). */
export const ServiceAccountStatusFormOptions: DropdownOption<ServiceAccountStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "SUSPENDED", label: "Suspended" },
    { id: "REVOKED", label: "Revoked" },
];
export const ServiceAccountStatusFilterOptions: DropdownOption<ServiceAccountStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...ServiceAccountStatusFormOptions];

/** API key list filter. */
export const ApiKeyStatusFilterOptions: DropdownOption<"all" | "active" | "revoked" | "expired">[] = [
    { id: "all", label: "All keys" },
    { id: "active", label: "Active" },
    { id: "expired", label: "Expired" },
    { id: "revoked", label: "Revoked" },
];

/** API key expiry choices. */
export const ApiKeyExpiryOptions: DropdownOption<"30" | "90" | "180" | "365" | "never">[] = [
    { id: "30", label: "30 days" },
    { id: "90", label: "90 days" },
    { id: "180", label: "180 days" },
    { id: "365", label: "1 year" },
    { id: "never", label: "Never" },
];

/** McpToolCall.status (01 §75). */
export const McpCallStatusFormOptions: DropdownOption<McpToolCallStatus>[] = [
    { id: "AWAITING_CONFIRMATION", label: "Awaiting confirmation" },
    { id: "SUCCEEDED", label: "Succeeded" },
    { id: "FAILED", label: "Failed" },
    { id: "DENIED", label: "Denied" },
    { id: "REJECTED", label: "Rejected" },
    { id: "EXPIRED", label: "Expired" },
];
export const McpCallStatusFilterOptions: DropdownOption<McpToolCallStatus | "all">[] = [{ id: "all", label: "All calls" }, ...McpCallStatusFormOptions];

/** AuditEvent.outcome (01 §139). */
export const AuditOutcomeFormOptions: DropdownOption<AuditOutcome>[] = [
    { id: "SUCCESS", label: "Success" },
    { id: "FAILURE", label: "Failure" },
    { id: "DENIED", label: "Denied" },
];
export const AuditOutcomeFilterOptions: DropdownOption<AuditOutcome | "all">[] = [{ id: "all", label: "Any outcome" }, ...AuditOutcomeFormOptions];

/** AuditEvent.actor_type. */
export const AuditActorTypeFormOptions: DropdownOption<AuditActorType>[] = [
    { id: "USER", label: "Person" },
    { id: "SERVICE_ACCOUNT", label: "Service account" },
    { id: "SYSTEM", label: "System" },
    { id: "PLATFORM_ADMIN", label: "Logiqdev staff" },
];
export const AuditActorTypeFilterOptions: DropdownOption<AuditActorType | "all">[] = [{ id: "all", label: "Any actor" }, ...AuditActorTypeFormOptions];

/** Audit date range presets (days back). */
export const AuditRangeFilterOptions: DropdownOption<"all" | "1" | "7" | "30" | "90">[] = [
    { id: "all", label: "Any time" },
    { id: "1", label: "Last 24 hours" },
    { id: "7", label: "Last 7 days" },
    { id: "30", label: "Last 30 days" },
    { id: "90", label: "Last 90 days" },
];

/** IntegrationConnection.status (01 §157). */
export const IntegrationStatusFormOptions: DropdownOption<IntegrationStatus>[] = [
    { id: "ACTIVE", label: "Connected" },
    { id: "PENDING", label: "Not verified" },
    { id: "ERROR", label: "Error" },
    { id: "DISABLED", label: "Disabled" },
    { id: "DISCONNECTED", label: "Disconnected" },
];

/** IntegrationConnection.category. */
export const IntegrationCategoryFormOptions: DropdownOption<IntegrationCategory>[] = [
    { id: "AI", label: "AI" },
    { id: "EMAIL", label: "Email" },
    { id: "SMS", label: "SMS" },
    { id: "PAYMENTS", label: "Payments" },
];
export const IntegrationCategoryFilterOptions: DropdownOption<IntegrationCategory | "all">[] = [{ id: "all", label: "All categories" }, ...IntegrationCategoryFormOptions];

/** IntegrationConnection.mode. */
export const IntegrationModeFormOptions: DropdownOption<IntegrationMode>[] = [
    { id: "LIVE", label: "Live" },
    { id: "TEST", label: "Test" },
];
