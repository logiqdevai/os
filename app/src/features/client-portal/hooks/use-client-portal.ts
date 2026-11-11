import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/client-portal.services";

const KEY = ["client-portal"] as const;
const k = (...parts: unknown[]) => [...KEY, ...parts];

function useAdminMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const usePortalOverview = () => useQuery({ queryKey: k("overview"), queryFn: s.getPortalOverview });
export const usePortalSettings = () => useQuery({ queryKey: k("settings"), queryFn: s.getPortalSettings });
export const useUpdatePortalSettings = () => useAdminMutation(s.updatePortalSettings);
export const usePortalClients = (params: Record<string, unknown>) => useQuery({ queryKey: k("clients", params), queryFn: () => s.getPortalClients(params), placeholderData: keepPreviousData });
export const usePortalClient = (companyId: string | undefined) => useQuery({ queryKey: k("client", companyId), queryFn: () => s.getPortalClient(companyId as string), enabled: !!companyId });
export const useEnablePortalClient = () => useAdminMutation(s.enablePortalClient);
export const useDisablePortalClient = () => useAdminMutation(s.disablePortalClient);
export const usePortalUsers = (params: Record<string, unknown>) => useQuery({ queryKey: k("users", params), queryFn: () => s.getPortalUsers(params), placeholderData: keepPreviousData });
export const useUpdatePortalUser = () => useAdminMutation(s.updatePortalUser);
export const useCustomerRoles = (enabled = true) => useQuery({ queryKey: k("roles"), queryFn: s.getCustomerRoles, enabled, staleTime: 5 * 60_000 });
export const usePortalInvitations = (params: Record<string, unknown>) => useQuery({ queryKey: k("invitations", params), queryFn: () => s.getPortalInvitations(params), placeholderData: keepPreviousData });
export const useInvitePortalUsers = () => useAdminMutation(s.invitePortalUsers);
export const useResendPortalInvitation = () => useAdminMutation(s.resendPortalInvitation);
export const useCancelPortalInvitation = () => useAdminMutation(s.cancelPortalInvitation);
export const useProfileChanges = (params: Record<string, unknown>) => useQuery({ queryKey: k("profile-changes", params), queryFn: () => s.getProfileChanges(params), placeholderData: keepPreviousData });
export const useApproveProfileChange = () => useAdminMutation(s.approveProfileChange);
export const useRejectProfileChange = () => useAdminMutation(s.rejectProfileChange);
export const usePortalActivity = (params: Record<string, unknown>) => useQuery({ queryKey: k("activity", params), queryFn: () => s.getPortalActivity(params), placeholderData: keepPreviousData });
export const usePortalApprovals = (params: Record<string, unknown>) => useQuery({ queryKey: k("approvals", params), queryFn: () => s.getPortalApprovals(params), placeholderData: keepPreviousData });
