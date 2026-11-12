import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/files.services";
import type { DocumentRow, VaultGrant, VaultEntryDetail } from "../interfaces/files.interfaces";

const KEY = ["files"] as const;
type Params = Record<string, unknown>;

/**
 * Plain files mutation: refreshes the files cache when it settles. No success toast (the UI shows the result); a failure
 * is toasted once by the global MutationCache with `errorTitle` (or shown inline when `errorToast` is false).
 */
function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, errorTitle: string, errorToast = true) {
    return () => {
        const qc = useQueryClient();
        return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
    };
}

export const useDocuments = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "documents", params], queryFn: () => service.getDocuments(params), placeholderData: keepPreviousData, enabled });
export const useRecentFiles = () => useQuery({ queryKey: [...KEY, "recent"], queryFn: service.getRecent });
export const useFavoriteFiles = () => useQuery({ queryKey: [...KEY, "favorites"], queryFn: service.getFavorites });
export const useStorageUsage = (enabled = true) => useQuery({ queryKey: [...KEY, "storage"], queryFn: service.getStorageUsage, enabled });
export const useDocument = (id: string | undefined) => useQuery({ queryKey: [...KEY, "document", id], queryFn: () => service.getDocument(id as string), enabled: !!id });
export const useDocumentVersions = (id: string | undefined) => useQuery({ queryKey: [...KEY, "document", id, "versions"], queryFn: () => service.getVersions(id as string), enabled: !!id });
/** Optimistic: the title / flags change everywhere at once. */
export const useUpdateDocument = () => useEntityUpdate({ root: KEY, mutationFn: service.updateDocument, meta: { errorTitle: "Could not update the file" } });
/** Optimistic: the file leaves the folder it was moved out of at once. */
export const useMoveDocument = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not move the file" },
        mutationFn: service.moveDocument,
        apply: (qc, v) => {
            qc.setQueriesData<{ data: DocumentRow[] }>({ queryKey: [...KEY, "documents"] }, (d) => (d?.data ? { ...d, data: d.data.filter((x) => x.id !== v.id || x.folder_id === v.folder_id) } : d));
            patchEntity(qc, [...KEY, "document", v.id], v.id, { folder_id: v.folder_id });
        },
    });
export const useArchiveDocument = () => useEntityRemove({ root: KEY, mutationFn: service.archiveDocument, meta: { errorTitle: "Could not archive the file" } });
/** Move to trash: the file disappears from every list at once. */
export const useDeleteDocument = () => useEntityRemove({ root: KEY, mutationFn: service.deleteDocument, meta: { errorTitle: "Could not move the file to trash" } });
/** Restore from trash: the file leaves the trash list at once. */
export const useRestoreDocument = () => useEntityRemove({ root: [...KEY, "documents"], mutationFn: service.restoreDocument, alsoInvalidate: [KEY], meta: { errorTitle: "Could not restore the file" } });
/** Optimistic star / unstar (an unstarred file also leaves the Favorites list). */
export const useSetDocumentFavorite = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update favorites" },
        mutationFn: service.setDocumentFavorite,
        apply: (qc, v) => {
            patchEntity(qc, KEY, v.id, { is_favorite: v.on });
            if (!v.on) qc.setQueriesData<{ documents: DocumentRow[] }>({ queryKey: [...KEY, "favorites"] }, (d) => (d ? { ...d, documents: d.documents.filter((x) => x.id !== v.id) } : d));
        },
    });
/** Optimistic: the hold badge and actions switch at once. */
export const useSetLegalHold = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not update the legal hold" },
        mutationFn: service.setLegalHold,
        apply: (qc, v) => patchEntity(qc, KEY, v.id, { legal_hold: v.on, effective_legal_hold: v.on, legal_hold_reason: v.on ? v.reason ?? null : null }),
    });
export const useRestoreDocumentVersion = mutation(service.restoreVersion, "Could not restore the version");
/** Upload errors are shown on the file's row in the upload dialog, not as a toast. */
export const useUploadFile = mutation(service.uploadFile, "Could not upload", false);

