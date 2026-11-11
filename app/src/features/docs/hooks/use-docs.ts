import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/docs.services";

const KEY = ["docs"] as const;
type Params = Record<string, unknown>;

function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    return () => {
        const qc = useQueryClient();
        return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
    };
}

export const useDocsHome = () => useQuery({ queryKey: [...KEY, "home"], queryFn: service.getHome });
export const useDocsSearch = (params: Params, enabled: boolean) => useQuery({ queryKey: [...KEY, "search", params], queryFn: () => service.searchPages(params), enabled, placeholderData: keepPreviousData });
export const useDocsTrash = (params: Params) => useQuery({ queryKey: [...KEY, "trash", params], queryFn: () => service.getTrash(params), placeholderData: keepPreviousData });
export const useDocsDirectory = (enabled = true) => useQuery({ queryKey: [...KEY, "directory"], queryFn: () => service.getDirectory(), enabled, staleTime: 60_000 });

export const useSpaces = (params: Params) => useQuery({ queryKey: [...KEY, "spaces", params], queryFn: () => service.getSpaces(params), placeholderData: keepPreviousData });
export const useSpace = (id: string | undefined) => useQuery({ queryKey: [...KEY, "space", id], queryFn: () => service.getSpace(id as string), enabled: !!id });
export const useSpaceTree = (id: string | undefined) => useQuery({ queryKey: [...KEY, "space", id, "tree"], queryFn: () => service.getSpaceTree(id as string), enabled: !!id });
export const useCreateSpace = mutation(service.createSpace);
export const useUpdateSpace = mutation(service.updateSpace);
export const useArchiveSpace = mutation(service.archiveSpace);

export const usePages = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "pages", params], queryFn: () => service.getPages(params), enabled, placeholderData: keepPreviousData });
export const usePage = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id], queryFn: () => service.getPage(id as string), enabled: !!id });
export const useCreatePage = mutation(service.createPage);
export const useUpdatePage = mutation(service.updatePage);
export const useMovePage = mutation(service.movePage);
export const usePageAction = mutation(service.pageAction);
export const useDeletePage = mutation(service.deletePage);
export const useSetFavorite = mutation(service.setFavorite);
export const usePageVersions = (id: string | undefined, enabled = true) => useQuery({ queryKey: [...KEY, "page", id, "versions"], queryFn: () => service.getVersions(id as string), enabled: !!id && enabled });
export const usePageVersion = (id: string | undefined, n: number | null) => useQuery({ queryKey: [...KEY, "page", id, "version", n], queryFn: () => service.getVersion(id as string, n as number), enabled: !!id && n !== null });
export const useRestoreVersion = mutation(service.restoreVersion);
export const usePageComments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id, "comments"], queryFn: () => service.getComments(id as string), enabled: !!id });
export const useAddComment = mutation(service.addComment);
export const useCommentAction = mutation(service.commentAction);
export const useDeleteComment = mutation(service.deleteComment);
export const usePageLinks = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id, "links"], queryFn: () => service.getLinks(id as string), enabled: !!id });

export const useDocTemplates = (params: Params) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => service.getTemplates(params) });
export const useCreateDocTemplate = mutation(service.createTemplate);
export const useUpdateDocTemplate = mutation(service.updateTemplate);
export const useArchiveDocTemplate = mutation(service.archiveTemplate);

export const useChecklists = (params: Params) => useQuery({ queryKey: [...KEY, "checklists", params], queryFn: () => service.getChecklists(params), placeholderData: keepPreviousData });
export const useChecklist = (id: string | undefined) => useQuery({ queryKey: [...KEY, "checklist", id], queryFn: () => service.getChecklist(id as string), enabled: !!id });
export const useCreateChecklist = mutation(service.createChecklist);
export const useUpdateChecklist = mutation(service.updateChecklist);
export const useReplaceChecklistItems = mutation(service.replaceChecklistItems);
export const useArchiveChecklist = mutation(service.archiveChecklist);
export const useStartChecklistRun = mutation(service.startChecklistRun);
export const useChecklistRuns = (params: Params) => useQuery({ queryKey: [...KEY, "runs", params], queryFn: () => service.getChecklistRuns(params), placeholderData: keepPreviousData });
export const useChecklistRun = (id: string | undefined) => useQuery({ queryKey: [...KEY, "run", id], queryFn: () => service.getChecklistRun(id as string), enabled: !!id });
export const useRunItemAction = mutation(service.runItemAction);
export const useCancelChecklistRun = mutation(service.cancelChecklistRun);

export const useForms = (params: Params) => useQuery({ queryKey: [...KEY, "forms", params], queryFn: () => service.getForms(params), placeholderData: keepPreviousData });
export const useAssignedForms = () => useQuery({ queryKey: [...KEY, "forms", "assigned"], queryFn: service.getAssignedForms });
export const useForm = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id], queryFn: () => service.getForm(id as string), enabled: !!id });
export const useCreateForm = mutation(service.createForm);
export const useUpdateForm = mutation(service.updateForm);
export const useFormAction = mutation(service.formAction);
export const useDeleteForm = mutation(service.deleteForm);
export const useFormAssignments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "assignments"], queryFn: () => service.getFormAssignments(id as string), enabled: !!id });
export const useCreateFormAssignment = mutation(service.createFormAssignment);
export const useFillableForm = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "fill"], queryFn: () => service.getFillableForm(id as string), enabled: !!id });
export const useSubmitForm = mutation(service.submitForm);
export const useFormResponses = (id: string | undefined, params: Params) => useQuery({ queryKey: [...KEY, "form", id, "responses", params], queryFn: () => service.getFormResponses(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useFormSummary = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "summary"], queryFn: () => service.getFormSummary(id as string), enabled: !!id });
export const useReviewResponse = mutation(service.reviewResponse);

export const usePublicForm = (id: string | undefined) => useQuery({ queryKey: ["public-form", id], queryFn: () => service.getPublicForm(id as string), enabled: !!id, retry: false });
export const useSubmitPublicForm = () => useMutation({ mutationFn: service.submitPublicForm });
