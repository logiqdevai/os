import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/contracts.services";

/** One base key for the whole Contracts area: every mutation invalidates it (lists, detail, dashboard stay in sync). */
const KEY = ["contracts"] as const;

type Meta = { errorTitle?: string; errorToast?: boolean };

/**
 * Plain Contracts write: refreshes the whole area when it settles. No success toast — the UI shows the result; a
 * failure is toasted once by the global MutationCache with `meta.errorTitle` (or shown inline when `errorToast` is false).
 */
function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>, meta: Meta) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars>({ mutationFn: fn, meta, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}

/** Optimistic by-id action with a known outcome (`patch` applied to the record everywhere under KEY). Called as `mutate(id)`. */
function usePatchById<TData>(fn: (id: string) => Promise<TData>, patch: () => Record<string, unknown>, meta: Meta, removeFromLists = false) {
    return useOptimisticMutation<TData, string>({
        roots: [KEY], meta, mutationFn: fn,
        apply: (qc, id) => { if (removeFromLists) removeEntity(qc, KEY, id); patchEntity(qc, KEY, id, patch()); },
    });
}
const now = () => new Date().toISOString();

// Queries
export const useContracts = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "list", params], queryFn: () => s.getContracts(params), placeholderData: keepPreviousData });
export const useContract = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => s.getContract(id as string), enabled: !!id });
export const useContractDashboard = () => useQuery({ queryKey: [...KEY, "dashboard"], queryFn: s.getContractDashboard });
export const useContractAnalytics = (params: Record<string, unknown>) => useQuery({ queryKey: [...KEY, "analytics", params], queryFn: () => s.getContractAnalytics(params), placeholderData: keepPreviousData });
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

// Mutations — Linear-style: no success toasts; optimistic where the outcome is known.
export const useCreateContract = () => useInvalidating(s.createContract, { errorTitle: "Could not create the contract" });
/** Optimistic: title, owner, dates, renewal settings… change everywhere at once; pass display objects through `optimistic`. */
export const useUpdateContract = (meta: Meta = { errorTitle: "Could not save the contract" }) => useEntityUpdate({ root: KEY, mutationFn: s.updateContract, meta });
export const useSetParties = () => useInvalidating(s.setParties, { errorTitle: "Could not save the parties" });
export const useLinkProject = () => useInvalidating(s.linkProject, { errorTitle: "Could not link the project" });
/** Optimistic: the project leaves the contract's linked projects at once. */
export const useUnlinkProject = () =>
    useOptimisticMutation({
        roots: [KEY], meta: { errorTitle: "Could not unlink the project" }, mutationFn: s.unlinkProject,
        apply: (qc, { id, project_id }) =>
            patchEntity<{ id: string; projects?: { project_id: string }[] }>(qc, KEY, id, (c) => (c.projects ? { ...c, projects: c.projects.filter((p) => p.project_id !== project_id) } : c)),
    });
export const useArchiveContract = () => usePatchById(s.archiveContract, () => ({ archived_at: now() }), { errorTitle: "Could not archive the contract" }, true);
export const useRestoreContract = () => usePatchById(s.restoreContract, () => ({ archived_at: null }), { errorTitle: "Could not restore the contract" });
export const useDeleteContract = () => useEntityRemove({ root: KEY, mutationFn: s.deleteContract, meta: { errorTitle: "Could not delete the contract" } });
export const useRenewalDecision = () => useInvalidating(s.renewalDecision, { errorTitle: "Could not record the renewal decision" });
export const useRenewContract = () => useInvalidating(s.renewContract, { errorTitle: "Could not renew the contract" });
export const useAmendContract = () => useInvalidating(s.amendContract, { errorTitle: "Could not create the amendment" });
export const useTerminateContract = () => useInvalidating(s.terminateContract, { errorTitle: "Could not terminate the contract" });
export const useCreateVersion = () => useInvalidating(s.createVersion, { errorTitle: "Could not create a new version" });
/** Autosave of a draft version's sections: the document editor shows failures in <SaveStatus /> (no toast). */
export const useSaveSections = () => useInvalidating(s.saveSections, { errorToast: false });
export const useRequestReview = () => useInvalidating(s.requestReview, { errorTitle: "Could not request the review" });
export const useDecideReview = () => useInvalidating(s.decideReview, { errorTitle: "Could not record the review" });
export const useSubmitForApproval = () => useInvalidating(s.submitForApproval, { errorTitle: "Could not submit for approval" });
export const useDecideApproval = () => useInvalidating(s.decideApproval, { errorTitle: "Could not record the decision" });
export const useCreateComment = () => useInvalidating(s.createComment, { errorTitle: "Could not add the comment" });
/** Optimistic: the comment shows resolved / reopened at once. */
export const useResolveComment = () =>
    useOptimisticMutation({
        roots: [[...KEY, "comments"]], alsoInvalidate: [KEY], meta: { errorTitle: "Could not update the comment" }, mutationFn: s.resolveComment,
        apply: (qc, { commentId, resolved }) => patchEntity(qc, [...KEY, "comments"], commentId, { resolved_at: resolved ? now() : null }),
    });
