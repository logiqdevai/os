import type { MembershipStatus, UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

/** GET /sessions row — UserSession of a member (token_hash is never returned). */
export interface AdminSessionRow {
    id: string;
    device: string | null;
    browser: string | null;
    ip_address: string | null;
    /** Approximate (GeoIP) location, when known. */
    location_approx: string | null;
    user_agent: string | null;
    last_activity_at: string;
    created_at: string;
    expires_at: string;
    /** The session's active organization is this one (branch context is only shown then). */
    in_this_organization: boolean;
    /** Selected branch context; empty = whole organization. */
    active_branch_ids: string[];
    /** The signed-in admin's own current session. */
    current: boolean;
    member: { id: string; status: MembershipStatus; job_title: string | null; user: UserSummary } | null;
}
