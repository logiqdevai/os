import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/contracts.services";

/** One base key for the whole Contracts area: every mutation invalidates it (lists, detail, dashboard stay in sync). */
const KEY = ["contracts"] as const;

function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

// Queries
export const useContracts = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "list", params], queryFn: () => s.getContracts(params), placeholderData: keepPreviousData });
export const useContract = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => s.getContract(id as string), enabled: !!id });
export const useContractDashboard = () => useQuery({ queryKey: [...KEY, "dashboard"], queryFn: s.getContractDashboard });
export const useRenewals = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "renewals", params], queryFn: () => s.getRenewals(params), placeholderData: keepPreviousData });
export const useContractHistory = (id: string | undefined) => useQuery({ queryKey: [...KEY, "history", id], queryFn: () => s.getContractHistory(id as string), enabled: !!id });
export const useContractLookup = (kind: "members" | "companies" | "contacts" | "projects", search: string, enabled = true, companyId?: string) =>
    useQuery({ queryKey: [...KEY, "lookup", kind, search, companyId], queryFn: () => s.lookup(kind, { search: search || undefined, company_id: companyId }), enabled, staleTime: 30_000, placeholderData: keepPreviousData });
export const useContractVersion = (id: string | undefined, vid: string | undefined) => useQuery({ queryKey: [...KEY, "version", id, vid], queryFn: () => s.getVersion(id as string, vid as string), enabled: !!id && !!vid });
export const useCompareVersions = (id: string | undefined, from: string | undefined, to: string | undefined) =>
    useQuery({ queryKey: [...KEY, "compare", id, from, to], queryFn: () => s.compareVersions(id as string, from as string, to as string), enabled: !!id && !!from && !!to && from !== to });
export const useApprovalPreview = (id: string | undefined, vid: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "approval-preview", id, vid], queryFn: () => s.getApprovalPreview(id as string, vid as string), enabled: enabled && !!id && !!vid });
export const useMyContractApprovals = (enabled = true) => useQuery({ queryKey: [...KEY, "my-approvals"], queryFn: s.getMyApprovals, enabled });
export const useContractComments = (id: string | undefined, params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "comments", id, params], queryFn: () => s.getComments(id as string, params), enabled: !!id });
export const useSignatureRequests = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "signatures", params], queryFn: () => s.getSignatureRequests(params), placeholderData: keepPreviousData });
export const useSignatureRequest = (id: string | undefined) => useQuery({ queryKey: [...KEY, "signature", id], queryFn: () => s.getSignatureRequest(id as string), enabled: !!id });
export const useSignatureCertificate = (id: string | undefined) => useQuery({ queryKey: [...KEY, "certificate", id], queryFn: () => s.getCertificate(id as string), enabled: !!id });
export const useObligations = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "obligations", params], queryFn: () => s.getObligations(params), placeholderData: keepPreviousData });
export const useContractTypes = (params: Record<string, unknown> = {}) => useQuery({ queryKey: [...KEY, "types", params], queryFn: () => s.getContractTypes({ limit: 100, ...params }) });
export const useContractTemplates = (params: Record<string, unknown> = {}) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => s.getContractTemplates({ limit: 100, ...params }), placeholderData: keepPreviousData });
export const useContractTemplate = (id: string | undefined) => useQuery({ queryKey: [...KEY, "template", id], queryFn: () => s.getContractTemplate(id as string), enabled: !!id });
export const useContractClauses = (params: Record<string, unknown> = {}) => useQuery({ queryKey: [...KEY, "clauses", params], queryFn: () => s.getContractClauses({ limit: 100, ...params }), placeholderData: keepPreviousData });
export const useContractClause = (id: string | undefined) => useQuery({ queryKey: [...KEY, "clause", id], queryFn: () => s.getContractClause(id as string), enabled: !!id });
export const useApprovalRules = (enabled = true) => useQuery({ queryKey: [...KEY, "approval-rules"], queryFn: s.getApprovalRules, enabled });