export const useSendForSignature = () => useInvalidating(s.sendForSignature, { errorTitle: "Could not send for signature" });
export const useRemindSignature = () => useInvalidating(s.remindSignature, { errorTitle: "Could not send the reminder" });
export const useReissueLink = () => useInvalidating(s.reissueLink, { errorTitle: "Could not create a new link" });
/** Optimistic: the request shows Cancelled at once. */
export const useCancelSignature = () =>
    useOptimisticMutation({
        roots: [KEY], meta: { errorTitle: "Could not cancel the signature request" }, mutationFn: s.cancelSignature,
        apply: (qc, { id }) => patchEntity(qc, KEY, id, { status: "CANCELLED" }),
    });
export const useCreateObligation = () => useInvalidating(s.createObligation, { errorTitle: "Could not add the obligation" });
/** Optimistic; pass display objects (e.g. `owner`) through `optimistic`. */
export const useUpdateObligation = () => useEntityUpdate({ root: KEY, mutationFn: s.updateObligation, meta: { errorTitle: "Could not save the obligation" } });
/** Optimistic: the obligation shows Fulfilled / Waived at once. */
export const useFulfilObligation = () => usePatchById(s.fulfilObligation, () => ({ status: "FULFILLED", fulfilled_at: now(), is_overdue: false }), { errorTitle: "Could not mark the obligation fulfilled" });
export const useWaiveObligation = () => usePatchById(s.waiveObligation, () => ({ status: "WAIVED" }), { errorTitle: "Could not waive the obligation" });
export const useDeleteObligation = () => useEntityRemove({ root: KEY, mutationFn: s.deleteObligation, meta: { errorTitle: "Could not delete the obligation" } });
export const useCreateContractType = () => useInvalidating(s.createContractType, { errorTitle: "Could not create the contract type" });
export const useUpdateContractType = () => useEntityUpdate({ root: KEY, mutationFn: s.updateContractType, meta: { errorTitle: "Could not save the contract type" } });
export const useArchiveContractType = () => usePatchById(s.archiveContractType, () => ({ archived_at: now() }), { errorTitle: "Could not archive the contract type" });
export const useCreateContractTemplate = () => useInvalidating(s.createContractTemplate, { errorTitle: "Could not create the template" });
export const useAddTemplateVersion = () => useInvalidating(s.addTemplateVersion, { errorTitle: "Could not save the template version" });
export const usePublishTemplateVersion = () => useInvalidating(s.publishTemplateVersion, { errorTitle: "Could not publish the template" });
export const useDeprecateTemplate = () => usePatchById(s.deprecateTemplate, () => ({ status: "DEPRECATED" }), { errorTitle: "Could not deprecate the template" });
export const useCreateContractClause = () => useInvalidating(s.createContractClause, { errorTitle: "Could not create the clause" });
export const useUpdateContractClause = () => useEntityUpdate({ root: KEY, mutationFn: s.updateContractClause, meta: { errorTitle: "Could not save the clause" } });
export const useAddClauseVersion = () => useInvalidating(s.addClauseVersion, { errorTitle: "Could not save the clause text" });
export const useCreateApprovalRule = () => useInvalidating(s.createApprovalRule, { errorTitle: "Could not create the rule" });
/** Optimistic (enable switch, edits). */
export const useUpdateApprovalRule = () => useEntityUpdate({ root: KEY, mutationFn: s.updateApprovalRule, meta: { errorTitle: "Could not save the rule" } });
export const useDeleteApprovalRule = () => useEntityRemove({ root: KEY, mutationFn: s.deleteApprovalRule, meta: { errorTitle: "Could not delete the rule" } });