export const useFolderTree = () => useQuery({ queryKey: [...KEY, "folders", "tree"], queryFn: service.getFolderTree });
export const useFolder = (id: string | null | undefined) => useQuery({ queryKey: [...KEY, "folder", id], queryFn: () => service.getFolder(id as string), enabled: !!id });
export const useCreateFolder = mutation(service.createFolder, "Could not create the folder");
/** Optimistic rename in the tree, breadcrumbs and subfolder tiles. */
export const useRenameFolder = () => useEntityUpdate({ root: KEY, mutationFn: service.renameFolder, meta: { errorTitle: "Could not rename the folder" } });
/** The folder leaves the tree at once (comes back if it is not empty or under a hold). */
export const useDeleteFolder = () => useEntityRemove({ root: KEY, mutationFn: service.deleteFolder, meta: { errorTitle: "Could not delete the folder" } });

export const useShareDirectory = (enabled = true) => useQuery({ queryKey: [...KEY, "directory"], queryFn: service.getShareDirectory, enabled, staleTime: 60_000 });
export const useShares = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "shares", params], queryFn: () => service.getShares(params), placeholderData: keepPreviousData, enabled });
export const useCreateShare = mutation(service.createShare, "Could not share");
/** Optimistic: the share shows Revoked at once. */
export const useRevokeShare = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not revoke the share" }, mutationFn: service.revokeShare, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "REVOKED" }) });

export const useFileApprovals = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData, enabled });
export const useRequestApproval = mutation(service.requestApproval, "Could not request approval");
/** Optimistic: the decide buttons disappear at once (the row's status refreshes when the request settles). */
export const useDecideFileApproval = () =>
    useOptimisticMutation({ roots: [[...KEY, "approvals"]], alsoInvalidate: [KEY], meta: { errorTitle: "Could not record the decision" }, mutationFn: service.decideApproval, apply: (qc, v) => patchEntity(qc, [...KEY, "approvals"], v.id, { can_decide: false }) });
export const useCancelFileApproval = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not cancel the request" }, mutationFn: service.cancelApproval, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "CANCELLED" }) });

export const useDeletionRequests = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "deletions", params], queryFn: () => service.getDeletionRequests(params), enabled });
export const useRequestDeletion = mutation(service.requestDeletion, "Could not request deletion");
/** Approve / reject / cancel: the request (and, when approved, the file) leaves the trash at once. */
export const useDeletionRequestAction = () =>
    useOptimisticMutation<unknown, Parameters<typeof service.deletionRequestAction>[0] & { document_id?: string }>({
        roots: [KEY],
        meta: { errorTitle: "Could not update the deletion request" },
        mutationFn: ({ document_id: _d, ...v }) => service.deletionRequestAction(v),
        apply: (qc, v) => {
            removeEntity(qc, [...KEY, "deletions"], v.id);
            if (v.action === "approve" && v.document_id) removeEntity(qc, [...KEY, "documents"], v.document_id);
        },
    });
export const useVaultEntries = (params: Params) => useQuery({ queryKey: [...KEY, "vault", params], queryFn: () => service.getVaultEntries(params), placeholderData: keepPreviousData });
export const useCreateVaultEntry = mutation(service.createVaultEntry, "Could not save the credential");
export const useUpdateVaultEntry = () => useEntityUpdate({ root: KEY, mutationFn: service.updateVaultEntry, meta: { errorTitle: "Could not save the credential" } });
export const useDeleteVaultEntry = () => useEntityRemove({ root: KEY, mutationFn: service.deleteVaultEntry, meta: { errorTitle: "Could not delete the credential" } });
/** Reveal is not cached: the secret lives only in component state. */
export const useRevealVaultEntry = () => useMutation({ mutationFn: service.revealVaultEntry, meta: { errorTitle: "Could not reveal" } });

export const usePublicShare = (token: string | undefined) => useQuery({ queryKey: ["public-share", token], queryFn: () => service.getPublicShare(token as string), enabled: !!token, retry: false });
/** The public page shows the error inline (wrong password, expired link). */
export const useAccessPublicShare = () => useMutation({ mutationFn: service.accessPublicShare, meta: { errorToast: false } });

