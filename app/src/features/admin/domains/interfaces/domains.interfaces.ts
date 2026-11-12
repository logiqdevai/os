export type DomainVerificationStatus = "PENDING" | "VERIFIED" | "FAILED" | "REVOKED";

/** OrganizationDomain (01 §70) + the TXT record the API spells out. */
export interface OrganizationDomain {
    id: string;
    domain: string;
    status: DomainVerificationStatus;
    verification_token: string;
    verified_at: string | null;
    allow_discovery: boolean;
    auto_provision: boolean;
    last_checked_at: string | null;
    dns_check: { txt?: { ok: boolean; name: string; expected: string; found: string[]; error: string | null } } | null;
    created_at: string;
    dns_record: { type: "TXT"; name: string; value: string };
    /** Active members whose email uses this domain (list only). */
    members_using?: number;
}

export interface CreateDomainDto {
    domain: string;
    allow_discovery?: boolean;
    auto_provision?: boolean;
}