// Public signing (separate key: never mixed with staff data)
const SIGN = ["public-sign"] as const;
export const useSigningState = (token: string | undefined) => useQuery({ queryKey: [...SIGN, token], queryFn: () => s.getSigningState(token as string), enabled: !!token, retry: false });
export const usePublicCertificate = (token: string | undefined, enabled: boolean) => useQuery({ queryKey: [...SIGN, token, "certificate"], queryFn: () => s.getPublicCertificate(token as string), enabled: !!token && enabled, retry: false });
function usePublic<TVars, TData>(fn: (v: TVars) => Promise<TData>, meta: Meta) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars>({ mutationFn: fn, meta, onSettled: () => qc.invalidateQueries({ queryKey: SIGN }) });
}
export const useSendSigningCode = () => usePublic(s.sendSigningCode, { errorTitle: "Could not send the code" });
export const useVerifySigningCode = () => usePublic(s.verifySigningCode, { errorTitle: "Code not accepted" });
export const useSignDocument = () => usePublic(s.signDocument, { errorTitle: "Could not sign" });
export const useDeclineSigning = () => usePublic(s.declineSigning, { errorTitle: "Could not decline" });

// PDF downloads (stored artifacts are created on first download: invalidate so document ids refresh)
export const useDownloadContractVersionPdf = () => useInvalidating(s.downloadContractVersionPdf, { errorTitle: "Could not download the PDF" });
export const useDownloadCertificatePdf = () => useInvalidating(s.downloadCertificatePdf, { errorTitle: "Could not download the certificate" });
export const useDownloadPublicSignedPdf = () => useMutation({ mutationFn: s.downloadPublicSignedPdf, meta: { errorTitle: "Could not download the PDF" } });
export const useDownloadPublicCertificatePdf = () => useMutation({ mutationFn: s.downloadPublicCertificatePdf, meta: { errorTitle: "Could not download the certificate" } });

// AI review & obligation extraction
export const useContractAiStatus = (enabled = true) => useQuery({ queryKey: [...KEY, "ai-status"], queryFn: s.getContractAiStatus, enabled, staleTime: 60_000 });
export const useContractAiFindings = (id: string | undefined, versionId: string | undefined) =>
    useQuery({ queryKey: [...KEY, "ai-findings", id, versionId], queryFn: () => s.getContractAiFindings(id as string, versionId as string), enabled: !!id && !!versionId });
export const useObligationSuggestions = (id: string | undefined) => useQuery({ queryKey: [...KEY, "ai-suggestions", id], queryFn: () => s.getObligationSuggestions(id as string), enabled: !!id });
export const useRunContractAiReview = () => useInvalidating(s.runContractAiReview, { errorTitle: "Could not run the AI review" });
/** Optimistic: the finding shows accepted / dismissed at once. */
export const useDecideContractAiFinding = () =>
    useOptimisticMutation({
        roots: [KEY], meta: { errorTitle: "Could not update the finding" }, mutationFn: s.decideContractAiFinding,
        apply: (qc, { findingId, status }) => patchEntity(qc, KEY, findingId, { status }),
    });
export const useExtractContractObligations = () => useInvalidating(s.extractContractObligations, { errorTitle: "Could not extract obligations" });
/** Optimistic: a reviewed suggestion leaves the suggestions list at once. */
export const useReviewObligationSuggestion = () =>
    useOptimisticMutation({
        roots: [[...KEY, "ai-suggestions"]], alsoInvalidate: [KEY], meta: { errorTitle: "Could not review the suggestion" }, mutationFn: s.reviewObligationSuggestion,
        apply: (qc, { obligationId }) => removeEntity(qc, [...KEY, "ai-suggestions"], obligationId),
    });
