import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CreateProjectDto,
    MemberRef,
    Milestone,
    Paginated,
    PortfolioSummary,
    PortfolioTimeline,
    ProjectChildKind,
    ProjectDetail,
    ProjectListItem,
    ProjectMember,
    ProjectStatus,
    ProjectTimeline,
    ProjectTemplate,
    ProjectType,
    UpdateProjectDto,
    WorkloadPerson,
} from "../interfaces/projects.interfaces";

const R = ApiRoutes.projects;
type Params = Record<string, unknown>;

export const getProjects = async (params: Params): Promise<Paginated<ProjectListItem>> => (await axiosInstance.get(R.list, { params })).data;
export const getProject = async (id: string): Promise<ProjectDetail> => (await axiosInstance.get(R.detail(id))).data;
export const lookupProjects = async (params: Params): Promise<{ id: string; name: string; code: string | null; color: string | null; company: { id: string; name: string } | null }[]> =>
    (await axiosInstance.get(R.lookup, { params })).data;
export const getFavoriteProjects = async (): Promise<{ id: string; name: string; color: string | null; health: string }[]> => (await axiosInstance.get(R.favorites)).data;
export const getPortfolio = async (): Promise<PortfolioSummary> => (await axiosInstance.get(R.portfolio)).data;
export const getMilestonesAcross = async (params: Params): Promise<Paginated<Milestone>> => (await axiosInstance.get(R.milestones, { params })).data;
export const getRaid = async <T>(params: Params): Promise<Paginated<T>> => (await axiosInstance.get(R.raid, { params })).data;
export const getProjectWorkload = async (params: Params): Promise<{ from: string; to: string; people: WorkloadPerson[] }> => (await axiosInstance.get(R.workload, { params })).data;

export const getPortfolioTimeline = async (params: Params): Promise<PortfolioTimeline> => (await axiosInstance.get(R.timeline, { params })).data;
export const getProjectTimeline = async (id: string, params: Params = {}): Promise<ProjectTimeline> => (await axiosInstance.get(R.projectTimeline(id), { params })).data;

// Governance & closeout: `path` is gates | reviews | checklists | handovers | closeout (+ sub-paths).
export const getGovernance = async <T>(id: string, path: string): Promise<T> => (await axiosInstance.get(R.governance(id, path))).data;
export const postGovernance = async ({ id, path, dto }: { id: string; path: string; dto?: Params }): Promise<unknown> => (await axiosInstance.post(R.governance(id, path), dto ?? {})).data;
export const patchGovernance = async ({ id, path, dto }: { id: string; path: string; dto: Params }): Promise<unknown> => (await axiosInstance.patch(R.governance(id, path), dto)).data;
export const putGovernance = async ({ id, path, dto }: { id: string; path: string; dto: Params }): Promise<unknown> => (await axiosInstance.put(R.governance(id, path), dto)).data;
export const deleteGovernance = async ({ id, path }: { id: string; path: string }): Promise<unknown> => (await axiosInstance.delete(R.governance(id, path))).data;

export const createProject = async (dto: CreateProjectDto): Promise<ProjectDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateProject = async ({ id, ...dto }: UpdateProjectDto & { id: string }): Promise<ProjectDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const deleteProject = async (id: string) => (await axiosInstance.delete(R.detail(id))).data;
export const archiveProject = async (id: string) => (await axiosInstance.post(R.archive(id))).data;
export const restoreProject = async (id: string) => (await axiosInstance.post(R.restore(id))).data;
export const completeProject = async (id: string): Promise<ProjectDetail> => (await axiosInstance.post(R.complete(id))).data;
export const reopenProject = async ({ id, reason }: { id: string; reason?: string }): Promise<ProjectDetail> => (await axiosInstance.post(R.reopen(id), { reason })).data;
export const setProjectFavorite = async ({ id, favorite }: { id: string; favorite: boolean }) =>
    (favorite ? await axiosInstance.post(R.favorite(id)) : await axiosInstance.delete(R.favorite(id))).data;

export const addProjectMember = async ({ id, ...dto }: { id: string; membership_id: string; role_label?: string; allocation_percent?: number }): Promise<ProjectMember> =>
    (await axiosInstance.post(R.members(id), dto)).data;
export const removeProjectMember = async ({ id, membership_id }: { id: string; membership_id: string }) => (await axiosInstance.delete(R.member(id, membership_id))).data;

export const getProjectChildren = async <T>(id: string, kind: ProjectChildKind): Promise<T[]> => (await axiosInstance.get(R.children(id, kind))).data;
export const createProjectChild = async ({ id, kind, dto }: { id: string; kind: ProjectChildKind; dto: Params }): Promise<unknown> => (await axiosInstance.post(R.children(id, kind), dto)).data;
export const updateProjectChild = async ({ id, kind, itemId, dto }: { id: string; kind: ProjectChildKind; itemId: string; dto: Params }): Promise<unknown> =>
    (await axiosInstance.patch(R.child(id, kind, itemId), dto)).data;
export const deleteProjectChild = async ({ id, kind, itemId }: { id: string; kind: ProjectChildKind; itemId: string }) => (await axiosInstance.delete(R.child(id, kind, itemId))).data;
export const projectChildAction = async ({ id, kind, itemId, action, dto }: { id: string; kind: ProjectChildKind; itemId: string; action: string; dto?: Params }) =>
    (await axiosInstance.post(R.childAction(id, kind, itemId, action), dto ?? {})).data;

export const getProjectTypes = async (params: Params = {}): Promise<ProjectType[]> => (await axiosInstance.get(R.types, { params })).data;
export const createProjectType = async (dto: Params) => (await axiosInstance.post(R.types, dto)).data;
export const updateProjectType = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.type(id), dto)).data;
export const archiveProjectType = async (id: string) => (await axiosInstance.post(R.typeArchive(id))).data;
export const getProjectStatuses = async (params: Params = {}): Promise<ProjectStatus[]> => (await axiosInstance.get(R.statuses, { params })).data;
export const createProjectStatus = async (dto: Params) => (await axiosInstance.post(R.statuses, dto)).data;
export const updateProjectStatus = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.status(id), dto)).data;
export const archiveProjectStatus = async (id: string) => (await axiosInstance.post(R.statusArchive(id))).data;
export const getProjectTemplates = async (params: Params = {}): Promise<ProjectTemplate[]> => (await axiosInstance.get(R.templates, { params })).data;
export const createProjectTemplate = async (dto: Params) => (await axiosInstance.post(R.templates, dto)).data;
export const updateProjectTemplate = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R.template(id), dto)).data;
export const getProjectPeople = async (params: Params): Promise<MemberRef[]> => (await axiosInstance.get(R.people, { params })).data;
