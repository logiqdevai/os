import { AutomationTriggerKind, ModuleKey, RecordEntityType } from 'generated/prisma';
import { DATE_TRIGGER_SOURCES } from './date-trigger-catalog';

/** A field of the trigger payload that the rule builder offers for conditions and input templates. */
export interface CatalogField {
    path: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'id';
}

export interface TriggerCatalogEntry {
    /** Stable event key modules publish (`<module>.<entity>.<action>`). */
    key: string;
    module: ModuleKey;
    name: string;
    description: string;
    kind: AutomationTriggerKind;
    entity_type?: RecordEntityType;
    /** The rule author (or run-as principal) must hold this key to build a rule on the trigger (20 §10). */
    required_permission?: string;
    /** Payload fields (relative to `event.payload`) for the condition builder. */
    fields?: CatalogField[];
    sample_payload?: Record<string, unknown>;
    /** DATE_RELATIVE: label of the watched date ("due date"). */
    date_label?: string;
}

const E = AutomationTriggerKind.EVENT;
const f = (path: string, label: string, type: CatalogField['type'] = 'string'): CatalogField => ({ path, label, type });

/**
 * 20 §3 — trigger catalog. Event keys are the ones modules publish through `EventsService.publish`.
 * Keys published by a module but missing here still work: the trigger list also shows "discovered" keys seen
 * on the organization's event bus, so modules never block on this file.
 */
