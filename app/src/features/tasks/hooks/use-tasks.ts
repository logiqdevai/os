import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as service from "../services/tasks.services";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { BoardData, MemberRef, TaskComment, TaskDetail, TaskRef, TaskStatus } from "../interfaces/tasks.interfaces";

export const TASKS_KEY = ["tasks"] as const;
type Params = Record<string, unknown>;

export const useTasks = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...TASKS_KEY, "list", params], queryFn: () => service.getTasks(params), placeholderData: keepPreviousData, enabled });
export const useBoard = (params: Params) => useQuery({ queryKey: [...TASKS_KEY, "board", params], queryFn: () => service.getBoard(params) });
export const useTask = (id: string | undefined) => useQuery({ queryKey: [...TASKS_KEY, "detail", id], queryFn: () => service.getTask(id as string), enabled: !!id });
export const useTaskLookup = (params: Params, enabled = true) => useQuery({ queryKey: [...TASKS_KEY, "lookup", params], queryFn: () => service.lookupTasks(params), enabled });
export const useTaskPeople = (search: string, enabled = true) =>
    useQuery({ queryKey: [...TASKS_KEY, "people", search], queryFn: () => service.getTaskPeople({ search: search || undefined }), enabled, staleTime: 60_000 });
export const useTaskActivity = (id: string | undefined) => useQuery({ queryKey: [...TASKS_KEY, "activity", id], queryFn: () => service.getTaskActivity(id as string), enabled: !!id });
export const useTaskComments = (id: string | undefined) => useQuery({ queryKey: [...TASKS_KEY, "comments", id], queryFn: () => service.getTaskComments(id as string), enabled: !!id });
export const useTaskWorkload = (params: Params) => useQuery({ queryKey: [...TASKS_KEY, "workload", params], queryFn: () => service.getTaskWorkload(params) });
export const useTaskReport = (params: Params) =>
    useQuery({ queryKey: [...TASKS_KEY, "report", params], queryFn: () => service.getTaskReport(params), placeholderData: keepPreviousData });
export const useTaskStatuses = (teamId: string | null | undefined, enabled = true) =>
    useQuery({ queryKey: [...TASKS_KEY, "statuses", teamId ?? "none"], queryFn: () => service.getTaskStatuses({ team_id: teamId ?? "none" }), enabled, staleTime: 60_000 });
export const useWorkflows = (enabled = true) => useQuery({ queryKey: [...TASKS_KEY, "workflows"], queryFn: service.getWorkflows, staleTime: 60_000, enabled });
export const useTaskTypes = () => useQuery({ queryKey: [...TASKS_KEY, "types"], queryFn: service.getTaskTypes, staleTime: 60_000 });
export const useTaskLabels = () => useQuery({ queryKey: [...TASKS_KEY, "labels"], queryFn: service.getTaskLabels, staleTime: 60_000 });
export const useCycles = (params: Params) => useQuery({ queryKey: [...TASKS_KEY, "cycles", params], queryFn: () => service.getCycles(params), placeholderData: keepPreviousData });
export const useCycle = (id: string | undefined) => useQuery({ queryKey: [...TASKS_KEY, "cycle", id], queryFn: () => service.getCycle(id as string), enabled: !!id });
export const useReleases = (params: Params) => useQuery({ queryKey: [...TASKS_KEY, "releases", params], queryFn: () => service.getReleases(params), placeholderData: keepPreviousData });
export const useRelease = (id: string | undefined) => useQuery({ queryKey: [...TASKS_KEY, "release", id], queryFn: () => service.getRelease(id as string), enabled: !!id });

const PROJECTS_ROOT = ["projects"] as const;

/**
 * Non-optimistic task mutation (creations and server-computed results): refreshes tasks (and project rollups) when it
 * settles. No success toast (the UI shows the result); a failure is toasted once by the global MutationCache.
 */
function useTaskMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: { errorTitle, errorToast },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: TASKS_KEY });
            qc.invalidateQueries({ queryKey: PROJECTS_ROOT });
        },
    });
}

