import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { UploadedAttachment } from "../interfaces/messaging.interfaces";
import type {
    CallList, ChannelCall, ChannelCallKind, ExportInput, ExportJob, GuestList, IntegrationInput, LegalHold, LegalHoldInput, MessageReport, MessageReportDetail, MessageReportStatus,
    MessagingIntegration, MessagingOverview, MessagingSettings, ModerationAction, ReportReason, Restriction, RetentionPolicy, RetentionPolicyInput, RetentionRunResult,
} from "../interfaces/messaging-admin.interfaces";

const R = () => ApiRoutes.messaging;
const A = () => ApiRoutes.messaging.admin;

// files
export const uploadAttachment = async ({ channelId, file, onProgress }: { channelId: string; file: File; onProgress?: (pct: number) => void }): Promise<UploadedAttachment> => {
    const body = new FormData();
    body.append("file", file);
    return (await axiosInstance.post(R().channels.attachments(channelId), body, { onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)) })).data;
};
export const getAttachmentUrl = async ({ id, disposition }: { id: string; disposition: "inline" | "attachment" }): Promise<{ path: string; expires_at: string; filename: string; mimetype: string }> =>
    (await axiosInstance.get(R().attachment_url(id), { params: { disposition } })).data;

// calls
export const getCalls = async (params: { status?: "active" | "recent"; channel_id?: string }): Promise<CallList> => (await axiosInstance.get(R().calls.list, { params })).data;
export const startCall = async ({ channelId, ...dto }: { channelId: string; kind: ChannelCallKind; title?: string; meeting_url?: string }): Promise<ChannelCall> =>
    (await axiosInstance.post(R().channels.calls(channelId), dto)).data;
export const callAction = async ({ id, action }: { id: string; action: "join" | "leave" | "end" }): Promise<ChannelCall> => (await axiosInstance.post(R().calls.action(id, action))).data;

// moderation
export const reportMessage = async ({ id, reason, details }: { id: string; reason: ReportReason; details?: string }): Promise<{ id: string; duplicate: boolean }> =>
    (await axiosInstance.post(R().report(id), { reason, details })).data;
export const getReports = async (params: { status?: MessageReportStatus }): Promise<{ data: MessageReport[]; counts: Record<string, number> }> => (await axiosInstance.get(A().reports, { params })).data;
export const getReport = async (id: string): Promise<MessageReportDetail> => (await axiosInstance.get(A().report(id))).data;
export const decideReport = async ({ id, ...dto }: { id: string; status: Exclude<MessageReportStatus, "OPEN">; action: ModerationAction; reason?: string; resolution_note?: string; restriction_hours?: number }) =>
    (await axiosInstance.patch(A().report(id), dto)).data;
export const getRestrictions = async (active = true): Promise<{ data: Restriction[] }> => (await axiosInstance.get(A().restrictions, { params: { active: String(active) } })).data;
export const createRestriction = async (dto: { membership_id: string; channel_id?: string | null; kind: "MUTED" | "BANNED"; reason?: string; expires_at?: string | null }): Promise<Restriction> =>
    (await axiosInstance.post(A().restrictions, dto)).data;
export const liftRestriction = async (id: string): Promise<Restriction> => (await axiosInstance.post(A().lift(id))).data;

// retention, holds, exports
export const getPolicies = async (): Promise<{ data: RetentionPolicy[] }> => (await axiosInstance.get(A().policies)).data;
export const createPolicy = async (dto: RetentionPolicyInput): Promise<RetentionPolicy> => (await axiosInstance.post(A().policies, dto)).data;
export const updatePolicy = async ({ id, ...dto }: RetentionPolicyInput & { id: string }): Promise<RetentionPolicy> => (await axiosInstance.put(A().policy(id), dto)).data;
export const deletePolicy = async (id: string) => (await axiosInstance.delete(A().policy(id))).data;
export const runPolicy = async ({ id, dryRun }: { id: string; dryRun: boolean }): Promise<RetentionRunResult> => (await axiosInstance.post(dryRun ? A().policy_preview(id) : A().policy_run(id))).data;
export const getHolds = async (includeReleased = false): Promise<{ data: LegalHold[] }> => (await axiosInstance.get(A().holds, { params: { include_released: String(includeReleased) } })).data;
export const createHold = async (dto: LegalHoldInput): Promise<LegalHold> => (await axiosInstance.post(A().holds, dto)).data;
export const releaseHold = async (id: string): Promise<LegalHold> => (await axiosInstance.post(A().hold_release(id))).data;
export const getExports = async (): Promise<{ data: ExportJob[] }> => (await axiosInstance.get(A().exports)).data;
export const requestExport = async (dto: ExportInput): Promise<ExportJob> => (await axiosInstance.post(A().exports, dto)).data;
export const getExportDownload = async (id: string): Promise<{ path: string }> => (await axiosInstance.get(A().export_download(id))).data;

// overview, guests, settings, integrations
export const getMessagingOverview = async (range: "7d" | "30d" | "90d"): Promise<MessagingOverview> => (await axiosInstance.get(A().overview, { params: { range } })).data;
export const getGuests = async (params: { search?: string; expiring_days?: number }): Promise<GuestList> => (await axiosInstance.get(A().guests, { params })).data;
export const updateGuest = async ({ memberId, ...dto }: { memberId: string; access_expires_at: string | null }) => (await axiosInstance.patch(A().guest(memberId), dto)).data;
export const removeGuest = async (memberId: string) => (await axiosInstance.delete(A().guest(memberId))).data;
export const revokeInvitation = async (id: string) => (await axiosInstance.post(A().invitation_revoke(id))).data;
export const getMessagingSettings = async (): Promise<MessagingSettings> => (await axiosInstance.get(A().settings)).data;
export const updateMessagingSettings = async (dto: Partial<MessagingSettings>): Promise<MessagingSettings> => (await axiosInstance.patch(A().settings, dto)).data;
export const getIntegrations = async (): Promise<{ data: MessagingIntegration[] }> => (await axiosInstance.get(A().integrations)).data;
export const createIntegration = async (dto: IntegrationInput): Promise<MessagingIntegration & { token: string; webhook_path: string }> => (await axiosInstance.post(A().integrations, dto)).data;
export const updateIntegration = async ({ id, ...dto }: Partial<IntegrationInput> & { id: string; status?: "ACTIVE" | "DISABLED" }): Promise<MessagingIntegration> =>
    (await axiosInstance.patch(A().integration(id), dto)).data;
export const rotateIntegrationToken = async (id: string): Promise<{ token: string; webhook_path: string }> => (await axiosInstance.post(A().integration_rotate(id))).data;
export const testIntegration = async (id: string) => (await axiosInstance.post(A().integration_test(id))).data;
export const disconnectIntegration = async (id: string) => (await axiosInstance.delete(A().integration(id))).data;
