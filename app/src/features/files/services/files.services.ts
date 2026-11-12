import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    MemberRef, CreateShareDto, CreateVaultEntryDto, DocumentApprovalRow, DocumentDetail, DocumentRow, DocumentShare, DocumentVersion, DownloadUrl, FolderDetail, FolderNode,
    Paginated, PublicShareAccess, PublicShareInfo, RevealResult, StorageUsage, VaultEntry, CreateVaultGrantDto, DocumentCategoryRef, DocumentTemplate, DocumentTemplateDto,
    FolderTemplate, FolderTemplateDto, PortalUserRef, RetentionPolicy, RetentionPolicyDto, VaultEntryDetail,
} from "../interfaces/files.interfaces";

const R = () => ApiRoutes.files;
type Params = Record<string, unknown>;
const get = async <T,>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T,>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T,>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const del = async <T,>(url: string, body?: unknown): Promise<T> => (await axiosInstance.delete(url, body ? { data: body } : undefined)).data;

export const getDocuments = (params: Params) => get<Paginated<DocumentRow>>(R().documents, params);
export const getRecent = () => get<{ last_accessed_at: string; access_count: number; document: DocumentRow }[]>(R().recent);
export const getFavorites = () => get<{ documents: DocumentRow[]; folders: { id: string; name: string }[] }>(R().favorites);
export const getStorageUsage = () => get<StorageUsage>(R().storageUsage);
export const getDocument = (id: string) => get<DocumentDetail>(R().document.detail(id));
export const updateDocument = ({ id, ...dto }: { id: string; title?: string; description?: string; is_sensitive?: boolean; customer_visible?: boolean }) => patch<DocumentDetail>(R().document.detail(id), dto);
export const moveDocument = ({ id, folder_id }: { id: string; folder_id: string | null }) => post(R().document.action(id, "move"), { folder_id });
export const archiveDocument = (id: string) => post(R().document.action(id, "archive"));
export const deleteDocument = (id: string) => del(R().document.detail(id));
export const restoreDocument = (id: string) => post(R().document.action(id, "restore"));
export const setDocumentFavorite = ({ id, on }: { id: string; on: boolean }) => (on ? post(R().document.action(id, "favorite")) : del(R().document.action(id, "favorite")));
export const setLegalHold = ({ id, on, reason }: { id: string; on: boolean; reason?: string }) => (on ? post(R().document.action(id, "legal-hold"), { reason }) : del(R().document.action(id, "legal-hold")));
export const getVersions = (id: string) => get<DocumentVersion[]>(R().document.versions(id));
export const restoreVersion = ({ id, versionId }: { id: string; versionId: string }) => post(R().document.restoreVersion(id, versionId));
export const getDownloadUrl = (id: string, params: { version_id?: string; disposition?: "inline" | "attachment" } = {}) => get<DownloadUrl>(R().document.downloadUrl(id), params);

