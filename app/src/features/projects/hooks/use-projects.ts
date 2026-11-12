import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as service from "../services/projects.services";
import type { ProjectChildKind } from "../interfaces/projects.interfaces";

export const PROJECTS_KEY = ["projects"] as const;
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

/** Mutation that refreshes every projects query and toasts the outcome. Pass `success: null` to toast at the call site. */
function useProjectMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, success: string | null, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: PROJECTS_KEY });
            qc.invalidateQueries({ queryKey: ["tasks"] });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}

export const useCreateProject = () => useProjectMutation(service.createProject, "Project created", "Could not create project");
export const useUpdateProject = () => useProjectMutation(service.updateProject, "Project updated", "Could not update project");
export const useDeleteProject = () => useProjectMutation(service.deleteProject, "Project deleted", "Could not delete project");
export const useArchiveProject = () => useProjectMutation(service.archiveProject, "Project archived", "Could not archive project");
export const useRestoreProject = () => useProjectMutation(service.restoreProject, "Project restored", "Could not restore project");
export const useCompleteProject = () => useProjectMutation(service.completeProject, "Project completed", "Could not complete project");
export const useReopenProject = () => useProjectMutation(service.reopenProject, "Project reopened", "Could not reopen project");
export const useSetProjectFavorite = () => useProjectMutation(service.setProjectFavorite, null, "Could not update favorites");
export const useAddProjectMember = () => useProjectMutation(service.addProjectMember, "Member added", "Could not add member");
export const useRemoveProjectMember = () => useProjectMutation(service.removeProjectMember, "Member removed", "Could not remove member");
export const useCreateProjectChild = (label: string) => useProjectMutation(service.createProjectChild, `${label} added`, `Could not add ${label.toLowerCase()}`);
export const useUpdateProjectChild = (label: string) => useProjectMutation(service.updateProjectChild, `${label} updated`, `Could not update ${label.toLowerCase()}`);
export const useDeleteProjectChild = (label: string) => useProjectMutation(service.deleteProjectChild, `${label} deleted`, `Could not delete ${label.toLowerCase()}`);
export const useProjectChildAction = (success: string) => useProjectMutation(service.projectChildAction, success, "Could not complete the action");
export const useCreateProjectType = () => useProjectMutation(service.createProjectType, "Type created", "Could not create type");
export const useUpdateProjectType = () => useProjectMutation(service.updateProjectType, "Type updated", "Could not update type");
export const useArchiveProjectType = () => useProjectMutation(service.archiveProjectType, "Type updated", "Could not archive type");
export const useCreateProjectStatus = () => useProjectMutation(service.createProjectStatus, "Status created", "Could not create status");
export const useUpdateProjectStatus = () => useProjectMutation(service.updateProjectStatus, "Status updated", "Could not update status");
export const useArchiveProjectStatus = () => useProjectMutation(service.archiveProjectStatus, "Status updated", "Could not archive status");
export const useCreateProjectTemplate = () => useProjectMutation(service.createProjectTemplate, "Template created", "Could not create template");
export const useUpdateProjectTemplate = () => useProjectMutation(service.updateProjectTemplate, "Template updated", "Could not update template");

/** Governance & closeout writes; `success: null` = toast at the call site. */
export const useGovernancePost = (success: string | null, failure = "Could not save") => useProjectMutation(service.postGovernance, success, failure);
export const useGovernancePatch = (success: string | null, failure = "Could not save") => useProjectMutation(service.patchGovernance, success, failure);
export const useGovernancePut = (success: string | null, failure = "Could not save") => useProjectMutation(service.putGovernance, success, failure);
export const useGovernanceDelete = (success: string | null, failure = "Could not delete") => useProjectMutation(service.deleteGovernance, success, failure);
