import { CrmCompanyType, RecordEntityType } from 'generated/prisma';

/**
 * Import targets per record type (02 §22). `kind` drives parsing:
 *  - text/email/url/int/number/date/enum: the column value itself
 *  - owner: a member's email → owner_membership_id
 *  - company: a company name → company_id (looked up; never created implicitly)
 *  - lead_source / lifecycle_stage / lead_status / stage / pipeline: an option name → its id
 *  - full_name: split into first_name + last_name (contacts)
 */
export type ImportFieldKind = 'text' | 'email' | 'url' | 'int' | 'number' | 'date' | 'enum' | 'owner' | 'company' | 'lead_source' | 'lifecycle_stage' | 'lead_status' | 'stage' | 'pipeline' | 'full_name';

export interface ImportField {
    key: string;
    label: string;
    kind: ImportFieldKind;
    required?: boolean;
    /** Header names that map to this field automatically (lower-case, spaces/underscores ignored). */
    aliases?: string[];
    enum?: string[];
    max?: number;
    /** Money: dropped without crm.financials.read. */
    money?: boolean;
}

export type ImportEntity = 'CRM_COMPANY' | 'CRM_CONTACT' | 'CRM_LEAD' | 'CRM_DEAL';

export const IMPORT_FIELDS: Record<ImportEntity, ImportField[]> = {
    CRM_COMPANY: [
        { key: 'name', label: 'Name', kind: 'text', required: true, aliases: ['company', 'companyname', 'organization', 'account', 'accountname'], max: 200 },
        { key: 'legal_name', label: 'Legal name', kind: 'text', max: 200 },
        { key: 'type', label: 'Type', kind: 'enum', enum: Object.values(CrmCompanyType), aliases: ['companytype'] },
        { key: 'industry', label: 'Industry', kind: 'text', max: 120 },
        { key: 'website', label: 'Website', kind: 'url', aliases: ['domain', 'url', 'web'] },
        { key: 'email', label: 'Email', kind: 'email' },
        { key: 'phone', label: 'Phone', kind: 'text', max: 40, aliases: ['telephone', 'tel'] },
        { key: 'country', label: 'Country (ISO code)', kind: 'text', max: 2 },
        { key: 'vat_number', label: 'VAT number', kind: 'text', max: 60, aliases: ['vat', 'vatid'] },
        { key: 'tax_id', label: 'Tax id', kind: 'text', max: 60 },
        { key: 'registration_number', label: 'Registration number', kind: 'text', max: 60 },
        { key: 'company_size', label: 'Company size', kind: 'text', max: 40, aliases: ['size'] },
        { key: 'number_of_employees', label: 'Employees', kind: 'int', aliases: ['employees', 'headcount'] },
        { key: 'annual_revenue', label: 'Annual revenue', kind: 'number', money: true, aliases: ['revenue'] },
        { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
        { key: 'description', label: 'Description', kind: 'text', max: 5000, aliases: ['notes', 'about'] },
        { key: 'owner', label: 'Owner (member email)', kind: 'owner', aliases: ['owneremail', 'accountowner'] },
        { key: 'lifecycle_stage', label: 'Lifecycle stage', kind: 'lifecycle_stage', aliases: ['lifecycle', 'stage'] },
        { key: 'lead_source', label: 'Source', kind: 'lead_source', aliases: ['source', 'leadsource'] },
    ],
    CRM_CONTACT: [
        { key: 'first_name', label: 'First name', kind: 'text', required: true, aliases: ['firstname', 'givenname'], max: 100 },
        { key: 'last_name', label: 'Last name', kind: 'text', aliases: ['lastname', 'surname', 'familyname'], max: 100 },
        { key: 'full_name', label: 'Full name (split)', kind: 'full_name', aliases: ['name', 'fullname', 'contactname'] },
        { key: 'email', label: 'Email', kind: 'email', aliases: ['emailaddress', 'mail'] },
        { key: 'phone', label: 'Phone', kind: 'text', max: 40, aliases: ['telephone', 'tel', 'workphone'] },
        { key: 'mobile', label: 'Mobile', kind: 'text', max: 40, aliases: ['cell', 'mobilephone'] },
        { key: 'job_title', label: 'Job title', kind: 'text', max: 120, aliases: ['title', 'position', 'role'] },
        { key: 'department', label: 'Department', kind: 'text', max: 120 },
        { key: 'company', label: 'Company (name)', kind: 'company', aliases: ['companyname', 'organization', 'account'] },
        { key: 'linkedin_url', label: 'LinkedIn', kind: 'url', aliases: ['linkedin'] },
        { key: 'website', label: 'Website', kind: 'url' },
        { key: 'description', label: 'Notes', kind: 'text', max: 5000, aliases: ['notes', 'description'] },
        { key: 'owner', label: 'Owner (member email)', kind: 'owner', aliases: ['owneremail', 'contactowner'] },
        { key: 'lifecycle_stage', label: 'Lifecycle stage', kind: 'lifecycle_stage', aliases: ['lifecycle'] },
        { key: 'lead_source', label: 'Source', kind: 'lead_source', aliases: ['source', 'leadsource'] },
    ],
    CRM_LEAD: [
        { key: 'name', label: 'Lead name', kind: 'text', required: true, aliases: ['lead', 'leadname', 'title', 'subject'], max: 200 },
        { key: 'company_name', label: 'Company name', kind: 'text', max: 200, aliases: ['company', 'organization'] },
        { key: 'contact_name', label: 'Contact name', kind: 'text', max: 200, aliases: ['contact', 'fullname', 'name'] },
        { key: 'email', label: 'Email', kind: 'email', aliases: ['emailaddress'] },
        { key: 'phone', label: 'Phone', kind: 'text', max: 40, aliases: ['telephone', 'tel'] },
        { key: 'website', label: 'Website', kind: 'url', aliases: ['domain'] },
        { key: 'industry', label: 'Industry', kind: 'text', max: 120 },
        { key: 'estimated_value', label: 'Estimated value', kind: 'number', money: true, aliases: ['value', 'amount', 'budget'] },
        { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
        { key: 'description', label: 'Description', kind: 'text', max: 5000, aliases: ['notes'] },
        { key: 'owner', label: 'Owner (member email)', kind: 'owner', aliases: ['owneremail', 'leadowner'] },
        { key: 'lead_source', label: 'Source', kind: 'lead_source', aliases: ['source', 'leadsource'] },
        { key: 'status', label: 'Status', kind: 'lead_status', aliases: ['leadstatus'] },
    ],
    CRM_DEAL: [
        { key: 'name', label: 'Deal name', kind: 'text', required: true, aliases: ['deal', 'dealname', 'opportunity', 'title'], max: 200 },
        { key: 'company', label: 'Company (name)', kind: 'company', aliases: ['companyname', 'account', 'organization'] },
        { key: 'value', label: 'Value', kind: 'number', money: true, aliases: ['amount', 'dealvalue'] },
        { key: 'currency', label: 'Currency', kind: 'text', max: 3 },
        { key: 'pipeline', label: 'Pipeline', kind: 'pipeline' },
        { key: 'stage', label: 'Stage', kind: 'stage', aliases: ['dealstage'] },
        { key: 'expected_close_date', label: 'Expected close date', kind: 'date', aliases: ['closedate', 'expectedclose', 'close'] },
        { key: 'probability', label: 'Probability %', kind: 'int' },
        { key: 'deal_type', label: 'Deal type', kind: 'text', max: 60, aliases: ['type'] },
        { key: 'description', label: 'Description', kind: 'text', max: 5000, aliases: ['notes'] },
        { key: 'owner', label: 'Owner (member email)', kind: 'owner', aliases: ['owneremail', 'dealowner'] },
        { key: 'lead_source', label: 'Source', kind: 'lead_source', aliases: ['source', 'leadsource'] },
    ],
};

/** Duplicate match keys per record type (02 §22): how an existing record is found. */
export const MATCH_KEYS: Record<ImportEntity, { key: string; label: string }[]> = {
    CRM_COMPANY: [{ key: 'name', label: 'Name' }, { key: 'domain', label: 'Website domain' }, { key: 'vat_number', label: 'VAT number' }, { key: 'email', label: 'Email' }],
    CRM_CONTACT: [{ key: 'email', label: 'Email' }, { key: 'name', label: 'First + last name' }],
    CRM_LEAD: [{ key: 'email', label: 'Email' }, { key: 'name', label: 'Lead name' }],
    CRM_DEAL: [{ key: 'name', label: 'Deal name' }],
};

export const ENTITY_KEYS: Record<ImportEntity, { create: string; update: string; label: string }> = {
    CRM_COMPANY: { create: 'crm.companies.create', update: 'crm.companies.update', label: 'companies' },
    CRM_CONTACT: { create: 'crm.contacts.create', update: 'crm.contacts.update', label: 'contacts' },
    CRM_LEAD: { create: 'crm.leads.create', update: 'crm.leads.update', label: 'leads' },
    CRM_DEAL: { create: 'crm.deals.create', update: 'crm.deals.update', label: 'deals' },
};

export const normHeader = (h: string) => h.toLowerCase().replace(/[\s_\-.]/g, '');

export const isImportEntity = (v: string): v is ImportEntity => v in IMPORT_FIELDS;
export const asRecordEntity = (e: ImportEntity) => e as RecordEntityType;
