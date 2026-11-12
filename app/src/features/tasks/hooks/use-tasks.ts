import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as service from "../services/tasks.services";

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

/** Mutation that refreshes tasks (and project rollups) and toasts the outcome. `success: null` = silent success. */
function useTaskMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, success: string | null, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: TASKS_KEY });
            qc.invalidateQueries({ queryKey: ["projects"] });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}

export const useCreateTask = () => useTaskMutation(service.createTask, null, "Could not create task");
export const useUpdateTask = () => useTaskMutation(service.updateTask, null, "Could not update task");
export const useMoveTask = () => useTaskMutation(service.moveTask, null, "Could not move task");
export const useDeleteTask = () => useTaskMutation(service.deleteTask, "Task deleted", "Could not delete task");
export const useArchiveTask = () => useTaskMutation(service.archiveTask, "Task archived", "Could not archive task");
export const useBulkTasks = () => useTaskMutation(service.bulkTasks, null, "Bulk update failed");
export const useCreateComment = () => useTaskMutation(service.createComment, null, "Could not post comment");
export const useDeleteComment = () => useTaskMutation(service.deleteComment, "Comment deleted", "Could not delete comment");
export const useAddChecklistItem = () => useTaskMutation(service.addChecklistItem, null, "Could not add item");
export const useUpdateChecklistItem = () => useTaskMutation(service.updateChecklistItem, null, "Could not update item");
export const useDeleteChecklistItem = () => useTaskMutation(service.deleteChecklistItem, null, "Could not remove item");
export const useAddDependency = () => useTaskMutation(service.addDependency, "Link added", "Could not link tasks");
export const useRemoveDependency = () => useTaskMutation(service.removeDependency, "Link removed", "Could not remove link");
export const useSetWatching = () => useTaskMutation(service.setWatching, null, "Could not update subscription");
export const useAddAttachment = () => useTaskMutation(service.addAttachment, "Attachment added", "Could not add attachment");
export const useRemoveAttachment = () => useTaskMutation(service.removeAttachment, "Attachment removed", "Could not remove attachment");
export const useCreateTaskStatus = () => useTaskMutation(service.createTaskStatus, "Status added", "Could not add status");
export const useUpdateTaskStatus = () => useTaskMutation(service.updateTaskStatus, "Status updated", "Could not update status");
export const useArchiveTaskStatus = () => useTaskMutation(service.archiveTaskStatus, "Status updated", "Could not archive status");
export const useReorderTaskStatuses = () => useTaskMutation(service.reorderTaskStatuses, null, "Could not reorder statuses");
export const useCreateTaskType = () => useTaskMutation(service.createTaskType, "Type added", "Could not add type");
export const useArchiveTaskType = () => useTaskMutation(service.archiveTaskType, "Type updated", "Could not archive type");
export const useCreateTaskLabel = () => useTaskMutation(service.createTaskLabel, "Label added", "Could not add label");
export const useUpdateTaskLabel = () => useTaskMutation(service.updateTaskLabel, "Label updated", "Could not update label");
export const useArchiveTaskLabel = () => useTaskMutation(service.archiveTaskLabel, "Label updated", "Could not archive label");
export const useCreateCycle = () => useTaskMutation(service.createCycle, "Cycle created", "Could not create cycle");
export const useUpdateCycle = () => useTaskMutation(service.updateCycle, "Cycle updated", "Could not update cycle");
export const useCompleteCycle = () => useTaskMutation(service.completeCycle, "Cycle completed", "Could not complete cycle");
export const useCreateRelease = () => useTaskMutation(service.createRelease, "Release created", "Could not create release");
export const useUpdateRelease = () => useTaskMutation(service.updateRelease, "Release updated", "Could not update release");
export const useAddReleaseDeployment = () => useTaskMutation(service.addReleaseDeployment, "Deployment recorded", "Could not record deployment");
export const useDraftReleaseNotes = () => useTaskMutation(service.draftReleaseNotes, null, "Could not draft release notes");
export const usePublishReleaseNotes = () => useTaskMutation(service.publishReleaseNotes, "Release notes published", "Could not publish release notes");
