import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    Agent,
    AiReplySuggestion,
    AiStatus,
    AiSuggestion,
    IncidentDetail,
    IncidentDto,
    IncidentListItem,
    IncidentUpdateStatus,
    ArticleDetail,
    ArticleDto,
    ArticleListItem,
    CannedDto,
    CannedResponse,
    ConversationCounts,
    ConversationDetail,
    ConversationListItem,
    CreateTicketDto,
    CsatSummary,
    EmailChannelSetup,
    Inbox,
    KnowledgeCategory,
    Paginated,
    PostMessageDto,
    SlaPolicy,
    SlaPolicyDto,
    SupportAnalytics,
    SupportChannel,
    SupportMessage,
    SupportSettings,
    TicketCategoryRow,
    TicketCounts,
    TicketDetail,
    TicketListItem,
    TicketStatusRow,
    UpdateTicketDto,
} from "../interfaces/support.interfaces";

const R = () => ApiRoutes.support;
type Params = Record<string, unknown>;

// Conversations
export const getConversations = async (params: Params): Promise<Paginated<ConversationListItem>> => (await axiosInstance.get(R().conversations.list, { params })).data;
export const getConversationCounts = async (): Promise<ConversationCounts> => (await axiosInstance.get(R().conversations.counts)).data;
export const getConversation = async (id: string): Promise<ConversationDetail> => (await axiosInstance.get(R().conversations.detail(id))).data;
export const postConversationMessage = async ({ id, ...dto }: PostMessageDto & { id: string }): Promise<SupportMessage> => (await axiosInstance.post(R().conversations.messages(id), dto)).data;
export const markConversationRead = async (id: string) => (await axiosInstance.post(R().conversations.read(id))).data;
export const assignConversation = async ({ id, assignee_membership_id }: { id: string; assignee_membership_id: string | null }) => (await axiosInstance.post(R().conversations.assign(id), { assignee_membership_id })).data;
export const updateConversation = async ({ id, ...dto }: { id: string; priority?: string; inbox_id?: string; subject?: string }) => (await axiosInstance.patch(R().conversations.detail(id), dto)).data;
export const snoozeConversation = async ({ id, until }: { id: string; until: string }) => (await axiosInstance.post(R().conversations.snooze(id), { until })).data;
export const closeConversation = async (id: string) => (await axiosInstance.post(R().conversations.close(id))).data;
export const reopenConversation = async (id: string) => (await axiosInstance.post(R().conversations.reopen(id))).data;
export const pendingConversation = async (id: string) => (await axiosInstance.post(R().conversations.pending(id))).data;
export const createConversation = async (dto: Params): Promise<ConversationDetail> => (await axiosInstance.post(R().conversations.list, dto)).data;

// Tickets
export const getTickets = async (params: Params): Promise<Paginated<TicketListItem>> => (await axiosInstance.get(R().tickets.list, { params })).data;
export const getTicketCounts = async (): Promise<TicketCounts> => (await axiosInstance.get(R().tickets.counts)).data;
export const getTicket = async (idOrRef: string): Promise<TicketDetail> => (await axiosInstance.get(R().tickets.detail(idOrRef))).data;
export const getTicketMessages = async (id: string): Promise<SupportMessage[]> => (await axiosInstance.get(R().tickets.messages(id))).data;
export const createTicket = async (dto: CreateTicketDto): Promise<TicketListItem> => (await axiosInstance.post(R().tickets.list, dto)).data;
export const updateTicket = async ({ id, ...dto }: UpdateTicketDto & { id: string }): Promise<TicketDetail> => (await axiosInstance.patch(R().tickets.detail(id), dto)).data;
export const changeTicketStatus = async ({ id, ...dto }: { id: string; status_id: string; reason?: string; resolution?: string }): Promise<TicketDetail> => (await axiosInstance.post(R().tickets.status(id), dto)).data;
export const assignTicket = async ({ id, ...dto }: { id: string; assignee_membership_id: string | null; team_id?: string | null }): Promise<TicketDetail> => (await axiosInstance.post(R().tickets.assign(id), dto)).data;
export const escalateTicket = async ({ id, ...dto }: { id: string; to_membership_id?: string; note?: string }): Promise<TicketDetail> => (await axiosInstance.post(R().tickets.escalate(id), dto)).data;
export const mergeTicket = async ({ id, into_ticket_id }: { id: string; into_ticket_id: string }): Promise<TicketDetail> => (await axiosInstance.post(R().tickets.merge(id), { into_ticket_id })).data;
export const replyToTicket = async ({ id, ...dto }: { id: string; kind: "AGENT" | "INTERNAL_NOTE"; body: string; then_status_id?: string; canned_response_id?: string }) => (await axiosInstance.post(R().tickets.replies(id), dto)).data;
export const followTicket = async (id: string) => (await axiosInstance.post(R().tickets.followers(id), {})).data;
export const unfollowTicket = async ({ id, membership_id }: { id: string; membership_id: string }) => (await axiosInstance.delete(R().tickets.follower(id, membership_id))).data;
export const convertTicketToTask = async ({ id, ...dto }: { id: string; title?: string; project_id?: string; team_id?: string; assignee_membership_id?: string; customer_visible?: boolean }): Promise<{ id: string; identifier: string }> => (await axiosInstance.post(R().tickets.convert(id), dto)).data;
export const archiveTicket = async (id: string) => (await axiosInstance.post(R().tickets.archive(id))).data;