/** Optimistic task mutation over every tasks cache: `apply` patches the cache before the request; rollback on failure. */
function useTaskOptimistic<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, errorTitle: string, apply: (qc: QueryClient, vars: TVars) => void, errorToast = true) {
    return useOptimisticMutation<TResult, TVars>({ roots: [TASKS_KEY], alsoInvalidate: [PROJECTS_ROOT], meta: { errorTitle, errorToast }, mutationFn: fn, apply });
}

/** Patch the open task detail (the only cache that holds checklist, links, attachments, sub-tasks). */
const patchTaskDetail = (qc: QueryClient, id: string, fn: (t: TaskDetail) => TaskDetail) =>
    patchEntity<TaskDetail>(qc, TASKS_KEY, id, (t) => ("checklist_items" in t ? fn(t) : t));
const tempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
/** True for rows added optimistically that the server has not confirmed yet (hide their row actions). */
export const isTempId = (id: string) => id.startsWith("temp-");

export const useCreateTask = () => useTaskMutation(service.createTask, "Could not create task");
/**
 * Sub-task: appears under the parent at once (temporary row, replaced by the refresh). `optimistic.assignee` etc. are
 * not needed — a new sub-task starts unassigned in the parent's first status.
 */
export const useCreateSubtask = () =>
    useTaskOptimistic(
        (v: Parameters<typeof service.createTask>[0] & { parent_task_id: string }) => service.createTask(v),
        "Could not add sub-task",
        (qc, v) => patchTaskDetail(qc, v.parent_task_id, (t) => ({
            ...t,
            subtasks: [...t.subtasks, { id: tempId(), identifier: "…", title: v.title, status: t.workflow_statuses[0] ?? null, assignee: null } as unknown as TaskRef],
        })),
    );
/** Optimistic: every cached list, board and detail shows the change at once; `optimistic` carries display objects (status, assignee…). */
export const useUpdateTask = () =>
    useEntityUpdate({ root: TASKS_KEY, mutationFn: service.updateTask, alsoInvalidate: [["projects"]], meta: { errorTitle: "Could not update task" } });
type MoveVars = Parameters<typeof service.moveTask>[0];

/** Place the task in its new status and position on every cached board, so a drop shows at once. */
function moveOnBoard(data: BoardData | undefined, v: MoveVars): BoardData | undefined {
    if (!data) return data;
    const task = data.tasks.find((t) => t.id === v.id);
    if (!task) return data;
    const status = v.status_id ? data.statuses.find((s) => s.id === v.status_id) : undefined;
    const moved = { ...task, ...(v.status_id && { status_id: v.status_id }), ...(status && { status }) };
    const rest = data.tasks.filter((t) => t.id !== v.id);
    let at = v.before_task_id ? rest.findIndex((t) => t.id === v.before_task_id) : -1;
    if (at < 0 && v.after_task_id) {
        const i = rest.findIndex((t) => t.id === v.after_task_id);
        if (i >= 0) at = i + 1;
    }
    if (at < 0) at = rest.length;
    return { ...data, tasks: [...rest.slice(0, at), moved, ...rest.slice(at)] };
}

/** Board drag and drop: optimistic move, rolled back if the API refuses (e.g. a completion gate). */
export const useMoveTask = () => {
    const qc = useQueryClient();
    const boardKey = [...TASKS_KEY, "board"];
    return useMutation({
        mutationFn: service.moveTask,
        onMutate: async (v: MoveVars) => {
            await qc.cancelQueries({ queryKey: boardKey });
            const previous = qc.getQueriesData<BoardData>({ queryKey: boardKey });
            qc.setQueriesData<BoardData>({ queryKey: boardKey }, (d) => moveOnBoard(d, v));
            return { previous };
        },
        meta: { errorTitle: "Could not move task" },
        onError: (_e, _v, context) => {
            for (const [key, data] of context?.previous ?? []) qc.setQueryData(key, data);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: TASKS_KEY });
            qc.invalidateQueries({ queryKey: ["projects"] });
        },
    });
};
export const useDeleteTask = () => useEntityRemove({ root: TASKS_KEY, mutationFn: service.deleteTask, alsoInvalidate: [["projects"]], meta: { errorTitle: "Could not delete task" } });
export const useArchiveTask = () => useEntityRemove({ root: TASKS_KEY, mutationFn: service.archiveTask, alsoInvalidate: [["projects"]], meta: { errorTitle: "Could not archive task" } });
/**
 * Bulk changes: optimistic (fields patched / archived rows removed at once). The server reports per-task failures;
 * the refresh on settle puts refused tasks back and the caller toasts the partial failure.
 * Pass display objects for id fields in `optimistic` (e.g. `{ assignee }`).
 */
