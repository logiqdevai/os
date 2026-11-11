import { Prisma } from 'generated/prisma';

/** Field-level permission (02 §21): money on deals, leads and companies. */
export const CRM_FINANCIALS = 'crm.financials.read';
/** Private notes (02 §16). */
export const CRM_PRIVATE_NOTES = 'crm.notes.private.read';

/** Lightweight membership projection used for owners, authors and assignees. */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} satisfies Prisma.MembershipSelect;

export const COMPANY_REF_SELECT = { id: true, name: true, website: true, type: true } satisfies Prisma.CrmCompanySelect;
export const CONTACT_REF_SELECT = { id: true, first_name: true, last_name: true, email: true, job_title: true, company_id: true } satisfies Prisma.CrmContactSelect;

/** Default CRM configuration created per organization (02 §37). */
export const DEFAULT_PIPELINE_STAGES: { name: string; probability: number; forecast_category: 'PIPELINE' | 'BEST_CASE' | 'COMMIT' | 'CLOSED_WON' | 'CLOSED_LOST'; is_won?: boolean; is_lost?: boolean; color: string }[] = [
    { name: 'New Opportunity', probability: 10, forecast_category: 'PIPELINE', color: 'neutral' },
    { name: 'Discovery', probability: 20, forecast_category: 'PIPELINE', color: 'info' },
    { name: 'Qualified', probability: 40, forecast_category: 'BEST_CASE', color: 'info' },
    { name: 'Proposal', probability: 60, forecast_category: 'BEST_CASE', color: 'violet' },
    { name: 'Negotiation', probability: 80, forecast_category: 'COMMIT', color: 'warning' },
    { name: 'Verbal Agreement', probability: 90, forecast_category: 'COMMIT', color: 'warning' },
    { name: 'Closed Won', probability: 100, forecast_category: 'CLOSED_WON', is_won: true, color: 'success' },
    { name: 'Closed Lost', probability: 0, forecast_category: 'CLOSED_LOST', is_lost: true, color: 'danger' },
];

export const DEFAULT_LEAD_STATUSES: { name: string; color: string; is_default?: boolean; is_converted?: boolean; is_lost?: boolean }[] = [
    { name: 'New', color: 'info', is_default: true },
    { name: 'Contacted', color: 'neutral' },
    { name: 'Attempting Contact', color: 'warning' },
    { name: 'Connected', color: 'info' },
    { name: 'Qualified', color: 'success' },
    { name: 'Unqualified', color: 'neutral' },
    { name: 'Nurture', color: 'violet' },
    { name: 'Converted', color: 'success', is_converted: true },
    { name: 'Lost', color: 'danger', is_lost: true },
];

export const DEFAULT_LIFECYCLE_STAGES: { name: string; is_customer?: boolean; is_default?: boolean }[] = [
    { name: 'Lead', is_default: true },
    { name: 'Marketing Qualified' },
    { name: 'Sales Qualified' },
    { name: 'Opportunity' },
    { name: 'Customer', is_customer: true },
    { name: 'Active Customer', is_customer: true },
    { name: 'Inactive Customer', is_customer: true },
    { name: 'Former Customer' },
];

export const DEFAULT_LEAD_SOURCES = [
    'Website', 'Referral', 'Existing Customer', 'Partner', 'Networking', 'Event', 'Cold Outreach',
    'Advertisement', 'Organic Search', 'Social Media', 'Direct', 'Import', 'API', 'Other',
];

export const DEFAULT_LOSS_REASONS: { name: string; applies_to: 'DEAL' | 'LEAD' | 'BOTH' }[] = [
    { name: 'Price too high', applies_to: 'BOTH' },
    { name: 'Chose a competitor', applies_to: 'DEAL' },
    { name: 'No budget', applies_to: 'BOTH' },
    { name: 'Bad timing', applies_to: 'BOTH' },
    { name: 'No decision / went silent', applies_to: 'BOTH' },
    { name: 'Not a fit', applies_to: 'BOTH' },
    { name: 'Built in-house', applies_to: 'DEAL' },
];
