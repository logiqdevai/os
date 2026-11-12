import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/proposals.services";
import type { ProposalComment } from "../interfaces/proposals.interfaces";

const KEY = ["proposals"] as const;
const TEMPLATES = ["proposal-templates"] as const;
const RULES = ["proposal-approval-rules"] as const;

type Meta = { errorTitle?: string; errorToast?: boolean };

/**
 * Plain write that refreshes `key` when it settles. No success toast — the UI shows the result; a failure is toasted
 * once by the global MutationCache with `meta.errorTitle` (or shown inline when `meta.errorToast` is false).
 */
function useWrite<TData, TVars>(mutationFn: (v: TVars) => Promise<TData>, meta: Meta, key: readonly string[] = KEY) {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars>({ mutationFn, meta, onSettled: () => qc.invalidateQueries({ queryKey: key }) });
}

// --- Queries -----------------------------------------------------------------------------------

export const useProposals = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getProposals(params), placeholderData: keepPreviousData });
export const useProposalSummary = () => useQuery({ queryKey: [...KEY, "summary"], queryFn: service.getProposalSummary });
export const useProposal = (id: string | undefined, versionId?: string) =>
    useQuery({ queryKey: [...KEY, "detail", id, versionId ?? "current"], queryFn: () => service.getProposal(id as string, versionId), enabled: !!id, placeholderData: keepPreviousData });
export const useProposalActivity = (id: string | undefined) => useQuery({ queryKey: [...KEY, "activity", id], queryFn: () => service.getProposalActivity(id as string), enabled: !!id });
export const useProposalComments = (id: string | undefined) => useQuery({ queryKey: [...KEY, "comments", id], queryFn: () => service.getProposalComments(id as string), enabled: !!id });
export const useCompareVersions = (id: string | undefined, from?: string, to?: string) =>
    useQuery({ queryKey: [...KEY, "compare", id, from, to], queryFn: () => service.compareProposalVersions(id as string, from as string, to as string), enabled: !!id && !!from && !!to && from !== to });
export const useReviewPreview = (id: string | undefined, versionId: string | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, "review-preview", id, versionId], queryFn: () => service.getReviewPreview(id as string, versionId as string), enabled: enabled && !!id && !!versionId });
export const useSendPreview = (id: string | undefined, versionId?: string, enabled = true) =>
    useQuery({ queryKey: [...KEY, "send-preview", id, versionId], queryFn: () => service.getSendPreview(id as string, versionId), enabled: enabled && !!id });