// Configuration
export const getSupportSettings = async (): Promise<SupportSettings> => (await axiosInstance.get(R().settings)).data;
export const updateSupportSettings = async (dto: Partial<SupportSettings>): Promise<SupportSettings> => (await axiosInstance.patch(R().settings, dto)).data;
export const getTicketStatuses = async (): Promise<TicketStatusRow[]> => (await axiosInstance.get(R().statuses.list)).data;
export const createTicketStatus = async (dto: Params) => (await axiosInstance.post(R().statuses.list, dto)).data;
export const updateTicketStatus = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R().statuses.detail(id), dto)).data;
export const archiveTicketStatus = async ({ id, replacement_status_id }: { id: string; replacement_status_id?: string }) => (await axiosInstance.post(R().statuses.archive(id), { replacement_status_id })).data;
export const getTicketCategories = async (): Promise<TicketCategoryRow[]> => (await axiosInstance.get(R().categories.list)).data;
export const createTicketCategory = async (dto: Params) => (await axiosInstance.post(R().categories.list, dto)).data;
export const updateTicketCategory = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R().categories.detail(id), dto)).data;
export const archiveTicketCategory = async (id: string) => (await axiosInstance.post(R().categories.archive(id))).data;
export const getInboxes = async (): Promise<Inbox[]> => (await axiosInstance.get(R().inboxes.list)).data;
export const createInbox = async (dto: Params): Promise<Inbox> => (await axiosInstance.post(R().inboxes.list, dto)).data;
export const updateInbox = async ({ id, ...dto }: Params & { id: string }): Promise<Inbox> => (await axiosInstance.patch(R().inboxes.detail(id), dto)).data;
export const archiveInbox = async (id: string) => (await axiosInstance.post(R().inboxes.archive(id))).data;
export const getChannels = async (): Promise<SupportChannel[]> => (await axiosInstance.get(R().channels.list)).data;
export const createChannel = async (dto: Params): Promise<SupportChannel> => (await axiosInstance.post(R().channels.list, dto)).data;
export const updateChannel = async ({ id, ...dto }: Params & { id: string }): Promise<SupportChannel> => (await axiosInstance.patch(R().channels.detail(id), dto)).data;
export const rotateWidgetKey = async (id: string): Promise<SupportChannel> => (await axiosInstance.post(R().channels.rotate(id))).data;
export const getEmailChannelSetup = async (id: string): Promise<EmailChannelSetup> => (await axiosInstance.get(R().channels.emailSetup(id))).data;
export const setEmailInboundSecret = async ({ id, secret }: { id: string; secret?: string }): Promise<{ inbound_url: string; secret: string | null }> => (await axiosInstance.post(R().channels.emailSecret(id), { secret })).data;
export const getAgents = async (search?: string): Promise<Agent[]> => (await axiosInstance.get(R().agents.list, { params: { search: search || undefined } })).data;
export const updateAgentProfile = async ({ membership_id, ...dto }: Params & { membership_id: string }) => (await axiosInstance.patch(R().agents.detail(membership_id), dto)).data;
export const getSlaPolicies = async (): Promise<SlaPolicy[]> => (await axiosInstance.get(R().sla.list)).data;
export const createSlaPolicy = async (dto: SlaPolicyDto): Promise<SlaPolicy> => (await axiosInstance.post(R().sla.list, dto)).data;
export const updateSlaPolicy = async ({ id, ...dto }: Partial<SlaPolicyDto> & { id: string }): Promise<SlaPolicy> => (await axiosInstance.patch(R().sla.detail(id), dto)).data;
export const archiveSlaPolicy = async (id: string) => (await axiosInstance.post(R().sla.archive(id))).data;

// Canned responses
export const getCannedResponses = async (params: Params): Promise<Paginated<CannedResponse> & { categories: string[] }> => (await axiosInstance.get(R().canned.list, { params })).data;
export const createCannedResponse = async (dto: CannedDto): Promise<CannedResponse> => (await axiosInstance.post(R().canned.list, dto)).data;
export const updateCannedResponse = async ({ id, ...dto }: Partial<CannedDto> & { id: string }): Promise<CannedResponse> => (await axiosInstance.patch(R().canned.detail(id), dto)).data;
export const deleteCannedResponse = async (id: string) => (await axiosInstance.delete(R().canned.detail(id))).data;
export const renderCannedResponse = async ({ id, ...dto }: { id: string; conversation_id?: string; ticket_id?: string }): Promise<{ id: string; body: string }> => (await axiosInstance.post(R().canned.render(id), dto)).data;

