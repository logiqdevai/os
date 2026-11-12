import type { MemberRef, Money, TagRef } from "../../common/interfaces/crm-common.interfaces";
import type { CustomFieldValues } from "../../custom-fields/interfaces/custom-fields.interfaces";

export const CompanyTypes = {
    PROSPECT: "PROSPECT",
    CUSTOMER: "CUSTOMER",
    PARTNER: "PARTNER",
    VENDOR: "VENDOR",
    OTHER: "OTHER",
} as const;
export type CompanyType = (typeof CompanyTypes)[keyof typeof CompanyTypes];

export interface Company {
    /** Custom field values keyed by field key (detail responses; send on create/update). */
    custom_fields?: CustomFieldValues;
    id: string;
    name: string;
    legal_name: string | null;
    type: CompanyType;
    industry: string | null;
    company_size: string | null;
    number_of_employees: number | null;
    annual_revenue: Money;
    currency: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    address: Record<string, string> | null;
    tax_id: string | null;
    vat_number: string | null;
    registration_number: string | null;
    description: string | null;
    lifecycle_stage_id: string | null;
    lead_source_id: string | null;
    owner_membership_id: string | null;
    account_manager_membership_id: string | null;
    team_id: string | null;
    parent_company_id: string | null;
    customer_since: string | null;
    last_activity_at: string | null;
    archived_at: string | null;
    created_at: string;
    owner?: MemberRef | null;
    lifecycle_stage?: { id: string; name: string; is_customer: boolean } | null;
    lead_source?: { id: string; name: string } | null;
    team?: { id: string; name: string } | null;
    _count?: { contacts: number; deals: number };
    open_deals_value?: number | null;
    tags?: TagRef[];
    financials_hidden?: boolean;
}

export interface CompanySummary {
    contacts: number;
    open_activities: number;
    last_activity: { completed_at: string; title: string; type: string } | null;
    open_deals: number;
    won_deals: number;
    lost_deals: number;
    open_value: number | null;
    won_value: number | null;
}

export interface CompanyDetail extends Company {
    account_manager?: MemberRef | null;
    parent?: { id: string; name: string } | null;
    children?: { id: string; name: string; type: CompanyType }[];
    branches?: { id: string; branch: { id: string; name: string }; relation_type: string; is_primary: boolean }[];
    summary: CompanySummary;
}

export interface CompanyLookupItem {
    id: string;
    name: string;
    type: CompanyType;
    website: string | null;
    country: string | null;
    currency: string | null;
}

export interface CreateCompanyDto {
    /** Custom field values keyed by field key (detail responses; send on create/update). */
    custom_fields?: CustomFieldValues;
    name: string;
    legal_name?: string;
    type?: CompanyType;
    lifecycle_stage_id?: string;
    industry?: string;
    company_size?: string;
    annual_revenue?: number;
    currency?: string;
    website?: string;
    email?: string;
    phone?: string;
    country?: string;
    vat_number?: string;
    description?: string;
    lead_source_id?: string;
    owner_membership_id?: string;
    allow_duplicate?: boolean;
}
export type UpdateCompanyDto = Partial<CreateCompanyDto>;
