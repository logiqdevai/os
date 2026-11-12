import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as s from "../services/messaging-admin.services";
import type { MessageReportStatus } from "../interfaces/messaging-admin.interfaces";

const K = {
    calls: ["messaging", "calls"] as const,
    moderation: ["messaging", "moderation"] as const,
    governance: ["messaging", "governance"] as const,
    admin: ["messaging", "admin"] as const,
    messages: ["messaging", "messages"] as const,
};

type Meta = { errorTitle?: string; errorToast?: boolean };

/**
 * Mutation without an optimistic change: refreshes `keys` when it settles. No success toast (the page shows the
 * result); a failure is toasted once globally with `errorTitle`.
 */
function useAdminMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, keys: (readonly string[])[], meta: Meta) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta, onSettled: () => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey }))) });
}
/** Optimistic patch / removal of one row by id under `root`, rolled back if the API refuses. */
const usePatch = <TVars, TData>(root: readonly string[], fn: (v: TVars) => Promise<TData>, idOf: (v: TVars) => string, patch: ((v: TVars) => object) | "remove", meta: Meta, also: (readonly string[])[] = []) =>
    useOptimisticMutation<TData, TVars>({
        roots: [root],
        alsoInvalidate: also,
        meta,
        mutationFn: fn,
        apply: (qc, v) => (patch === "remove" ? removeEntity(qc, root, idOf(v)) : patchEntity(qc, root, idOf(v), patch(v))),
    });

// files
/** The composer shows a failed upload inline on the file chip. */
export const useUploadAttachment = () => useMutation({ mutationFn: s.uploadAttachment, meta: { errorTitle: "A file was not uploaded" } });
export const useAttachmentUrl = (id: string | undefined, disposition: "inline" | "attachment", enabled = true) =>
    useQuery({ queryKey: ["messaging", "attachment-url", id, disposition], queryFn: () => s.getAttachmentUrl({ id: id as string, disposition }), enabled: !!id && enabled, staleTime: 4 * 60_000 });
export const useOpenAttachment = () => useMutation({ mutationFn: s.getAttachmentUrl, meta: { errorTitle: "Could not open the file" } });

// calls (polls; live updates also arrive on the socket as call.updated)
export const useCalls = (params: { status?: "active" | "recent"; channel_id?: string }, enabled = true) =>
    useQuery({ queryKey: [...K.calls, params], queryFn: () => s.getCalls(params), enabled, refetchInterval: params.status === "recent" ? false : 15_000 });
export const useStartCall = () => useAdminMutation(s.startCall, [K.calls], { errorTitle: "Could not start the call" });
export const useCallAction = () => useAdminMutation(s.callAction, [K.calls], { errorTitle: "Could not update the call" });

// moderation
export const useReportMessage = () => useMutation({ mutationFn: s.reportMessage, meta: { errorTitle: "Could not report the message" } });
export const useReports = (status?: MessageReportStatus) => useQuery({ queryKey: [...K.moderation, "reports", status ?? "open"], queryFn: () => s.getReports({ status }), placeholderData: keepPreviousData });
export const useReport = (id: string | undefined) => useQuery({ queryKey: [...K.moderation, "report", id], queryFn: () => s.getReport(id as string), enabled: !!id });
/** The report shows its new status at once. */
export const useDecideReport = () => usePatch(K.moderation, s.decideReport, (v) => v.id, (v) => ({ status: v.status }), { errorTitle: "Could not apply the decision" }, [K.admin]);
export const useRestrictions = (active = true, enabled = true) => useQuery({ queryKey: [...K.moderation, "restrictions", active], queryFn: () => s.getRestrictions(active), enabled });
export const useCreateRestriction = () => useAdminMutation(s.createRestriction, [K.moderation], { errorTitle: "Could not restrict the member" });
export const useLiftRestriction = () => usePatch(K.moderation, s.liftRestriction, (id) => id, "remove", { errorTitle: "Could not lift the restriction" });

