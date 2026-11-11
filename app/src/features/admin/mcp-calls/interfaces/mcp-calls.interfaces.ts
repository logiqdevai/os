import type { PaginationMeta } from "@/components/ui/data-table";

export type McpToolCallStatus = "SUCCEEDED" | "FAILED" | "DENIED" | "AWAITING_CONFIRMATION" | "REJECTED" | "EXPIRED";

interface PersonName {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
}

export interface McpCall {
    id: string;
    tool_name: string;
    permission_key: string | null;
    module: string | null;
    actor_type: string;
    client_name: string | null;
    resource_type: string | null;
    resource_id: string | null;
    status: McpToolCallStatus;
    requires_confirmation: boolean;
    confirmed_at: string | null;
    rejected_at: string | null;
    input_summary: Record<string, unknown> | null;
    error_code: string | null;
    duration_ms: number | null;
    created_at: string;
    service_account: { id: string; name: string } | null;
    api_key: { id: string; name: string; key_prefix: string } | null;
    actor_member: PersonName | null;
    confirmed_by: PersonName | null;
    can_decide: boolean;
}

export interface McpCallList {
    data: McpCall[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
    awaiting_confirmation: number;
}
