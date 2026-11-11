import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/communications.services";
import type { CommChannel, SegmentDefinition, SegmentEntityType } from "../interfaces/communications.interfaces";

/** Query keys share the ["communications", resource] prefix; mutations invalidate the whole resource. */
const K = {
    overview: ["communications", "overview"] as const,
    analytics: ["communications", "analytics"] as const,
    settings: ["communications", "settings"] as const,
    campaigns: ["communications", "campaigns"] as const,
    templates: ["communications", "templates"] as const,
    segments: ["communications", "segments"] as const,
    lists: ["communications", "lists"] as const,
    compliance: ["communications", "compliance"] as const,
    messages: ["communications", "messages"] as const,
    senders: ["communications", "senders"] as const,
};

function useInvalidate(...keys: (readonly string[])[]) {
    const qc = useQueryClient();
    return () => Promise.all([...keys, K.overview].map((queryKey) => qc.invalidateQueries({ queryKey })));
}

// overview / analytics / settings
export const useCommOverview = () => useQuery({ queryKey: K.overview, queryFn: s.getOverview });
export const useProviderStatus = () => useQuery({ queryKey: [...K.senders, "provider-status"], queryFn: s.getProviderStatus });
export const useAnalyticsSummary = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.analytics, params], queryFn: () => s.getAnalyticsSummary(params), enabled, placeholderData: keepPreviousData });
export const useCommSettings = () => useQuery({ queryKey: K.settings, queryFn: s.getCommSettings });
export const useUpdateCommSettings = () => {
    const invalidate = useInvalidate(K.settings, K.campaigns);
    return useMutation({ mutationFn: s.updateCommSettings, onSuccess: invalidate });
};

// campaigns
export const useCampaigns = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.campaigns, "list", params], queryFn: () => s.getCampaigns(params), placeholderData: keepPreviousData });
export const useCampaign = (id: string | undefined, live = false) =>
    useQuery({
        queryKey: [...K.campaigns, "detail", id],
        queryFn: () => s.getCampaign(id as string),
        enabled: !!id,
        // Poll while the background runner is sending.
        refetchInterval: (q) => (live && ["SCHEDULED", "SENDING"].includes(q.state.data?.status ?? "") ? 5000 : false),
    });
export const useCampaignStats = (id: string | undefined, poll = false) =>
    useQuery({ queryKey: [...K.campaigns, "stats", id], queryFn: () => s.getCampaignStats(id as string), enabled: !!id, refetchInterval: poll ? 5000 : false });
export const useCampaignRecipients = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...K.campaigns, "recipients", id, params], queryFn: () => s.getCampaignRecipients(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useCreateCampaign = () => useMutation({ mutationFn: s.createCampaign, onSuccess: useInvalidate(K.campaigns) });
export const useUpdateCampaign = () => useMutation({ mutationFn: s.updateCampaign, onSuccess: useInvalidate(K.campaigns) });
export const useResolveAudience = () => useMutation({ mutationFn: s.resolveCampaignAudience });
export const usePreflight = () => useMutation({ mutationFn: s.preflightCampaign });
export const useTestSend = () => useMutation({ mutationFn: s.testSendCampaign });
export const useCampaignAction = () => useMutation({ mutationFn: s.campaignAction, onSuccess: useInvalidate(K.campaigns) });
export const useDeleteCampaign = () => useMutation({ mutationFn: s.deleteCampaign, onSuccess: useInvalidate(K.campaigns) });

// templates
export const useTemplates = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.templates, "list", params], queryFn: () => s.getTemplates(params), placeholderData: keepPreviousData });
export const useTemplate = (id: string | undefined) => useQuery({ queryKey: [...K.templates, "detail", id], queryFn: () => s.getTemplate(id as string), enabled: !!id });
export const useCreateTemplate = () => useMutation({ mutationFn: s.createTemplate, onSuccess: useInvalidate(K.templates) });
export const useUpdateTemplate = () => useMutation({ mutationFn: s.updateTemplate, onSuccess: useInvalidate(K.templates) });
export const useSaveTemplateDraft = () => useMutation({ mutationFn: s.saveTemplateDraft, onSuccess: useInvalidate(K.templates) });
export const usePublishTemplate = () => useMutation({ mutationFn: s.publishTemplateVersion, onSuccess: useInvalidate(K.templates) });
export const usePreviewTemplate = () => useMutation({ mutationFn: s.previewTemplate });
export const useTemplateAction = () => useMutation({ mutationFn: s.templateAction, onSuccess: useInvalidate(K.templates) });
export const useDeleteTemplate = () => useMutation({ mutationFn: s.deleteTemplate, onSuccess: useInvalidate(K.templates) });

