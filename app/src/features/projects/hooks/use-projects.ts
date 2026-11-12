import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { insertEntity, patchEntity, removeEntity, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/projects.services";
import type { ProjectChildKind, ProjectDetail } from "../interfaces/projects.interfaces";

export const PROJECTS_KEY = ["projects"] as const;
const TASKS_ROOT = ["tasks"] as const;
type Params = Record<string, unknown>;

export const useProjects = (params: Params) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "list", params], queryFn: () => service.getProjects(params), placeholderData: keepPreviousData });
export const useProject = (id: string | undefined) => useQuery({ queryKey: [...PROJECTS_KEY, "detail", id], queryFn: () => service.getProject(id as string), enabled: !!id });
export const useProjectLookup = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "lookup", params], queryFn: () => service.lookupProjects(params), enabled, staleTime: 30_000 });
export const useProjectPeople = (search: string, enabled = true) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "people", search], queryFn: () => service.getProjectPeople({ search: search || undefined }), enabled, staleTime: 60_000 });
export const useFavoriteProjects = () => useQuery({ queryKey: [...PROJECTS_KEY, "favorites"], queryFn: service.getFavoriteProjects });
export const usePortfolio = () => useQuery({ queryKey: [...PROJECTS_KEY, "portfolio"], queryFn: service.getPortfolio });
export const useMilestonesAcross = (params: Params) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "milestones", params], queryFn: () => service.getMilestonesAcross(params), placeholderData: keepPreviousData });
export const useRaid = <T,>(params: Params) => useQuery({ queryKey: [...PROJECTS_KEY, "raid", params], queryFn: () => service.getRaid<T>(params), placeholderData: keepPreviousData });
export const useProjectWorkload = (params: Params) => useQuery({ queryKey: [...PROJECTS_KEY, "workload", params], queryFn: () => service.getProjectWorkload(params) });
export const usePortfolioTimeline = (params: Params) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "timeline", params], queryFn: () => service.getPortfolioTimeline(params), placeholderData: keepPreviousData });
export const useProjectTimeline = (id: string | undefined, params: Params = {}) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "timeline", id, params], queryFn: () => service.getProjectTimeline(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
/** Governance & closeout reads: gates | reviews | checklists | handovers | closeout. */
export const useGovernance = <T,>(id: string | undefined, path: "gates" | "reviews" | "checklists" | "handovers" | "closeout") =>
    useQuery({ queryKey: [...PROJECTS_KEY, "governance", id, path], queryFn: () => service.getGovernance<T>(id as string, path), enabled: !!id });
export const useProjectChildren = <T,>(id: string | undefined, kind: ProjectChildKind) =>
    useQuery({ queryKey: [...PROJECTS_KEY, "children", id, kind], queryFn: () => service.getProjectChildren<T>(id as string, kind), enabled: !!id });
export const useProjectTypes = () => useQuery({ queryKey: [...PROJECTS_KEY, "types"], queryFn: () => service.getProjectTypes(), staleTime: 60_000 });
export const useProjectStatuses = () => useQuery({ queryKey: [...PROJECTS_KEY, "statuses"], queryFn: () => service.getProjectStatuses(), staleTime: 60_000 });
export const useProjectTemplates = () => useQuery({ queryKey: [...PROJECTS_KEY, "templates"], queryFn: () => service.getProjectTemplates(), staleTime: 60_000 });

/**
 * Non-optimistic project mutation (creations, server-computed transitions): refreshes projects and tasks when it
 * settles. No success toast (the UI shows the result); a failure is toasted once globally with `errorTitle`.
 */
function useProjectMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: { errorTitle, errorToast },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: PROJECTS_KEY });
            qc.invalidateQueries({ queryKey: TASKS_ROOT });
        },
    });
}

/** Optimistic project mutation over the whole projects cache (ids are unique, so patches find every copy). */
function useProjectOptimistic<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, errorTitle: string, apply: (qc: QueryClient, vars: TVars) => void, errorToast = true) {
    return useOptimisticMutation<TResult, TVars>({ roots: [PROJECTS_KEY], alsoInvalidate: [TASKS_ROOT], meta: { errorTitle, errorToast }, mutationFn: fn, apply });
}

const patchDetail = (qc: QueryClient, id: string, fn: (p: ProjectDetail) => ProjectDetail) =>
    patchEntity<ProjectDetail>(qc, PROJECTS_KEY, id, (p) => ("members" in p ? fn(p) : p));

