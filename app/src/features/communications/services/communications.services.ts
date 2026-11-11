import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    AnalyticsSummary, AudienceInput, Campaign, CampaignDetail, CampaignInput, CampaignRecipient, CampaignStats, CommMessage, CommMessageDetail, CommOverview,
    CommSettings, Consent, ListMemberInput, Paginated, PreflightResult, ProviderStatus, RecipientList, RecipientListMember, ResolvedAudience, Segment,
    SegmentDetail, SegmentField, SegmentInput, SegmentPreview, SendMessageInput, SenderDomain, SenderIdentity, SenderIdentityInput, Suppression, SuppressionInput,
    Template, TemplateContent, TemplateDetail, TemplateInput, TemplatePreview, TemplateVersion, AudienceMember, CommChannel, SegmentEntityType, SegmentDefinition,
} from "../interfaces/communications.interfaces";

const R = ApiRoutes.communications;
type Params = Record<string, unknown>;

// overview / analytics / settings
export const getOverview = async (): Promise<CommOverview> => (await axiosInstance.get(R.overview)).data;
export const getProviderStatus = async (): Promise<ProviderStatus> => (await axiosInstance.get(R.provider_status)).data;
export const getAnalyticsSummary = async (params: Params): Promise<AnalyticsSummary> => (await axiosInstance.get(R.analytics.summary, { params })).data;
export const getCommSettings = async (): Promise<CommSettings> => (await axiosInstance.get(R.settings)).data;
export const updateCommSettings = async (dto: Partial<CommSettings>): Promise<CommSettings> => (await axiosInstance.patch(R.settings, dto)).data;

// campaigns
export const getCampaigns = async (params: Params): Promise<Paginated<Campaign>> => (await axiosInstance.get(R.campaigns.list, { params })).data;
export const getCampaign = async (id: string): Promise<CampaignDetail> => (await axiosInstance.get(R.campaigns.detail(id))).data;
export const getCampaignStats = async (id: string): Promise<CampaignStats> => (await axiosInstance.get(R.campaigns.stats(id))).data;
export const getCampaignRecipients = async (id: string, params: Params): Promise<Paginated<CampaignRecipient>> => (await axiosInstance.get(R.campaigns.recipients(id), { params })).data;
export const createCampaign = async (dto: CampaignInput): Promise<CampaignDetail> => (await axiosInstance.post(R.campaigns.list, dto)).data;
export const updateCampaign = async ({ id, ...dto }: CampaignInput & { id: string }): Promise<CampaignDetail> => (await axiosInstance.patch(R.campaigns.detail(id), dto)).data;
export const setCampaignAudience = async ({ id, audiences }: { id: string; audiences: AudienceInput[] }): Promise<CampaignDetail> => (await axiosInstance.put(R.campaigns.audience(id), { audiences })).data;
export const resolveCampaignAudience = async (id: string): Promise<ResolvedAudience> => (await axiosInstance.post(R.campaigns.resolve(id))).data;
export const preflightCampaign = async (id: string): Promise<PreflightResult> => (await axiosInstance.post(R.campaigns.preflight(id))).data;
export const testSendCampaign = async ({ id, addresses }: { id: string; addresses: string[] }): Promise<{ results: { address: string; status: string; reason?: string | null }[] }> =>
    (await axiosInstance.post(R.campaigns.test(id), { addresses })).data;
export type CampaignAction = Parameters<typeof R.campaigns.action>[1];
export const campaignAction = async ({ id, action, body }: { id: string; action: CampaignAction; body?: Record<string, unknown> }): Promise<CampaignDetail> =>
    (await axiosInstance.post(R.campaigns.action(id, action), body ?? {})).data;
export const deleteCampaign = async (id: string) => (await axiosInstance.delete(R.campaigns.detail(id))).data;

// templates
export const getTemplates = async (params: Params): Promise<Paginated<Template>> => (await axiosInstance.get(R.templates.list, { params })).data;
export const getTemplate = async (id: string): Promise<TemplateDetail> => (await axiosInstance.get(R.templates.detail(id))).data;
export const createTemplate = async (dto: TemplateInput): Promise<TemplateDetail> => (await axiosInstance.post(R.templates.list, dto)).data;
export const updateTemplate = async ({ id, ...dto }: TemplateInput & { id: string }): Promise<TemplateDetail> => (await axiosInstance.patch(R.templates.detail(id), dto)).data;
export const saveTemplateDraft = async ({ id, ...dto }: TemplateContent & { id: string }): Promise<TemplateVersion> => (await axiosInstance.post(R.templates.versions(id), dto)).data;
export const publishTemplateVersion = async ({ id, versionId }: { id: string; versionId: string }): Promise<TemplateVersion> => (await axiosInstance.post(R.templates.publish(id, versionId))).data;
export const previewTemplate = async (dto: TemplateContent & { version_id?: string; contact_id?: string }): Promise<TemplatePreview> => (await axiosInstance.post(R.templates.preview, dto)).data;
export const templateAction = async ({ id, action }: { id: string; action: "duplicate" | "archive" | "restore" }): Promise<Template> => (await axiosInstance.post(R.templates.action(id, action))).data;
export const deleteTemplate = async (id: string) => (await axiosInstance.delete(R.templates.detail(id))).data;

