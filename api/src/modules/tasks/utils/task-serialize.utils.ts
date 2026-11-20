import { Prisma } from 'generated/prisma';
import { MEMBER_SELECT } from '@/modules/projects/utils/projects.utils';
import { taskIdentifier } from './task-number.utils';

export const TASK_READ = 'tasks.tasks.read';

/** Fields shown in every task list, board card and side peek. */
export const TASK_LIST_INCLUDE = {
    status: { select: { id: true, name: true, slug: true, category: true, color: true } },
    type: { select: { id: true, name: true, icon: true, color: true } },
    team: { select: { id: true, name: true, task_key: true } },
    project: { select: { id: true, name: true, color: true } },
    milestone: { select: { id: true, name: true } },
    cycle: { select: { id: true, number: true, name: true } },
    assignees: { select: { membership: { select: MEMBER_SELECT } }, orderBy: { assigned_at: 'asc' as const } },
    labels: { select: { label: { select: { id: true, name: true, color: true } } } },
    _count: { select: { subtasks: true, comments: { where: { deleted_at: null } }, checklist_items: true, attachments: true } },
} satisfies Prisma.TaskInclude;

export type TaskListRow = Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>;

/** Add the human identifier (WEB-142), flatten label rows and assignee rows (assignees = member refs). */
export function serializeTask<T extends { number: number; team?: { task_key: string | null } | null; labels?: { label: { id: string; name: string; color: string | null } }[]; assignees?: { membership: unknown }[] }>(task: T) {
    const { labels, assignees, ...rest } = task;
    return { ...rest, identifier: taskIdentifier(task), labels: (labels ?? []).map((l) => l.label), assignees: (assignees ?? []).map((a) => a.membership) as unknown[] };
}

/** Compact reference to another task (sub-tasks, dependencies, parent). */
export const TASK_REF_SELECT = {
    id: true,
    number: true,
    title: true,
    priority: true,
    due_date: true,
    team: { select: { task_key: true } },
    status: { select: { id: true, name: true, category: true, color: true } },
    assignees: { select: { membership: { select: MEMBER_SELECT } }, orderBy: { assigned_at: 'asc' as const } },
} satisfies Prisma.TaskSelect;

export function serializeRef<T extends { number: number; team?: { task_key: string | null } | null; assignees?: { membership: unknown }[] }>(task: T | null) {
    if (!task) return null;
    const { assignees, ...rest } = task;
    return { ...rest, identifier: taskIdentifier(task), assignees: (assignees ?? []).map((a) => a.membership) as unknown[] };
}
