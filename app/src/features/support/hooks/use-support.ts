import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as s from "../services/support.services";
import { patchEntity, removeEntity, useEntityRemove, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import { useSessionData } from "@/features/session/hooks/use-session";
import type { ConversationDetail, ConversationStatus, IncidentDetail, MemberRef, StatusRef, SupportMessage } from "../interfaces/support.interfaces";

export const SUPPORT_KEY = ["support"] as const;
const k = (...parts: unknown[]) => [...SUPPORT_KEY, ...parts];

type Meta = { errorTitle?: string; errorToast?: boolean };
/** Autosaved forms show failures in their <SaveStatus />, so the global toast is skipped. */
const INLINE: Meta = { errorToast: false };

/**
 * Support mutation without an optimistic change (create, send for review…): refreshes every support query when it
 * settles. No success toast (the UI shows the result); a failure is toasted once globally with `errorTitle`.
 */
function useSupportMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, meta: Meta) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: () => qc.invalidateQueries({ queryKey: SUPPORT_KEY }) });
}
/** Optimistic update of one support entity by id (lists + details patched at once, rollback on failure). */
const useSupportUpdate = <TBody extends object, TData>(mutationFn: (vars: TBody & { id: string }) => Promise<TData>, meta: Meta) => useEntityUpdate({ root: SUPPORT_KEY, mutationFn, meta });
/** Optimistic archive / delete: the row disappears at once and comes back if the API refuses. */
const useSupportRemove = <TData>(mutationFn: (id: string) => Promise<TData>, meta: Meta) => useEntityRemove({ root: SUPPORT_KEY, mutationFn, meta });
/** Optimistic status-style change of one entity by id (`patch` is what the server will return for these fields). */
function useSupportPatch<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>, idOf: (v: TVars) => string, patch: (v: TVars) => object, meta: Meta) {
    return useOptimisticMutation<TData, TVars>({ roots: [SUPPORT_KEY], meta, mutationFn, apply: (qc, v) => patchEntity(qc, SUPPORT_KEY, idOf(v), patch(v)) });
}

