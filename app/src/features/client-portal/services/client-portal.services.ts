import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    CustomerRole,
    InviteResult,
    Paginated,
    PortalActivityRow,
    PortalApprovalRow,
    PortalClientDetail,
    PortalClientRow,
    PortalInvitationRow,
    PortalMembershipRow,
    PortalOverview,
    PortalSettings,
    ProfileChangeRow,
} from "../interfaces/client-portal.interfaces";

const R = () => ApiRoutes.portal.admin;
type Params = Record<string, unknown>;

export const getPortalOverview = async (): Promise<PortalOverview> => (await axiosInstance.get(R().overview)).data;
export const getPortalSettings = async (): Promise<PortalSettings> => (await axiosInstance.get(R().settings)).data;
export const updatePortalSettings = async (dto: Partial<Omit<PortalSettings, "organization" | "organization_id">>): Promise<PortalSettings> => (await axiosInstance.patch(R().settings, dto)).data;
export const getPortalClients = async (params: Params): Promise<Paginated<PortalClientRow>> => (await axiosInstance.get(R().clients, { params })).data;
export const getPortalClient = async (companyId: string): Promise<PortalClientDetail> => (await axiosInstance.get(R().client(companyId))).data;
export const enablePortalClient = async ({ company_id, ...dto }: { company_id: string; emails?: string[]; role_id?: string; message?: string; welcome_message?: string | null }): Promise<PortalClientDetail & { invitation_results: InviteResult[] }> =>
    (await axiosInstance.post(R().enable(company_id), dto)).data;
export const disablePortalClient = async (companyId: string): Promise<PortalClientDetail> => (await axiosInstance.post(R().disable(companyId))).data;
export const getPortalUsers = async (params: Params): Promise<Paginated<PortalMembershipRow>> => (await axiosInstance.get(R().users, { params })).data;
export const updatePortalUser = async ({ id, ...dto }: { id: string; role_id?: string; status?: string }) => (await axiosInstance.patch(R().user(id), dto)).data;
export const getCustomerRoles = async (): Promise<CustomerRole[]> => (await axiosInstance.get(R().roles)).data;
export const getPortalInvitations = async (params: Params): Promise<Paginated<PortalInvitationRow>> => (await axiosInstance.get(R().invitations, { params })).data;
export const invitePortalUsers = async (dto: { company_id: string; emails: string[]; role_id?: string; message?: string }): Promise<{ results: InviteResult[] }> => (await axiosInstance.post(R().invitations, dto)).data;
export const resendPortalInvitation = async (id: string): Promise<InviteResult> => (await axiosInstance.post(R().resend(id))).data;
export const cancelPortalInvitation = async (id: string) => (await axiosInstance.post(R().cancel(id))).data;
export const getProfileChanges = async (params: Params): Promise<Paginated<ProfileChangeRow>> => (await axiosInstance.get(R().profileChanges, { params })).data;
export const approveProfileChange = async ({ id, review_note }: { id: string; review_note?: string }) => (await axiosInstance.post(R().approveChange(id), { review_note })).data;
export const rejectProfileChange = async ({ id, review_note }: { id: string; review_note?: string }) => (await axiosInstance.post(R().rejectChange(id), { review_note })).data;
export const getPortalActivity = async (params: Params): Promise<Paginated<PortalActivityRow>> => (await axiosInstance.get(R().activity, { params })).data;
export const getPortalApprovals = async (params: Params): Promise<Paginated<PortalApprovalRow>> => (await axiosInstance.get(R().approvals, { params })).data;