// segments
export const getSegments = async (params: Params): Promise<Paginated<Segment>> => (await axiosInstance.get(R.segments.list, { params })).data;
export const getSegment = async (id: string): Promise<SegmentDetail> => (await axiosInstance.get(R.segments.detail(id))).data;
export const getSegmentFields = async (): Promise<Record<SegmentEntityType, SegmentField[]>> => (await axiosInstance.get(R.segments.fields)).data;
export const getSegmentMembers = async (id: string, params: Params): Promise<Paginated<AudienceMember>> => (await axiosInstance.get(R.segments.members(id), { params })).data;
export const previewSegment = async (dto: { entity_type?: SegmentEntityType; definition: SegmentDefinition; channel?: CommChannel; require_consent?: boolean }): Promise<SegmentPreview> =>
    (await axiosInstance.post(R.segments.preview, dto)).data;
export const createSegment = async (dto: SegmentInput): Promise<Segment> => (await axiosInstance.post(R.segments.list, dto)).data;
export const updateSegment = async ({ id, ...dto }: SegmentInput & { id: string }): Promise<Segment> => (await axiosInstance.patch(R.segments.detail(id), dto)).data;
export const segmentAction = async ({ id, action }: { id: string; action: "refresh" | "archive" | "restore" }): Promise<Segment> => (await axiosInstance.post(R.segments.action(id, action))).data;
export const deleteSegment = async (id: string) => (await axiosInstance.delete(R.segments.detail(id))).data;

// lists
export const getLists = async (params: Params): Promise<Paginated<RecipientList>> => (await axiosInstance.get(R.lists.list, { params })).data;
export const getList = async (id: string): Promise<RecipientList> => (await axiosInstance.get(R.lists.detail(id))).data;
export const getListMembers = async (id: string, params: Params): Promise<Paginated<RecipientListMember>> => (await axiosInstance.get(R.lists.members(id), { params })).data;
export const createList = async (dto: { name: string; description?: string; channel?: CommChannel }): Promise<RecipientList> => (await axiosInstance.post(R.lists.list, dto)).data;
export const updateList = async ({ id, ...dto }: { id: string; name?: string; description?: string }): Promise<RecipientList> => (await axiosInstance.patch(R.lists.detail(id), dto)).data;
export const addListMembers = async ({ id, members }: { id: string; members: ListMemberInput[] }): Promise<{ added: number; skipped: number; invalid: { row: number; reason: string }[]; member_count: number }> =>
    (await axiosInstance.post(R.lists.members(id), { members })).data;
export const removeListMember = async ({ id, memberId }: { id: string; memberId: string }) => (await axiosInstance.delete(R.lists.member(id, memberId))).data;
export const listAction = async ({ id, action }: { id: string; action: "archive" | "restore" }): Promise<RecipientList> => (await axiosInstance.post(R.lists.action(id, action))).data;
export const deleteList = async (id: string) => (await axiosInstance.delete(R.lists.detail(id))).data;

// consent & suppressions
export const getConsents = async (params: Params): Promise<Paginated<Consent>> => (await axiosInstance.get(R.consents.list, { params })).data;
export const getSuppressions = async (params: Params): Promise<Paginated<Suppression>> => (await axiosInstance.get(R.suppressions.list, { params })).data;
export const addSuppression = async (dto: SuppressionInput): Promise<Suppression> => (await axiosInstance.post(R.suppressions.list, dto)).data;
export const removeSuppression = async ({ id, reason }: { id: string; reason?: string }): Promise<Suppression> => (await axiosInstance.post(R.suppressions.remove(id), { reason })).data;

// messages
export const getMessages = async (params: Params): Promise<Paginated<CommMessage>> => (await axiosInstance.get(R.messages.list, { params })).data;
export const getMessage = async (id: string): Promise<CommMessageDetail> => (await axiosInstance.get(R.messages.detail(id))).data;
export const sendMessage = async (dto: SendMessageInput): Promise<CommMessageDetail> => (await axiosInstance.post(R.messages.list, dto)).data;
export const messageAction = async ({ id, action }: { id: string; action: "send" | "resend" | "cancel" | "archive" | "restore" }): Promise<CommMessageDetail> =>
    (await axiosInstance.post(R.messages.action(id, action))).data;

// senders
export const getSenderDomains = async (): Promise<SenderDomain[]> => (await axiosInstance.get(R.senders.domains)).data;
export const createSenderDomain = async (dto: { domain: string }): Promise<SenderDomain> => (await axiosInstance.post(R.senders.domains, dto)).data;
export const verifySenderDomain = async (id: string): Promise<SenderDomain> => (await axiosInstance.post(R.senders.verify_domain(id))).data;
export const deleteSenderDomain = async (id: string) => (await axiosInstance.delete(R.senders.domain(id))).data;
export const getSenderIdentities = async (channel?: CommChannel): Promise<SenderIdentity[]> => (await axiosInstance.get(R.senders.identities, { params: { channel } })).data;
export const createSenderIdentity = async (dto: SenderIdentityInput): Promise<SenderIdentity> => (await axiosInstance.post(R.senders.identities, dto)).data;
export const updateSenderIdentity = async ({ id, ...dto }: Partial<SenderIdentityInput> & { id: string }): Promise<SenderIdentity> => (await axiosInstance.patch(R.senders.identity(id), dto)).data;
export const verifySenderIdentity = async (id: string): Promise<SenderIdentity> => (await axiosInstance.post(R.senders.verify_identity(id))).data;
export const deleteSenderIdentity = async (id: string) => (await axiosInstance.delete(R.senders.identity(id))).data;
