import type { CompanyRef, MemberRef, TagRef } from "../../common/interfaces/crm-common.interfaces";

export const ContactRoles = {
    PRIMARY: "PRIMARY",
    DECISION_MAKER: "DECISION_MAKER",
    TECHNICAL: "TECHNICAL",
    BILLING: "BILLING",
    PROJECT_STAKEHOLDER: "PROJECT_STAKEHOLDER",
    EXECUTIVE: "EXECUTIVE",
} as const;
export type ContactRole = (typeof ContactRoles)[keyof typeof ContactRoles];

export interface Contact {
    id: string;
    first_name: string;
    last_name: string | null;
    job_title: string | null;
    department: string | null;
    company_id: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    linkedin_url: string | null;
    website: string | null;
    roles: ContactRole[];
    lifecycle_stage_id: string | null;
    lead_source_id: string | null;
    owner_membership_id: string | null;
    timezone: string | null;
    language: string | null;
    consent: Record<string, boolean> | null;
    description: string | null;
    last_activity_at: string | null;
    archived_at: string | null;
    created_at: string;
    company?: CompanyRef | null;
    owner?: MemberRef | null;
    lifecycle_stage?: { id: string; name: string } | null;
    tags?: TagRef[];
}

export interface ContactDetail extends Contact {
    lead_source?: { id: string; name: string } | null;
    summary: { deals: number; open_activities: number };
}

export interface ContactLookupItem {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    job_title: string | null;
    company: { id: string; name: string } | null;
}

export interface CreateContactDto {
    first_name: string;
    last_name?: string;
    job_title?: string;
    company_id?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    linkedin_url?: string;
    roles?: ContactRole[];
    lifecycle_stage_id?: string;
    owner_membership_id?: string;
    description?: string;
    consent?: Record<string, boolean>;
    allow_duplicate?: boolean;
}
export type UpdateContactDto = Partial<CreateContactDto>;
