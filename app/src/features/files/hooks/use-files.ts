import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/files.services";

const KEY = ["files"] as const;
type Params = Record<string, unknown>;

function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    return () => {
        const qc = useQueryClient();
        return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
    };
}

export const useDocuments = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "documents", params], queryFn: () => service.getDocuments(params), placeholderData: keepPreviousData, enabled });
export const useRecentFiles = () => useQuery({ queryKey: [...KEY, "recent"], queryFn: service.getRecent });
export const useFavoriteFiles = () => useQuery({ queryKey: [...KEY, "favorites"], queryFn: service.getFavorites });
export const useStorageUsage = (enabled = true) => useQuery({ queryKey: [...KEY, "storage"], queryFn: service.getStorageUsage, enabled });
export const useDocument = (id: string | undefined) => useQuery({ queryKey: [...KEY, "document", id], queryFn: () => service.getDocument(id as string), enabled: !!id });
export const useDocumentVersions = (id: string | undefined) => useQuery({ queryKey: [...KEY, "document", id, "versions"], queryFn: () => service.getVersions(id as string), enabled: !!id });
export const useUpdateDocument = mutation(service.updateDocument);
export const useMoveDocument = mutation(service.moveDocument);
export const useArchiveDocument = mutation(service.archiveDocument);
export const useDeleteDocument = mutation(service.deleteDocument);
export const useRestoreDocument = mutation(service.restoreDocument);
export const useSetDocumentFavorite = mutation(service.setDocumentFavorite);
export const useSetLegalHold = mutation(service.setLegalHold);
export const useRestoreDocumentVersion = mutation(service.restoreVersion);
export const useUploadFile = mutation(service.uploadFile);

export const useFolderTree = () => useQuery({ queryKey: [...KEY, "folders", "tree"], queryFn: service.getFolderTree });
export const useFolder = (id: string | null | undefined) => useQuery({ queryKey: [...KEY, "folder", id], queryFn: () => service.getFolder(id as string), enabled: !!id });
export const useCreateFolder = mutation(service.createFolder);
export const useRenameFolder = mutation(service.renameFolder);
export const useDeleteFolder = mutation(service.deleteFolder);

export const useShareDirectory = (enabled = true) => useQuery({ queryKey: [...KEY, "directory"], queryFn: service.getShareDirectory, enabled, staleTime: 60_000 });
export const useShares = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "shares", params], queryFn: () => service.getShares(params), placeholderData: keepPreviousData, enabled });
export const useCreateShare = mutation(service.createShare);
export const useRevokeShare = mutation(service.revokeShare);

export const useFileApprovals = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData, enabled });
export const useRequestApproval = mutation(service.requestApproval);
export const useDecideFileApproval = mutation(service.decideApproval);
export const useCancelFileApproval = mutation(service.cancelApproval);

export const useDeletionRequests = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "deletions", params], queryFn: () => service.getDeletionRequests(params), enabled });
export const useRequestDeletion = mutation(service.requestDeletion);
export const useDeletionRequestAction = mutation(service.deletionRequestAction);
export const useVaultEntries = (params: Params) => useQuery({ queryKey: [...KEY, "vault", params], queryFn: () => service.getVaultEntries(params), placeholderData: keepPreviousData });
export const useCreateVaultEntry = mutation(service.createVaultEntry);
export const useUpdateVaultEntry = mutation(service.updateVaultEntry);
export const useDeleteVaultEntry = mutation(service.deleteVaultEntry);
/** Reveal is not cached: the secret lives only in component state. */
export const useRevealVaultEntry = () => useMutation({ mutationFn: service.revealVaultEntry });

export const usePublicShare = (token: string | undefined) => useQuery({ queryKey: ["public-share", token], queryFn: () => service.getPublicShare(token as string), enabled: !!token, retry: false });
export const useAccessPublicShare = () => useMutation({ mutationFn: service.accessPublicShare });
