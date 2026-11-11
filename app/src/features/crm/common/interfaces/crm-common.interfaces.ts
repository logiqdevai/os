import type { PaginationMeta } from "@/components/ui/data-table";

/** Lightweight membership projection returned for owners, authors and assignees. */
export interface MemberRef {
    id: string;
    job_title: string | null;
    user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
}

export interface TagRef {
    id: string;
    name: string;
    color: string | null;
}

export interface CompanyRef {
    id: string;
    name: string;
    website: string | null;
    type: string;
}

export interface ContactRef {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    job_title?: string | null;
    company_id?: string | null;
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

/** Decimal columns arrive as strings; money is null without crm.financials.read. */
export type Money = string | number | null;

/** 409 body when a create finds possible duplicates (02 §22). */
export interface DuplicateConflict<T = { id: string; match: string; name?: string }> {
    code: "possible_duplicates";
    message: string;
    duplicates: T[];
}

export const contactName = (c: { first_name: string; last_name?: string | null } | null | undefined) => (c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "");

export const RecordEntityTypes = {
    CRM_COMPANY: "CRM_COMPANY",
    CRM_CONTACT: "CRM_CONTACT",
    CRM_LEAD: "CRM_LEAD",
    CRM_DEAL: "CRM_DEAL",
    CRM_ACTIVITY: "CRM_ACTIVITY",
} as const;
export type CrmEntityType = (typeof RecordEntityTypes)[keyof typeof RecordEntityTypes];
