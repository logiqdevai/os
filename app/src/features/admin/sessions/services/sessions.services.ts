import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { AdminSessionRow } from "../interfaces/sessions.interfaces";

export const getSessions = async (params: Record<string, unknown>): Promise<Paginated<AdminSessionRow>> => (await axiosInstance.get(ApiRoutes.admin.sessions.list, { params })).data;
export const revokeSession = async ({ id, reason }: { id: string; reason?: string }): Promise<{ success: boolean }> => (await axiosInstance.post(ApiRoutes.admin.sessions.revoke(id), { reason })).data;
export const revokeAllSessions = async (dto: { member_id?: string; reason?: string }): Promise<{ revoked: number }> => (await axiosInstance.post(ApiRoutes.admin.sessions.revokeAll, dto)).data;
