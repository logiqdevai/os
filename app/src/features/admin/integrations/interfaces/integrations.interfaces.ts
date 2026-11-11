export type IntegrationProvider = "OPENAI" | "RESEND" | "TWILIO" | "STRIPE" | "VIVA_WALLET";
export type IntegrationCategory = "AI" | "EMAIL" | "SMS" | "PAYMENTS";
export type IntegrationStatus = "PENDING" | "ACTIVE" | "ERROR" | "DISABLED" | "DISCONNECTED";
export type IntegrationMode = "LIVE" | "TEST";

export interface IntegrationFieldSpec {
    key: string;
    label: string;
    input: "text" | "password" | "url" | "select" | "number" | "textarea";
    required: boolean;
    placeholder?: string;
    help?: string;
    options?: string[];
}

export interface IntegrationProviderSpec {
    provider: IntegrationProvider;
    category: IntegrationCategory;
    label: string;
    description: string;
    secrets: IntegrationFieldSpec[];
    config: IntegrationFieldSpec[];
    hasTestMode: boolean;
    webhook: boolean;
    verify: string;
    supportsUsageLimits: boolean;
    docsUrl?: string;
}

export interface IntegrationConnection {
    id: string;
    provider: IntegrationProvider;
    category: IntegrationCategory;
    name: string;
    status: IntegrationStatus;
    mode: IntegrationMode;
    credential_source: "ORGANIZATION" | "PLATFORM";
    secret_hints: Record<string, string> | null;
    config: Record<string, string> | null;
    capabilities: Record<string, unknown> | null;
    usage_limits: Record<string, number> | null;
    is_default: boolean;
    branch_id: string | null;
    last_verified_at: string | null;
    last_used_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    rotated_at: string | null;
    connected_at: string | null;
    disconnected_at: string | null;
    created_at: string;
    webhook_url: string | null;
    branch: { id: string; name: string } | null;
    created_by: { id: string; user: { display_name: string | null; email: string } } | null;
}

export interface IntegrationDetail extends IntegrationConnection {
    usage: { date: string; requests: number; failures: number; units: number }[];
    verification?: { ok: boolean; automatic: boolean; error: string | null };
}

export interface CreateIntegrationDto {
    provider: IntegrationProvider;
    name: string;
    mode?: IntegrationMode;
    secrets: Record<string, string>;
    config?: Record<string, string>;
    branch_id?: string;
    make_default?: boolean;
}

export interface UpdateIntegrationDto {
    name?: string;
    config?: Record<string, string>;
    branch_id?: string | null;
    usage_limits?: Record<string, number>;
}
