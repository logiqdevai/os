import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadFile } from "@/features/files/services/file-download.services";
import type {
    ApprovalRule, ApprovalRuleDto, CompareResult, CreateProposalDto, CreateTemplateDto, LookupOption, MyApproval, Paginated, ProposalActivity, ProposalAnalytics, ProposalComment,
    ProposalDetail, ProposalListItem, ProposalSummary, ProposalTracking, AiApplyDto, AiGenerateDto, AiGenerateResult, ProposalTemplate, PublicDecisionDto, PublicProposal, PublicTotals, ReviewPreview, SaveContentDto, SendPreview,
    SendProposalDto, SendResult, UpdateProposalDto,
} from "../interfaces/proposals.interfaces";

const R = () => ApiRoutes.proposals;

// --- Proposals ----------------------------------------------------------------------------------

export const getProposals = async (params: Record<string, unknown>): Promise<Paginated<ProposalListItem>> => (await axiosInstance.get(R().list, { params })).data;
export const getProposalSummary = async (): Promise<ProposalSummary> => (await axiosInstance.get(R().summary)).data;
export const getProposal = async (id: string, versionId?: string): Promise<ProposalDetail> => (await axiosInstance.get(R().detail(id), { params: versionId ? { version_id: versionId } : undefined })).data;
export const createProposal = async (dto: CreateProposalDto): Promise<ProposalListItem> => (await axiosInstance.post(R().list, dto)).data;
export const updateProposal = async ({ id, ...dto }: UpdateProposalDto & { id: string }): Promise<ProposalListItem> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const deleteProposal = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
export const duplicateProposal = async (id: string): Promise<ProposalListItem> => (await axiosInstance.post(R().duplicate(id))).data;
export const archiveProposal = async ({ id, restore }: { id: string; restore?: boolean }) => (await axiosInstance.post(restore ? R().restore(id) : R().archive(id))).data;
export const cancelProposal = async (id: string) => (await axiosInstance.post(R().cancel(id))).data;
export const markProposalLost = async ({ id, lost_reason, note }: { id: string; lost_reason: string; note?: string }) => (await axiosInstance.post(R().mark_lost(id), { lost_reason, note })).data;
export const getProposalActivity = async (id: string): Promise<ProposalActivity> => (await axiosInstance.get(R().activity(id))).data;
export const downloadProposalPdf = ({ id, versionId }: { id: string; versionId?: string }) =>
    downloadFile(R().pdf(id), { params: versionId ? { version_id: versionId } : undefined, fallbackName: "proposal.pdf" });

// --- Versions & content ---------------------------------------------------------------------------

export const createProposalVersion = async ({ id, ...dto }: { id: string; from_version_id?: string; change_summary?: string }) => (await axiosInstance.post(R().versions(id), dto)).data;
export const saveProposalContent = async ({ id, versionId, ...dto }: SaveContentDto & { id: string; versionId: string }): Promise<ProposalDetail> =>
    (await axiosInstance.put(R().content(id, versionId), dto)).data;
export const compareProposalVersions = async (id: string, from: string, to: string): Promise<CompareResult> => (await axiosInstance.get(R().compare(id), { params: { from, to } })).data;

// --- Review ---------------------------------------------------------------------------------------

export const getReviewPreview = async (id: string, versionId: string): Promise<ReviewPreview> => (await axiosInstance.get(R().review_preview(id, versionId))).data;
export const submitForReview = async ({ id, versionId, ...dto }: { id: string; versionId: string; approver_membership_ids?: string[]; note?: string; due_at?: string }) =>
    (await axiosInstance.post(R().submit_for_review(id, versionId), dto)).data;
export const decideApproval = async ({ id, approvalId, ...dto }: { id: string; approvalId: string; decision: string; comment?: string }) => (await axiosInstance.post(R().approval_decision(id, approvalId), dto)).data;
export const getMyApprovals = async (): Promise<MyApproval[]> => (await axiosInstance.get(R().my_approvals)).data;

// --- Send ----------------------------------------------------------------------------------------

export const getSendPreview = async (id: string, versionId?: string): Promise<SendPreview> => (await axiosInstance.get(R().send_preview(id), { params: versionId ? { version_id: versionId } : undefined })).data;
export const sendProposal = async ({ id, ...dto }: SendProposalDto & { id: string }): Promise<SendResult> => (await axiosInstance.post(R().send(id), dto)).data;
export const rotateShareLink = async (id: string): Promise<{ public_url: string }> => (await axiosInstance.post(R().share_link(id))).data;

// --- Comments & conversion ------------------------------------------------------------------------

export const getProposalComments = async (id: string): Promise<ProposalComment[]> => (await axiosInstance.get(R().comments(id))).data;
export const addProposalComment = async ({ id, ...dto }: { id: string; body: string; is_internal: boolean; section_id?: string; version_id?: string }) => (await axiosInstance.post(R().comments(id), dto)).data;
export const resolveProposalComment = async ({ id, commentId, resolved }: { id: string; commentId: string; resolved: boolean }) => (await axiosInstance.patch(R().comment(id, commentId), { resolved })).data;
export const convertProposal = async ({ id, ...dto }: { id: string; contract_template_id?: string; contract_type_id?: string; contract_title?: string }): Promise<{ contract_id: string; contract_number: string }> =>
    (await axiosInstance.post(R().convert(id), dto)).data;