export const useVaultEntryDetail = (id: string | null) => useQuery({ queryKey: [...KEY, "vault-entry", id], queryFn: () => service.getVaultEntryDetail(id as string), enabled: !!id });
type AddGrantVars = Parameters<typeof service.addVaultGrant>[0] & { display?: Pick<VaultGrant, "membership" | "team" | "portal_user"> };
/** Optimistic: the grant shows in the list at once (`display` carries the picked person / team, never sent). */
export const useAddVaultGrant = () =>
    useOptimisticMutation<unknown, AddGrantVars>({
        roots: [[...KEY, "vault-entry"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not grant access" },
        mutationFn: ({ display: _d, ...dto }) => service.addVaultGrant(dto),
        apply: (qc, { id, display, ...dto }) => {
            const temp: VaultGrant = {
                id: `temp-${Date.now()}`, subject_type: dto.subject_type, membership_id: dto.membership_id ?? null, team_id: dto.team_id ?? null, portal_user_id: dto.portal_user_id ?? null,
                can_reveal: !!dto.can_reveal, can_manage: !!dto.can_manage, expires_at: dto.expires_at ?? null, created_at: new Date().toISOString(),
                membership: display?.membership ?? null, team: display?.team ?? null, portal_user: display?.portal_user ?? null,
            };
            qc.setQueryData<VaultEntryDetail>([...KEY, "vault-entry", id], (d) => (d ? { ...d, grants: [...d.grants, temp] } : d));
        },
    });
/** Optimistic: the grant leaves the list at once. */
export const useRevokeVaultGrant = () =>
    useOptimisticMutation({
        roots: [[...KEY, "vault-entry"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not revoke access" },
        mutationFn: service.revokeVaultGrant,
        apply: (qc, v) => qc.setQueryData<VaultEntryDetail>([...KEY, "vault-entry", v.id], (d) => (d ? { ...d, grants: d.grants.filter((g) => g.id !== v.grantId) } : d)),
    });
export const useVaultPortalUsers = (id: string | null, enabled = true) => useQuery({ queryKey: [...KEY, "vault-entry", id, "portal-users"], queryFn: () => service.getVaultPortalUsers(id as string), enabled: !!id && enabled });

export const useFileCategories = (enabled = true) => useQuery({ queryKey: [...KEY, "categories"], queryFn: service.getCategories, enabled, staleTime: 60_000 });
export const useRetentionPolicies = (enabled = true) => useQuery({ queryKey: [...KEY, "retention"], queryFn: service.getRetentionPolicies, enabled });
export const useCreateRetentionPolicy = mutation(service.createRetentionPolicy, "Could not create the policy");
/** Autosaved edit form: failures show in its <SaveStatus />. */
export const useUpdateRetentionPolicy = () => useEntityUpdate({ root: KEY, mutationFn: service.updateRetentionPolicy, meta: { errorTitle: "Could not save the policy", errorToast: false } });
export const useArchiveRetentionPolicy = () => useEntityRemove({ root: [...KEY, "retention"], mutationFn: service.archiveRetentionPolicy, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive the policy" } });

export const useFolderTemplates = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "folder-templates", params], queryFn: () => service.getFolderTemplates(params), placeholderData: keepPreviousData, enabled });
export const useCreateFolderTemplate = mutation(service.createFolderTemplate, "Could not create the template");
/** Autosaved edit form: failures show in its <SaveStatus />. */
export const useUpdateFolderTemplate = () => useEntityUpdate({ root: KEY, mutationFn: service.updateFolderTemplate, meta: { errorTitle: "Could not save the template", errorToast: false } });
export const useArchiveFolderTemplate = () => useEntityRemove({ root: [...KEY, "folder-templates"], mutationFn: service.archiveFolderTemplate, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive the template" } });
export const useApplyFolderTemplate = mutation(service.applyFolderTemplate, "Could not create the folders");
export const useDocumentTemplates = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "document-templates", params], queryFn: () => service.getDocumentTemplates(params), placeholderData: keepPreviousData, enabled });
export const useDocumentTemplate = (id: string | null) => useQuery({ queryKey: [...KEY, "document-template", id], queryFn: () => service.getDocumentTemplate(id as string), enabled: !!id });
export const useCreateDocumentTemplate = mutation(service.createDocumentTemplate, "Could not create the template");
export const useUpdateDocumentTemplate = () => useEntityUpdate({ root: KEY, mutationFn: service.updateDocumentTemplate, meta: { errorTitle: "Could not save the template" } });
export const useArchiveDocumentTemplate = () => useEntityRemove({ root: [...KEY, "document-templates"], mutationFn: service.archiveDocumentTemplate, alsoInvalidate: [KEY], meta: { errorTitle: "Could not archive the template" } });
export const useGenerateFromTemplate = mutation(service.generateFromTemplate, "Could not generate the document");