// Mutations (toasts are raised by the calling screen with the context-specific message)
export const useCreateContract = () => useInvalidating(s.createContract);
export const useUpdateContract = () => useInvalidating(s.updateContract);
export const useSetParties = () => useInvalidating(s.setParties);
export const useLinkProject = () => useInvalidating(s.linkProject);
export const useUnlinkProject = () => useInvalidating(s.unlinkProject);
export const useArchiveContract = () => useInvalidating(s.archiveContract);
export const useRestoreContract = () => useInvalidating(s.restoreContract);
export const useDeleteContract = () => useInvalidating(s.deleteContract);
export const useRenewalDecision = () => useInvalidating(s.renewalDecision);
export const useRenewContract = () => useInvalidating(s.renewContract);
export const useAmendContract = () => useInvalidating(s.amendContract);
export const useTerminateContract = () => useInvalidating(s.terminateContract);
export const useCreateVersion = () => useInvalidating(s.createVersion);
export const useSaveSections = () => useInvalidating(s.saveSections);
export const useRequestReview = () => useInvalidating(s.requestReview);
export const useDecideReview = () => useInvalidating(s.decideReview);
export const useSubmitForApproval = () => useInvalidating(s.submitForApproval);
export const useDecideApproval = () => useInvalidating(s.decideApproval);
export const useCreateComment = () => useInvalidating(s.createComment);
export const useResolveComment = () => useInvalidating(s.resolveComment);
export const useSendForSignature = () => useInvalidating(s.sendForSignature);
export const useRemindSignature = () => useInvalidating(s.remindSignature);
export const useReissueLink = () => useInvalidating(s.reissueLink);
export const useCancelSignature = () => useInvalidating(s.cancelSignature);
export const useCreateObligation = () => useInvalidating(s.createObligation);
export const useUpdateObligation = () => useInvalidating(s.updateObligation);
export const useFulfilObligation = () => useInvalidating(s.fulfilObligation);
export const useWaiveObligation = () => useInvalidating(s.waiveObligation);
export const useDeleteObligation = () => useInvalidating(s.deleteObligation);
export const useCreateContractType = () => useInvalidating(s.createContractType);
export const useUpdateContractType = () => useInvalidating(s.updateContractType);
export const useArchiveContractType = () => useInvalidating(s.archiveContractType);
export const useCreateContractTemplate = () => useInvalidating(s.createContractTemplate);
export const useAddTemplateVersion = () => useInvalidating(s.addTemplateVersion);
export const usePublishTemplateVersion = () => useInvalidating(s.publishTemplateVersion);
export const useDeprecateTemplate = () => useInvalidating(s.deprecateTemplate);
export const useCreateContractClause = () => useInvalidating(s.createContractClause);
export const useUpdateContractClause = () => useInvalidating(s.updateContractClause);
export const useAddClauseVersion = () => useInvalidating(s.addClauseVersion);
export const useCreateApprovalRule = () => useInvalidating(s.createApprovalRule);
export const useUpdateApprovalRule = () => useInvalidating(s.updateApprovalRule);
export const useDeleteApprovalRule = () => useInvalidating(s.deleteApprovalRule);

// Public signing (separate key: never mixed with staff data)
const SIGN = ["public-sign"] as const;
export const useSigningState = (token: string | undefined) => useQuery({ queryKey: [...SIGN, token], queryFn: () => s.getSigningState(token as string), enabled: !!token, retry: false });
export const usePublicCertificate = (token: string | undefined, enabled: boolean) => useQuery({ queryKey: [...SIGN, token, "certificate"], queryFn: () => s.getPublicCertificate(token as string), enabled: !!token && enabled, retry: false });
function usePublic<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: SIGN }) });
}
export const useSendSigningCode = () => usePublic(s.sendSigningCode);
export const useVerifySigningCode = () => usePublic(s.verifySigningCode);
export const useSignDocument = () => usePublic(s.signDocument);
export const useDeclineSigning = () => usePublic(s.declineSigning);