/** Multipart upload with progress. `document_id` uploads a new version of that document. */
export const uploadFile = async ({ file, folder_id, document_id, change_note, onProgress }: { file: File; folder_id?: string | null; document_id?: string; change_note?: string; onProgress?: (pct: number) => void }) => {
    const form = new FormData();
    form.append("file", file);
    if (folder_id) form.append("folder_id", folder_id);
    if (document_id) form.append("document_id", document_id);
    if (change_note) form.append("change_note", change_note);
    const res = await axiosInstance.post<DocumentDetail>(R().upload, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
    return res.data;
};

// Folders
export const getFolderTree = () => get<FolderNode[]>(R().folders.tree);
export const getFolder = (id: string) => get<FolderDetail>(R().folders.detail(id));
export const createFolder = (dto: { name: string; parent_folder_id?: string; description?: string }) => post<FolderNode>(R().folders.list, dto);
export const renameFolder = ({ id, name }: { id: string; name: string }) => patch(R().folders.detail(id), { name });
export const deleteFolder = (id: string) => del(R().folders.detail(id));

// Shares
export const getShareDirectory = () => get<{ members: MemberRef[]; teams: { id: string; name: string }[] }>(R().shares.directory);
export const getShares = (params: Params) => get<Paginated<DocumentShare>>(R().shares.list, params);
export const createShare = (dto: CreateShareDto) => post<DocumentShare>(R().shares.list, dto);
export const revokeShare = (id: string) => post(R().shares.revoke(id));

// Approvals
export const getApprovals = (params: Params) => get<Paginated<DocumentApprovalRow>>(R().approvals.list, params);
export const requestApproval = (dto: { document_id: string; approver_membership_ids: string[]; title?: string; message?: string; due_at?: string }) => post<DocumentApprovalRow>(R().approvals.list, dto);
export const decideApproval = ({ id, decision, comment }: { id: string; decision: string; comment?: string }) => post(R().approvals.decision(id), { decision, comment });
export const cancelApproval = (id: string) => post(R().approvals.cancel(id));

// Permanent deletion (request → approval by someone else)
export const getDeletionRequests = (params: Params) => get<Paginated<{ id: string; document_id: string; status: string; reason: string | null; created_at: string; requested_by_membership_id: string | null }>>(R().deletionRequests.list, params);
export const requestDeletion = ({ document_id, reason }: { document_id: string; reason?: string }) => post(R().deletionRequests.list, { document_id, reason });
export const deletionRequestAction = ({ id, action, reason }: { id: string; action: "approve" | "reject" | "cancel"; reason?: string }) => post(R().deletionRequests.action(id, action), action === "reject" ? { reason } : {});

// Vault
export const getVaultEntries = (params: Params) => get<Paginated<VaultEntry>>(R().vault.list, params);
export const getVaultEntry = (id: string) => get<VaultEntry>(R().vault.detail(id));
export const createVaultEntry = (dto: CreateVaultEntryDto) => post<VaultEntry>(R().vault.list, dto);
export const updateVaultEntry = ({ id, ...dto }: Partial<CreateVaultEntryDto> & { id: string }) => patch<VaultEntry>(R().vault.detail(id), dto);
export const deleteVaultEntry = (id: string) => del(R().vault.detail(id));
export const revealVaultEntry = ({ id, reason }: { id: string; reason?: string }) => post<RevealResult>(R().vault.reveal(id), { reason });
export const logVaultCopy = (id: string) => post(R().vault.copy(id));

// Public share (no credential)
export const getPublicShare = (token: string) => get<PublicShareInfo>(R().public.share(token));
export const accessPublicShare = ({ token, password }: { token: string; password?: string }) => post<PublicShareAccess>(R().public.access(token), { password });

// Vault grants (17 §12)
export const getVaultEntryDetail = (id: string) => get<VaultEntryDetail>(R().vault.detail(id));
export const addVaultGrant = ({ id, ...dto }: CreateVaultGrantDto & { id: string }) => post(R().vault.grants(id), dto);
export const revokeVaultGrant = ({ id, grantId }: { id: string; grantId: string }) => del(R().vault.grant(id, grantId));
export const getVaultPortalUsers = (id: string) => get<PortalUserRef[]>(R().vault.portalUsers(id));

// Retention (17 §13)
export const getCategories = () => get<DocumentCategoryRef[]>(R().categories);
export const getRetentionPolicies = () => get<RetentionPolicy[]>(R().retention.policies);
export const createRetentionPolicy = (dto: RetentionPolicyDto) => post<RetentionPolicy>(R().retention.policies, dto);
export const updateRetentionPolicy = ({ id, ...dto }: Partial<RetentionPolicyDto> & { id: string }) => patch<RetentionPolicy>(R().retention.policy(id), dto);
export const archiveRetentionPolicy = (id: string) => post(R().retention.archive(id));

// Templates (17 §4, §7)
export const getFolderTemplates = (params: Params) => get<Paginated<FolderTemplate>>(R().folderTemplates.list, params);
export const createFolderTemplate = (dto: FolderTemplateDto) => post<FolderTemplate>(R().folderTemplates.list, dto);
export const updateFolderTemplate = ({ id, ...dto }: Partial<FolderTemplateDto> & { id: string }) => patch<FolderTemplate>(R().folderTemplates.detail(id), dto);
export const archiveFolderTemplate = (id: string) => post(R().folderTemplates.action(id, "archive"));
export const applyFolderTemplate = ({ id, ...dto }: { id: string; parent_folder_id?: string; root_name?: string }) => post<{ root_folder_id: string | null; created: { id: string; name: string }[] }>(R().folderTemplates.action(id, "apply"), dto);
export const getDocumentTemplates = (params: Params) => get<Paginated<DocumentTemplate>>(R().documentTemplates.list, params);
export const getDocumentTemplate = (id: string) => get<DocumentTemplate>(R().documentTemplates.detail(id));
export const createDocumentTemplate = (dto: DocumentTemplateDto) => post<DocumentTemplate>(R().documentTemplates.list, dto);
export const updateDocumentTemplate = ({ id, ...dto }: Partial<DocumentTemplateDto> & { id: string }) => patch<DocumentTemplate>(R().documentTemplates.detail(id), dto);
export const archiveDocumentTemplate = (id: string) => post(R().documentTemplates.action(id, "archive"));
export const generateFromTemplate = ({ id, ...dto }: { id: string; values: Record<string, string>; title?: string; folder_id?: string }) => post<{ document_id: string; title: string; filename: string }>(R().documentTemplates.action(id, "generate"), dto);
