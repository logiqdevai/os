import type { ModuleKey } from "@/config/apps/app.types";
import type { MembershipType, ScopeType, UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED" | "REJECTED";

export interface Invitation {
    id: string;
    email: string;
    type: MembershipType;
    status: InvitationStatus;
    scope_type: ScopeType;
    scope_id: string | null;
    modules: ModuleKey[];
    message: string | null;
    expires_at: string;
    accepted_at: string | null;
    cancelled_at: string | null;
    created_at: string;
    last_sent_at: string | null;
    send_count: number;
    valid_until: string | null;
    membership_id: string | null;
    role: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    invited_by: UserSummary | null;
}

export interface CreateInvitationDto {
    emails: string[];
    type?: MembershipType;
    role_id?: string;
    scope_type?: ScopeType;
    scope_id?: string;
    branch_id?: string;
    team_id?: string;
    valid_until?: string;
    expires_in_days?: number;
    message?: string;
}

export interface InvitationSendResult {
    email: string;
    status: "invited" | "already_member" | "already_invited";
    invitation_id?: string;
    invite_url?: string;
    email_sent?: boolean;
}
