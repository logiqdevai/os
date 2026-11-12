import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/communications.services";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { CampaignStatus, CommChannel, SegmentDefinition, SegmentEntityType } from "../interfaces/communications.interfaces";

/** Query keys share the ["communications", resource] prefix; mutations refresh the whole resource (and the overview). */
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

type Meta = { errorTitle?: string; errorToast?: boolean };
/** Autosaved editors show failures in their <SaveStatus />, so the global toast is skipped. */
const INLINE: Meta = { errorToast: false };

/**
 * Mutation without an optimistic change (create, send, verify…): refreshes `keys` (+ overview) when it settles.
 * No success toast (the UI shows the result); a failure is toasted once globally with `errorTitle`.
 */
function useCommMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, keys: (readonly string[])[], meta: Meta) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: () => Promise.all([...keys, K.overview].map((queryKey) => qc.invalidateQueries({ queryKey }))) });
}

// overview / analytics / settings
export const useCommOverview = () => useQuery({ queryKey: K.overview, queryFn: s.getOverview });
export const useProviderStatus = () => useQuery({ queryKey: [...K.senders, "provider-status"], queryFn: s.getProviderStatus });
export const useAnalyticsSummary = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.analytics, params], queryFn: () => s.getAnalyticsSummary(params), enabled, placeholderData: keepPreviousData });
export const useCommSettings = () => useQuery({ queryKey: K.settings, queryFn: s.getCommSettings });
/** Autosaved settings: failures show in the <SaveStatus />. */
export const useUpdateCommSettings = () => useCommMutation(s.updateCommSettings, [K.settings, K.campaigns], INLINE);

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
export const useCreateCampaign = () => useCommMutation(s.createCampaign, [K.campaigns], { errorTitle: "Could not save the campaign" });
/**
 * Autosaved campaign draft (wizard, A/B settings): the form is the source of truth while editing, so the cache is not
 * patched (the API body and the detail differ, e.g. audiences); failures show in the <SaveStatus />.
 */
export const useUpdateCampaign = () => useCommMutation(s.updateCampaign, [K.campaigns], INLINE);
export const useResolveAudience = () => useMutation({ mutationFn: s.resolveCampaignAudience, meta: { errorTitle: "Could not resolve the audience" } });
/** The review step shows the checks (or their failure) inline. */
export const usePreflight = () => useMutation({ mutationFn: s.preflightCampaign, meta: { errorTitle: "Could not run the pre-send checks" } });
/** The review step shows the per-address result inline. */
export const useTestSend = () => useMutation({ mutationFn: s.testSendCampaign, meta: INLINE });

/** Status a campaign has right after an action (shown at once); actions the server decides (schedule, duplicate) are not predicted. */
const ACTION_STATUS: Partial<Record<s.CampaignAction, CampaignStatus>> = { pause: "PAUSED", resume: "SENDING", cancel: "CANCELLED", unschedule: "DRAFT", approve: "APPROVED", reject: "DRAFT", submit: "PENDING_APPROVAL" };
export const useCampaignAction = () =>
    useOptimisticMutation({
        roots: [K.campaigns],
        alsoInvalidate: [K.overview],
        meta: { errorTitle: "Could not update the campaign" },
        mutationFn: s.campaignAction,
        apply: (qc, v) => {
            if (v.action === "archive") removeEntity(qc, K.campaigns, v.id);
            const status = ACTION_STATUS[v.action];
            if (status) patchEntity(qc, K.campaigns, v.id, { status });
        },
    });
export const useDeleteCampaign = () => useEntityRemove({ root: K.campaigns, mutationFn: s.deleteCampaign, alsoInvalidate: [K.overview], meta: { errorTitle: "Could not delete the campaign" } });

