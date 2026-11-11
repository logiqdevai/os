import { AutomationActionKind, ModuleKey } from 'generated/prisma';

/** One input of an action, rendered by the form-based workflow builder. Values may contain `{{…}}` templates. */
export interface ActionField {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'boolean' | 'json' | 'select' | 'member' | 'members' | 'webhook' | 'conditions';
    required?: boolean;
    placeholder?: string;
    help?: string;
    options?: { id: string; label: string }[];
    default?: unknown;
}

export type ActionExecutor =
    /** Executed by the engine itself (wait, approval, condition gate, webhook call, notify). */
    | { type: 'builtin' }
    /** Executed by calling the owning module's MCP tool (same service + zod validation + permission as REST). */
    | { type: 'mcp'; tool: string; map?: (inputs: Record<string, unknown>) => Record<string, unknown> };

export interface ActionCatalogEntry {
    key: string;
    module: ModuleKey;
    name: string;
    description: string;
    kind: AutomationActionKind;
    executor: ActionExecutor;
    /** Permission the run principal must hold; for MCP actions the tool's own permission is checked as well. */
    required_permission?: string;
    /** 20 §6 — delete, payment, external send: needs explicit enablement and (by default) approval. */
    is_destructive?: boolean;
    is_customer_facing?: boolean;
    retryable?: boolean;
    fields: ActionField[];
}

const PRIORITIES = [
    { id: 'LOW', label: 'Low' },
    { id: 'MEDIUM', label: 'Medium' },
    { id: 'HIGH', label: 'High' },
    { id: 'URGENT', label: 'Urgent' },
];

/** Generic update: `{ id, changes: {...} }` → tool args `{ id, ...changes }`. */
const updateMap = (inputs: Record<string, unknown>) => ({ id: inputs.id, ...((inputs.changes as Record<string, unknown>) ?? {}) });
const recordId = (label: string): ActionField => ({ key: 'id', label, type: 'text', required: true, default: '{{event.entity_id}}', help: 'Defaults to the record of the triggering event.' });
const changes: ActionField = { key: 'changes', label: 'Fields to set (JSON)', type: 'json', required: true, placeholder: '{ "status": "IN_PROGRESS" }' };

/**
 * 20 §4 — action catalog. Module actions run through the module's MCP tool so they reuse the module's service,
 * validation and permission key, under the rule's run-as principal (`AuthorizationService.contextFor`).
 * An action whose tool is not registered yet is listed as unavailable; a run using it fails with `action_unavailable`.
 */
