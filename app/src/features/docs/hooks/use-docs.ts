import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/docs.services";
import type { MemberRef, WikiChecklistRunDetail, WikiPageComment, WikiPageDetail } from "../interfaces/docs.interfaces";

const KEY = ["docs"] as const;
type Params = Record<string, unknown>;

/**
 * Plain docs mutation: refreshes the docs cache when it settles. No success toast (the UI shows the result); a failure is
 * toasted once by the global MutationCache with `errorTitle` (or shown inline when `errorToast` is false).
 */
function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, errorTitle: string, errorToast = true) {
    return () => {
        const qc = useQueryClient();
        return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
    };
}

type PageAction = Parameters<typeof service.pageAction>[0]["action"];
const commentsKey = (pageId: string) => [...KEY, "page", pageId, "comments"];

export const useDocsHome = () => useQuery({ queryKey: [...KEY, "home"], queryFn: service.getHome });
export const useDocsSearch = (params: Params, enabled: boolean) => useQuery({ queryKey: [...KEY, "search", params], queryFn: () => service.searchPages(params), enabled, placeholderData: keepPreviousData });
export const useDocsTrash = (params: Params) => useQuery({ queryKey: [...KEY, "trash", params], queryFn: () => service.getTrash(params), placeholderData: keepPreviousData });
export const useDocsDirectory = (enabled = true) => useQuery({ queryKey: [...KEY, "directory"], queryFn: () => service.getDirectory(), enabled, staleTime: 60_000 });

export const useSpaces = (params: Params) => useQuery({ queryKey: [...KEY, "spaces", params], queryFn: () => service.getSpaces(params), placeholderData: keepPreviousData });
export const useSpace = (id: string | undefined) => useQuery({ queryKey: [...KEY, "space", id], queryFn: () => service.getSpace(id as string), enabled: !!id });
export const useSpaceTree = (id: string | undefined) => useQuery({ queryKey: [...KEY, "space", id, "tree"], queryFn: () => service.getSpaceTree(id as string), enabled: !!id });
export const useCreateSpace = mutation(service.createSpace, "Could not create the space");
/** Autosaved space settings: optimistic, failures show in the dialog's <SaveStatus />. */
export const useUpdateSpace = () => useEntityUpdate({ root: KEY, mutationFn: service.updateSpace, meta: { errorTitle: "Could not save the space", errorToast: false } });
export const useArchiveSpace = () => useEntityRemove({ root: [...KEY, "spaces"], mutationFn: service.archiveSpace, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive the space" } });

export const usePages = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "pages", params], queryFn: () => service.getPages(params), enabled, placeholderData: keepPreviousData });
export const usePage = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id], queryFn: () => service.getPage(id as string), enabled: !!id });
export const useCreatePage = mutation(service.createPage, "Could not create the page");
/**
 * Page editor autosave (sends base_version_number): a 409 "page changed" opens the merge prompt and other failures show
 * in the editor's <SaveStatus />, so no toast.
 */
export const useUpdatePage = mutation(service.updatePage, "Could not save the page", false);
/** Rename from the page view / tree: optimistic everywhere (tree, lists, breadcrumbs). */
export const useRenamePage = () => useEntityUpdate({ root: KEY, mutationFn: service.updatePage, meta: { errorTitle: "Could not rename the page" } });
/** Move / reorder in the tree: the node takes its new parent and position at once. */
export const useMovePage = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not move the page" },
        mutationFn: service.movePage,
        apply: (qc, { id, ...to }) => patchEntity(qc, KEY, id, to),
    });
const PAGE_ACTION_PATCH: Partial<Record<PageAction, () => Partial<WikiPageDetail>>> = {
    publish: () => ({ status: "PUBLISHED", has_unpublished_changes: false }),
    unpublish: () => ({ status: "DRAFT" }),
    archive: () => ({ archived_at: new Date().toISOString() }),
    unarchive: () => ({ archived_at: null }),
};
/**
 * Publish / unpublish / archive / trash / restore / acknowledge. The page shows its new state at once: trashed pages
 * leave lists and the tree, restored ones leave the trash, the acknowledgement banner turns green.
 */
export const usePageAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the page" },
        mutationFn: service.pageAction,
        apply: (qc, { id, action }) => {
            const patch = PAGE_ACTION_PATCH[action];
            if (patch) patchEntity(qc, KEY, id, patch());
            if (action === "trash") removeEntity(qc, KEY, id);
            if (action === "restore" || action === "unarchive") removeEntity(qc, [...KEY, "trash"], id);
            if (action === "acknowledge")
                patchEntity<WikiPageDetail>(qc, [...KEY, "page", id], id, (pg) => (pg.my_acknowledgement ? { ...pg, my_acknowledgement: { ...pg.my_acknowledgement, is_current: true, acknowledged_at: new Date().toISOString() } } : pg));
        },
    });