export const TRIGGER_CATALOG: TriggerCatalogEntry[] = [
    // --- Engine-level triggers --------------------------------------------------------------
    { key: 'manual', module: ModuleKey.AUTOMATION, name: 'Run manually', description: 'Started by a member with "Run now" or by the API / MCP.', kind: AutomationTriggerKind.MANUAL, required_permission: 'automation.rules.run' },
    { key: 'schedule.cron', module: ModuleKey.AUTOMATION, name: 'On a schedule', description: 'Runs on a cron expression or a fixed interval (hourly, daily, weekly, monthly).', kind: AutomationTriggerKind.SCHEDULE },
    { key: 'inbound_webhook', module: ModuleKey.AUTOMATION, name: 'Inbound webhook received', description: 'An external system called a signed inbound webhook URL of this organization.', kind: AutomationTriggerKind.INBOUND_WEBHOOK, fields: [f('body', 'Request body')] },

    // --- 01 Administration -------------------------------------------------------------------
    { key: 'organizations.team.created', module: ModuleKey.ADMINISTRATION, name: 'Team created', description: 'A team, department or business unit was created.', kind: E, required_permission: 'organizations.teams.read', fields: [f('name', 'Team name')] },
    { key: 'users.member.updated', module: ModuleKey.ADMINISTRATION, name: 'Member updated', description: 'A member profile or employment detail changed.', kind: E, entity_type: RecordEntityType.MEMBERSHIP, required_permission: 'users.members.read' },
    { key: 'users.member.offboarded', module: ModuleKey.ADMINISTRATION, name: 'Member offboarded', description: 'A member left the organization.', kind: E, entity_type: RecordEntityType.MEMBERSHIP, required_permission: 'users.members.read' },

    // --- 02 CRM --------------------------------------------------------------------------------
    { key: 'crm.company.created', module: ModuleKey.CRM, name: 'Company created', description: 'A company (account) was added to the CRM.', kind: E, entity_type: RecordEntityType.CRM_COMPANY, required_permission: 'crm.companies.read', fields: [f('name', 'Company name'), f('lifecycle_stage', 'Lifecycle stage'), f('owner_membership_id', 'Owner', 'id')], sample_payload: { name: 'Acme Ltd', lifecycle_stage: 'LEAD' } },
    { key: 'crm.company.updated', module: ModuleKey.CRM, name: 'Company updated', description: 'Company fields changed.', kind: E, entity_type: RecordEntityType.CRM_COMPANY, required_permission: 'crm.companies.read', fields: [f('name', 'Company name')] },
    { key: 'crm.company.lifecycle_changed', module: ModuleKey.CRM, name: 'Company lifecycle changed', description: 'A company moved to another lifecycle stage (lead → customer …).', kind: E, entity_type: RecordEntityType.CRM_COMPANY, required_permission: 'crm.companies.read', fields: [f('from', 'From stage'), f('to', 'To stage')], sample_payload: { name: 'Acme Ltd', from: 'PROSPECT', to: 'CUSTOMER' } },
    { key: 'crm.company.assigned', module: ModuleKey.CRM, name: 'Company owner changed', description: 'A company was assigned to another owner.', kind: E, entity_type: RecordEntityType.CRM_COMPANY, required_permission: 'crm.companies.read', fields: [f('owner_membership_id', 'New owner', 'id')] },
    { key: 'crm.contact.created', module: ModuleKey.CRM, name: 'Contact created', description: 'A contact person was added.', kind: E, entity_type: RecordEntityType.CRM_CONTACT, required_permission: 'crm.contacts.read' },
    { key: 'crm.lead.created', module: ModuleKey.CRM, name: 'Lead created', description: 'A new lead arrived (form, import, API or manual).', kind: E, entity_type: RecordEntityType.CRM_LEAD, required_permission: 'crm.leads.read', fields: [f('source', 'Source'), f('name', 'Lead name')], sample_payload: { name: 'Jane Doe', source: 'WEBSITE' } },
    { key: 'crm.lead.converted', module: ModuleKey.CRM, name: 'Lead converted', description: 'A lead was converted to a company, contact and deal.', kind: E, entity_type: RecordEntityType.CRM_LEAD, required_permission: 'crm.leads.read' },
    { key: 'crm.deal.created', module: ModuleKey.CRM, name: 'Deal created', description: 'A new deal was opened.', kind: E, entity_type: RecordEntityType.CRM_DEAL, required_permission: 'crm.deals.read', fields: [f('name', 'Deal name'), f('amount', 'Amount', 'number')] },
    { key: 'crm.deal.stage_changed', module: ModuleKey.CRM, name: 'Deal stage changed', description: 'A deal moved to another pipeline stage.', kind: E, entity_type: RecordEntityType.CRM_DEAL, required_permission: 'crm.deals.read', fields: [f('name', 'Deal name'), f('from_stage', 'From stage'), f('to_stage', 'To stage'), f('amount', 'Amount', 'number')], sample_payload: { name: 'Website redesign', from_stage: 'Proposal', to_stage: 'Negotiation', amount: 12000 } },
    { key: 'crm.deal.won', module: ModuleKey.CRM, name: 'Deal won', description: 'A deal was marked won.', kind: E, entity_type: RecordEntityType.CRM_DEAL, required_permission: 'crm.deals.read', fields: [f('name', 'Deal name'), f('value', 'Value', 'number'), f('currency', 'Currency'), f('company_id', 'Company', 'id'), f('owner_membership_id', 'Owner', 'id')], sample_payload: { name: 'Website redesign', value: 12000, currency: 'EUR' } },
    { key: 'crm.deal.lost', module: ModuleKey.CRM, name: 'Deal lost', description: 'A deal was marked lost.', kind: E, entity_type: RecordEntityType.CRM_DEAL, required_permission: 'crm.deals.read', fields: [f('name', 'Deal name'), f('lost_reason_id', 'Lost reason', 'id'), f('company_id', 'Company', 'id')] },

    // --- 03 Proposals / 04 Contracts -----------------------------------------------------------
    { key: 'proposals.proposal.sent', module: ModuleKey.PROPOSALS, name: 'Proposal sent', description: 'A proposal was sent to the customer.', kind: E, entity_type: RecordEntityType.PROPOSAL, required_permission: 'proposals.proposals.read', fields: [f('title', 'Title'), f('total', 'Total', 'number')] },
    { key: 'proposals.proposal.viewed', module: ModuleKey.PROPOSALS, name: 'Proposal viewed', description: 'The customer opened the proposal link.', kind: E, entity_type: RecordEntityType.PROPOSAL, required_permission: 'proposals.proposals.read' },
    { key: 'proposals.proposal.accepted', module: ModuleKey.PROPOSALS, name: 'Proposal accepted', description: 'The customer accepted the proposal.', kind: E, entity_type: RecordEntityType.PROPOSAL, required_permission: 'proposals.proposals.read', fields: [f('title', 'Title'), f('total', 'Total', 'number')] },
    { key: 'proposals.proposal.declined', module: ModuleKey.PROPOSALS, name: 'Proposal declined', description: 'The customer declined the proposal.', kind: E, entity_type: RecordEntityType.PROPOSAL, required_permission: 'proposals.proposals.read' },
    { key: 'contracts.contract.approved', module: ModuleKey.CONTRACTS, name: 'Contract approved', description: 'Internal approval of a contract completed.', kind: E, entity_type: RecordEntityType.CONTRACT, required_permission: 'contracts.contracts.read' },
    { key: 'contracts.contract.signed', module: ModuleKey.CONTRACTS, name: 'Contract fully signed', description: 'All signatories signed the contract.', kind: E, entity_type: RecordEntityType.CONTRACT, required_permission: 'contracts.contracts.read', fields: [f('title', 'Title'), f('value', 'Value', 'number')] },
    { key: 'contracts.contract.expiring', module: ModuleKey.CONTRACTS, name: 'Contract expiring', description: 'A contract reaches its notice / expiry window.', kind: E, entity_type: RecordEntityType.CONTRACT, required_permission: 'contracts.contracts.read', fields: [f('days_left', 'Days left', 'number')] },
    { key: 'contracts.contract.terminated', module: ModuleKey.CONTRACTS, name: 'Contract terminated', description: 'A contract was terminated.', kind: E, entity_type: RecordEntityType.CONTRACT, required_permission: 'contracts.contracts.read' },

    // --- 05 Projects / 06 Tasks -------------------------------------------------------------------
    { key: 'projects.project.created', module: ModuleKey.PROJECTS, name: 'Project created', description: 'A project was created.', kind: E, entity_type: RecordEntityType.PROJECT, required_permission: 'projects.projects.read', fields: [f('name', 'Project name'), f('company_id', 'Customer', 'id')] },
    { key: 'projects.project.status_changed', module: ModuleKey.PROJECTS, name: 'Project status changed', description: 'A project moved to another status.', kind: E, entity_type: RecordEntityType.PROJECT, required_permission: 'projects.projects.read', fields: [f('name', 'Project name'), f('from', 'From status'), f('to', 'To status')] },
    { key: 'projects.project.completed', module: ModuleKey.PROJECTS, name: 'Project completed', description: 'A project was completed.', kind: E, entity_type: RecordEntityType.PROJECT, required_permission: 'projects.projects.read' },
    { key: 'projects.milestone.completed', module: ModuleKey.PROJECTS, name: 'Milestone completed', description: 'A project milestone was completed.', kind: E, entity_type: RecordEntityType.PROJECT_MILESTONE, required_permission: 'projects.projects.read' },
    { key: 'tasks.task.created', module: ModuleKey.TASKS, name: 'Task created', description: 'A task was created.', kind: E, entity_type: RecordEntityType.TASK, required_permission: 'tasks.tasks.read', fields: [f('title', 'Title'), f('priority', 'Priority'), f('project_id', 'Project', 'id')], sample_payload: { title: 'Prepare kickoff deck', priority: 'HIGH' } },
    { key: 'tasks.task.status_changed', module: ModuleKey.TASKS, name: 'Task status changed', description: 'A task moved to another status.', kind: E, entity_type: RecordEntityType.TASK, required_permission: 'tasks.tasks.read', fields: [f('title', 'Title'), f('from', 'From status'), f('to', 'To status')] },
    { key: 'tasks.task.assigned', module: ModuleKey.TASKS, name: 'Task assigned', description: 'A task was assigned to a member.', kind: E, entity_type: RecordEntityType.TASK, required_permission: 'tasks.tasks.read', fields: [f('assignee_membership_id', 'Assignee', 'id')] },
    { key: 'tasks.task.completed', module: ModuleKey.TASKS, name: 'Task completed', description: 'A task was completed.', kind: E, entity_type: RecordEntityType.TASK, required_permission: 'tasks.tasks.read' },
    { key: 'tasks.task.overdue', module: ModuleKey.TASKS, name: 'Task overdue', description: 'A task passed its due date while open.', kind: E, entity_type: RecordEntityType.TASK, required_permission: 'tasks.tasks.read' },

    // --- 08 Finance -----------------------------------------------------------------------------------
    { key: 'finance.invoice.created', module: ModuleKey.FINANCE, name: 'Invoice created', description: 'An invoice was created.', kind: E, entity_type: RecordEntityType.INVOICE, required_permission: 'finance.invoices.read', fields: [f('number', 'Invoice number'), f('total', 'Total', 'number')] },
    { key: 'finance.invoice.paid', module: ModuleKey.FINANCE, name: 'Invoice paid', description: 'An invoice was paid in full.', kind: E, entity_type: RecordEntityType.INVOICE, required_permission: 'finance.invoices.read', fields: [f('number', 'Invoice number'), f('total', 'Total', 'number')] },
    { key: 'finance.invoice.overdue', module: ModuleKey.FINANCE, name: 'Invoice overdue', description: 'An invoice passed its due date unpaid.', kind: E, entity_type: RecordEntityType.INVOICE, required_permission: 'finance.invoices.read', fields: [f('number', 'Invoice number'), f('days_overdue', 'Days overdue', 'number')] },
    { key: 'finance.payment.failed', module: ModuleKey.FINANCE, name: 'Payment failed', description: 'A card or direct debit payment failed.', kind: E, entity_type: RecordEntityType.PAYMENT, required_permission: 'finance.payments.read' },

    // --- 10 People / 13 Support ------------------------------------------------------------------------
    { key: 'employees.leave.requested', module: ModuleKey.EMPLOYEES, name: 'Leave requested', description: 'An employee requested leave.', kind: E, entity_type: RecordEntityType.LEAVE_REQUEST, required_permission: 'employees.leave.read' },
    { key: 'employees.leave.approved', module: ModuleKey.EMPLOYEES, name: 'Leave approved', description: 'A leave request was approved.', kind: E, entity_type: RecordEntityType.LEAVE_REQUEST, required_permission: 'employees.leave.read' },
    { key: 'employees.employee.joined', module: ModuleKey.EMPLOYEES, name: 'Employee joined', description: 'A new employee record started.', kind: E, entity_type: RecordEntityType.EMPLOYEE, required_permission: 'employees.directory.read' },
    { key: 'support.ticket.created', module: ModuleKey.SUPPORT, name: 'Ticket created', description: 'A support ticket was opened (portal, email, chat or form).', kind: E, entity_type: RecordEntityType.TICKET, required_permission: 'support.tickets.read', fields: [f('subject', 'Subject'), f('priority', 'Priority'), f('channel', 'Channel')], sample_payload: { subject: 'Cannot log in', priority: 'HIGH', channel: 'PORTAL' } },
    { key: 'support.ticket.status_changed', module: ModuleKey.SUPPORT, name: 'Ticket status changed', description: 'A ticket moved to another status.', kind: E, entity_type: RecordEntityType.TICKET, required_permission: 'support.tickets.read', fields: [f('from', 'From status'), f('to', 'To status')] },
    { key: 'support.ticket.sla_at_risk', module: ModuleKey.SUPPORT, name: 'Ticket SLA at risk', description: 'A ticket is about to breach its SLA.', kind: E, entity_type: RecordEntityType.TICKET, required_permission: 'support.tickets.read' },

    // --- 14 Notifications (published only when Notifications → Settings → "Webhook events" is on) ---------------
    { key: 'notification.created', module: ModuleKey.NOTIFICATIONS, name: 'Notification created', description: 'A notification was created for a member (ids, event key, category, priority — no content).', kind: E, entity_type: RecordEntityType.NOTIFICATION, required_permission: 'notifications.audit.read', fields: [f('event_key', 'Source event'), f('category', 'Category'), f('priority', 'Priority'), f('recipient_membership_id', 'Recipient', 'id')] },
    { key: 'notification.delivered', module: ModuleKey.NOTIFICATIONS, name: 'Notification delivered', description: 'An email, SMS or push of a notification was sent.', kind: E, entity_type: RecordEntityType.NOTIFICATION, required_permission: 'notifications.audit.read', fields: [f('channel', 'Channel'), f('delivery_id', 'Delivery', 'id')] },
    { key: 'notification.failed', module: ModuleKey.NOTIFICATIONS, name: 'Notification delivery failed', description: 'An email, SMS or push of a notification failed after its retries.', kind: E, entity_type: RecordEntityType.NOTIFICATION, required_permission: 'notifications.audit.read', fields: [f('channel', 'Channel'), f('reason', 'Reason')] },
    { key: 'notification.read', module: ModuleKey.NOTIFICATIONS, name: 'Notification read', description: 'A member opened or marked a notification read.', kind: E, entity_type: RecordEntityType.NOTIFICATION, required_permission: 'notifications.audit.read', fields: [f('event_key', 'Source event')] },

    // --- 15 Docs / 17 Files -----------------------------------------------------------------------------
    { key: 'docs.page.created', module: ModuleKey.BUSINESS_DOCS, name: 'Doc page created', description: 'A wiki page was created.', kind: E, entity_type: RecordEntityType.WIKI_PAGE, required_permission: 'docs.pages.read', fields: [f('title', 'Title'), f('space_id', 'Space', 'id'), f('page_type', 'Page type'), f('status', 'Status')] },
    { key: 'docs.page.updated', module: ModuleKey.BUSINESS_DOCS, name: 'Doc page updated', description: 'A wiki page was saved (new version).', kind: E, entity_type: RecordEntityType.WIKI_PAGE, required_permission: 'docs.pages.read', fields: [f('title', 'Title')] },
    { key: 'docs.page.acknowledged', module: ModuleKey.BUSINESS_DOCS, name: 'Page acknowledged', description: 'A member acknowledged a required page.', kind: E, entity_type: RecordEntityType.WIKI_PAGE, required_permission: 'docs.pages.read' },
    { key: 'docs.page.published', module: ModuleKey.BUSINESS_DOCS, name: 'Doc page published', description: 'A wiki page was published.', kind: E, entity_type: RecordEntityType.WIKI_PAGE, required_permission: 'docs.pages.read', fields: [f('title', 'Title')] },
    { key: 'docs.form.submitted', module: ModuleKey.BUSINESS_DOCS, name: 'Form submitted', description: 'Someone submitted a custom form.', kind: E, entity_type: RecordEntityType.FORM_SUBMISSION, required_permission: 'docs.forms.read', fields: [f('form_id', 'Form', 'id'), f('form_name', 'Form name'), f('anonymous', 'Anonymous', 'boolean'), f('status', 'Status')], sample_payload: { form_name: 'Website contact', anonymous: true, status: 'SUBMITTED' } },
    { key: 'docs.checklist_run.completed', module: ModuleKey.BUSINESS_DOCS, name: 'Checklist completed', description: 'A checklist run was completed.', kind: E, required_permission: 'docs.pages.read' },
    { key: 'documents.document.uploaded', module: ModuleKey.DOCUMENTS, name: 'File uploaded', description: 'A document was uploaded.', kind: E, entity_type: RecordEntityType.DOCUMENT, required_permission: 'documents.documents.read', fields: [f('title', 'Title'), f('filename', 'File name'), f('mimetype', 'MIME type'), f('size', 'Size (bytes)', 'number'), f('folder_id', 'Folder', 'id'), f('project_id', 'Project', 'id')], sample_payload: { title: 'Signed contract', filename: 'contract.pdf', mimetype: 'application/pdf', size: 120000 } },
    { key: 'documents.document.version_created', module: ModuleKey.DOCUMENTS, name: 'New file version', description: 'A new version of a document was uploaded.', kind: E, entity_type: RecordEntityType.DOCUMENT, required_permission: 'documents.documents.read', fields: [f('title', 'Title'), f('version_number', 'Version', 'number')] },
    { key: 'documents.vault.revealed', module: ModuleKey.DOCUMENTS, name: 'Vault secret revealed', description: 'Someone revealed a vault credential.', kind: E, required_permission: 'documents.vault.read' },
    { key: 'documents.document.shared', module: ModuleKey.DOCUMENTS, name: 'File shared', description: 'A document was shared internally or by link.', kind: E, entity_type: RecordEntityType.DOCUMENT, required_permission: 'documents.documents.read' },
    { key: 'documents.document.approved', module: ModuleKey.DOCUMENTS, name: 'File approved', description: 'A document approval completed.', kind: E, entity_type: RecordEntityType.DOCUMENT, required_permission: 'documents.documents.read' },

    // --- 20 Automation -------------------------------------------------------------------------------------
    { key: 'automation.rule_run_failed', module: ModuleKey.AUTOMATION, name: 'Workflow run failed', description: 'A workflow run failed permanently (dead-lettered).', kind: E, entity_type: RecordEntityType.AUTOMATION_RUN, required_permission: 'automation.runs.read', fields: [f('rule_name', 'Workflow'), f('error_message', 'Error')] },
    { key: 'automation.rule_run_completed', module: ModuleKey.AUTOMATION, name: 'Workflow run completed', description: 'A workflow run finished successfully.', kind: E, entity_type: RecordEntityType.AUTOMATION_RUN, required_permission: 'automation.runs.read', fields: [f('rule_name', 'Workflow')] },

    // --- Date-relative (20 §3): `date.<source>` with { offset_days, direction } ---------------------------------
    ...DATE_TRIGGER_SOURCES.map((s): TriggerCatalogEntry => ({
        key: `date.${s.key}`,
        module: s.module,
        name: s.name,
        description: `${s.description} Runs once per record when the date is the configured number of days away.`,
        kind: AutomationTriggerKind.DATE_RELATIVE,
        entity_type: s.entity_type,
        required_permission: s.required_permission,
        fields: [...s.fields, f('days_offset', 'Days offset', 'number'), f('direction', 'Direction')],
        sample_payload: s.sample_payload,
        date_label: s.date_label,
    })),
];

export const TRIGGER_BY_KEY = new Map(TRIGGER_CATALOG.map((t) => [t.key, t]));