// Knowledge base
export const getKnowledgeCategories = async (): Promise<KnowledgeCategory[]> => (await axiosInstance.get(R().knowledge.categories)).data;
export const createKnowledgeCategory = async (dto: Params) => (await axiosInstance.post(R().knowledge.categories, dto)).data;
export const updateKnowledgeCategory = async ({ id, ...dto }: Params & { id: string }) => (await axiosInstance.patch(R().knowledge.category(id), dto)).data;
export const archiveKnowledgeCategory = async (id: string) => (await axiosInstance.post(R().knowledge.categoryArchive(id))).data;
export const getArticles = async (params: Params): Promise<Paginated<ArticleListItem> & { status_counts: Record<string, number> }> => (await axiosInstance.get(R().knowledge.articles, { params })).data;
export const getArticle = async (id: string): Promise<ArticleDetail> => (await axiosInstance.get(R().knowledge.article(id))).data;
export const createArticle = async (dto: ArticleDto): Promise<ArticleDetail> => (await axiosInstance.post(R().knowledge.articles, dto)).data;
export const updateArticle = async ({ id, ...dto }: Partial<ArticleDto> & { id: string }): Promise<ArticleDetail> => (await axiosInstance.patch(R().knowledge.article(id), dto)).data;
export const publishArticle = async (id: string): Promise<ArticleDetail> => (await axiosInstance.post(R().knowledge.publish(id))).data;
export const unpublishArticle = async (id: string): Promise<ArticleDetail> => (await axiosInstance.post(R().knowledge.unpublish(id))).data;
export const submitArticleReview = async (id: string): Promise<ArticleDetail> => (await axiosInstance.post(R().knowledge.review(id))).data;
export const archiveArticle = async (id: string) => (await axiosInstance.post(R().knowledge.archive(id))).data;
export const deleteArticle = async (id: string) => (await axiosInstance.delete(R().knowledge.article(id))).data;

// Analytics, CSAT, AI
export const getSupportAnalytics = async (params: Params): Promise<SupportAnalytics> => (await axiosInstance.get(R().analytics.overview, { params })).data;
export const getCsatSummary = async (params: Params): Promise<CsatSummary> => (await axiosInstance.get(R().csat.summary, { params })).data;
export const suggestReply = async (conversationId: string): Promise<AiReplySuggestion> => (await axiosInstance.post(R().ai.suggestReply(conversationId))).data;
export const summarizeConversation = async (conversationId: string): Promise<{ available: boolean; reason?: string; summary: string | null }> => (await axiosInstance.post(R().ai.summarize(conversationId))).data;

export const reorderKnowledgeCategories = async (ids: string[]): Promise<KnowledgeCategory[]> => (await axiosInstance.post(R().knowledge.categoriesReorder, { ids })).data;

// Incidents
export const getIncidents = async (params: Params): Promise<Paginated<IncidentListItem>> => (await axiosInstance.get(R().incidents.list, { params })).data;
export const getIncident = async (id: string): Promise<IncidentDetail> => (await axiosInstance.get(R().incidents.detail(id))).data;
export const createIncident = async (dto: IncidentDto): Promise<IncidentDetail> => (await axiosInstance.post(R().incidents.list, dto)).data;
export const updateIncident = async ({ id, ...dto }: IncidentDto & { id: string }): Promise<IncidentDetail> => (await axiosInstance.patch(R().incidents.detail(id), dto)).data;
export const attachIncidentTickets = async ({ id, ticket_ids }: { id: string; ticket_ids: string[] }): Promise<IncidentDetail> => (await axiosInstance.post(R().incidents.tickets(id), { ticket_ids })).data;
export const detachIncidentTicket = async ({ id, ticket_id }: { id: string; ticket_id: string }): Promise<IncidentDetail> => (await axiosInstance.delete(R().incidents.ticket(id, ticket_id))).data;
export const postIncidentUpdate = async ({ id, ...dto }: { id: string; status: IncidentUpdateStatus; body: string; customer_visible?: boolean }) => (await axiosInstance.post(R().incidents.updates(id), dto)).data;

// AI review queue
export const getAiStatus = async (): Promise<AiStatus> => (await axiosInstance.get(R().ai.status)).data;
export const getAiSuggestions = async (params: Params): Promise<Paginated<AiSuggestion>> => (await axiosInstance.get(R().ai.suggestions, { params })).data;
export const acceptAiSuggestion = async ({ id, ...dto }: { id: string; body?: string; as?: "AGENT" | "INTERNAL_NOTE"; note?: string }): Promise<AiSuggestion> => (await axiosInstance.post(R().ai.accept(id), dto)).data;
export const rejectAiSuggestion = async ({ id, note }: { id: string; note?: string }): Promise<AiSuggestion> => (await axiosInstance.post(R().ai.reject(id), { note })).data;
