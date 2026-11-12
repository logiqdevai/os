import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as s from "../services/messaging-admin.services";
import type { MessageReportStatus } from "../interfaces/messaging-admin.interfaces";

const K = {
    calls: ["messaging", "calls"] as const,
    moderation: ["messaging", "moderation"] as const,
    governance: ["messaging", "governance"] as const,
    admin: ["messaging", "admin"] as const,
    messages: ["messaging", "messages"] as const,
};

function useInvalidate(...keys: (readonly string[])[]) {
    const qc = useQueryClient();
    return () => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

// files
export const useUploadAttachment = () => useMutation({ mutationFn: s.uploadAttachment });
export const useAttachmentUrl = (id: string | undefined, disposition: "inline" | "attachment", enabled = true) =>
    useQuery({ queryKey: ["messaging", "attachment-url", id, disposition], queryFn: () => s.getAttachmentUrl({ id: id as string, disposition }), enabled: !!id && enabled, staleTime: 4 * 60_000 });
export const useOpenAttachment = () => useMutation({ mutationFn: s.getAttachmentUrl });

// calls (polls; live updates also arrive on the socket as call.updated)
export const useCalls = (params: { status?: "active" | "recent"; channel_id?: string }, enabled = true) =>
    useQuery({ queryKey: [...K.calls, params], queryFn: () => s.getCalls(params), enabled, refetchInterval: params.status === "recent" ? false : 15_000 });
export const useStartCall = () => useMutation({ mutationFn: s.startCall, onSuccess: useInvalidate(K.calls) });
export const useCallAction = () => useMutation({ mutationFn: s.callAction, onSuccess: useInvalidate(K.calls) });

// moderation
export const useReportMessage = () => useMutation({ mutationFn: s.reportMessage });
export const useReports = (status?: MessageReportStatus) => useQuery({ queryKey: [...K.moderation, "reports", status ?? "open"], queryFn: () => s.getReports({ status }), placeholderData: keepPreviousData });
export const useReport = (id: string | undefined) => useQuery({ queryKey: [...K.moderation, "report", id], queryFn: () => s.getReport(id as string), enabled: !!id });
export const useDecideReport = () => useMutation({ mutationFn: s.decideReport, onSuccess: useInvalidate(K.moderation, K.admin) });
export const useRestrictions = (active = true, enabled = true) => useQuery({ queryKey: [...K.moderation, "restrictions", active], queryFn: () => s.getRestrictions(active), enabled });
export const useCreateRestriction = () => useMutation({ mutationFn: s.createRestriction, onSuccess: useInvalidate(K.moderation) });
export const useLiftRestriction = () => useMutation({ mutationFn: s.liftRestriction, onSuccess: useInvalidate(K.moderation) });

// retention, holds, exports
export const usePolicies = (enabled = true) => useQuery({ queryKey: [...K.governance, "policies"], queryFn: s.getPolicies, enabled });
export const useCreatePolicy = () => useMutation({ mutationFn: s.createPolicy, onSuccess: useInvalidate(K.governance) });
export const useUpdatePolicy = () => useMutation({ mutationFn: s.updatePolicy, onSuccess: useInvalidate(K.governance) });
export const useDeletePolicy = () => useMutation({ mutationFn: s.deletePolicy, onSuccess: useInvalidate(K.governance) });
export const useRunPolicy = () => useMutation({ mutationFn: s.runPolicy, onSuccess: useInvalidate(K.governance) });
export const useHolds = (includeReleased = false, enabled = true) => useQuery({ queryKey: [...K.governance, "holds", includeReleased], queryFn: () => s.getHolds(includeReleased), enabled });
export const useCreateHold = () => useMutation({ mutationFn: s.createHold, onSuccess: useInvalidate(K.governance) });
export const useReleaseHold = () => useMutation({ mutationFn: s.releaseHold, onSuccess: useInvalidate(K.governance) });
export const useExports = (enabled = true) =>
    useQuery({
        queryKey: [...K.governance, "exports"],
        queryFn: s.getExports,
        enabled,
        refetchInterval: (q) => (q.state.data?.data.some((e) => e.status === "PENDING" || e.status === "RUNNING") ? 5000 : false),
    });
export const useRequestExport = () => useMutation({ mutationFn: s.requestExport, onSuccess: useInvalidate(K.governance) });
export const useExportDownload = () => useMutation({ mutationFn: s.getExportDownload });

// overview, guests, settings, integrations
export const useMessagingOverview = (range: "7d" | "30d" | "90d", enabled = true) =>
    useQuery({ queryKey: [...K.admin, "overview", range], queryFn: () => s.getMessagingOverview(range), enabled, placeholderData: keepPreviousData });
export const useGuests = (params: { search?: string; expiring_days?: number }) => useQuery({ queryKey: [...K.admin, "guests", params], queryFn: () => s.getGuests(params), placeholderData: keepPreviousData });
export const useUpdateGuest = () => useMutation({ mutationFn: s.updateGuest, onSuccess: useInvalidate(K.admin) });
export const useRemoveGuest = () => useMutation({ mutationFn: s.removeGuest, onSuccess: useInvalidate(K.admin) });
export const useRevokeInvitation = () => useMutation({ mutationFn: s.revokeInvitation, onSuccess: useInvalidate(K.admin) });
export const useMessagingSettings = (enabled = true) => useQuery({ queryKey: [...K.admin, "settings"], queryFn: s.getMessagingSettings, enabled });
export const useUpdateMessagingSettings = () => useMutation({ mutationFn: s.updateMessagingSettings, onSuccess: useInvalidate(K.admin, K.calls) });
export const useIntegrations = () => useQuery({ queryKey: [...K.admin, "integrations"], queryFn: s.getIntegrations });
export const useCreateIntegration = () => useMutation({ mutationFn: s.createIntegration, onSuccess: useInvalidate(K.admin) });
export const useUpdateIntegration = () => useMutation({ mutationFn: s.updateIntegration, onSuccess: useInvalidate(K.admin) });
export const useRotateIntegrationToken = () => useMutation({ mutationFn: s.rotateIntegrationToken, onSuccess: useInvalidate(K.admin) });
export const useTestIntegration = () => useMutation({ mutationFn: s.testIntegration, onSuccess: useInvalidate(K.admin) });
export const useDisconnectIntegration = () => useMutation({ mutationFn: s.disconnectIntegration, onSuccess: useInvalidate(K.admin) });
