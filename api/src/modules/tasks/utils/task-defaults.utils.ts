import { Prisma, TaskStatusCategory } from 'generated/prisma';

/** PrismaService or a transaction client. */
type Client = Prisma.TransactionClient;

/** Linear-style default workflow (06 §3), created lazily per team (or organization-wide when team is null). */
export const DEFAULT_TASK_STATUSES: { name: string; slug: string; category: TaskStatusCategory; color: string; is_default?: boolean }[] = [
    { name: 'Backlog', slug: 'backlog', category: TaskStatusCategory.BACKLOG, color: 'neutral' },
    { name: 'Todo', slug: 'todo', category: TaskStatusCategory.TODO, color: 'neutral', is_default: true },
    { name: 'In Progress', slug: 'in-progress', category: TaskStatusCategory.IN_PROGRESS, color: 'warning' },
    { name: 'In Review', slug: 'in-review', category: TaskStatusCategory.IN_REVIEW, color: 'violet' },
    { name: 'Done', slug: 'done', category: TaskStatusCategory.DONE, color: 'success' },
    { name: 'Canceled', slug: 'canceled', category: TaskStatusCategory.CANCELLED, color: 'neutral' },
];

export const DEFAULT_TASK_TYPES = [
    { name: 'Task', slug: 'task', icon: 'square-check', color: 'neutral', is_default: true },
    { name: 'Bug', slug: 'bug', icon: 'bug', color: 'danger' },
    { name: 'Feature', slug: 'feature', icon: 'sparkles', color: 'violet' },
    { name: 'Improvement', slug: 'improvement', icon: 'trending-up', color: 'info' },
    { name: 'Chore', slug: 'chore', icon: 'wrench', color: 'neutral' },
];

/** Statuses of a team (or the organization-wide workflow), creating the defaults on first use. */
export async function ensureTaskStatuses(client: Client, organizationId: string, teamId: string | null) {
    const where = { organization_id: organizationId, team_id: teamId, project_type_id: null };
    let statuses = await client.taskStatus.findMany({ where: { ...where, archived_at: null }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
    if (statuses.length) return statuses;
    const any = await client.taskStatus.count({ where });
    if (any) return statuses; // all archived: respect the admin's choice
    // createMany cannot dedupe NULL columns in the unique key, so create one by one and ignore races.
    for (const [i, s] of DEFAULT_TASK_STATUSES.entries()) {
        try {
            await client.taskStatus.create({ data: { ...s, organization_id: organizationId, team_id: teamId, sort_order: i, is_default: !!s.is_default } });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        }
    }
    statuses = await client.taskStatus.findMany({ where: { ...where, archived_at: null }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] });
    return statuses;
}

export async function ensureTaskTypes(client: Client, organizationId: string) {
    const count = await client.taskType.count({ where: { organization_id: organizationId } });
    if (!count) {
        await client.taskType.createMany({ data: DEFAULT_TASK_TYPES.map((t, i) => ({ ...t, organization_id: organizationId, sort_order: i })), skipDuplicates: true });
    }
}

/** Default status of a workflow: the flagged default, else the first TODO, else the first status. */
export function defaultStatus<T extends { is_default: boolean; category: TaskStatusCategory }>(statuses: T[]): T | undefined {
    return statuses.find((s) => s.is_default) ?? statuses.find((s) => s.category === TaskStatusCategory.TODO) ?? statuses[0];
}