export const useBulkTasks = () =>
    useTaskOptimistic(
        ({ optimistic: _o, ...v }: Parameters<typeof service.bulkTasks>[0] & { optimistic?: Record<string, unknown> }) => service.bulkTasks(v),
        "Bulk update failed",
        (qc, { task_ids, patch, action, optimistic }) => {
            for (const id of task_ids) {
                if (action === "archive") removeEntity(qc, TASKS_KEY, id);
                else if (patch || optimistic) patchEntity(qc, TASKS_KEY, id, { ...(patch ?? {}), ...(optimistic ?? {}) });
            }
        },
    );

/** Comment: shows at once at the end of the thread (temporary row with `optimistic.author`), replaced by the refresh. */
type CommentVars = Parameters<typeof service.createComment>[0] & { optimistic?: { author: MemberRef | null; author_membership_id: string | null } };
export const useCreateComment = () =>
    useTaskOptimistic(
        ({ optimistic: _o, ...v }: CommentVars) => service.createComment(v),
        "Could not post comment",
        (qc, v) => qc.setQueryData<TaskComment[]>([...TASKS_KEY, "comments", v.id], (list) => [
            ...(list ?? []),
            {
                id: tempId(), body: v.body, visibility: (v.visibility ?? "INTERNAL") as TaskComment["visibility"], parent_comment_id: null,
                author: v.optimistic?.author ?? null, author_membership_id: v.optimistic?.author_membership_id ?? null, edited_at: null, created_at: new Date().toISOString(),
            },
        ]),
    );
export const useDeleteComment = () =>
    useTaskOptimistic(service.deleteComment, "Could not delete comment", (qc, { commentId }) => removeEntity(qc, TASKS_KEY, commentId));

/** Checklist: add / tick / remove change the panel at once. */
export const useAddChecklistItem = () =>
    useTaskOptimistic(service.addChecklistItem, "Could not add item", (qc, { id, title }) =>
        patchTaskDetail(qc, id, (t) => ({ ...t, checklist_items: [...t.checklist_items, { id: tempId(), title, is_completed: false, sort_order: t.checklist_items.length }] })),
    );
export const useUpdateChecklistItem = () =>
    useTaskOptimistic(service.updateChecklistItem, "Could not update item", (qc, { id, itemId, ...dto }) =>
        patchTaskDetail(qc, id, (t) => ({ ...t, checklist_items: t.checklist_items.map((i) => (i.id === itemId ? { ...i, ...dto } : i)) })),
    );
export const useDeleteChecklistItem = () =>
    useTaskOptimistic(service.deleteChecklistItem, "Could not remove item", (qc, { id, itemId }) =>
        patchTaskDetail(qc, id, (t) => ({ ...t, checklist_items: t.checklist_items.filter((i) => i.id !== itemId) })),
    );

/** Linking needs the server's task reference: the picker closes at once and the link appears on refresh. */
export const useAddDependency = () => useTaskMutation(service.addDependency, "Could not link tasks");
export const useRemoveDependency = () =>
    useTaskOptimistic(service.removeDependency, "Could not remove link", (qc, { id, depId }) =>
        patchTaskDetail(qc, id, (t) => ({ ...t, dependencies_from: t.dependencies_from.filter((d) => d.id !== depId), dependencies_to: t.dependencies_to.filter((d) => d.id !== depId) })),
    );
export const useSetWatching = () =>
    useTaskOptimistic(service.setWatching, "Could not update subscription", (qc, { id, watching }) => patchEntity(qc, TASKS_KEY, id, { is_watching: watching }));