export const ACTION_CATALOG: ActionCatalogEntry[] = [
    // --- Engine built-ins -----------------------------------------------------------------------
    {
        key: 'engine.condition', module: ModuleKey.AUTOMATION, name: 'Continue only if', kind: AutomationActionKind.BRANCH, executor: { type: 'builtin' },
        description: 'Stops the run (as succeeded) when the conditions do not match; later steps run only when they do.',
        fields: [{ key: 'conditions', label: 'Conditions', type: 'conditions', required: true }],
    },
    {
        key: 'engine.wait', module: ModuleKey.AUTOMATION, name: 'Wait', kind: AutomationActionKind.WAIT, executor: { type: 'builtin' },
        description: 'Pauses the run for a duration, then continues with the next step.',
        fields: [{ key: 'minutes', label: 'Minutes to wait', type: 'number', required: true, default: 60 }],
    },
    {
        key: 'engine.approval', module: ModuleKey.AUTOMATION, name: 'Require approval', kind: AutomationActionKind.APPROVAL, executor: { type: 'builtin' },
        description: 'Pauses the run until the chosen member approves or rejects. Rejection stops the run.',
        fields: [
            { key: 'approver_membership_id', label: 'Approver', type: 'member', required: true },
            { key: 'message', label: 'What is being approved', type: 'textarea', placeholder: 'Approve sending the renewal offer to {{event.payload.name}}' },
            { key: 'expires_after_hours', label: 'Expires after (hours)', type: 'number', default: 48 },
        ],
    },
    {
        key: 'notifications.notify', module: ModuleKey.NOTIFICATIONS, name: 'Send notification', kind: AutomationActionKind.NOTIFY, executor: { type: 'builtin' },
        description: 'Puts an in-app notification in the inbox of the chosen members (14 Notifications).',
        fields: [
            { key: 'recipient_membership_ids', label: 'Recipients', type: 'members', required: true },
            { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Deal {{event.payload.name}} was won' },
            { key: 'body', label: 'Message', type: 'textarea' },
            { key: 'link', label: 'Link', type: 'text', placeholder: '/crm/deals/{{event.entity_id}}' },
        ],
    },
    {
        key: 'webhook.call', module: ModuleKey.AUTOMATION, name: 'Call webhook', kind: AutomationActionKind.CALL_WEBHOOK, executor: { type: 'builtin' },
        description: 'POSTs a signed JSON payload to one of the organization\'s outbound webhook endpoints.',
        required_permission: 'automation.webhooks.read',
        fields: [
            { key: 'webhook_id', label: 'Endpoint', type: 'webhook', required: true },
            { key: 'payload', label: 'Payload (JSON, optional)', type: 'json', help: 'Defaults to the triggering event.' },
        ],
    },

    // --- Module actions (through MCP tools) -----------------------------------------------------
    {
        key: 'tasks.create', module: ModuleKey.TASKS, name: 'Create task', kind: AutomationActionKind.CREATE_RECORD,
        executor: { type: 'mcp', tool: 'tasks_tasks_create' }, required_permission: 'tasks.tasks.create',
        description: 'Creates a task (06 Tasks).',
        fields: [
            { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Kick-off with {{event.payload.name}}' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'project_id', label: 'Project id', type: 'text' },
            { key: 'assignee_membership_id', label: 'Assignee', type: 'member' },
            { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
        ],
    },
    {
        key: 'tasks.update', module: ModuleKey.TASKS, name: 'Update task', kind: AutomationActionKind.UPDATE_FIELD,
        executor: { type: 'mcp', tool: 'tasks_tasks_update', map: updateMap }, required_permission: 'tasks.tasks.update',
        description: 'Updates fields of a task (status, assignee, priority …).', fields: [recordId('Task id'), changes],
    },
    {
        key: 'tasks.assign', module: ModuleKey.TASKS, name: 'Assign task', kind: AutomationActionKind.ASSIGN,
        executor: { type: 'mcp', tool: 'tasks_tasks_assign' }, required_permission: 'tasks.tasks.assign',
        description: 'Assigns a task to a member.',
        fields: [recordId('Task id'), { key: 'assignee_membership_id', label: 'Assignee', type: 'member', required: true }],
    },
    {
        key: 'crm.lead.create', module: ModuleKey.CRM, name: 'Create lead', kind: AutomationActionKind.CREATE_RECORD,
        executor: { type: 'mcp', tool: 'crm_leads_create' }, required_permission: 'crm.leads.create',
        description: 'Creates a CRM lead (for example from an inbound webhook or a form).',
        fields: [
            { key: 'name', label: 'Name', type: 'text', required: true, placeholder: '{{event.payload.body.name}}' },
            { key: 'email', label: 'Email', type: 'text', placeholder: '{{event.payload.body.email}}' },
            { key: 'company_name', label: 'Company', type: 'text' },
        ],
    },
    {
        key: 'support.ticket.create', module: ModuleKey.SUPPORT, name: 'Create ticket', kind: AutomationActionKind.CREATE_RECORD,
        executor: { type: 'mcp', tool: 'support_tickets_create' }, required_permission: 'support.tickets.create',
        description: 'Opens a support ticket (13 Support).',
        fields: [
            { key: 'subject', label: 'Subject', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'company_id', label: 'Company id', type: 'text' },
            { key: 'priority', label: 'Priority', type: 'select', options: PRIORITIES },
        ],
    },
    {
        key: 'crm.company.update', module: ModuleKey.CRM, name: 'Update company', kind: AutomationActionKind.UPDATE_FIELD,
        executor: { type: 'mcp', tool: 'crm_companies_update', map: updateMap }, required_permission: 'crm.companies.update',
        description: 'Updates fields of a CRM company.', fields: [recordId('Company id'), changes],
    },
    {
        key: 'crm.company.assign', module: ModuleKey.CRM, name: 'Assign company owner', kind: AutomationActionKind.ASSIGN,
        executor: { type: 'mcp', tool: 'crm_companies_assign' }, required_permission: 'crm.companies.assign',
        description: 'Changes the owner of a CRM company.',
        fields: [recordId('Company id'), { key: 'owner_membership_id', label: 'New owner', type: 'member', required: true }],
    },
    {
        key: 'crm.deal.update', module: ModuleKey.CRM, name: 'Update deal', kind: AutomationActionKind.UPDATE_FIELD,
        executor: { type: 'mcp', tool: 'crm_deals_update', map: updateMap }, required_permission: 'crm.deals.update',
        description: 'Updates fields of a deal.', fields: [recordId('Deal id'), changes],
    },
    {
        key: 'projects.project.update', module: ModuleKey.PROJECTS, name: 'Update project', kind: AutomationActionKind.UPDATE_FIELD,
        executor: { type: 'mcp', tool: 'projects_projects_update', map: updateMap }, required_permission: 'projects.projects.update',
        description: 'Updates fields of a project.', fields: [recordId('Project id'), changes],
    },
    {
        key: 'docs.page.create', module: ModuleKey.BUSINESS_DOCS, name: 'Create doc page', kind: AutomationActionKind.CREATE_RECORD,
        executor: { type: 'mcp', tool: 'docs_pages_create' }, required_permission: 'docs.pages.create',
        description: 'Creates a wiki page in a space (15 Docs).',
        fields: [
            { key: 'space_id', label: 'Space id', type: 'text', required: true },
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'content', label: 'Content (markdown)', type: 'textarea' },
        ],
    },
    {
        key: 'messaging.message.post', module: ModuleKey.MESSAGING, name: 'Post message to channel', kind: AutomationActionKind.POST_MESSAGE,
        executor: { type: 'mcp', tool: 'messaging_messages_post' }, required_permission: 'messaging.messages.post',
        description: 'Posts a message in a team channel (12 Messaging).',
        fields: [
            { key: 'channel_id', label: 'Channel id', type: 'text', required: true },
            { key: 'body', label: 'Message', type: 'textarea', required: true },
        ],
    },
    {
        key: 'mcp.tool', module: ModuleKey.AUTOMATION, name: 'Run any tool', kind: AutomationActionKind.CUSTOM,
        executor: { type: 'builtin' },
        description: 'Calls any MCP tool of the platform with JSON arguments, under the run-as principal and its permissions.',
        fields: [
            { key: 'tool', label: 'Tool name', type: 'text', required: true, placeholder: 'crm_companies_update' },
            { key: 'arguments', label: 'Arguments (JSON)', type: 'json', required: true },
        ],
    },
];

export const ACTION_BY_KEY = new Map(ACTION_CATALOG.map((a) => [a.key, a]));