export const useDeletePage = () => useEntityRemove({ root: KEY, mutationFn: service.deletePage, meta: { errorTitle: "Could not delete the page" } });
/** Optimistic star / unstar. */
export const useSetFavorite = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not update favorites" }, mutationFn: service.setFavorite, apply: (qc, v) => patchEntity(qc, KEY, v.id, { is_favorite: v.on }) });
export const usePageVersions = (id: string | undefined, enabled = true) => useQuery({ queryKey: [...KEY, "page", id, "versions"], queryFn: () => service.getVersions(id as string), enabled: !!id && enabled });
export const usePageVersion = (id: string | undefined, n: number | null) => useQuery({ queryKey: [...KEY, "page", id, "version", n], queryFn: () => service.getVersion(id as string, n as number), enabled: !!id && n !== null });
export const useRestoreVersion = mutation(service.restoreVersion, "Could not restore the version");
export const usePageComments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id, "comments"], queryFn: () => service.getComments(id as string), enabled: !!id });
/** Optimistic: the comment shows at once (`author` is display-only, never sent). */
export const useAddComment = () =>
    useOptimisticMutation<WikiPageComment, Parameters<typeof service.addComment>[0] & { author?: MemberRef | null }>({
        roots: [[...KEY, "page"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not post the comment" },
        mutationFn: ({ author: _a, ...v }) => service.addComment(v),
        apply: (qc, v) => {
            const now = new Date().toISOString();
            const temp: WikiPageComment = { id: `temp-${Date.now()}`, page_id: v.id, parent_comment_id: v.parent_comment_id ?? null, author_membership_id: v.author?.id ?? null, body: v.body, resolved_at: null, edited_at: null, created_at: now, author: v.author ?? null };
            qc.setQueryData<WikiPageComment[]>(commentsKey(v.id), (d) => (d ? [temp, ...d] : d));
        },
    });
/** Optimistic resolve / reopen. */
export const useCommentAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "page"]],
        meta: { errorTitle: "Could not update the comment" },
        mutationFn: service.commentAction,
        apply: (qc, v) => patchEntity(qc, commentsKey(v.id), v.commentId, { resolved_at: v.action === "resolve" ? new Date().toISOString() : null }),
    });
/** Optimistic: the comment disappears at once. */
export const useDeleteComment = () =>
    useOptimisticMutation({
        roots: [[...KEY, "page"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not delete the comment" },
        mutationFn: service.deleteComment,
        apply: (qc, v) => removeEntity(qc, commentsKey(v.id), v.commentId),
    });
export const usePageLinks = (id: string | undefined) => useQuery({ queryKey: [...KEY, "page", id, "links"], queryFn: () => service.getLinks(id as string), enabled: !!id });

export const usePagePermissions = (id: string | undefined, enabled = true) => useQuery({ queryKey: [...KEY, "page", id, "permissions"], queryFn: () => service.getPagePermissions(id as string), enabled: !!id && enabled });
/** Autosaved permissions panel: failures show in its <SaveStatus />. */
export const useSetPagePermissions = mutation(service.setPagePermissions, "Could not save permissions", false);
export const useDocTemplates = (params: Params) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => service.getTemplates(params) });
export const useCreateDocTemplate = mutation(service.createTemplate, "Could not create the template");
/** Autosaved template edit dialog: optimistic, failures show in its <SaveStatus />. */
export const useUpdateDocTemplate = () => useEntityUpdate({ root: KEY, mutationFn: service.updateTemplate, meta: { errorTitle: "Could not save the template", errorToast: false } });
export const useArchiveDocTemplate = () => useEntityRemove({ root: [...KEY, "templates"], mutationFn: service.archiveTemplate, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive the template" } });

export const useChecklists = (params: Params) => useQuery({ queryKey: [...KEY, "checklists", params], queryFn: () => service.getChecklists(params), placeholderData: keepPreviousData });
export const useChecklist = (id: string | undefined) => useQuery({ queryKey: [...KEY, "checklist", id], queryFn: () => service.getChecklist(id as string), enabled: !!id });
export const useCreateChecklist = mutation(service.createChecklist, "Could not create the checklist");
export const useUpdateChecklist = () => useEntityUpdate({ root: KEY, mutationFn: service.updateChecklist, meta: { errorTitle: "Could not update the checklist" } });
/** Autosaved item editor: failures show in its <SaveStatus />. */
export const useReplaceChecklistItems = mutation(service.replaceChecklistItems, "Could not save the items", false);
export const useArchiveChecklist = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not archive the checklist" }, mutationFn: service.archiveChecklist, apply: (qc, id) => patchEntity(qc, KEY, id, { archived_at: new Date().toISOString() }) });
export const useStartChecklistRun = mutation(service.startChecklistRun, "Could not start the checklist");
export const useChecklistRuns = (params: Params) => useQuery({ queryKey: [...KEY, "runs", params], queryFn: () => service.getChecklistRuns(params), placeholderData: keepPreviousData });
export const useChecklistRun = (id: string | undefined) => useQuery({ queryKey: [...KEY, "run", id], queryFn: () => service.getChecklistRun(id as string), enabled: !!id });
const ITEM_STATUS = { complete: "COMPLETED", reopen: "PENDING", skip: "SKIPPED" } as const;
/** Optimistic: the item ticks / unticks / skips at once (progress refreshes when the request settles). */
export const useRunItemAction = () =>
    useOptimisticMutation({
        roots: [[...KEY, "run"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the item" },
        mutationFn: service.runItemAction,
        apply: (qc, v) =>
            qc.setQueryData<WikiChecklistRunDetail>([...KEY, "run", v.id], (d) =>
                d ? { ...d, items: d.items.map((it) => (it.id === v.itemId ? { ...it, status: ITEM_STATUS[v.action], completed_at: v.action === "complete" ? new Date().toISOString() : null, skipped_reason: v.action === "skip" ? v.reason ?? null : null } : it)) } : d),
    });
export const useCancelChecklistRun = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not cancel the run" }, mutationFn: service.cancelChecklistRun, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "CANCELLED" }) });

export const useForms = (params: Params) => useQuery({ queryKey: [...KEY, "forms", params], queryFn: () => service.getForms(params), placeholderData: keepPreviousData });
export const useAssignedForms = () => useQuery({ queryKey: [...KEY, "forms", "assigned"], queryFn: service.getAssignedForms });
export const useForm = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id], queryFn: () => service.getForm(id as string), enabled: !!id });
export const useCreateForm = mutation(service.createForm, "Could not create the form");
/** Autosaved form builder: failures show in its <SaveStatus />. */
export const useUpdateForm = mutation(service.updateForm, "Could not save the form", false);
const FORM_STATUS = { publish: "PUBLISHED", close: "CLOSED", reopen: "PUBLISHED", archive: "ARCHIVED" } as const;
/** Publish / close / reopen / archive: the status badge changes at once. */
export const useFormAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the form" },
        mutationFn: service.formAction,
        apply: (qc, v) => { if (v.action in FORM_STATUS) patchEntity(qc, KEY, v.id, { status: FORM_STATUS[v.action as keyof typeof FORM_STATUS] }); },
    });
