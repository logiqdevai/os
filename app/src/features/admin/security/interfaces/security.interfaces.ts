export const MfaPolicies = {
    OPTIONAL: "OPTIONAL",
    REQUIRED_FOR_ADMINS: "REQUIRED_FOR_ADMINS",
    REQUIRED_FOR_ALL: "REQUIRED_FOR_ALL",
    REQUIRED_FOR_SENSITIVE_MODULES: "REQUIRED_FOR_SENSITIVE_MODULES",
} as const;
export type MfaPolicy = (typeof MfaPolicies)[keyof typeof MfaPolicies];

export type InvitationPolicy = "PERMISSION_HOLDERS" | "ADMINS_ONLY";

/** OrganizationSecurityPolicy (01 §72–74). Durations are minutes. */
export interface SecurityPolicy {
    organization_id: string;
    mfa_policy: MfaPolicy;
    portal_mfa_policy: MfaPolicy;
    password_min_length: number;
    password_require_symbols: boolean;
    password_max_age_days: number | null;
    session_duration_minutes: number;
    idle_timeout_minutes: number | null;
    allowed_email_domains: string[];
    restrict_invitations_to_domains: boolean;
    allowed_ip_ranges: string[];
    allowed_countries: string[];
    invitation_policy: InvitationPolicy;
    members_can_view_sessions: boolean;
    sso_required: boolean;
    updated_at: string | null;
    /** True when the organization never saved a policy (defaults apply). */
    is_default: boolean;
    context: { caller_ip: string | null; sso_enabled: boolean; verified_domains: number };
}

export type UpdateSecurityPolicyDto = Partial<Omit<SecurityPolicy, "organization_id" | "updated_at" | "is_default" | "context">>;
