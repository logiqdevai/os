/**
 * Every foreign key that points at a CRM record (generated from api/prisma/schema.prisma). A merge re-points them
 * from the merged records to the survivor (02 §22). Keep in sync when a module adds a relation to a CRM record.
 * `[model delegate, column]`.
 */
export const COMPANY_REFS: [string, string][] = [
    ['invitation', 'customer_id'], ['crmLifecycleHistory', 'company_id'], ['crmCompany', 'parent_company_id'], ['crmCompanyBranch', 'company_id'],
    ['crmContact', 'company_id'], ['crmLead', 'company_id'], ['crmLead', 'converted_company_id'], ['crmLead', 'referring_partner_company_id'],
    ['crmDeal', 'company_id'], ['crmDeal', 'referring_partner_company_id'], ['crmActivity', 'company_id'], ['proposal', 'company_id'],
    ['contract', 'primary_company_id'], ['contractParty', 'company_id'], ['project', 'company_id'], ['customerPortalClientSettings', 'company_id'],
    ['customerPortalProfileChangeRequest', 'company_id'], ['billingProfile', 'company_id'], ['invoice', 'company_id'], ['subscription', 'company_id'],
    ['ledgerSupplierProfile', 'company_id'], ['ledgerRecord', 'company_id'], ['ledgerInvoiceImport', 'matched_company_id'], ['recurringExpense', 'company_id'],
    ['financialPeriodSummary', 'company_id'], ['ledgerProfitabilitySnapshot', 'company_id'], ['commThread', 'company_id'], ['commMessage', 'company_id'],
    ['channel', 'company_id'], ['supportConversation', 'company_id'], ['ticket', 'company_id'], ['folder', 'company_id'], ['document', 'company_id'],
    ['vaultEntry', 'company_id'], ['calendar', 'company_id'], ['calendarEvent', 'company_id'], ['bookingLink', 'company_id'], ['calendarBooking', 'company_id'],
];

export const CONTACT_REFS: [string, string][] = [
    ['crmLifecycleHistory', 'contact_id'], ['crmLead', 'contact_id'], ['crmLead', 'converted_contact_id'], ['crmDeal', 'primary_contact_id'],
    ['crmDealContact', 'contact_id'], ['crmActivityParticipant', 'contact_id'], ['proposal', 'contact_id'], ['proposalDelivery', 'recipient_contact_id'],
    ['proposalAcceptance', 'contact_id'], ['contractSignatory', 'contact_id'], ['contractReview', 'reviewer_contact_id'], ['projectStakeholder', 'contact_id'],
    ['customerPortalProfileChangeRequest', 'contact_id'], ['commThread', 'contact_id'], ['commMessage', 'recipient_contact_id'], ['commMessageRecipient', 'contact_id'],
    ['commRecipientListMember', 'contact_id'], ['commConsent', 'contact_id'], ['commSuppression', 'contact_id'], ['campaignRecipient', 'contact_id'],
    ['commTopicSubscription', 'contact_id'], ['supportConversation', 'contact_id'], ['ticket', 'requester_contact_id'], ['supportCsatRating', 'contact_id'],
    ['calendarEventAttendee', 'contact_id'], ['calendarBooking', 'contact_id'],
];

export const LEAD_REFS: [string, string][] = [['crmActivity', 'lead_id']];

export const DEAL_REFS: [string, string][] = [
    ['crmLead', 'converted_deal_id'], ['crmDealContact', 'deal_id'], ['crmDealLineItem', 'deal_id'], ['crmDealStageHistory', 'deal_id'], ['crmActivity', 'deal_id'], ['proposal', 'deal_id'],
];

/** Scalar fields the user picks per field when records differ (money fields need crm.financials.read). */
export const MERGE_FIELDS = {
    CRM_COMPANY: ['name', 'legal_name', 'type', 'lifecycle_stage_id', 'industry', 'company_size', 'number_of_employees', 'annual_revenue', 'currency', 'website', 'email', 'phone', 'country', 'address', 'tax_id', 'vat_number', 'registration_number', 'description', 'lead_source_id', 'owner_membership_id', 'account_manager_membership_id', 'team_id', 'parent_company_id'],
    CRM_CONTACT: ['first_name', 'last_name', 'job_title', 'department', 'email', 'phone', 'mobile', 'address', 'website', 'linkedin_url', 'company_id', 'lifecycle_stage_id', 'lead_source_id', 'owner_membership_id', 'timezone', 'language', 'description'],
    CRM_LEAD: ['name', 'company_name', 'contact_name', 'email', 'phone', 'website', 'industry', 'estimated_company_size', 'estimated_value', 'currency', 'status_id', 'lead_source_id', 'owner_membership_id', 'company_id', 'contact_id', 'description', 'manual_score'],
    CRM_DEAL: ['name', 'company_id', 'primary_contact_id', 'owner_membership_id', 'value', 'expected_close_date', 'description', 'next_step', 'deal_type', 'lead_source_id', 'competitor'],
} as const;

export const MONEY_FIELDS = new Set(['annual_revenue', 'estimated_value', 'value']);
export const OWNER_FIELDS = new Set(['owner_membership_id', 'account_manager_membership_id']);

export type MergeEntity = keyof typeof MERGE_FIELDS;

export const MERGE_KEYS: Record<MergeEntity, { read: string; update: string; merge: string; assign: string; label: string }> = {
    CRM_COMPANY: { read: 'crm.companies.read', update: 'crm.companies.update', merge: 'crm.companies.merge', assign: 'crm.companies.assign', label: 'company' },
    CRM_CONTACT: { read: 'crm.contacts.read', update: 'crm.contacts.update', merge: 'crm.contacts.merge', assign: 'crm.contacts.assign', label: 'contact' },
    CRM_LEAD: { read: 'crm.leads.read', update: 'crm.leads.update', merge: 'crm.leads.merge', assign: 'crm.leads.assign', label: 'lead' },
    CRM_DEAL: { read: 'crm.deals.read', update: 'crm.deals.update', merge: 'crm.deals.merge', assign: 'crm.deals.assign', label: 'deal' },
};

export const REFS: Record<MergeEntity, [string, string][]> = { CRM_COMPANY: COMPANY_REFS, CRM_CONTACT: CONTACT_REFS, CRM_LEAD: LEAD_REFS, CRM_DEAL: DEAL_REFS };