// --- Analytics & lookups ------------------------------------------------------------------------------

export const getProposalAiStatus = async (): Promise<{ configured: boolean; can_generate: boolean }> => (await axiosInstance.get(R().ai_status)).data;
export const generateProposalDraft = async ({ id, ...dto }: AiGenerateDto & { id: string }): Promise<AiGenerateResult> => (await axiosInstance.post(R().ai_generate(id), dto)).data;
export const applyProposalDraft = async ({ id, ...dto }: AiApplyDto & { id: string }): Promise<ProposalDetail> => (await axiosInstance.post(R().ai_apply(id), dto)).data;
export const getProposalTracking = async (params: Record<string, unknown>): Promise<ProposalTracking> => (await axiosInstance.get(R().tracking, { params })).data;
export const getProposalAnalytics = async (params: Record<string, unknown>): Promise<ProposalAnalytics> => (await axiosInstance.get(R().analytics, { params })).data;
export const getProposalLookups = async (params: { kind: string; search?: string; company_id?: string }): Promise<LookupOption[]> => (await axiosInstance.get(R().lookups, { params })).data;

// --- Templates & rules -------------------------------------------------------------------------------

export const getProposalTemplates = async (params: Record<string, unknown>): Promise<Paginated<ProposalTemplate>> => (await axiosInstance.get(R().templates.list, { params })).data;
export const getProposalTemplate = async (id: string): Promise<ProposalTemplate> => (await axiosInstance.get(R().templates.detail(id))).data;
export const createProposalTemplate = async (dto: CreateTemplateDto): Promise<ProposalTemplate> => (await axiosInstance.post(R().templates.list, dto)).data;
export const updateProposalTemplate = async ({ id, ...dto }: Partial<CreateTemplateDto> & { id: string }): Promise<ProposalTemplate> => (await axiosInstance.patch(R().templates.detail(id), dto)).data;
export const duplicateProposalTemplate = async (id: string): Promise<ProposalTemplate> => (await axiosInstance.post(R().templates.duplicate(id))).data;
export const archiveProposalTemplate = async ({ id, restore }: { id: string; restore?: boolean }) => (await axiosInstance.post(restore ? R().templates.restore(id) : R().templates.archive(id))).data;
export const getApprovalRules = async (): Promise<ApprovalRule[]> => (await axiosInstance.get(R().approval_rules.list)).data;
export const createApprovalRule = async (dto: ApprovalRuleDto): Promise<ApprovalRule> => (await axiosInstance.post(R().approval_rules.list, dto)).data;
export const updateApprovalRule = async ({ id, ...dto }: Partial<ApprovalRuleDto> & { id: string }): Promise<ApprovalRule> => (await axiosInstance.patch(R().approval_rules.detail(id), dto)).data;
export const deleteApprovalRule = async (id: string) => (await axiosInstance.delete(R().approval_rules.detail(id))).data;

// --- Public customer link (no login; X-Proposal-Access for verified links) ----------------------------

const accessHeader = (access?: string | null) => (access ? { headers: { "X-Proposal-Access": access } } : undefined);
export const getPublicProposal = async (token: string, access?: string | null): Promise<PublicProposal> => (await axiosInstance.get(R().public.view(token), accessHeader(access))).data;
export const quotePublicSelection = async ({ token, access, ids }: { token: string; access?: string | null; ids: string[] }): Promise<{ totals: PublicTotals; selected_optional_item_ids: string[] }> =>
    (await axiosInstance.post(R().public.selection(token), { selected_optional_item_ids: ids }, accessHeader(access))).data;
export const decidePublicProposal = async ({ token, access, ...dto }: PublicDecisionDto & { token: string; access?: string | null }) => (await axiosInstance.post(R().public.decision(token), dto, accessHeader(access))).data;
export const commentPublicProposal = async ({ token, access, ...dto }: { token: string; access?: string | null; body: string; author_name: string; section_id?: string }) =>
    (await axiosInstance.post(R().public.comments(token), dto, accessHeader(access))).data;
export const sendPublicCode = async ({ token, email }: { token: string; email: string }): Promise<{ sent: boolean; dev_code?: string }> => (await axiosInstance.post(R().public.send_code(token), { email })).data;
export const downloadPublicProposalPdf = ({ token, access }: { token: string; access?: string | null }) =>
    downloadFile(R().public.pdf(token), { headers: access ? { "X-Proposal-Access": access } : undefined, fallbackName: "proposal.pdf" });
export const sendPublicEngagement = async ({ token, access, ...dto }: { token: string; access?: string | null; seconds: number; sections: { id: string; seconds: number }[]; session_id: string }) =>
    (await axiosInstance.post(R().public.engagement(token), dto, accessHeader(access))).data;
export const verifyPublicCode = async ({ token, code }: { token: string; code: string }): Promise<{ access: string }> => (await axiosInstance.post(R().public.verify(token), { code })).data;
