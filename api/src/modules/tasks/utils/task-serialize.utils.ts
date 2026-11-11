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
    assignee: { select: MEMBER_SELECT },
    labels: { select: { label: { select: { id: true, name: true, color: true } } } },
    _count: { select: { subtasks: true, comments: { where: { deleted_at: null } }, checklist_items: true, attachments: true } },
} satisfies Prisma.TaskInclude;

export type TaskListRow = Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>;

/** Add the human identifier (WEB-142) and flatten label rows. */
export function serializeTask<T extends { number: number; team?: { task_key: string | null } | null; labels?: { label: { id: string; name: string; color: string | null } }[] }>(task: T) {
    const { labels, ...rest } = task;
    return { ...rest, identifier: taskIdentifier(task), labels: (labels ?? []).map((l) => l.label) };
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
    assignee: { select: MEMBER_SELECT },
} satisfies Prisma.TaskSelect;

export function serializeRef<T extends { number: number; team?: { task_key: string | null } | null }>(task: T | null) {
    return task ? { ...task, identifier: taskIdentifier(task) } : null;
}