// retention, holds, exports
export const usePolicies = (enabled = true) => useQuery({ queryKey: [...K.governance, "policies"], queryFn: s.getPolicies, enabled });
export const useCreatePolicy = () => useAdminMutation(s.createPolicy, [K.governance], { errorTitle: "Could not create the policy" });
/** Retention policies delete messages, so edits keep an explicit Save (no half-typed retention period is ever stored). */
export const useUpdatePolicy = () => useAdminMutation(s.updatePolicy, [K.governance], { errorTitle: "Could not save the policy" });
export const useDeletePolicy = () => usePatch(K.governance, s.deletePolicy, (id) => id, "remove", { errorTitle: "Could not delete the policy" });
/** Applying a policy deletes messages: explicit and confirmed; the dialog shows the dry-run counts. */
export const useRunPolicy = () => useAdminMutation(s.runPolicy, [K.governance], { errorTitle: "Could not run the policy" });
export const useHolds = (includeReleased = false, enabled = true) => useQuery({ queryKey: [...K.governance, "holds", includeReleased], queryFn: () => s.getHolds(includeReleased), enabled });
export const useCreateHold = () => useAdminMutation(s.createHold, [K.governance], { errorTitle: "Could not create the hold" });
export const useReleaseHold = () => usePatch(K.governance, s.releaseHold, (id) => id, () => ({ released_at: new Date().toISOString() }), { errorTitle: "Could not release the hold" });
export const useExports = (enabled = true) =>
    useQuery({
        queryKey: [...K.governance, "exports"],
        queryFn: s.getExports,
        enabled,
        refetchInterval: (q) => (q.state.data?.data.some((e) => e.status === "PENDING" || e.status === "RUNNING") ? 5000 : false),
    });
export const useRequestExport = () => useAdminMutation(s.requestExport, [K.governance], { errorTitle: "Could not request the export" });
export const useExportDownload = () => useMutation({ mutationFn: s.getExportDownload, meta: { errorTitle: "Could not download the export" } });

// overview, guests, settings, integrations
export const useMessagingOverview = (range: "7d" | "30d" | "90d", enabled = true) =>
    useQuery({ queryKey: [...K.admin, "overview", range], queryFn: () => s.getMessagingOverview(range), enabled, placeholderData: keepPreviousData });
export const useGuests = (params: { search?: string; expiring_days?: number }) => useQuery({ queryKey: [...K.admin, "guests", params], queryFn: () => s.getGuests(params), placeholderData: keepPreviousData });
export const useUpdateGuest = () => usePatch(K.admin, s.updateGuest, (v) => v.memberId, (v) => ({ access_expires_at: v.access_expires_at }), { errorTitle: "Could not update the guest" });
export const useRemoveGuest = () => usePatch(K.admin, s.removeGuest, (id) => id, "remove", { errorTitle: "Could not remove the guest" });
export const useRevokeInvitation = () => usePatch(K.admin, s.revokeInvitation, (id) => id, "remove", { errorTitle: "Could not revoke the invitation" });
export const useMessagingSettings = (enabled = true) => useQuery({ queryKey: [...K.admin, "settings"], queryFn: s.getMessagingSettings, enabled });
/** Autosaved settings page: failures show in its <SaveStatus />. */
export const useUpdateMessagingSettings = () => useAdminMutation(s.updateMessagingSettings, [K.admin, K.calls], { errorToast: false });
export const useIntegrations = () => useQuery({ queryKey: [...K.admin, "integrations"], queryFn: s.getIntegrations });
export const useCreateIntegration = () => useAdminMutation(s.createIntegration, [K.admin], { errorTitle: "Could not connect the integration" });
/** Enable / disable shows at once. */
export const useUpdateIntegration = () => usePatch(K.admin, s.updateIntegration, (v) => v.id, ({ id: _id, ...v }) => v, { errorTitle: "Could not update the integration" });
export const useRotateIntegrationToken = () => useAdminMutation(s.rotateIntegrationToken, [K.admin], { errorTitle: "Could not rotate the token" });
export const useTestIntegration = () => useAdminMutation(s.testIntegration, [K.admin], { errorTitle: "Test failed" });
export const useDisconnectIntegration = () => usePatch(K.admin, s.disconnectIntegration, (id) => id, "remove", { errorTitle: "Could not disconnect the integration" });