// Conversations
export const useConversations = (params: Record<string, unknown>) =>
    useQuery({ queryKey: k("conversations", params), queryFn: () => s.getConversations(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
export const useConversationCounts = () => useQuery({ queryKey: k("conversation-counts"), queryFn: s.getConversationCounts, refetchInterval: 30_000 });
export const useConversation = (id: string | undefined) => useQuery({ queryKey: k("conversation", id), queryFn: () => s.getConversation(id as string), enabled: !!id, refetchInterval: 20_000 });
/** Read state is a background side effect of opening a conversation: the unread dot clears at once, failures stay silent. */
export const useMarkConversationRead = () =>
    useOptimisticMutation<unknown, string>({ roots: [k("conversations")], meta: { errorToast: false }, mutationFn: s.markConversationRead, apply: (qc, id) => patchEntity(qc, k("conversations"), id, { unread: false }), alsoInvalidate: [k("conversation-counts")] });
/** `optimistic: { assignee }` shows the picked agent at once. */
export const useAssignConversation = () => useSupportUpdate(s.assignConversation, { errorTitle: "Could not assign the conversation" });
export const useUpdateConversation = () => useSupportUpdate(s.updateConversation, { errorTitle: "Could not update the conversation" });
const conversationStatus = (status: ConversationStatus, extra: object = {}) => (id: string) => ({ id, status, ...extra });
export const useSnoozeConversation = () =>
    useSupportPatch(s.snoozeConversation, (v) => v.id, (v) => ({ status: "SNOOZED", snoozed_until: v.until }), { errorTitle: "Could not snooze the conversation" });
export const useCloseConversation = () => useSupportPatch(s.closeConversation, (id) => id, conversationStatus("RESOLVED"), { errorTitle: "Could not resolve the conversation" });
export const useReopenConversation = () => useSupportPatch(s.reopenConversation, (id) => id, conversationStatus("OPEN", { snoozed_until: null }), { errorTitle: "Could not reopen the conversation" });
export const usePendingConversation = () => useSupportPatch(s.pendingConversation, (id) => id, conversationStatus("PENDING"), { errorTitle: "Could not update the conversation" });
export const useCreateConversation = () => useSupportMutation(s.createConversation, { errorTitle: "Could not start the conversation" });

// Tickets
export const useTickets = (params: Record<string, unknown>) => useQuery({ queryKey: k("tickets", params), queryFn: () => s.getTickets(params), placeholderData: keepPreviousData });
export const useTicketCounts = () => useQuery({ queryKey: k("ticket-counts"), queryFn: s.getTicketCounts });
export const useTicket = (idOrRef: string | undefined) => useQuery({ queryKey: k("ticket", idOrRef), queryFn: () => s.getTicket(idOrRef as string), enabled: !!idOrRef });
export const useTicketMessages = (id: string | undefined) => useQuery({ queryKey: k("ticket-messages", id), queryFn: () => s.getTicketMessages(id as string), enabled: !!id, refetchInterval: 30_000 });
/** Create forms show the API error inline. */
export const useCreateTicket = () => useSupportMutation(s.createTicket, INLINE);
/** `optimistic: { category }` for id fields. */
export const useUpdateTicket = () => useSupportUpdate(s.updateTicket, { errorTitle: "Could not update the ticket" });
/** `optimistic: { status }` (the picked status row) shows the new status at once. */
export const useChangeTicketStatus = () => useSupportUpdate(s.changeTicketStatus, { errorTitle: "Could not change the status" });
/** `optimistic: { assignee }`. */
export const useAssignTicket = () => useSupportUpdate(s.assignTicket, { errorTitle: "Could not assign the ticket" });
export const useEscalateTicket = () => useSupportMutation(s.escalateTicket, { errorTitle: "Could not escalate the ticket" });
export const useMergeTicket = () => useSupportMutation(s.mergeTicket, { errorTitle: "Could not merge the ticket" });
export const useFollowTicket = () => useSupportPatch(s.followTicket, (id) => id, () => ({ following: true }), { errorTitle: "Could not follow the ticket" });
export const useUnfollowTicket = () => useSupportPatch(s.unfollowTicket, (v) => v.id, () => ({ following: false }), { errorTitle: "Could not unfollow the ticket" });
/** The dialog shows the API error inline. */
export const useConvertTicketToTask = () => useSupportMutation(s.convertTicketToTask, INLINE);
export const useArchiveTicket = () => useSupportRemove(s.archiveTicket, { errorTitle: "Could not archive the ticket" });

// Replies and internal notes: shown in the thread at once ("Sending…"), marked "Not sent · Retry" when refused.

/** A reply or note the agent sent that the server has not confirmed yet (kept outside the refetched support queries). */
export type OutgoingMessage = SupportMessage & { local_state: "sending" | "failed" };
type ThreadKey = { conversationId?: string; ticketId?: string };
const outboxKey = (t: ThreadKey) => ["support-outbox", t.conversationId ? `c:${t.conversationId}` : `t:${t.ticketId}`] as const;
const setOutbox = (qc: QueryClient, t: ThreadKey, fn: (list: OutgoingMessage[]) => OutgoingMessage[]) => qc.setQueryData<OutgoingMessage[]>(outboxKey(t), (l) => fn(l ?? []));

/** Messages of a conversation / ticket thread still on their way (or refused), to show after the server's messages. */
export function useOutbox(t: ThreadKey) {
    const { data } = useQuery({ queryKey: outboxKey(t), queryFn: () => [] as OutgoingMessage[], initialData: [] as OutgoingMessage[], staleTime: Infinity, gcTime: Infinity });
    return data;
}

type SendVars = { local_id?: string; kind: "AGENT" | "INTERNAL_NOTE"; body: string; canned_response_id?: string };

function useSendMessage<TVars extends SendVars>(thread: (v: TVars) => ThreadKey, send: (v: TVars) => Promise<unknown>, errorTitle: string) {
    const qc = useQueryClient();
    const session = useSessionData();
    const membership = session?.active_organization;
    const author: MemberRef | null = session && membership ? { id: membership.membership_id, job_title: membership.job_title ?? null, user: session.user } : null;
    return useMutation({
        meta: { errorTitle },
        mutationFn: ({ local_id: _l, ...v }: TVars) => send(v as TVars),
        onMutate: (v) => {
            const t = thread(v);
            const local_id = v.local_id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const msg: OutgoingMessage = {
                id: local_id, kind: v.kind, body: v.body, created_at: new Date().toISOString(), channel_type: null, author, author_user: null, author_name: null, author_email: null,
                mentions: [], delivery_status: null, is_first_response: false, local_state: "sending",
            };
            setOutbox(qc, t, (l) => (l.some((m) => m.id === local_id) ? l.map((m) => (m.id === local_id ? msg : m)) : [...l, msg]));
            return { t, local_id };
        },
        onSuccess: async (_r, v, ctx) => {
            const t = thread(v);
            // Show the server's copy first, then drop the local one, so the message never flickers out.
            await Promise.all([
                t.conversationId ? qc.refetchQueries({ queryKey: k("conversation", t.conversationId) }) : null,
                t.ticketId ? qc.refetchQueries({ queryKey: k("ticket-messages", t.ticketId) }) : null,
            ]);
            setOutbox(qc, t, (l) => l.filter((m) => m.id !== ctx.local_id));
        },
        onError: (_e, v, ctx) => setOutbox(qc, thread(v), (l) => l.map((m) => (m.id === ctx?.local_id ? { ...m, local_state: "failed" } : m))),
        onSettled: () => qc.invalidateQueries({ queryKey: SUPPORT_KEY }),
    });
}

/** Drop a refused message from the thread (the agent chose not to retry). */
export function useDiscardOutgoing() {
    const qc = useQueryClient();
    return (t: ThreadKey, localId: string) => setOutbox(qc, t, (l) => l.filter((m) => m.id !== localId));
}

export const usePostConversationMessage = () =>
    useSendMessage((v: Parameters<typeof s.postConversationMessage>[0] & { local_id?: string }) => ({ conversationId: v.id }), s.postConversationMessage, "Could not send the message");
export const useReplyToTicket = () => useSendMessage((v: Parameters<typeof s.replyToTicket>[0] & { local_id?: string }) => ({ ticketId: v.id }), s.replyToTicket, "Could not send the message");

/** Status / assignee set by sending (e.g. "Send and resolve") show at once on the conversation. */
export function patchConversationStatus(qc: QueryClient, id: string, status: ConversationStatus) {
    patchEntity<ConversationDetail>(qc, SUPPORT_KEY, id, { status });
}
export function patchTicketStatus(qc: QueryClient, id: string, status: StatusRef) {
    patchEntity(qc, SUPPORT_KEY, id, { status });
}

// Configuration
export const useSupportSettings = (enabled = true) => useQuery({ queryKey: k("settings"), queryFn: s.getSupportSettings, enabled, staleTime: 60_000 });
/** Autosaved settings form: failures show in its <SaveStatus />. */
export const useUpdateSupportSettings = () => useSupportMutation(s.updateSupportSettings, INLINE);
export const useTicketStatuses = (enabled = true) => useQuery({ queryKey: k("statuses"), queryFn: s.getTicketStatuses, enabled, staleTime: 60_000 });
export const useCreateTicketStatus = () => useSupportMutation(s.createTicketStatus, { errorTitle: "Could not add the status" });
export const useUpdateTicketStatus = () => useSupportUpdate(s.updateTicketStatus, { errorTitle: "Could not update the status" });
export const useArchiveTicketStatus = () =>
    useOptimisticMutation({ roots: [SUPPORT_KEY], meta: { errorTitle: "Could not archive the status" }, mutationFn: s.archiveTicketStatus, apply: (qc, v) => removeEntity(qc, k("statuses"), v.id) });
export const useTicketCategories = (enabled = true) => useQuery({ queryKey: k("categories"), queryFn: s.getTicketCategories, enabled, staleTime: 60_000 });
export const useCreateTicketCategory = () => useSupportMutation(s.createTicketCategory, { errorTitle: "Could not add the category" });
export const useUpdateTicketCategory = () => useSupportUpdate(s.updateTicketCategory, { errorTitle: "Could not update the category" });
export const useArchiveTicketCategory = () => useSupportRemove(s.archiveTicketCategory, { errorTitle: "Could not archive the category" });
export const useInboxes = (enabled = true) => useQuery({ queryKey: k("inboxes"), queryFn: s.getInboxes, enabled, staleTime: 60_000 });
export const useCreateInbox = () => useSupportMutation(s.createInbox, { errorTitle: "Could not create the inbox" });
/** Autosaved inbox dialog: failures show in its <SaveStatus />. */
export const useUpdateInbox = () => useSupportUpdate(s.updateInbox, INLINE);
export const useArchiveInbox = () => useSupportRemove(s.archiveInbox, { errorTitle: "Could not archive the inbox" });
export const useChannels = (enabled = true) => useQuery({ queryKey: k("channels"), queryFn: s.getChannels, enabled });
export const useCreateChannel = () => useSupportMutation(s.createChannel, { errorTitle: "Could not connect the channel" });
/** Switches (active) — optimistic with a toast on failure. */
export const useUpdateChannel = () => useSupportUpdate(s.updateChannel, { errorTitle: "Could not update the channel" });
/** Autosaved widget appearance: failures show in its <SaveStatus />. */
export const useAutosaveChannel = () => useSupportUpdate(s.updateChannel, INLINE);
export const useRotateWidgetKey = () => useSupportMutation(s.rotateWidgetKey, { errorTitle: "Could not rotate the key" });
export const usePublicHelpArticle = (orgSlug: string | undefined, slug: string | undefined) =>
    useQuery({ queryKey: k("help-article", orgSlug, slug), queryFn: () => s.getPublicHelpArticle(orgSlug as string, slug as string), enabled: !!orgSlug && !!slug, retry: false });
export const useHelpArticleFeedback = () => useMutation({ mutationFn: s.sendHelpArticleFeedback, meta: { errorTitle: "Could not send your feedback" } });
export const useChannelAutomation = (id: string | undefined, enabled = true) => useQuery({ queryKey: k("channel-automation", id), queryFn: () => s.getChannelAutomation(id as string), enabled: !!id && enabled });
/** Autosaved dialogs (AI answers, office hours): failures show in their <SaveStatus />. */
export const useSetChannelAiAgent = () => useSupportMutation(s.setChannelAiAgent, INLINE);
export const useSetChannelOfficeHours = () => useSupportMutation(s.setChannelOfficeHours, INLINE);
export const useAiSessions = (conversationId: string | undefined, enabled = true) => useQuery({ queryKey: k("ai-sessions", conversationId), queryFn: () => s.getAiSessions(conversationId as string), enabled: !!conversationId && enabled });
/** The "AI is answering" banner turns into "handed over" at once. */
export const useTakeOverFromAi = () =>
    useOptimisticMutation<unknown, string>({
        roots: [k("ai-sessions")],
        alsoInvalidate: [SUPPORT_KEY],
        meta: { errorTitle: "Could not take over" },
        mutationFn: s.takeOverFromAi,
        apply: (qc, id) => qc.setQueryData<{ status: string }[]>(k("ai-sessions", id), (l) => l?.map((x) => (x.status === "ACTIVE" ? { ...x, status: "HANDED_OVER" } : x))),
    });
export const useEmailChannelSetup = (id: string | undefined) => useQuery({ queryKey: k("email-setup", id), queryFn: () => s.getEmailChannelSetup(id as string), enabled: !!id });
export const useSetEmailInboundSecret = () => useSupportMutation(s.setEmailInboundSecret, { errorTitle: "Could not save the secret" });
export const useAgents = (enabled = true) => useQuery({ queryKey: k("agents"), queryFn: () => s.getAgents(), enabled, staleTime: 60_000 });
export const useUpdateAgentProfile = () => useSupportMutation(s.updateAgentProfile, { errorTitle: "Could not update the agent" });
export const useSlaPolicies = (enabled = true) => useQuery({ queryKey: k("sla"), queryFn: s.getSlaPolicies, enabled });
export const useCreateSlaPolicy = () => useSupportMutation(s.createSlaPolicy, { errorTitle: "Could not create the policy" });
/** Autosaved policy dialog: failures show in its <SaveStatus />. */
export const useUpdateSlaPolicy = () => useSupportUpdate(s.updateSlaPolicy, INLINE);
export const useArchiveSlaPolicy = () => useSupportRemove(s.archiveSlaPolicy, { errorTitle: "Could not archive the policy" });

// Canned responses
export const useCannedResponses = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: k("canned", params), queryFn: () => s.getCannedResponses(params), placeholderData: keepPreviousData, enabled });
export const useCreateCannedResponse = () => useSupportMutation(s.createCannedResponse, { errorTitle: "Could not create the saved reply" });
/** Autosaved dialog: failures show in its <SaveStatus />. */
export const useUpdateCannedResponse = () => useSupportUpdate(s.updateCannedResponse, INLINE);
export const useDeleteCannedResponse = () => useSupportRemove(s.deleteCannedResponse, { errorTitle: "Could not remove the saved reply" });
export const useRenderCannedResponse = () => useMutation({ mutationFn: s.renderCannedResponse, meta: { errorTitle: "Could not insert the saved reply" } });

// Knowledge base
export const useKnowledgeCategories = (enabled = true) => useQuery({ queryKey: k("kb-categories"), queryFn: s.getKnowledgeCategories, enabled });
export const useCreateKnowledgeCategory = () => useSupportMutation(s.createKnowledgeCategory, { errorTitle: "Could not create the category" });
export const useUpdateKnowledgeCategory = () => useSupportUpdate(s.updateKnowledgeCategory, { errorTitle: "Could not update the category" });
export const useArchiveKnowledgeCategory = () => useSupportRemove(s.archiveKnowledgeCategory, { errorTitle: "Could not archive the category" });
export const useArticles = (params: Record<string, unknown>) => useQuery({ queryKey: k("articles", params), queryFn: () => s.getArticles(params), placeholderData: keepPreviousData });
export const useArticle = (id: string | undefined) => useQuery({ queryKey: k("article", id), queryFn: () => s.getArticle(id as string), enabled: !!id });
export const useCreateArticle = () => useSupportMutation(s.createArticle, { errorTitle: "Could not create the article" });
/** Autosaved editor: failures show in its <SaveStatus />. */
export const useUpdateArticle = () => useSupportUpdate(s.updateArticle, INLINE);
export const usePublishArticle = () => useSupportPatch(s.publishArticle, (id) => id, () => ({ status: "PUBLISHED" }), { errorTitle: "Could not publish the article" });
export const useUnpublishArticle = () => useSupportPatch(s.unpublishArticle, (id) => id, () => ({ status: "DRAFT" }), { errorTitle: "Could not unpublish the article" });
export const useSubmitArticleReview = () => useSupportPatch(s.submitArticleReview, (id) => id, () => ({ status: "IN_REVIEW" }), { errorTitle: "Could not send for review" });
export const useArchiveArticle = () => useSupportRemove(s.archiveArticle, { errorTitle: "Could not archive the article" });
export const useDeleteArticle = () => useSupportRemove(s.deleteArticle, { errorTitle: "Could not delete the article" });

// Analytics, CSAT, AI
export const useSupportAnalytics = (params: Record<string, unknown>) => useQuery({ queryKey: k("analytics", params), queryFn: () => s.getSupportAnalytics(params), placeholderData: keepPreviousData });
export const useCsatSummary = (params: Record<string, unknown>, enabled = true) => useQuery({ queryKey: k("csat", params), queryFn: () => s.getCsatSummary(params), enabled });
export const useSuggestReply = () => useMutation({ mutationFn: s.suggestReply, meta: { errorTitle: "Could not draft a reply" } });
export const useSummarizeConversation = () => useSupportMutation(s.summarizeConversation, { errorTitle: "Could not summarize" });
/** Optimistic order: the list re-sorts at once and rolls back on failure. */
export const useReorderKnowledgeCategories = () =>
    useOptimisticMutation<unknown, string[]>({
        roots: [k("kb-categories")],
        meta: { errorTitle: "Could not save the order" },
        mutationFn: s.reorderKnowledgeCategories,
        apply: (qc, ids) => qc.setQueryData<{ id: string }[]>(k("kb-categories"), (list) => (list ? [...list].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : list)),
    });

// Incidents
export const useIncidents = (params: Record<string, unknown>) => useQuery({ queryKey: k("incidents", params), queryFn: () => s.getIncidents(params), placeholderData: keepPreviousData });
export const useIncident = (id: string | undefined) => useQuery({ queryKey: k("incident", id), queryFn: () => s.getIncident(id as string), enabled: !!id });
export const useCreateIncident = () => useSupportMutation(s.createIncident, { errorTitle: "Could not declare the incident" });
export const useUpdateIncident = () => useSupportUpdate(s.updateIncident, { errorTitle: "Could not update the incident" });
/** `rows` (the picked tickets) show under "Affected tickets" at once. */
export const useAttachIncidentTickets = () =>
    useOptimisticMutation<unknown, { id: string; ticket_ids: string[]; rows?: IncidentDetail["tickets"] }>({
        roots: [SUPPORT_KEY],
        meta: { errorTitle: "Could not link the ticket" },
        mutationFn: ({ rows: _r, ...v }) => s.attachIncidentTickets(v),
        apply: (qc, v) => patchEntity<IncidentDetail>(qc, SUPPORT_KEY, v.id, (i) => ({ ...i, tickets: [...(i.tickets ?? []), ...(v.rows ?? [])], ticket_count: (i.ticket_count ?? 0) + v.ticket_ids.length })),
    });
/** The ticket leaves the incident at once. */
export const useDetachIncidentTicket = () =>
    useSupportPatch(
        s.detachIncidentTicket,
        (v) => v.id,
        (v) => (i: { tickets?: { id: string }[]; ticket_count?: number }) => ({ ...i, tickets: i.tickets?.filter((t) => t.id !== v.ticket_id), ticket_count: Math.max(0, (i.ticket_count ?? 1) - 1) }),
        { errorTitle: "Could not remove the ticket" },
    );
/** The update shows at the top of the timeline at once (removed again if the API refuses). */
export const usePostIncidentUpdate = () =>
    useOptimisticMutation<unknown, Parameters<typeof s.postIncidentUpdate>[0]>({
        roots: [SUPPORT_KEY],
        meta: { errorTitle: "Could not post the update" },
        mutationFn: s.postIncidentUpdate,
        apply: (qc, v) =>
            patchEntity<IncidentDetail>(qc, SUPPORT_KEY, v.id, (i) => ({
                ...i,
                updates: [{ id: `local-${Date.now()}`, status: v.status, body: v.body, customer_visible: !!v.customer_visible, created_at: new Date().toISOString(), author: null }, ...(i.updates ?? [])],
            })),
    });

// AI review queue — accepted / rejected suggestions leave the pending queue at once.
export const useAiStatus = (enabled = true) => useQuery({ queryKey: k("ai-status"), queryFn: s.getAiStatus, enabled, staleTime: 30_000 });
export const useAiSuggestions = (params: Record<string, unknown>) => useQuery({ queryKey: k("ai-suggestions", params), queryFn: () => s.getAiSuggestions(params), placeholderData: keepPreviousData });
export const useAcceptAiSuggestion = () =>
    useOptimisticMutation({ roots: [SUPPORT_KEY], meta: { errorTitle: "Could not accept the suggestion" }, mutationFn: s.acceptAiSuggestion, apply: (qc, v) => patchEntity(qc, k("ai-suggestions"), v.id, { status: "ACCEPTED" }) });
export const useRejectAiSuggestion = () =>
    useOptimisticMutation({ roots: [SUPPORT_KEY], meta: { errorTitle: "Could not reject the suggestion" }, mutationFn: s.rejectAiSuggestion, apply: (qc, v) => patchEntity(qc, k("ai-suggestions"), v.id, { status: "REJECTED" }) });
