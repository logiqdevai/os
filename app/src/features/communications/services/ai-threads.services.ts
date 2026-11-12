import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CommMessageDetail, Paginated } from "../interfaces/communications.interfaces";
import type { CommAiInput, CommAiResult, CommAiStatus, CommThreadDetail, CommThreadListItem } from "../interfaces/ai-threads.interfaces";

const R = ApiRoutes.communications;

export const getAiStatus = async (): Promise<CommAiStatus> => (await axiosInstance.get(R.ai.status)).data;
export const generateAi = async (dto: CommAiInput): Promise<CommAiResult> => (await axiosInstance.post(R.ai.generate, dto)).data;
export const aiFeedback = async ({ id, accepted, campaign_id }: { id: string; accepted: boolean; campaign_id?: string }) => (await axiosInstance.post(R.ai.feedback(id), { accepted, campaign_id })).data;

export const getThreads = async (params: Record<string, unknown>): Promise<Paginated<CommThreadListItem>> => (await axiosInstance.get(R.threads.list, { params })).data;
export const getThread = async (id: string): Promise<CommThreadDetail> => (await axiosInstance.get(R.threads.detail(id))).data;
export const replyInThread = async ({ id, ...dto }: { id: string; subject?: string; body_html?: string; body_text?: string }): Promise<CommMessageDetail> =>
    (await axiosInstance.post(R.threads.reply(id), dto)).data;
export const threadAction = async ({ id, action }: { id: string; action: "archive" | "restore" }) => (await axiosInstance.post(R.threads.action(id, action))).data;
