import { ContractStatus, CrmDealStatus, InvoiceStatus, ModuleKey, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import type { CatalogField } from './trigger-catalog';

/** One record whose date falls in the scanned window. `payload` is exposed to templates as `event.payload`. */
export interface DateRecord {
    id: string;
    date: Date;
    payload: Record<string, unknown>;
}

/**
 * 20 §3 — a date field the DATE_RELATIVE trigger can watch ("3 days before task due date").
 * Trigger key = `date.<key>`; config = `{ offset_days, direction: 'before' | 'after' | 'on' }`.
 */
export interface DateTriggerSource {
    key: string;
    module: ModuleKey;
    entity_type: RecordEntityType;
    name: string;
    /** Label of the watched date, used in the builder ("due date"). */
    date_label: string;
    description: string;
    required_permission: string;
    fields: CatalogField[];
    sample_payload: Record<string, unknown>;
    /** Open records of the organization whose watched date is in [from, to] (UTC calendar days). */
    find: (prisma: PrismaService, organizationId: string, from: Date, to: Date) => Promise<DateRecord[]>;
}

const f = (path: string, label: string, type: CatalogField['type'] = 'string'): CatalogField => ({ path, label, type });
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const LIMIT = 500;

export const DATE_TRIGGER_SOURCES: DateTriggerSource[] = [
    {
        key: 'tasks.task.due_date', module: ModuleKey.TASKS, entity_type: RecordEntityType.TASK, name: 'Task due date', date_label: 'due date',
        description: 'Open tasks (not completed or archived) relative to their due date.', required_permission: 'tasks.tasks.read',
        fields: [f('title', 'Title'), f('date', 'Due date', 'date'), f('assignee_membership_id', 'Assignee', 'id'), f('project_id', 'Project', 'id'), f('team_id', 'Team', 'id')],
        sample_payload: { title: 'Prepare kick-off deck', date: '2026-12-01', days_offset: 3 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.task.findMany({
                where: { organization_id: org, due_date: { gte: from, lte: to }, completed_at: null, archived_at: null },
                select: { id: true, title: true, due_date: true, assignee_membership_id: true, project_id: true, team_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.due_date as Date, payload: { title: r.title, date: day(r.due_date), assignee_membership_id: r.assignee_membership_id, assignee_membership_ids: r.assignee_membership_id ? [r.assignee_membership_id] : [], project_id: r.project_id, team_id: r.team_id } }));
        },
    },
    {
        key: 'contracts.contract.end_date', module: ModuleKey.CONTRACTS, entity_type: RecordEntityType.CONTRACT, name: 'Contract end date', date_label: 'end date',
        description: 'Signed or active contracts relative to their end date.', required_permission: 'contracts.contracts.read',
        fields: [f('title', 'Title'), f('number', 'Number'), f('date', 'End date', 'date'), f('owner_membership_id', 'Owner', 'id')],
        sample_payload: { title: 'Website retainer', number: 'CTR-2026-0004', date: '2026-12-31', days_offset: 30 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.contract.findMany({
                where: { organization_id: org, end_date: { gte: from, lte: to }, archived_at: null, status: { in: [ContractStatus.FULLY_SIGNED, ContractStatus.ACTIVE, ContractStatus.EXPIRING] } },
                select: { id: true, title: true, number: true, end_date: true, owner_membership_id: true, branch_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.end_date as Date, payload: { title: r.title, number: r.number, date: day(r.end_date), owner_membership_id: r.owner_membership_id, branch_id: r.branch_id } }));
        },
    },
    {
        key: 'contracts.contract.notice_deadline', module: ModuleKey.CONTRACTS, entity_type: RecordEntityType.CONTRACT, name: 'Contract notice deadline', date_label: 'notice deadline',
        description: 'Active contracts relative to the last day to give notice.', required_permission: 'contracts.contracts.read',
        fields: [f('title', 'Title'), f('number', 'Number'), f('date', 'Notice deadline', 'date'), f('owner_membership_id', 'Owner', 'id')],
        sample_payload: { title: 'Website retainer', number: 'CTR-2026-0004', date: '2026-11-30', days_offset: 14 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.contract.findMany({
                where: { organization_id: org, notice_deadline: { gte: from, lte: to }, archived_at: null, status: { in: [ContractStatus.FULLY_SIGNED, ContractStatus.ACTIVE, ContractStatus.EXPIRING] } },
                select: { id: true, title: true, number: true, notice_deadline: true, owner_membership_id: true, branch_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.notice_deadline as Date, payload: { title: r.title, number: r.number, date: day(r.notice_deadline), owner_membership_id: r.owner_membership_id, branch_id: r.branch_id } }));
        },
    },
    {
        key: 'finance.invoice.due_date', module: ModuleKey.FINANCE, entity_type: RecordEntityType.INVOICE, name: 'Invoice due date', date_label: 'due date',
        description: 'Unpaid invoices relative to their due date.', required_permission: 'finance.invoices.read',
        fields: [f('number', 'Invoice number'), f('date', 'Due date', 'date'), f('amount_due', 'Amount due', 'number'), f('currency', 'Currency'), f('company_id', 'Company', 'id')],
        sample_payload: { number: 'INV-2026-0012', date: '2026-12-01', amount_due: 1200, currency: 'EUR', days_offset: 3 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.invoice.findMany({
                where: { organization_id: org, due_date: { gte: from, lte: to }, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
                select: { id: true, number: true, due_date: true, amount_due: true, currency: true, company_id: true, project_id: true, branch_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.due_date as Date, payload: { number: r.number, date: day(r.due_date), amount_due: Number(r.amount_due), currency: r.currency, company_id: r.company_id, project_id: r.project_id, branch_id: r.branch_id } }));
        },
    },
    {
        key: 'projects.project.target_completion', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, name: 'Project target completion', date_label: 'target completion',
        description: 'Open projects relative to their target completion date.', required_permission: 'projects.projects.read',
        fields: [f('name', 'Project name'), f('date', 'Target completion', 'date'), f('owner_membership_id', 'Owner', 'id'), f('company_id', 'Customer', 'id')],
        sample_payload: { name: 'Website relaunch', date: '2026-12-15', days_offset: 7 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.project.findMany({
                where: { organization_id: org, target_completion: { gte: from, lte: to }, completed_at: null, cancelled_at: null, archived_at: null },
                select: { id: true, name: true, target_completion: true, owner_membership_id: true, company_id: true, team_id: true, branch_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.target_completion as Date, payload: { name: r.name, date: day(r.target_completion), owner_membership_id: r.owner_membership_id, company_id: r.company_id, project_id: r.id, team_id: r.team_id, branch_id: r.branch_id } }));
        },
    },
    {
        key: 'crm.deal.expected_close_date', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_DEAL, name: 'Deal expected close date', date_label: 'expected close date',
        description: 'Open deals relative to their expected close date.', required_permission: 'crm.deals.read',
        fields: [f('name', 'Deal name'), f('date', 'Expected close', 'date'), f('value', 'Value', 'number'), f('owner_membership_id', 'Owner', 'id')],
        sample_payload: { name: 'Website redesign', date: '2026-12-01', value: 12000, days_offset: 7 },
        find: async (prisma, org, from, to) => {
            const rows = await prisma.crmDeal.findMany({
                where: { organization_id: org, expected_close_date: { gte: from, lte: to }, status: CrmDealStatus.OPEN, archived_at: null },
                select: { id: true, name: true, expected_close_date: true, value: true, currency: true, owner_membership_id: true, company_id: true, team_id: true, branch_id: true },
                take: LIMIT,
            });
            return rows.map((r) => ({ id: r.id, date: r.expected_close_date as Date, payload: { name: r.name, date: day(r.expected_close_date), value: Number(r.value), currency: r.currency, owner_membership_id: r.owner_membership_id, company_id: r.company_id, team_id: r.team_id, branch_id: r.branch_id } }));
        },
    },
];

export const DATE_SOURCE_BY_TRIGGER_KEY = new Map(DATE_TRIGGER_SOURCES.map((s) => [`date.${s.key}`, s]));

export type DateDirection = 'before' | 'after' | 'on';
export interface DateTriggerConfig {
    offset_days: number;
    direction: DateDirection;
}

export function dateConfig(raw: unknown): DateTriggerConfig {
    const c = (raw ?? {}) as Record<string, unknown>;
    const direction = c.direction === 'after' ? 'after' : c.direction === 'on' ? 'on' : 'before';
    const offset = direction === 'on' ? 0 : Math.max(0, Math.min(365, Math.floor(Number(c.offset_days ?? 0)) || 0));
    return { offset_days: offset, direction };
}
