import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/proposals.services";

const KEY = ["proposals"] as const;
const TEMPLATES = ["proposal-templates"] as const;
const RULES = ["proposal-approval-rules"] as const;

function useInvalidate(key: readonly string[] = KEY) {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: key });
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
// Each page shows its own toast (success + error) so the message can name the record.

export const useCreateProposal = () => useMutation({ mutationFn: service.createProposal, onSuccess: useInvalidate() });
export const useUpdateProposal = () => useMutation({ mutationFn: service.updateProposal, onSuccess: useInvalidate() });
export const useDeleteProposal = () => useMutation({ mutationFn: service.deleteProposal, onSuccess: useInvalidate() });
export const useDuplicateProposal = () => useMutation({ mutationFn: service.duplicateProposal, onSuccess: useInvalidate() });
export const useArchiveProposal = () => useMutation({ mutationFn: service.archiveProposal, onSuccess: useInvalidate() });
export const useCancelProposal = () => useMutation({ mutationFn: service.cancelProposal, onSuccess: useInvalidate() });
export const useMarkProposalLost = () => useMutation({ mutationFn: service.markProposalLost, onSuccess: useInvalidate() });
export const useCreateProposalVersion = () => useMutation({ mutationFn: service.createProposalVersion, onSuccess: useInvalidate() });
export const useSaveProposalContent = () => useMutation({ mutationFn: service.saveProposalContent, onSuccess: useInvalidate() });
export const useSubmitForReview = () => useMutation({ mutationFn: service.submitForReview, onSuccess: useInvalidate() });
export const useDecideApproval = () => useMutation({ mutationFn: service.decideApproval, onSuccess: useInvalidate() });
export const useSendProposal = () => useMutation({ mutationFn: service.sendProposal, onSuccess: useInvalidate() });
export const useRotateShareLink = () => useMutation({ mutationFn: service.rotateShareLink, onSuccess: useInvalidate() });
export const useAddProposalComment = () => useMutation({ mutationFn: service.addProposalComment, onSuccess: useInvalidate() });
export const useResolveProposalComment = () => useMutation({ mutationFn: service.resolveProposalComment, onSuccess: useInvalidate() });
export const useDownloadProposalPdf = () => useMutation({ mutationFn: service.downloadProposalPdf, onSuccess: useInvalidate() });
export const useProposalAiStatus = (enabled = true) => useQuery({ queryKey: [...KEY, "ai-status"], queryFn: service.getProposalAiStatus, enabled, staleTime: 60_000 });
export const useGenerateProposalDraft = () => useMutation({ mutationFn: service.generateProposalDraft });
export const useApplyProposalDraft = () => useMutation({ mutationFn: service.applyProposalDraft, onSuccess: useInvalidate() });
export const useConvertProposal = () => useMutation({ mutationFn: service.convertProposal, onSuccess: useInvalidate() });

// --- Templates & approval rules ------------------------------------------------------------------

export const useProposalTemplates = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...TEMPLATES, "list", params], queryFn: () => service.getProposalTemplates(params), placeholderData: keepPreviousData, enabled });
export const useProposalTemplate = (id: string | undefined) => useQuery({ queryKey: [...TEMPLATES, "detail", id], queryFn: () => service.getProposalTemplate(id as string), enabled: !!id });
export const useCreateProposalTemplate = () => useMutation({ mutationFn: service.createProposalTemplate, onSuccess: useInvalidate(TEMPLATES) });
export const useUpdateProposalTemplate = () => useMutation({ mutationFn: service.updateProposalTemplate, onSuccess: useInvalidate(TEMPLATES) });
export const useDuplicateProposalTemplate = () => useMutation({ mutationFn: service.duplicateProposalTemplate, onSuccess: useInvalidate(TEMPLATES) });
export const useArchiveProposalTemplate = () => useMutation({ mutationFn: service.archiveProposalTemplate, onSuccess: useInvalidate(TEMPLATES) });

export const useApprovalRules = (enabled = true) => useQuery({ queryKey: [...RULES], queryFn: service.getApprovalRules, enabled });
export const useCreateApprovalRule = () => useMutation({ mutationFn: service.createApprovalRule, onSuccess: useInvalidate(RULES) });
export const useUpdateApprovalRule = () => useMutation({ mutationFn: service.updateApprovalRule, onSuccess: useInvalidate(RULES) });
export const useDeleteApprovalRule = () => useMutation({ mutationFn: service.deleteApprovalRule, onSuccess: useInvalidate(RULES) });

// --- Public customer link ------------------------------------------------------------------------

const PUBLIC = ["public-proposal"] as const;
export const usePublicProposal = (token: string | undefined, access: string | null) =>
    useQuery({ queryKey: [...PUBLIC, token, access], queryFn: () => service.getPublicProposal(token as string, access), enabled: !!token, retry: false, refetchOnWindowFocus: false });
export const useQuotePublicSelection = () => useMutation({ mutationFn: service.quotePublicSelection });
export const useDecidePublicProposal = () => useMutation({ mutationFn: service.decidePublicProposal, onSuccess: useInvalidate(PUBLIC) });
export const useCommentPublicProposal = () => useMutation({ mutationFn: service.commentPublicProposal, onSuccess: useInvalidate(PUBLIC) });
export const useSendPublicCode = () => useMutation({ mutationFn: service.sendPublicCode });
export const useDownloadPublicProposalPdf = () => useMutation({ mutationFn: service.downloadPublicProposalPdf, onSuccess: useInvalidate(PUBLIC) });
export const useVerifyPublicCode = () => useMutation({ mutationFn: service.verifyPublicCode });
