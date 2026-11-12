import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CreateDelegationDto, Delegation } from "../interfaces/delegations.interfaces";

export const getDelegations = async (params: Record<string, unknown>): Promise<Paginated<Delegation>> => (await axiosInstance.get(ApiRoutes.admin.delegations.list, { params })).data;
export const createDelegation = async (dto: CreateDelegationDto): Promise<Delegation> => (await axiosInstance.post(ApiRoutes.admin.delegations.list, dto)).data;
export const revokeDelegation = async ({ id, reason }: { id: string; reason?: string }): Promise<Delegation> => (await axiosInstance.post(ApiRoutes.admin.delegations.revoke(id), { reason })).data;
