import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as s from "../services/client-portal.services";
import { patchEntity, useEntityUpdate, useOptimisticMutation } from "@/lib/query/optimistic";
import type { PortalClientDetail, PortalClientStatus } from "../interfaces/client-portal.interfaces";

const KEY = ["client-portal"] as const;
const k = (...parts: unknown[]) => [...KEY, ...parts];

type Meta = { errorTitle?: string; errorToast?: boolean };

/** No optimistic change (invitations): refresh every portal-admin query when it settles; failures toast once globally. */
function useAdminMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>, meta: Meta) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
}
/** Optimistic patch of one row by id in every cached portal-admin list / detail. */
const useAdminPatch = <TVars, TData>(mutationFn: (v: TVars) => Promise<TData>, idOf: (v: TVars) => string, patch: (v: TVars) => object, meta: Meta) =>
    useOptimisticMutation<TData, TVars>({ roots: [KEY], meta, mutationFn, apply: (qc, v) => patchEntity(qc, KEY, idOf(v), patch(v)) });

/** A client's portal status shows at once on the clients list and the client page (the detail has no top-level id). */
function setClientStatus(qc: QueryClient, companyId: string, portal_status: PortalClientStatus) {
    patchEntity(qc, KEY, companyId, { portal_status });
    qc.setQueryData<PortalClientDetail>(k("client", companyId), (d) => (d ? { ...d, portal_status } : d));
}

export const usePortalOverview = () => useQuery({ queryKey: k("overview"), queryFn: s.getPortalOverview });
export const usePortalSettings = () => useQuery({ queryKey: k("settings"), queryFn: s.getPortalSettings });
/** Autosaved settings page: failures show in its <SaveStatus />. */
export const useUpdatePortalSettings = () => useAdminMutation(s.updatePortalSettings, { errorToast: false });
export const usePortalClients = (params: Record<string, unknown>) => useQuery({ queryKey: k("clients", params), queryFn: () => s.getPortalClients(params), placeholderData: keepPreviousData });
export const usePortalClient = (companyId: string | undefined) => useQuery({ queryKey: k("client", companyId), queryFn: () => s.getPortalClient(companyId as string), enabled: !!companyId });
export const useEnablePortalClient = () =>
    useOptimisticMutation({ roots: [KEY], meta: { errorTitle: "Could not enable the portal" }, mutationFn: s.enablePortalClient, apply: (qc, v) => setClientStatus(qc, v.company_id, "enabled") });
export const useDisablePortalClient = () =>
    useOptimisticMutation<unknown, string>({ roots: [KEY], meta: { errorTitle: "Could not switch the portal off" }, mutationFn: s.disablePortalClient, apply: (qc, id) => setClientStatus(qc, id, "disabled") });
export const usePortalUsers = (params: Record<string, unknown>) => useQuery({ queryKey: k("users", params), queryFn: () => s.getPortalUsers(params), placeholderData: keepPreviousData });
/** Role / access changes show at once; pass `optimistic: { role }` with the picked role. */
export const useUpdatePortalUser = () => useEntityUpdate({ root: KEY, mutationFn: s.updatePortalUser, meta: { errorTitle: "Could not update the portal user" } });
export const useCustomerRoles = (enabled = true) => useQuery({ queryKey: k("roles"), queryFn: s.getCustomerRoles, enabled, staleTime: 5 * 60_000 });
export const usePortalInvitations = (params: Record<string, unknown>) => useQuery({ queryKey: k("invitations", params), queryFn: () => s.getPortalInvitations(params), placeholderData: keepPreviousData });
/** Sending invitations is an explicit action; the dialog shows the per-email results. */
export const useInvitePortalUsers = () => useAdminMutation(s.invitePortalUsers, { errorTitle: "Could not send the invitations" });
export const useResendPortalInvitation = () =>
    useAdminPatch(s.resendPortalInvitation, (id) => id, () => ({ status: "PENDING", last_sent_at: new Date().toISOString() }), { errorTitle: "Could not resend the invitation" });
export const useCancelPortalInvitation = () => useAdminPatch(s.cancelPortalInvitation, (id) => id, () => ({ status: "CANCELLED" }), { errorTitle: "Could not cancel the invitation" });
export const useProfileChanges = (params: Record<string, unknown>) => useQuery({ queryKey: k("profile-changes", params), queryFn: () => s.getProfileChanges(params), placeholderData: keepPreviousData });
export const useApproveProfileChange = () => useAdminPatch(s.approveProfileChange, (v) => v.id, () => ({ status: "APPROVED" }), { errorTitle: "Could not approve the change" });
export const useRejectProfileChange = () => useAdminPatch(s.rejectProfileChange, (v) => v.id, (v) => ({ status: "REJECTED", review_note: v.review_note ?? null }), { errorTitle: "Could not reject the change" });
export const usePortalActivity = (params: Record<string, unknown>) => useQuery({ queryKey: k("activity", params), queryFn: () => s.getPortalActivity(params), placeholderData: keepPreviousData });
export const usePortalApprovals = (params: Record<string, unknown>) => useQuery({ queryKey: k("approvals", params), queryFn: () => s.getPortalApprovals(params), placeholderData: keepPreviousData });
