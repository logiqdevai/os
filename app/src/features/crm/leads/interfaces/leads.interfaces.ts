import type { CompanyRef, ContactRef, MemberRef, Money, TagRef } from "../../common/interfaces/crm-common.interfaces";
import type { CreateCompanyDto } from "../../companies/interfaces/companies.interfaces";
import type { CreateContactDto } from "../../contacts/interfaces/contacts.interfaces";

export const LeadStates = { OPEN: "open", CONVERTED: "converted", LOST: "lost", ALL: "all" } as const;
export type LeadState = (typeof LeadStates)[keyof typeof LeadStates];

export interface LeadStatusRef {
    id: string;
    name: string;
    color: string | null;
    is_converted: boolean;
    is_lost: boolean;
}

export interface Lead {
    id: string;
    name: string;
    company_id: string | null;
    contact_id: string | null;
    company_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    industry: string | null;
    estimated_company_size: string | null;
    estimated_value: Money;
    currency: string | null;
    status_id: string | null;
    lead_source_id: string | null;
    owner_membership_id: string | null;
    branch_id: string | null;
    lead_score: number | null;
    manual_score: number | null;
    qualification_notes: string | null;
    description: string | null;
    next_follow_up_at: string | null;
    last_activity_at: string | null;
    converted_at: string | null;
    lost_reason: string | null;
    archived_at: string | null;
    created_at: string;
    status?: LeadStatusRef | null;
    lead_source?: { id: string; name: string } | null;
    owner?: MemberRef | null;
    company?: CompanyRef | null;
    contact?: ContactRef | null;
    tags?: TagRef[];
    financials_hidden?: boolean;
}

export interface LeadDetail extends Lead {
    branch?: { id: string; name: string } | null;
    loss_reason?: { id: string; name: string } | null;
    converted_company?: { id: string; name: string } | null;
    converted_contact?: { id: string; first_name: string; last_name: string | null } | null;
    converted_deal?: { id: string; name: string } | null;
}

export interface CreateLeadDto {
    name: string;
    company_name?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    website?: string;
    industry?: string;
    estimated_value?: number;
    currency?: string;
    status_id?: string;
    lead_source_id?: string;
    owner_membership_id?: string;
    manual_score?: number;
    description?: string;
    qualification_notes?: string;
    next_follow_up_at?: string;
    allow_duplicate?: boolean;
}
export type UpdateLeadDto = Partial<CreateLeadDto>;

export interface ConvertPreview {
    lead: LeadDetail;
    company_matches: { id: string; name: string; website?: string | null; match: string }[];
    contact_matches: { id: string; first_name: string; last_name: string | null; email: string | null; match: string }[];
    defaults: {
        company: { name: string; website: string | null; industry: string | null; company_size: string | null };
        contact: { first_name: string; last_name?: string; email: string | null; phone: string | null };
        deal: { name: string; value: Money; currency: string | null; pipeline_id?: string; stage_id?: string; owner_membership_id: string | null };
    };
    allowed: { company: boolean; contact: boolean; deal: boolean; financials: boolean };
}

export interface ConvertLeadDto {
    company?: { existing_id?: string; new?: CreateCompanyDto };
    contact?: { existing_id?: string; new?: CreateContactDto };
    deal?: { name: string; pipeline_id?: string; stage_id?: string; value?: number; currency?: string; expected_close_date?: string; owner_membership_id?: string };
}

export interface ConvertResult {
    lead_id: string;
    company_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
}