/** Creation: the new page opens on success. */
export const useCreateProject = () => useProjectMutation(service.createProject, "Could not create project");
/**
 * Optimistic: header, lists and pickers change at once; pass display objects (status, owner…) in `optimistic`.
 * `inline: true` for autosaving forms that show the error in <SaveStatus /> instead of a toast.
 */
export const useUpdateProject = ({ inline = false }: { inline?: boolean } = {}) =>
    useEntityUpdate({ root: PROJECTS_KEY, mutationFn: service.updateProject, alsoInvalidate: [TASKS_ROOT], meta: { errorTitle: "Could not update project", errorToast: !inline } });
export const useDeleteProject = () => useProjectOptimistic(service.deleteProject, "Could not delete project", (qc, id) => removeEntity(qc, PROJECTS_KEY, id));
/** Archive: gone from lists at once; the open detail page shows "Archived". */
export const useArchiveProject = () =>
    useProjectOptimistic(service.archiveProject, "Could not archive project", (qc, id) => {
        removeEntity(qc, PROJECTS_KEY, id);
        patchEntity(qc, PROJECTS_KEY, id, { archived_at: new Date().toISOString() });
    });
export const useRestoreProject = () => useProjectOptimistic(service.restoreProject, "Could not restore project", (qc, id) => patchEntity(qc, PROJECTS_KEY, id, { archived_at: null }));
/** Completing is checked by the server (gates, checklists): not optimistic, the confirmation shows the outcome. */
export const useCompleteProject = () => useProjectMutation(service.completeProject, "Could not complete project");
export const useReopenProject = () =>
    useProjectOptimistic(service.reopenProject, "Could not reopen project", (qc, { id }) => patchEntity(qc, PROJECTS_KEY, id, { completed_at: null }));
export const useSetProjectFavorite = () =>
    useProjectOptimistic(service.setProjectFavorite, "Could not update favorites", (qc, { id, favorite }) => {
        patchEntity(qc, PROJECTS_KEY, id, { is_favorite: favorite });
        if (!favorite) qc.setQueryData<{ id: string }[]>([...PROJECTS_KEY, "favorites"], (d) => d?.filter((f) => f.id !== id));
    });
/** Adding needs the server's member row (role, joined date): not optimistic; the dialog closes on success. */
export const useAddProjectMember = () => useProjectMutation(service.addProjectMember, "Could not add member");
export const useRemoveProjectMember = () =>
    useProjectOptimistic(service.removeProjectMember, "Could not remove member", (qc, { id, membership_id }) =>
        patchDetail(qc, id, (p) => ({ ...p, members: p.members.filter((m) => m.membership_id !== membership_id) })),
    );

/** Child records (milestones, deliverables, RAID, updates…). Creation is not optimistic; dialogs close on success. */
export const useCreateProjectChild = (label: string) => useProjectMutation(service.createProjectChild, `Could not add ${label.toLowerCase()}`);
type ChildUpdateVars = Parameters<typeof service.updateProjectChild>[0] & { optimistic?: Params };
/**
 * Optimistic: the row (in every list, timeline and detail) shows `dto` + `optimistic` display objects at once.
 * `inline: true` for autosaving edit dialogs that show failures in <SaveStatus /> instead of a toast.
 */
export const useUpdateProjectChild = (label: string, { inline = false }: { inline?: boolean } = {}) =>
    useProjectOptimistic((v: ChildUpdateVars) => service.updateProjectChild(v), `Could not update ${label.toLowerCase()}`, (qc, { itemId, dto, optimistic }) =>
        patchEntity(qc, PROJECTS_KEY, itemId, { ...dto, ...(optimistic ?? {}) }), !inline,
    );
export const useDeleteProjectChild = (label: string) =>
    useProjectOptimistic(service.deleteProjectChild, `Could not delete ${label.toLowerCase()}`, (qc, { itemId }) => removeEntity(qc, PROJECTS_KEY, itemId));
type ChildActionVars = Parameters<typeof service.projectChildAction>[0] & { optimistic?: Params };
/** Workflow actions (complete, submit, review, publish…). Pass `optimistic` (e.g. `{ status: "COMPLETED" }`) to show the result at once. */
export const useProjectChildAction = (errorTitle = "Could not complete the action") =>
    useProjectOptimistic((v: ChildActionVars) => service.projectChildAction(v), errorTitle, (qc, { itemId, optimistic }) => {
        if (optimistic) patchEntity(qc, PROJECTS_KEY, itemId, optimistic);
    });

