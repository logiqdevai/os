import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    BoardData,
    CreateTaskDto,
    MemberRef,
    Cycle,
    CycleDetail,
    Paginated,
    Release,
    Task,
    TaskActivity,
    TaskComment,
    TaskDetail,
    TaskLabel,
    TaskStatus,
    TaskType,
    TaskReport,
    TaskWorkload,
    UpdateTaskDto,
} from "../interfaces/tasks.interfaces";

const R = ApiRoutes.tasks;
type Params = Record<string, unknown>;

export const getTasks = async (params: Params): Promise<Paginated<Task>> => (await axiosInstance.get(R.list, { params })).data;
export const getBoard = async (params: Params): Promise<BoardData> => (await axiosInstance.get(R.board, { params })).data;
export const getTask = async (id: string): Promise<TaskDetail> => (await axiosInstance.get(R.detail(id))).data;
export const lookupTasks = async (params: Params): Promise<{ id: string; identifier: string; title: string; project: { id: string; name: string } | null }[]> =>
    (await axiosInstance.get(R.lookup, { params })).data;
export const getTaskActivity = async (id: string): Promise<TaskActivity> => (await axiosInstance.get(R.activity(id))).data;
export const getTaskComments = async (id: string): Promise<TaskComment[]> => (await axiosInstance.get(R.comments(id))).data;
export const getTaskWorkload = async (params: Params): Promise<TaskWorkload> => (await axiosInstance.get(R.workload, { params })).data;

export const getTaskReport = async (params: Params): Promise<TaskReport> => (await axiosInstance.get(R.reports, { params })).data;

export const createTask = async (dto: CreateTaskDto): Promise<TaskDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateTask = async ({ id, ...dto }: UpdateTaskDto & { id: string }): Promise<TaskDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const moveTask = async ({ id, ...dto }: { id: string; status_id?: string; after_task_id?: string | null; before_task_id?: string | null }) =>
    (await axiosInstance.post(R.move(id), dto)).data;
export const deleteTask = async (id: string) => (await axiosInstance.delete(R.detail(id))).data;
export const archiveTask = async (id: string) => (await axiosInstance.post(R.archive(id))).data;
export const bulkTasks = async (dto: { task_ids: string[]; patch?: Params; action?: string; label_ids?: string[] }): Promise<{ updated: number; failed: { id: string; error?: string }[] }> =>
    (await axiosInstance.post(R.bulk, dto)).data;

export const createComment = async ({ id, ...dto }: { id: string; body: string; visibility?: string; mentions?: string[] }): Promise<TaskComment> => (await axiosInstance.post(R.comments(id), dto)).data;
export const deleteComment = async ({ id, commentId }: { id: string; commentId: string }) => (await axiosInstance.delete(R.comment(id, commentId))).data;
export const addChecklistItem = async ({ id, title }: { id: string; title: string }) => (await axiosInstance.post(R.checklist(id), { title })).data;
export const updateChecklistItem = async ({ id, itemId, ...dto }: { id: string; itemId: string; title?: string; is_completed?: boolean }) =>
    (await axiosInstance.patch(R.checklistItem(id, itemId), dto)).data;
export const deleteChecklistItem = async ({ id, itemId }: { id: string; itemId: string }) => (await axiosInstance.delete(R.checklistItem(id, itemId))).data;
export const addDependency = async ({ id, ...dto }: { id: string; target_task_id: string; type: string }) => (await axiosInstance.post(R.dependencies(id), dto)).data;
export const removeDependency = async ({ id, depId }: { id: string; depId: string }) => (await axiosInstance.delete(R.dependency(id, depId))).data;
export const setWatching = async ({ id, watching }: { id: string; watching: boolean }) =>
    (watching ? await axiosInstance.post(R.watchers(id), {}) : await axiosInstance.delete(R.watchers(id))).data;
export const addAttachment = async ({ id, ...dto }: { id: string; file_name?: string; url?: string; mime_type?: string; size?: number }) => (await axiosInstance.post(R.attachments(id), dto)).data;
export const removeAttachment = async ({ id, attId }: { id: string; attId: string }) => (await axiosInstance.delete(R.attachment(id, attId))).data;

export const getTaskStatuses = async (params: Params): Promise<TaskStatus[]> => (await axiosInstance.get(R.statuses, { params })).data;
export const getWorkflows = async (): Promise<{ team: { id: string; name: string; task_key: string | null } | null; statuses: TaskStatus[] }[]> => (await axiosInstance.get(R.workflows)).data;
export const createTaskStatus = async (dto: Params) => (await axiosInstance.post(R.statuses, dto)).data;
export const updateTaskStatus = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.status(id), dto)).data;
export const archiveTaskStatus = async ({ id, replacement_status_id }: { id: string; replacement_status_id?: string }) => (await axiosInstance.post(R.statusArchive(id), { replacement_status_id })).data;
export const reorderTaskStatuses = async (status_ids: string[]) => (await axiosInstance.post(R.statusReorder, { status_ids })).data;
export const getTaskTypes = async (): Promise<TaskType[]> => (await axiosInstance.get(R.types)).data;
export const createTaskType = async (dto: Params) => (await axiosInstance.post(R.types, dto)).data;
export const archiveTaskType = async (id: string) => (await axiosInstance.post(R.typeArchive(id))).data;
export const getTaskLabels = async (): Promise<TaskLabel[]> => (await axiosInstance.get(R.labels)).data;
export const createTaskLabel = async (dto: Params): Promise<TaskLabel> => (await axiosInstance.post(R.labels, dto)).data;
export const updateTaskLabel = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.label(id), dto)).data;
export const archiveTaskLabel = async (id: string) => (await axiosInstance.post(R.labelArchive(id))).data;

export const getCycles = async (params: Params): Promise<Paginated<Cycle>> => (await axiosInstance.get(R.cycles, { params })).data;
export const getCycle = async (id: string): Promise<CycleDetail> => (await axiosInstance.get(R.cycle(id))).data;
export const createCycle = async (dto: Params): Promise<Cycle> => (await axiosInstance.post(R.cycles, dto)).data;
export const updateCycle = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.cycle(id), dto)).data;
export const completeCycle = async ({ id, carry_over }: { id: string; carry_over: "next" | "backlog" }) => (await axiosInstance.post(R.cycleComplete(id), { carry_over })).data;

export const getReleases = async (params: Params): Promise<Paginated<Release>> => (await axiosInstance.get(R.releases, { params })).data;
export const getRelease = async (id: string): Promise<Release> => (await axiosInstance.get(R.release(id))).data;
export const createRelease = async (dto: Params): Promise<Release> => (await axiosInstance.post(R.releases, dto)).data;
export const updateRelease = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.release(id), dto)).data;
export const addReleaseDeployment = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.post(R.releaseDeployments(id), dto)).data;
export const getTaskPeople = async (params: Params): Promise<MemberRef[]> => (await axiosInstance.get(R.people, { params })).data;
