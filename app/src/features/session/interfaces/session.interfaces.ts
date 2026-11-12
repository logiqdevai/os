export interface SessionUser {
    id: string;
    email: string;
    role: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    profile_photo_url: string | null;
    /** Mobile number (E.164) for SMS notifications. */
    phone?: string | null;
    timezone: string | null;
    locale: string | null;
    default_organization_id: string | null;
    preferences?: { theme?: string | null } | null;
    mfa_enabled?: boolean;
}

/** Why the organization requires MFA for this person (01 §74). */
export type MfaRequiredReason = "ALL" | "ADMIN" | "SENSITIVE" | "PORTAL";

export interface SessionMfa {
    enabled: boolean;
    required: boolean;
    required_reason: MfaRequiredReason | null;
    /** Required but not set up yet: the app shows only the enrolment screen. */
    enrollment_required: boolean;
}

export interface SessionOrganization {
    id: string;
    display_name: string;
    slug: string;
    logo_url: string | null;
    default_currency: string;
    default_timezone: string;
    membership_id: string;
    job_title?: string | null;
    default_branch_id?: string | null;
}

export interface SessionBranch {
    id: string;
    name: string;
    is_headquarters: boolean;
}

export interface Session {
    user: SessionUser;
    mfa: SessionMfa;
    organizations: SessionOrganization[];
    active_organization: SessionOrganization | null;
    customer_memberships: { id: string; organization_id: string; customer_id: string; status: string }[];
    permissions: string[];
    modules: string[];
    branches: SessionBranch[];
}

export interface AuthResponse {
    access_token: string;
    expires_in: number;
    session_id: string;
    user: SessionUser;
    password_change_required?: boolean;
    mfa_enrollment_required?: boolean;
    mfa_required_reason?: MfaRequiredReason | null;
    /** Only after signing in with a recovery code. */
    recovery_codes_remaining?: number | null;
}

/** First sign-in step for someone with MFA: no session yet, exchange the token at POST /auth/mfa/verify. */
export interface MfaChallenge {
    mfa_required: true;
    mfa_token: string;
    mfa_methods: string[];
    expires_in_seconds: number;
}

export type SignInResult = AuthResponse | MfaChallenge;
export const isMfaChallenge = (r: SignInResult): r is MfaChallenge => "mfa_required" in r && r.mfa_required === true;

export interface MfaVerifyDto {
    mfa_token: string;
    code?: string;
    recovery_code?: string;
}

/** A current authenticator code or one recovery code (to regenerate codes or turn MFA off). */
export interface MfaFactorDto {
    code?: string;
    recovery_code?: string;
}

export interface MfaStatus {
    enabled: boolean;
    totp: { verified_at: string; last_used_at: string | null } | null;
    recovery_codes: { total: number; remaining: number };
    required: boolean;
    required_reason: MfaRequiredReason | null;
}

export interface TotpSetup {
    secret: string;
    otpauth_uri: string;
    issuer: string;
    account: string;
}

export interface SignInDto {
    email: string;
    password: string;
}

export interface SignUpDto {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    organization_name?: string;
    invitation_token?: string;
}

export interface InvitationPreview {
    email: string;
    status: string;
    expires_at: string;
    audience: string;
    has_account: boolean;
    organization: { display_name: string; logo_url: string | null };
    role: { name: string } | null;
}

export interface UserSessionRow {
    id: string;
    browser: string | null;
    device: string | null;
    ip_address: string | null;
    last_activity_at: string;
    created_at: string;
    user_agent: string | null;
    current: boolean;
}

export interface UpdateProfileDto {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    timezone?: string;
    locale?: string;
    language?: string;
    profile_photo_url?: string;
    phone?: string | null;
}
