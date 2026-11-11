import type { UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";
export type AuditActorType = "USER" | "SERVICE_ACCOUNT" | "SYSTEM" | "PLATFORM_ADMIN";

export interface AuditEvent {
    id: string;
    event_type: string;
    actor_type: AuditActorType;
    actor_user_id: string | null;
    actor_service_account_id: string | null;
    resource_type: string | null;
    resource_id: string | null;
    branch_id: string | null;
    outcome: AuditOutcome;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    actor_user: UserSummary | null;
    actor_service_account?: { id: string; name: string } | null;
}

export interface AuditEventDetail extends AuditEvent {
    related: { id: string; event_type: string; created_at: string; outcome: AuditOutcome; actor_user: UserSummary | null }[];
}

export interface AuditEventType {
    event_type: string;
    resource: string;
    sensitive: boolean;
    notifyAdmins: boolean;
    description: string;
}