// templates
export const useTemplates = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.templates, "list", params], queryFn: () => s.getTemplates(params), placeholderData: keepPreviousData });
export const useTemplate = (id: string | undefined) => useQuery({ queryKey: [...K.templates, "detail", id], queryFn: () => s.getTemplate(id as string), enabled: !!id });
export const useCreateTemplate = () => useCommMutation(s.createTemplate, [K.templates], { errorTitle: "Could not create the template" });
/** Autosaved template editor: failures show in its <SaveStatus />. */
export const useUpdateTemplate = () => useCommMutation(s.updateTemplate, [K.templates], INLINE);
export const useSaveTemplateDraft = () => useCommMutation(s.saveTemplateDraft, [K.templates], INLINE);
export const usePublishTemplate = () => useCommMutation(s.publishTemplateVersion, [K.templates], { errorTitle: "Could not publish the template" });
export const usePreviewTemplate = () => useMutation({ mutationFn: s.previewTemplate, meta: { errorToast: false } });
/** Archive leaves the list at once; duplicate / restore refresh it. */
export const useTemplateAction = () =>
    useOptimisticMutation({
        roots: [K.templates],
        meta: { errorTitle: "Could not update the template" },
        mutationFn: s.templateAction,
        apply: (qc, v) => { if (v.action === "archive") removeEntity(qc, K.templates, v.id); else if (v.action === "restore") patchEntity(qc, K.templates, v.id, { archived_at: null }); },
    });
export const useDeleteTemplate = () => useEntityRemove({ root: K.templates, mutationFn: s.deleteTemplate, meta: { errorTitle: "Could not delete the template" } });

// segments
export const useSegments = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.segments, "list", params], queryFn: () => s.getSegments(params), placeholderData: keepPreviousData, enabled });
export const useSegment = (id: string | undefined) => useQuery({ queryKey: [...K.segments, "detail", id], queryFn: () => s.getSegment(id as string), enabled: !!id });
export const useSegmentFields = () => useQuery({ queryKey: [...K.segments, "fields"], queryFn: s.getSegmentFields, staleTime: Infinity });
export const useSegmentMembers = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...K.segments, "members", id, params], queryFn: () => s.getSegmentMembers(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useSegmentPreview = (dto: { entity_type?: SegmentEntityType; definition: SegmentDefinition; channel?: CommChannel; require_consent?: boolean }, enabled: boolean) =>
    useQuery({ queryKey: [...K.segments, "preview", dto], queryFn: () => s.previewSegment(dto), enabled, placeholderData: keepPreviousData, retry: false });
export const useCreateSegment = () => useCommMutation(s.createSegment, [K.segments], { errorTitle: "Could not create the segment" });
/** Autosaved segment builder: failures show in its <SaveStatus />. */
export const useUpdateSegment = () => useEntityUpdate({ root: K.segments, mutationFn: s.updateSegment, meta: INLINE });
/** Archive leaves the list at once; refresh recounts on the server. */
export const useSegmentAction = () =>
    useOptimisticMutation({
        roots: [K.segments],
        meta: { errorTitle: "Could not update the segment" },
        mutationFn: s.segmentAction,
        apply: (qc, v) => { if (v.action === "archive") removeEntity(qc, K.segments, v.id); else if (v.action === "restore") patchEntity(qc, K.segments, v.id, { archived_at: null }); },
    });
export const useDeleteSegment = () => useEntityRemove({ root: K.segments, mutationFn: s.deleteSegment, meta: { errorTitle: "Could not delete the segment" } });

// lists
export const useLists = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.lists, "list", params], queryFn: () => s.getLists(params), placeholderData: keepPreviousData, enabled });
export const useList = (id: string | undefined) => useQuery({ queryKey: [...K.lists, "detail", id], queryFn: () => s.getList(id as string), enabled: !!id });
export const useListMembers = (id: string | undefined, params: Record<string, unknown>) =>
    useQuery({ queryKey: [...K.lists, "members", id, params], queryFn: () => s.getListMembers(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useCreateList = () => useCommMutation(s.createList, [K.lists], { errorTitle: "Could not create the list" });
/** Autosaved list dialog: failures show in its <SaveStatus />. */
export const useUpdateList = () => useEntityUpdate({ root: K.lists, mutationFn: s.updateList, meta: INLINE });
/** The import dialog shows added / skipped / invalid counts inline. */
export const useAddListMembers = () => useCommMutation(s.addListMembers, [K.lists], { errorTitle: "Could not add members" });
/** The member row disappears at once. */
export const useRemoveListMember = () =>
    useOptimisticMutation({ roots: [K.lists], meta: { errorTitle: "Could not remove the member" }, mutationFn: s.removeListMember, apply: (qc, v) => removeEntity(qc, [...K.lists, "members", v.id], v.memberId) });
export const useListAction = () =>
    useOptimisticMutation({
        roots: [K.lists],
        meta: { errorTitle: "Could not update the list" },
        mutationFn: s.listAction,
        apply: (qc, v) => { if (v.action === "archive") removeEntity(qc, K.lists, v.id); else patchEntity(qc, K.lists, v.id, { archived_at: null }); },
    });
export const useDeleteList = () => useEntityRemove({ root: K.lists, mutationFn: s.deleteList, meta: { errorTitle: "Could not delete the list" } });

// consent & suppressions
export const useConsents = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.compliance, "consents", params], queryFn: () => s.getConsents(params), placeholderData: keepPreviousData, enabled });
export const useSuppressions = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...K.compliance, "suppressions", params], queryFn: () => s.getSuppressions(params), placeholderData: keepPreviousData, enabled });
export const useAddSuppression = () => useCommMutation(s.addSuppression, [K.compliance], { errorTitle: "Could not add the suppression" });
/** The suppression leaves the list at once. */
export const useRemoveSuppression = () =>
    useOptimisticMutation({ roots: [K.compliance], alsoInvalidate: [K.overview], meta: { errorTitle: "Could not remove the suppression" }, mutationFn: s.removeSuppression, apply: (qc, v) => removeEntity(qc, K.compliance, v.id) });

