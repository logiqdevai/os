import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CreateInvitationDto, Invitation, InvitationSendResult } from "../interfaces/invitations.interfaces";

const R = ApiRoutes.admin.invitations;

export const getInvitations = async (params: Record<string, unknown>): Promise<Paginated<Invitation>> => (await axiosInstance.get(R.list, { params })).data;
export const createInvitations = async (dto: CreateInvitationDto): Promise<{ results: InvitationSendResult[] }> => (await axiosInstance.post(R.list, dto)).data;
export const resendInvitation = async (id: string): Promise<InvitationSendResult> => (await axiosInstance.post(R.resend(id))).data;
export const cancelInvitation = async (id: string): Promise<Invitation> => (await axiosInstance.post(R.cancel(id))).data;