export const useMyApprovals = (enabled = true) => useQuery({ queryKey: [...KEY, "my-approvals"], queryFn: service.getMyApprovals, enabled });
export const useProposalTracking = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "tracking", params], queryFn: () => service.getProposalTracking(params), placeholderData: keepPreviousData });
export const useProposalAnalytics = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "analytics", params], queryFn: () => service.getProposalAnalytics(params), placeholderData: keepPreviousData });
export const useProposalLookups = (kind: string, search: string, opts: { company_id?: string; enabled?: boolean } = {}) =>
    useQuery({
        queryKey: [...KEY, "lookups", kind, search, opts.company_id],
        queryFn: () => service.getProposalLookups({ kind, search: search || undefined, company_id: opts.company_id }),
        enabled: opts.enabled ?? true,
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

// --- Mutations ----------------------------------------------------------------------------------
// Linear-style: no success toasts (the UI shows the result); failures are toasted once by the global MutationCache.

export const useCreateProposal = () => useWrite(service.createProposal, { errorTitle: "Could not create the proposal" });
/** Optimistic: title, owner, dates… change everywhere at once; pass display objects through `optimistic`. */
export const useUpdateProposal = () => useEntityUpdate({ root: KEY, mutationFn: service.updateProposal, meta: { errorTitle: "Could not save the proposal" } });
export const useDeleteProposal = () => useEntityRemove({ root: KEY, mutationFn: service.deleteProposal, meta: { errorTitle: "Could not delete the proposal" } });
export const useDuplicateProposal = () => useWrite(service.duplicateProposal, { errorTitle: "Could not duplicate" });
/** Optimistic: archiving removes it from lists (and marks an open detail page archived); restoring clears the flag. */
export const useArchiveProposal = () =>
    useOptimisticMutation({
        roots: [KEY],
        meta: { errorTitle: "Could not archive the proposal" },
        mutationFn: service.archiveProposal,
        apply: (qc, { id, restore }) => {
            if (!restore) removeEntity(qc, KEY, id);
            patchEntity(qc, KEY, id, { archived_at: restore ? null : new Date().toISOString() });
        },
    });
/** Optimistic: the status shows Cancelled at once. */
export const useCancelProposal = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not cancel the proposal" }, mutationFn: service.cancelProposal, apply: (qc, id) => patchEntity(qc, KEY, id, { status: "CANCELLED" }) });
export const useMarkProposalLost = () => useWrite(service.markProposalLost, { errorTitle: "Could not mark the proposal lost" });
export const useCreateProposalVersion = () => useWrite(service.createProposalVersion, { errorTitle: "Could not create a revision" });
/** Autosave of a version's content (sections, pricing, schedule): the editor shows failures in <SaveStatus />. */
export const useAutosaveProposalContent = () => useWrite(service.saveProposalContent, { errorToast: false });
export const useSubmitForReview = () => useWrite(service.submitForReview, { errorTitle: "Could not submit for approval" });
export const useDecideApproval = () => useWrite(service.decideApproval, { errorTitle: "Could not record the decision" });
export const useSendProposal = () => useWrite(service.sendProposal, { errorTitle: "Could not send" });
export const useRotateShareLink = () => useWrite(service.rotateShareLink, { errorTitle: "Could not create a link" });
export const useAddProposalComment = () => useWrite(service.addProposalComment, { errorTitle: "Could not add the comment" });
/** Optimistic: the comment shows resolved / reopened at once. */
export const useResolveProposalComment = () =>
    useOptimisticMutation({
        roots: [[...KEY, "comments"]],
        alsoInvalidate: [KEY],
        meta: { errorTitle: "Could not update the comment" },
        mutationFn: service.resolveProposalComment,
        apply: (qc, { commentId, resolved }) =>
            patchEntity<ProposalComment>(qc, [...KEY, "comments"], commentId, { resolved_at: resolved ? new Date().toISOString() : null }),
    });
export const useDownloadProposalPdf = () => useWrite(service.downloadProposalPdf, { errorTitle: "Could not create the PDF" });
export const useProposalAiStatus = (enabled = true) => useQuery({ queryKey: [...KEY, "ai-status"], queryFn: service.getProposalAiStatus, enabled, staleTime: 60_000 });
export const useGenerateProposalDraft = () => useMutation({ mutationFn: service.generateProposalDraft, meta: { errorTitle: "Could not generate a draft" } });
export const useApplyProposalDraft = () => useWrite(service.applyProposalDraft, { errorTitle: "Could not add the draft" });
export const useConvertProposal = () => useWrite(service.convertProposal, { errorTitle: "Could not create the contract" });

// --- Templates & approval rules ------------------------------------------------------------------

export const useProposalTemplates = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...TEMPLATES, "list", params], queryFn: () => service.getProposalTemplates(params), placeholderData: keepPreviousData, enabled });
export const useProposalTemplate = (id: string | undefined) => useQuery({ queryKey: [...TEMPLATES, "detail", id], queryFn: () => service.getProposalTemplate(id as string), enabled: !!id });
export const useCreateProposalTemplate = () => useWrite(service.createProposalTemplate, { errorTitle: "Could not create the template" }, TEMPLATES);
export const useUpdateProposalTemplate = () => useWrite(service.updateProposalTemplate, { errorTitle: "Could not save the template" }, TEMPLATES);
export const useDuplicateProposalTemplate = () => useWrite(service.duplicateProposalTemplate, { errorTitle: "Could not duplicate the template" }, TEMPLATES);
/** Optimistic: the template shows archived / restored at once. */
export const useArchiveProposalTemplate = () =>
    useOptimisticMutation({
        roots: [TEMPLATES],
        meta: { errorTitle: "Could not archive the template" },
        mutationFn: service.archiveProposalTemplate,
        apply: (qc, { id, restore }) => patchEntity(qc, TEMPLATES, id, { archived_at: restore ? null : new Date().toISOString() }),
    });

export const useApprovalRules = (enabled = true) => useQuery({ queryKey: [...RULES], queryFn: service.getApprovalRules, enabled });
export const useCreateApprovalRule = () => useWrite(service.createApprovalRule, { errorTitle: "Could not create the rule" }, RULES);
/** Optimistic (enable switch, edits). */
export const useUpdateApprovalRule = () => useEntityUpdate({ root: RULES, mutationFn: service.updateApprovalRule, meta: { errorTitle: "Could not save the rule" } });
export const useDeleteApprovalRule = () => useEntityRemove({ root: RULES, mutationFn: service.deleteApprovalRule, meta: { errorTitle: "Could not delete the rule" } });

// --- Public customer link ------------------------------------------------------------------------

const PUBLIC = ["public-proposal"] as const;
export const usePublicProposal = (token: string | undefined, access: string | null) =>
    useQuery({ queryKey: [...PUBLIC, token, access], queryFn: () => service.getPublicProposal(token as string, access), enabled: !!token, retry: false, refetchOnWindowFocus: false });
export const useQuotePublicSelection = () => useMutation({ mutationFn: service.quotePublicSelection, meta: { errorTitle: "Could not update the total" } });
export const useDecidePublicProposal = () => useWrite(service.decidePublicProposal, { errorTitle: "Could not record your decision" }, PUBLIC);
export const useCommentPublicProposal = () => useWrite(service.commentPublicProposal, { errorTitle: "Could not send the comment" }, PUBLIC);
export const useSendPublicCode = () => useMutation({ mutationFn: service.sendPublicCode, meta: { errorTitle: "Could not send the code" } });
export const useDownloadPublicProposalPdf = () => useWrite(service.downloadPublicProposalPdf, { errorTitle: "Could not download the PDF" }, PUBLIC);
export const useVerifyPublicCode = () => useMutation({ mutationFn: service.verifyPublicCode, meta: { errorTitle: "Code not accepted" } });
