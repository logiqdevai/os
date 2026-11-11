import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { getPortalStoreState } from "@/stores/portal";
import type {
    HelpArticle,
    HelpHome,
    Paginated,
    PortalCompany,
    PortalContract,
    PortalConversation,
    PortalConversationDetail,
    PortalDashboard,
    PortalDeliverable,
    PortalDocument,
    PortalInvoice,
    PortalMembershipOption,
    PortalProject,
    PortalProjectDetail,
    PortalProposal,
    PortalRequest,
    PortalRequestDetail,
    PortalSession,
    PortalTeam,
} from "../interfaces/portal.interfaces";

const R = () => ApiRoutes.portal.customer;
type Params = Record<string, unknown>;

/** Every customer portal call carries the chosen company (CustomerPortalMembership). */
const cfg = (params?: Params) => {
    const id = getPortalStoreState().membership_id;
    return { params, headers: id ? { "X-Portal-Membership-Id": id } : {} };
};
const get = async <T,>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, cfg(params))).data;
const post = async <T,>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {}, cfg())).data;
const patch = async <T,>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body, cfg())).data;

export const getPortalMemberships = async (): Promise<PortalMembershipOption[]> => (await axiosInstance.get(R().memberships)).data;
export const getPortalSession = () => get<PortalSession>(R().me);
export const getPortalDashboard = () => get<PortalDashboard>(R().dashboard);
export const getPortalProjects = (params: Params) => get<Paginated<PortalProject>>(R().projects, params);
export const getPortalProject = (id: string) => get<PortalProjectDetail>(R().project(id));
export const getPortalApprovals = (params: Params) => get<Paginated<PortalDeliverable>>(R().approvals, params);
export const reviewDeliverable = ({ id, ...dto }: { id: string; decision: "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED"; comment?: string }) => post<{ id: string; status: string }>(R().review(id), dto);
export const getPortalRequests = (params: Params) => get<Paginated<PortalRequest>>(R().requests, params);
export const getPortalRequest = (idOrRef: string) => get<PortalRequestDetail>(R().request(idOrRef));
export const createPortalRequest = (dto: { subject: string; description: string; type: string; priority?: string; project_id?: string }) => post<PortalRequestDetail>(R().requests, dto);
export const updatePortalRequest = ({ id, ...dto }: { id: string; subject?: string; description?: string; priority?: string }) => patch<PortalRequestDetail>(R().request(id), dto);
export const replyToPortalRequest = ({ id, body }: { id: string; body: string }) => post<PortalRequestDetail>(R().requestReplies(id), { body });
export const ratePortalRequest = ({ id, rating, comment }: { id: string; rating: number; comment?: string }) => post<{ success: boolean }>(R().requestRating(id), { rating, comment });
export const getPortalConversations = (params: Params) => get<Paginated<PortalConversation>>(R().conversations, params);
export const getPortalConversation = (id: string) => get<PortalConversationDetail>(R().conversation(id));
export const startPortalConversation = (dto: { subject: string; body: string }) => post<PortalConversationDetail>(R().conversations, dto);
export const postPortalMessage = ({ id, body }: { id: string; body: string }) => post<PortalConversationDetail>(R().conversationMessages(id), { body });
export const getPortalDocuments = (params: Params) => get<Paginated<PortalDocument>>(R().documents, params);
export const getPortalProposals = (params: Params) => get<Paginated<PortalProposal>>(R().proposals, params);
export const getPortalContracts = (params: Params) => get<Paginated<PortalContract>>(R().contracts, params);
export const getPortalInvoices = (params: Params) => get<Paginated<PortalInvoice> & { outstanding: { currency: string; amount_due: string | null; count: number }[] }>(R().invoices, params);
export const getHelpHome = () => get<HelpHome>(R().knowledge);
export const getHelpArticles = (params: Params) => get<Paginated<HelpArticle>>(R().articles, params);
export const getHelpArticle = (slug: string) => get<HelpArticle>(R().article(slug));
export const getPortalCompany = () => get<PortalCompany>(R().company);
export const requestProfileChange = (dto: { contact_id?: string; changes: Record<string, unknown> }) => post<{ id: string; status: string }>(R().profileChanges, dto);
export const getPortalTeam = () => get<PortalTeam>(R().team);
export const inviteColleagues = (dto: { emails: string[]; role_id?: string; message?: string }) => post<{ results: { email: string; status: string }[] }>(R().teamInvitations, dto);
export const cancelColleagueInvitation = (id: string) => post(R().cancelInvitation(id));
export const updateTeamMember = ({ id, ...dto }: { id: string; role_id?: string; status?: string }) => patch(R().teamMember(id), dto);
