import { TicketPriority, TicketStatusCategory } from 'generated/prisma';

/** Permission keys of 13 Customer Support (api/prisma/seed/permission-catalog.ts). */
export const SUPPORT_PERMS = {
    conversationsRead: 'support.conversations.read',
    conversationsCreate: 'support.conversations.create',
    conversationsUpdate: 'support.conversations.update',
    conversationsAssign: 'support.conversations.assign',
    conversationsReply: 'support.conversations.reply',
    conversationsClose: 'support.conversations.close',
    conversationsDelete: 'support.conversations.delete',
    ticketsRead: 'support.tickets.read',
    ticketsCreate: 'support.tickets.create',
    ticketsUpdate: 'support.tickets.update',
    ticketsAssign: 'support.tickets.assign',
    ticketsMerge: 'support.tickets.merge',
    ticketsEscalate: 'support.tickets.escalate',
    ticketsArchive: 'support.tickets.archive',
    ticketsDelete: 'support.tickets.delete',
    ticketsExport: 'support.tickets.export',
    ticketsConvert: 'support.tickets.convert_to_task',
    knowledgeRead: 'support.knowledge.read',
    knowledgeCreate: 'support.knowledge.create',
    knowledgeUpdate: 'support.knowledge.update',
    knowledgePublish: 'support.knowledge.publish',
    knowledgeArchive: 'support.knowledge.archive',
    knowledgeDelete: 'support.knowledge.delete',
    slaManage: 'support.sla_policies.manage',
    cannedManage: 'support.canned_responses.manage',
    inboxesRead: 'support.inboxes.read',
    inboxesManage: 'support.inboxes.manage',
    aiUse: 'support.ai.use',
    aiConfigure: 'support.ai.configure',
    analyticsRead: 'support.analytics.read',
    settingsManage: 'support.settings.manage',
    csatRead: 'support.csat.read',
    incidentsPublish: 'support.incidents.publish',
} as const;

/** Statuses created for every organization the first time Support is used (13 §2, §13). */
export const DEFAULT_TICKET_STATUSES: { name: string; slug: string; category: TicketStatusCategory; color: string; is_default?: boolean; pauses_sla?: boolean; customer_label?: string }[] = [
    { name: 'New', slug: 'new', category: 'NEW', color: 'info', is_default: true, customer_label: 'Received' },
    { name: 'Open', slug: 'open', category: 'OPEN', color: 'info', customer_label: 'In progress' },
    { name: 'Waiting on customer', slug: 'waiting-on-customer', category: 'PENDING_CUSTOMER', color: 'warning', pauses_sla: true, customer_label: 'Awaiting your reply' },
    { name: 'On hold', slug: 'on-hold', category: 'ON_HOLD', color: 'neutral', pauses_sla: true, customer_label: 'On hold' },
    { name: 'Resolved', slug: 'resolved', category: 'RESOLVED', color: 'success', customer_label: 'Resolved' },
    { name: 'Closed', slug: 'closed', category: 'CLOSED', color: 'neutral', customer_label: 'Closed' },
];

/** Default SLA targets in minutes (calendar time) per priority. */
export const DEFAULT_SLA_TARGETS: { priority: TicketPriority; first_response_minutes: number; next_response_minutes: number; resolution_minutes: number }[] = [
    { priority: 'URGENT', first_response_minutes: 30, next_response_minutes: 60, resolution_minutes: 480 },
    { priority: 'HIGH', first_response_minutes: 120, next_response_minutes: 240, resolution_minutes: 1440 },
    { priority: 'NORMAL', first_response_minutes: 480, next_response_minutes: 720, resolution_minutes: 2880 },
    { priority: 'LOW', first_response_minutes: 1440, next_response_minutes: 1440, resolution_minutes: 7200 },
];

export const CLOSED_CATEGORIES: TicketStatusCategory[] = ['RESOLVED', 'CLOSED'];
export const OPEN_CATEGORIES: TicketStatusCategory[] = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD'];

/** Minimal member projection for assignees / authors. Never includes personal data beyond name and photo. */
export const MEMBER_SELECT = {
    id: true,
    job_title: true,
    user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } },
} as const;

export const USER_PUBLIC_SELECT = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } as const;

/** Customer-facing label on every automatic AI answer (13 §3: AI replies are clearly marked). */
export const AI_REPLY_LABEL = 'Answered by our AI assistant. Reply "human" to talk to a person.';
