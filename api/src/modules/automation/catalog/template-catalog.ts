import { AutomationTriggerKind, ModuleKey } from 'generated/prisma';
import { RuleDefinition } from '../engine/rule-definition.types';

export interface SystemTemplate {
    key: string;
    module: ModuleKey;
    name: string;
    description: string;
    category: string;
    definition: RuleDefinition;
}

/** 20 §5, §14 — recipes shipped with the platform (organization_id null). Organization templates live in the DB. */
export const SYSTEM_TEMPLATES: SystemTemplate[] = [
    {
        key: 'deal-won-kickoff-task',
        module: ModuleKey.CRM,
        name: 'Deal won → kick-off task',
        description: 'When a deal is won, create a kick-off task and notify the deal owner.',
        category: 'Sales',
        definition: {
            trigger_kind: AutomationTriggerKind.EVENT,
            trigger_key: 'crm.deal.won',
            conditions: { all: [] },
            actions: [
                { key: 'create_task', action_key: 'tasks.create', inputs: { title: 'Kick-off: {{event.payload.name}}', priority: 'HIGH' }, on_error: 'stop' },
            ],
        },
    },
    {
        key: 'urgent-ticket-alert',
        module: ModuleKey.SUPPORT,
        name: 'Urgent ticket → alert the team lead',
        description: 'Notify a lead whenever a ticket arrives with HIGH or URGENT priority.',
        category: 'Support',
        definition: {
            trigger_kind: AutomationTriggerKind.EVENT,
            trigger_key: 'support.ticket.created',
            conditions: { all: [{ path: 'event.payload.priority', operator: 'in', value: ['HIGH', 'URGENT'] }] },
            actions: [
                { key: 'notify_lead', action_key: 'notifications.notify', inputs: { recipient_membership_ids: [], title: 'Urgent ticket: {{event.payload.subject}}', link: '/support/tickets/{{event.entity_id}}' }, on_error: 'stop' },
            ],
        },
    },
    {
        key: 'form-submission-webhook',
        module: ModuleKey.BUSINESS_DOCS,
        name: 'Form submitted → send to webhook',
        description: 'Forward every form submission to an external system through a signed webhook.',
        category: 'Integrations',
        definition: {
            trigger_kind: AutomationTriggerKind.EVENT,
            trigger_key: 'docs.form.submitted',
            conditions: { all: [] },
            actions: [{ key: 'forward', action_key: 'webhook.call', inputs: { webhook_id: '' }, on_error: 'stop' }],
        },
    },
    {
        key: 'file-uploaded-approval',
        module: ModuleKey.DOCUMENTS,
        name: 'Contract file uploaded → approval, then notify',
        description: 'When a PDF is uploaded, ask a reviewer to approve before notifying the team.',
        category: 'Documents',
        definition: {
            trigger_kind: AutomationTriggerKind.EVENT,
            trigger_key: 'documents.document.uploaded',
            conditions: { all: [{ path: 'event.payload.mimetype', operator: 'eq', value: 'application/pdf' }] },
            actions: [
                { key: 'review', action_key: 'engine.approval', inputs: { approver_membership_id: '', message: 'Review {{event.payload.title}}', expires_after_hours: 48 }, on_error: 'stop' },
                { key: 'tell_team', action_key: 'notifications.notify', inputs: { recipient_membership_ids: [], title: 'Approved file: {{event.payload.title}}' }, on_error: 'stop' },
            ],
        },
    },
    {
        key: 'weekday-morning-digest',
        module: ModuleKey.AUTOMATION,
        name: 'Weekday 9:00 → webhook digest',
        description: 'Every weekday at 9:00 call a webhook (for example a reporting system).',
        category: 'Scheduled',
        definition: {
            trigger_kind: AutomationTriggerKind.SCHEDULE,
            trigger_key: 'schedule.cron',
            trigger_config: { cron: '0 9 * * 1-5', timezone: 'Europe/Athens' },
            conditions: { all: [] },
            actions: [{ key: 'digest', action_key: 'webhook.call', inputs: { webhook_id: '' }, on_error: 'stop' }],
        },
    },
];