/** Adding an attachment creates a document on the server, so it is not optimistic; the form closes on success. */
export const useAddAttachment = () => useTaskMutation(service.addAttachment, "Could not add attachment");
export const useRemoveAttachment = () =>
    useTaskOptimistic(service.removeAttachment, "Could not remove attachment", (qc, { id, attId }) =>
        patchTaskDetail(qc, id, (t) => ({ ...t, attachments: t.attachments.filter((a) => a.id !== attId) })),
    );

// Setup: statuses, types, labels.
export const useCreateTaskStatus = () => useTaskMutation(service.createTaskStatus, "Could not add status");
export const useUpdateTaskStatus = ({ inline = false }: { inline?: boolean } = {}) =>
    useTaskOptimistic(service.updateTaskStatus, "Could not update status", (qc, { id, ...dto }) => patchEntity(qc, TASKS_KEY, id, dto), !inline);
/** Archiving moves tasks to the replacement status on the server; the status disappears at once. */
export const useArchiveTaskStatus = () =>
    useTaskOptimistic(service.archiveTaskStatus, "Could not archive status", (qc, { id }) => removeEntity(qc, TASKS_KEY, id));
/** Reorder: the new order shows at once in every cached status list. */
export const useReorderTaskStatuses = () =>
    useTaskOptimistic(service.reorderTaskStatuses, "Could not reorder statuses", (qc, ids) => {
        const order = new Map(ids.map((id, i) => [id, i]));
        qc.setQueriesData<TaskStatus[]>({ queryKey: [...TASKS_KEY, "statuses"] }, (list) =>
            Array.isArray(list) ? [...list].sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9)) : list,
        );
    });
export const useCreateTaskType = () => useTaskMutation(service.createTaskType, "Could not add type");
/** Archive / restore toggle: the row flips at once. */
export const useArchiveTaskType = () =>
    useTaskOptimistic(service.archiveTaskType, "Could not archive type", (qc, id) =>
        patchEntity<{ archived_at: string | null }>(qc, TASKS_KEY, id, (e) => ({ ...e, archived_at: e.archived_at ? null : new Date().toISOString() })),
    );
export const useCreateTaskLabel = () => useTaskMutation(service.createTaskLabel, "Could not add label");
export const useUpdateTaskLabel = () => useTaskOptimistic(service.updateTaskLabel, "Could not update label", (qc, { id, ...dto }) => patchEntity(qc, TASKS_KEY, id, dto));
export const useArchiveTaskLabel = () => useTaskOptimistic(service.archiveTaskLabel, "Could not archive label", (qc, id) => removeEntity(qc, TASKS_KEY, id));

// Cycles and releases.
export const useCreateCycle = () => useTaskMutation(service.createCycle, "Could not create cycle");
export const useUpdateCycle = ({ inline = false }: { inline?: boolean } = {}) =>
    useTaskOptimistic(service.updateCycle, "Could not update cycle", (qc, { id, ...dto }) => patchEntity(qc, TASKS_KEY, id, dto), !inline);
/** Completing carries unfinished tasks over on the server: the cycle shows Completed at once, tasks move on refresh. */
export const useCompleteCycle = () =>
    useTaskOptimistic(service.completeCycle, "Could not complete cycle", (qc, { id }) => patchEntity(qc, TASKS_KEY, id, { status: "COMPLETED" }));
export const useCreateRelease = () => useTaskMutation(service.createRelease, "Could not create release");
export const useUpdateRelease = ({ inline = false }: { inline?: boolean } = {}) =>
    useTaskOptimistic(service.updateRelease, "Could not update release", (qc, { id, ...dto }) => patchEntity(qc, TASKS_KEY, id, dto), !inline);
export const useAddReleaseDeployment = () => useTaskMutation(service.addReleaseDeployment, "Could not record deployment");
export const useDraftReleaseNotes = () => useTaskMutation(service.draftReleaseNotes, "Could not draft release notes");
/** Publishing is an outward action with its own button; the notes show as published at once. */
export const usePublishReleaseNotes = () =>
    useTaskOptimistic(service.publishReleaseNotes, "Could not publish release notes", (qc, { id, notes }) =>
        patchEntity(qc, TASKS_KEY, id, { notes, notes_published_at: new Date().toISOString() }),
    );
