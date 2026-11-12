import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { InvitationPolicy, MfaPolicy } from "@/features/admin/security/interfaces/security.interfaces";

/** MfaPolicy (01 §74). */
export const MfaPolicyFormOptions: DropdownOption<MfaPolicy>[] = [
    { id: "OPTIONAL", label: "Optional" },
    { id: "REQUIRED_FOR_ADMINS", label: "Required for admins" },
    { id: "REQUIRED_FOR_ALL", label: "Required for everyone" },
    { id: "REQUIRED_FOR_SENSITIVE_MODULES", label: "Required for sensitive modules" },
];

/** Customer portal users get the lighter choice set. */
export const PortalMfaPolicyFormOptions = MfaPolicyFormOptions.filter((o) => o.id === "OPTIONAL" || o.id === "REQUIRED_FOR_ALL");

/** InvitationPolicy (01 §73) — who may send invitations. */
export const InvitationPolicyFormOptions: DropdownOption<InvitationPolicy>[] = [
    { id: "PERMISSION_HOLDERS", label: "Anyone with the invite permission" },
    { id: "ADMINS_ONLY", label: "Administrators only" },
];

/** Session lifetime choices, stored in minutes (OrganizationSecurityPolicy.session_duration_minutes). */
export const SessionDurationOptions: DropdownOption<string>[] = [
    { id: "60", label: "1 hour" },
    { id: "480", label: "8 hours" },
    { id: "1440", label: "1 day" },
    { id: "10080", label: "7 days" },
    { id: "20160", label: "14 days" },
    { id: "43200", label: "30 days" },
    { id: "129600", label: "90 days" },
];

/** Idle timeout choices in minutes; "none" = no idle timeout. */
export const IdleTimeoutOptions: DropdownOption<string>[] = [
    { id: "none", label: "No idle timeout" },
    { id: "15", label: "15 minutes" },
    { id: "30", label: "30 minutes" },
    { id: "60", label: "1 hour" },
    { id: "120", label: "2 hours" },
    { id: "240", label: "4 hours" },
    { id: "480", label: "8 hours" },
];

/** Password max age in days; "none" = never expires. */
export const PasswordMaxAgeOptions: DropdownOption<string>[] = [
    { id: "none", label: "Never" },
    { id: "30", label: "30 days" },
    { id: "60", label: "60 days" },
    { id: "90", label: "90 days" },
    { id: "180", label: "180 days" },
    { id: "365", label: "1 year" },
];