export const useCreateProjectType = () => useProjectMutation(service.createProjectType, "Could not create type");
export const useUpdateProjectType = ({ inline = false }: { inline?: boolean } = {}) =>
    useProjectOptimistic(service.updateProjectType, "Could not update type", (qc, { id, ...dto }) => patchEntity(qc, PROJECTS_KEY, id, dto), !inline);
/** Archive / restore toggle: the row flips at once. */
export const useArchiveProjectType = () =>
    useProjectOptimistic(service.archiveProjectType, "Could not archive type", (qc, id) =>
        patchEntity<{ archived_at: string | null }>(qc, PROJECTS_KEY, id, (e) => ({ ...e, archived_at: e.archived_at ? null : new Date().toISOString() })),
    );
export const useCreateProjectStatus = () => useProjectMutation(service.createProjectStatus, "Could not create status");
export const useUpdateProjectStatus = ({ inline = false }: { inline?: boolean } = {}) =>
    useProjectOptimistic(service.updateProjectStatus, "Could not update status", (qc, { id, ...dto }) => patchEntity(qc, PROJECTS_KEY, id, dto), !inline);
export const useArchiveProjectStatus = () =>
    useProjectOptimistic(service.archiveProjectStatus, "Could not archive status", (qc, id) => removeEntity(qc, PROJECTS_KEY, id));
export const useCreateProjectTemplate = () => useProjectMutation(service.createProjectTemplate, "Could not create template");
/** Deactivating (`is_active: false`) removes the template from the list at once. */
export const useUpdateProjectTemplate = () =>
    useProjectOptimistic(service.updateProjectTemplate, "Could not update template", (qc, { id, ...dto }) =>
        dto.is_active === false ? removeEntity(qc, PROJECTS_KEY, id) : patchEntity(qc, PROJECTS_KEY, id, dto),
    );

/**
 * Governance & closeout writes. Optional optimistic hints on the variables (never sent):
 *   - `patch: { id, value }` merges `value` (or applies a function) into the entity `id` anywhere in the projects cache;
 *   - `removeId` removes that entity from cached lists;
 *   - `insert: { root, entity }` prepends a temporary entity to a cached list.
 */
type GovernanceHints = {
    patch?: { id: string; value: Params | ((e: never) => unknown) };
    removeId?: string;
    insert?: { root: readonly unknown[]; entity: { id: string } };
};
function applyGovernance(qc: QueryClient, h: GovernanceHints) {
    if (h.patch) patchEntity(qc, PROJECTS_KEY, h.patch.id, h.patch.value as Params);
    if (h.removeId) removeEntity(qc, PROJECTS_KEY, h.removeId);
    if (h.insert) insertEntity(qc, h.insert.root, h.insert.entity);
}
type GovVars<T> = T & GovernanceHints;
export const useGovernancePost = (errorTitle = "Could not save", errorToast = true) =>
    useOptimisticMutation<unknown, GovVars<Parameters<typeof service.postGovernance>[0]>>({
        roots: [PROJECTS_KEY], alsoInvalidate: [TASKS_ROOT], meta: { errorTitle, errorToast }, mutationFn: (v) => service.postGovernance(v), apply: applyGovernance,
    });
export const useGovernancePatch = (errorTitle = "Could not save", errorToast = true) =>
    useOptimisticMutation<unknown, GovVars<Parameters<typeof service.patchGovernance>[0]>>({
        roots: [PROJECTS_KEY], alsoInvalidate: [TASKS_ROOT], meta: { errorTitle, errorToast }, mutationFn: (v) => service.patchGovernance(v), apply: applyGovernance,
    });
export const useGovernancePut = (errorTitle = "Could not save", errorToast = true) =>
    useOptimisticMutation<unknown, GovVars<Parameters<typeof service.putGovernance>[0]>>({
        roots: [PROJECTS_KEY], alsoInvalidate: [TASKS_ROOT], meta: { errorTitle, errorToast }, mutationFn: (v) => service.putGovernance(v), apply: applyGovernance,
    });
export const useGovernanceDelete = (errorTitle = "Could not delete") =>
    useOptimisticMutation<unknown, GovVars<Parameters<typeof service.deleteGovernance>[0]>>({
        roots: [PROJECTS_KEY], alsoInvalidate: [TASKS_ROOT], meta: { errorTitle }, mutationFn: (v) => service.deleteGovernance(v), apply: applyGovernance,
    });
/** AI status-update draft: the caller opens the draft or shows why AI is unavailable. */
export const useDraftStatusUpdate = () => useProjectMutation(service.draftStatusUpdate, "Could not draft the update");