export const useDeleteForm = () => useEntityRemove({ root: KEY, mutationFn: service.deleteForm, meta: { errorTitle: "Could not delete the form" } });
export const useFormAssignments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "assignments"], queryFn: () => service.getFormAssignments(id as string), enabled: !!id });
export const useCreateFormAssignment = mutation(service.createFormAssignment, "Could not assign the form");
export const useFillableForm = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "fill"], queryFn: () => service.getFillableForm(id as string), enabled: !!id });
export const useSubmitForm = mutation(service.submitForm, "Could not submit");
export const useFormResponses = (id: string | undefined, params: Params) => useQuery({ queryKey: [...KEY, "form", id, "responses", params], queryFn: () => service.getFormResponses(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useFormSummary = (id: string | undefined) => useQuery({ queryKey: [...KEY, "form", id, "summary"], queryFn: () => service.getFormSummary(id as string), enabled: !!id });
/** Optimistic: the response's status changes at once. */
export const useReviewResponse = () =>
    useOptimisticMutation({
        roots: [[...KEY, "form"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the response" },
        mutationFn: service.reviewResponse,
        apply: (qc, v) => patchEntity(qc, [...KEY, "form", v.id, "responses"], v.submissionId, { status: v.status }),
    });

export const usePublicForm = (id: string | undefined) => useQuery({ queryKey: ["public-form", id], queryFn: () => service.getPublicForm(id as string), enabled: !!id, retry: false });
export const useSubmitPublicForm = () => useMutation({ mutationFn: service.submitPublicForm, meta: { errorTitle: "Could not submit" } });

export const useAskDocs = () => useMutation({ mutationFn: service.askDocs, meta: { errorTitle: "Could not answer" } });
export const useDocsAiStatus = (enabled = true) => useQuery({ queryKey: [...KEY, "ai-status"], queryFn: service.getDocsAiStatus, enabled });
export const useReindexDocsAi = mutation(service.reindexDocsAi, "Could not rebuild the index");
export const useDocsAnalytics = (params: Params) => useQuery({ queryKey: [...KEY, "analytics", params], queryFn: () => service.getDocsAnalytics(params), placeholderData: keepPreviousData });
/** The browser download is the feedback. */
export const useExportDocs = () => useMutation({ mutationFn: service.exportDocs, meta: { errorTitle: "Export failed" } });
/** The import dialog shows the result (and the error) inline. */
export const useImportDocs = mutation(service.importDocs, "Import failed", false);
export const useDocsTransfers = (enabled = true) => useQuery({ queryKey: [...KEY, "transfers"], queryFn: service.getDocsTransfers, enabled });
