import type { ModuleKey } from "@/config/apps/app.types";

export type SsoProtocol = "SAML" | "OIDC";

export interface SsoAttributeMapping {
    email?: string;
    first_name?: string;
    last_name?: string;
    groups?: string;
}

export interface SamlConfig {
    idp_entity_id: string;
    sso_url: string;
    certificate: string;
    metadata_url?: string;
    attribute_mapping?: SsoAttributeMapping;
}

export interface OidcConfig {
    issuer: string;
    client_id: string;
    discovery_url?: string;
    scopes?: string[];
    attribute_mapping?: SsoAttributeMapping;
}

export interface SsoGroupMapping {
    id: string;
    external_group: string;
    role_id: string | null;
    team_id: string | null;
    branch_id: string | null;
    modules: ModuleKey[];
    role: { id: string; name: string } | null;
    team: { id: string; name: string } | null;
    branch: { id: string; name: string } | null;
}

/** SsoConfiguration (01 §69) as returned by the API: public settings + secret hints, never secrets. */
export interface SsoConfiguration {
    id: string;
    name: string;
    protocol: SsoProtocol;
    enabled: boolean;
    auto_provision: boolean;
    scim_enabled: boolean;
    scim_last_synced_at: string | null;
    config: Partial<SamlConfig & OidcConfig>;
    secret_hints: Record<string, string>;
    /** configured = all required settings present; the sign-in handshake is not tested yet. */
    status: "configured" | "incomplete";
    tested: boolean;
    service_provider: { entity_id: string };
    group_mappings: SsoGroupMapping[];
    created_at: string;
    updated_at: string;
}

export interface SaveSsoConfigurationDto {
    name: string;
    protocol: SsoProtocol;
    auto_provision?: boolean;
    config: SamlConfig | OidcConfig;
    secrets?: { client_secret?: string };
}

export interface GroupMappingDto {
    external_group: string;
    role_id?: string | null;
    team_id?: string | null;
    branch_id?: string | null;
    modules?: ModuleKey[];
}
