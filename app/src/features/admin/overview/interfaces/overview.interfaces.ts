import type { UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

/** Blocks are null when the caller may not see that data. */
export interface AdminOverview {
    members: { active: number; suspended: number; deactivated: number; external: number; mfa_enabled: number; mfa_coverage: number } | null;
    invitations: { pending: number; expiring_soon: number } | null;
    structure: { branches: number | null; teams: number | null } | null;
    roles: { custom: number; drafts: number; templates: number; expiring_assignments: number } | null;
    security: { disabled_modules: string[] } | null;
    developers: { api_keys: number | null; service_accounts: number | null; mcp_awaiting: number | null; integrations: { total: number; errors: number } | null } | null;
    recent_sensitive_events: { id: string; event_type: string; resource_type: string | null; resource_id: string | null; outcome: string; created_at: string; actor_type: string; actor_user: UserSummary | null }[] | null;
    onboarding: { invited_someone: boolean; has_branches: boolean; has_teams: boolean; has_integration: boolean; has_branding: boolean };
}