// segments
export const useSegments = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.segments, "list", params], queryFn: () => s.getSegments(params), placeholderData: keepPreviousData, enabled });
export const useSegment = (id: string | undefined) => useQuery({ queryKey: [...K.segments, "detail", id], queryFn: () => s.getSegment(id as string), enabled: !!id });
export const useSegmentFields = () => useQuery({ queryKey: [...K.segments, "fields"], queryFn: s.getSegmentFields, staleTime: Infinity });
export const useSegmentMembers = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...K.segments, "members", id, params], queryFn: () => s.getSegmentMembers(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useSegmentPreview = (dto: { entity_type?: SegmentEntityType; definition: SegmentDefinition; channel?: CommChannel; require_consent?: boolean }, enabled: boolean) =>
    useQuery({ queryKey: [...K.segments, "preview", dto], queryFn: () => s.previewSegment(dto), enabled, placeholderData: keepPreviousData, retry: false });
export const useCreateSegment = () => useMutation({ mutationFn: s.createSegment, onSuccess: useInvalidate(K.segments) });
export const useUpdateSegment = () => useMutation({ mutationFn: s.updateSegment, onSuccess: useInvalidate(K.segments) });
export const useSegmentAction = () => useMutation({ mutationFn: s.segmentAction, onSuccess: useInvalidate(K.segments) });
export const useDeleteSegment = () => useMutation({ mutationFn: s.deleteSegment, onSuccess: useInvalidate(K.segments) });

// lists
export const useLists = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.lists, "list", params], queryFn: () => s.getLists(params), placeholderData: keepPreviousData, enabled });
export const useList = (id: string | undefined) => useQuery({ queryKey: [...K.lists, "detail", id], queryFn: () => s.getList(id as string), enabled: !!id });
export const useListMembers = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...K.lists, "members", id, params], queryFn: () => s.getListMembers(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useCreateList = () => useMutation({ mutationFn: s.createList, onSuccess: useInvalidate(K.lists) });
export const useUpdateList = () => useMutation({ mutationFn: s.updateList, onSuccess: useInvalidate(K.lists) });
export const useAddListMembers = () => useMutation({ mutationFn: s.addListMembers, onSuccess: useInvalidate(K.lists) });
export const useRemoveListMember = () => useMutation({ mutationFn: s.removeListMember, onSuccess: useInvalidate(K.lists) });
export const useListAction = () => useMutation({ mutationFn: s.listAction, onSuccess: useInvalidate(K.lists) });
export const useDeleteList = () => useMutation({ mutationFn: s.deleteList, onSuccess: useInvalidate(K.lists) });

// consent & suppressions
export const useConsents = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.compliance, "consents", params], queryFn: () => s.getConsents(params), placeholderData: keepPreviousData, enabled });
export const useSuppressions = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.compliance, "suppressions", params], queryFn: () => s.getSuppressions(params), placeholderData: keepPreviousData, enabled });
export const useAddSuppression = () => useMutation({ mutationFn: s.addSuppression, onSuccess: useInvalidate(K.compliance) });
export const useRemoveSuppression = () => useMutation({ mutationFn: s.removeSuppression, onSuccess: useInvalidate(K.compliance) });

// messages
export const useCommMessages = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.messages, "list", params], queryFn: () => s.getMessages(params), placeholderData: keepPreviousData });
export const useCommMessage = (id: string | undefined) => useQuery({ queryKey: [...K.messages, "detail", id], queryFn: () => s.getMessage(id as string), enabled: !!id });
export const useSendMessage = () => useMutation({ mutationFn: s.sendMessage, onSuccess: useInvalidate(K.messages) });
export const useMessageAction = () => useMutation({ mutationFn: s.messageAction, onSuccess: useInvalidate(K.messages) });

// senders
export const useSenderDomains = (enabled = true) => useQuery({ queryKey: [...K.senders, "domains"], queryFn: s.getSenderDomains, enabled });
export const useSenderIdentities = (channel?: CommChannel) => useQuery({ queryKey: [...K.senders, "identities", channel ?? "all"], queryFn: () => s.getSenderIdentities(channel) });
export const useCreateSenderDomain = () => useMutation({ mutationFn: s.createSenderDomain, onSuccess: useInvalidate(K.senders) });
export const useVerifySenderDomain = () => useMutation({ mutationFn: s.verifySenderDomain, onSuccess: useInvalidate(K.senders) });
export const useDeleteSenderDomain = () => useMutation({ mutationFn: s.deleteSenderDomain, onSuccess: useInvalidate(K.senders) });
export const useCreateSenderIdentity = () => useMutation({ mutationFn: s.createSenderIdentity, onSuccess: useInvalidate(K.senders) });
export const useUpdateSenderIdentity = () => useMutation({ mutationFn: s.updateSenderIdentity, onSuccess: useInvalidate(K.senders) });
export const useVerifySenderIdentity = () => useMutation({ mutationFn: s.verifySenderIdentity, onSuccess: useInvalidate(K.senders) });
export const useDeleteSenderIdentity = () => useMutation({ mutationFn: s.deleteSenderIdentity, onSuccess: useInvalidate(K.senders) });
