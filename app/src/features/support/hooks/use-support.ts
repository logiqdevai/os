import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/support.services";

export const SUPPORT_KEY = ["support"] as const;
const k = (...parts: unknown[]) => [...SUPPORT_KEY, ...parts];

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: SUPPORT_KEY });
}
/** Mutation that refreshes every support query on success. */
function useSupportMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: fn, onSuccess: invalidate });
}

// Conversations
export const useConversations = (params: Record<string, unknown>) =>
    useQuery({ queryKey: k("conversations", params), queryFn: () => s.getConversations(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
export const useConversationCounts = () => useQuery({ queryKey: k("conversation-counts"), queryFn: s.getConversationCounts, refetchInterval: 30_000 });
export const useConversation = (id: string | undefined) => useQuery({ queryKey: k("conversation", id), queryFn: () => s.getConversation(id as string), enabled: !!id, refetchInterval: 20_000 });
export const usePostConversationMessage = () => useSupportMutation(s.postConversationMessage);
export const useMarkConversationRead = () => useMutation({ mutationFn: s.markConversationRead });
export const useAssignConversation = () => useSupportMutation(s.assignConversation);
export const useUpdateConversation = () => useSupportMutation(s.updateConversation);
export const useSnoozeConversation = () => useSupportMutation(s.snoozeConversation);
export const useCloseConversation = () => useSupportMutation(s.closeConversation);
export const useReopenConversation = () => useSupportMutation(s.reopenConversation);
export const usePendingConversation = () => useSupportMutation(s.pendingConversation);
export const useCreateConversation = () => useSupportMutation(s.createConversation);

// Tickets
export const useTickets = (params: Record<string, unknown>) => useQuery({ queryKey: k("tickets", params), queryFn: () => s.getTickets(params), placeholderData: keepPreviousData });
export const useTicketCounts = () => useQuery({ queryKey: k("ticket-counts"), queryFn: s.getTicketCounts });
export const useTicket = (idOrRef: string | undefined) => useQuery({ queryKey: k("ticket", idOrRef), queryFn: () => s.getTicket(idOrRef as string), enabled: !!idOrRef });
export const useTicketMessages = (id: string | undefined) => useQuery({ queryKey: k("ticket-messages", id), queryFn: () => s.getTicketMessages(id as string), enabled: !!id, refetchInterval: 30_000 });
export const useCreateTicket = () => useSupportMutation(s.createTicket);
export const useUpdateTicket = () => useSupportMutation(s.updateTicket);
export const useChangeTicketStatus = () => useSupportMutation(s.changeTicketStatus);
export const useAssignTicket = () => useSupportMutation(s.assignTicket);
export const useEscalateTicket = () => useSupportMutation(s.escalateTicket);
export const useMergeTicket = () => useSupportMutation(s.mergeTicket);
export const useReplyToTicket = () => useSupportMutation(s.replyToTicket);
export const useFollowTicket = () => useSupportMutation(s.followTicket);
export const useUnfollowTicket = () => useSupportMutation(s.unfollowTicket);
export const useConvertTicketToTask = () => useSupportMutation(s.convertTicketToTask);
export const useArchiveTicket = () => useSupportMutation(s.archiveTicket);

// Configuration
export const useSupportSettings = (enabled = true) => useQuery({ queryKey: k("settings"), queryFn: s.getSupportSettings, enabled, staleTime: 60_000 });
export const useUpdateSupportSettings = () => useSupportMutation(s.updateSupportSettings);
export const useTicketStatuses = (enabled = true) => useQuery({ queryKey: k("statuses"), queryFn: s.getTicketStatuses, enabled, staleTime: 60_000 });
export const useCreateTicketStatus = () => useSupportMutation(s.createTicketStatus);
export const useUpdateTicketStatus = () => useSupportMutation(s.updateTicketStatus);
export const useArchiveTicketStatus = () => useSupportMutation(s.archiveTicketStatus);
export const useTicketCategories = (enabled = true) => useQuery({ queryKey: k("categories"), queryFn: s.getTicketCategories, enabled, staleTime: 60_000 });
export const useCreateTicketCategory = () => useSupportMutation(s.createTicketCategory);
export const useUpdateTicketCategory = () => useSupportMutation(s.updateTicketCategory);
export const useArchiveTicketCategory = () => useSupportMutation(s.archiveTicketCategory);
export const useInboxes = (enabled = true) => useQuery({ queryKey: k("inboxes"), queryFn: s.getInboxes, enabled, staleTime: 60_000 });
export const useCreateInbox = () => useSupportMutation(s.createInbox);
export const useUpdateInbox = () => useSupportMutation(s.updateInbox);
export const useArchiveInbox = () => useSupportMutation(s.archiveInbox);
export const useChannels = (enabled = true) => useQuery({ queryKey: k("channels"), queryFn: s.getChannels, enabled });
export const useCreateChannel = () => useSupportMutation(s.createChannel);
export const useUpdateChannel = () => useSupportMutation(s.updateChannel);
export const useRotateWidgetKey = () => useSupportMutation(s.rotateWidgetKey);
export const useChannelAutomation = (id: string | undefined, enabled = true) => useQuery({ queryKey: k("channel-automation", id), queryFn: () => s.getChannelAutomation(id as string), enabled: !!id && enabled });
export const useSetChannelAiAgent = () => useSupportMutation(s.setChannelAiAgent);
export const useSetChannelOfficeHours = () => useSupportMutation(s.setChannelOfficeHours);
export const useAiSessions = (conversationId: string | undefined, enabled = true) => useQuery({ queryKey: k("ai-sessions", conversationId), queryFn: () => s.getAiSessions(conversationId as string), enabled: !!conversationId && enabled });
export const useTakeOverFromAi = () => useSupportMutation(s.takeOverFromAi);
export const useEmailChannelSetup = (id: string | undefined) => useQuery({ queryKey: k("email-setup", id), queryFn: () => s.getEmailChannelSetup(id as string), enabled: !!id });
export const useSetEmailInboundSecret = () => useSupportMutation(s.setEmailInboundSecret);
export const useAgents = (enabled = true) => useQuery({ queryKey: k("agents"), queryFn: () => s.getAgents(), enabled, staleTime: 60_000 });
export const useUpdateAgentProfile = () => useSupportMutation(s.updateAgentProfile);
export const useSlaPolicies = (enabled = true) => useQuery({ queryKey: k("sla"), queryFn: s.getSlaPolicies, enabled });
export const useCreateSlaPolicy = () => useSupportMutation(s.createSlaPolicy);
export const useUpdateSlaPolicy = () => useSupportMutation(s.updateSlaPolicy);
export const useArchiveSlaPolicy = () => useSupportMutation(s.archiveSlaPolicy);

// Canned responses
export const useCannedResponses = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: k("canned", params), queryFn: () => s.getCannedResponses(params), placeholderData: keepPreviousData, enabled });
export const useCreateCannedResponse = () => useSupportMutation(s.createCannedResponse);
export const useUpdateCannedResponse = () => useSupportMutation(s.updateCannedResponse);
export const useDeleteCannedResponse = () => useSupportMutation(s.deleteCannedResponse);
export const useRenderCannedResponse = () => useMutation({ mutationFn: s.renderCannedResponse });

// Knowledge base
export const useKnowledgeCategories = (enabled = true) => useQuery({ queryKey: k("kb-categories"), queryFn: s.getKnowledgeCategories, enabled });
export const useCreateKnowledgeCategory = () => useSupportMutation(s.createKnowledgeCategory);
export const useUpdateKnowledgeCategory = () => useSupportMutation(s.updateKnowledgeCategory);
export const useArchiveKnowledgeCategory = () => useSupportMutation(s.archiveKnowledgeCategory);
export const useArticles = (params: Record<string, unknown>) => useQuery({ queryKey: k("articles", params), queryFn: () => s.getArticles(params), placeholderData: keepPreviousData });
export const useArticle = (id: string | undefined) => useQuery({ queryKey: k("article", id), queryFn: () => s.getArticle(id as string), enabled: !!id });
export const useCreateArticle = () => useSupportMutation(s.createArticle);
export const useUpdateArticle = () => useSupportMutation(s.updateArticle);
export const usePublishArticle = () => useSupportMutation(s.publishArticle);
export const useUnpublishArticle = () => useSupportMutation(s.unpublishArticle);
export const useSubmitArticleReview = () => useSupportMutation(s.submitArticleReview);
export const useArchiveArticle = () => useSupportMutation(s.archiveArticle);
export const useDeleteArticle = () => useSupportMutation(s.deleteArticle);

// Analytics, CSAT, AI
export const useSupportAnalytics = (params: Record<string, unknown>) => useQuery({ queryKey: k("analytics", params), queryFn: () => s.getSupportAnalytics(params), placeholderData: keepPreviousData });
export const useCsatSummary = (params: Record<string, unknown>, enabled = true) => useQuery({ queryKey: k("csat", params), queryFn: () => s.getCsatSummary(params), enabled });
export const useSuggestReply = () => useMutation({ mutationFn: s.suggestReply });
export const useSummarizeConversation = () => useSupportMutation(s.summarizeConversation);
export const useReorderKnowledgeCategories = () => useSupportMutation(s.reorderKnowledgeCategories);

// Incidents
export const useIncidents = (params: Record<string, unknown>) => useQuery({ queryKey: k("incidents", params), queryFn: () => s.getIncidents(params), placeholderData: keepPreviousData });
export const useIncident = (id: string | undefined) => useQuery({ queryKey: k("incident", id), queryFn: () => s.getIncident(id as string), enabled: !!id });
export const useCreateIncident = () => useSupportMutation(s.createIncident);
export const useUpdateIncident = () => useSupportMutation(s.updateIncident);
export const useAttachIncidentTickets = () => useSupportMutation(s.attachIncidentTickets);
export const useDetachIncidentTicket = () => useSupportMutation(s.detachIncidentTicket);
export const usePostIncidentUpdate = () => useSupportMutation(s.postIncidentUpdate);

// AI review queue
export const useAiStatus = (enabled = true) => useQuery({ queryKey: k("ai-status"), queryFn: s.getAiStatus, enabled, staleTime: 30_000 });
export const useAiSuggestions = (params: Record<string, unknown>) => useQuery({ queryKey: k("ai-suggestions", params), queryFn: () => s.getAiSuggestions(params), placeholderData: keepPreviousData });
export const useAcceptAiSuggestion = () => useSupportMutation(s.acceptAiSuggestion);
export const useRejectAiSuggestion = () => useSupportMutation(s.rejectAiSuggestion);