// messages
export const useCommMessages = (params: Record<string, unknown>) => useQuery({ queryKey: [...K.messages, "list", params], queryFn: () => s.getMessages(params), placeholderData: keepPreviousData });
export const useCommMessage = (id: string | undefined) => useQuery({ queryKey: [...K.messages, "detail", id], queryFn: () => s.getMessage(id as string), enabled: !!id });
/** Sending is explicit; the compose dialog shows the result inline. */
export const useSendMessage = () => useCommMutation(s.sendMessage, [K.messages], { errorTitle: "Could not send the message" });
export const useMessageAction = () =>
    useOptimisticMutation({
        roots: [K.messages],
        alsoInvalidate: [K.overview],
        meta: { errorTitle: "Could not update the message" },
        mutationFn: s.messageAction,
        apply: (qc, v) => {
            if (v.action === "archive") removeEntity(qc, K.messages, v.id);
            else if (v.action === "cancel") patchEntity(qc, K.messages, v.id, { status: "CANCELLED" });
            else if (v.action === "send" || v.action === "resend") patchEntity(qc, K.messages, v.id, { status: "QUEUED" });
            else if (v.action === "restore") patchEntity(qc, K.messages, v.id, { archived_at: null });
        },
    });

// senders
export const useSenderDomains = (enabled = true) => useQuery({ queryKey: [...K.senders, "domains"], queryFn: s.getSenderDomains, enabled });
export const useSenderIdentities = (channel?: CommChannel) => useQuery({ queryKey: [...K.senders, "identities", channel ?? "all"], queryFn: () => s.getSenderIdentities(channel) });
export const useCreateSenderDomain = () => useCommMutation(s.createSenderDomain, [K.senders], { errorTitle: "Could not add the domain" });
/** Verification runs on the server; the row shows the new status when it returns. */
export const useVerifySenderDomain = () => useCommMutation(s.verifySenderDomain, [K.senders], { errorTitle: "Could not verify the domain" });
export const useDeleteSenderDomain = () => useEntityRemove({ root: K.senders, mutationFn: s.deleteSenderDomain, meta: { errorTitle: "Could not remove the domain" } });
export const useCreateSenderIdentity = () => useCommMutation(s.createSenderIdentity, [K.senders], { errorTitle: "Could not add the sender" });
/** Toggles (default sender…) show at once. */
export const useUpdateSenderIdentity = () => useEntityUpdate({ root: K.senders, mutationFn: s.updateSenderIdentity, meta: { errorTitle: "Could not update the sender" } });
export const useVerifySenderIdentity = () => useCommMutation(s.verifySenderIdentity, [K.senders], { errorTitle: "Could not verify the sender" });
export const useDeleteSenderIdentity = () => useEntityRemove({ root: K.senders, mutationFn: s.deleteSenderIdentity, meta: { errorTitle: "Could not remove the sender" } });
