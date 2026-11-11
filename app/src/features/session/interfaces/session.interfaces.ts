export interface SessionUser {
    id: string;
    email: string;
    role: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    profile_photo_url: string | null;
    timezone: string | null;
    locale: string | null;
    default_organization_id: string | null;
    preferences?: { theme?: string | null } | null;
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
}
