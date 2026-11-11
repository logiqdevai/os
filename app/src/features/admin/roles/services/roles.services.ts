import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CreateRoleDto, Role, RoleDetail, UpdateRoleDto } from "../interfaces/roles.interfaces";

const R = ApiRoutes.admin.roles;

export const getRoles = async (params: Record<string, unknown>): Promise<Paginated<Role>> => (await axiosInstance.get(R.list, { params })).data;
export const getRole = async (id: string): Promise<RoleDetail> => (await axiosInstance.get(R.detail(id))).data;
export const createRole = async (dto: CreateRoleDto): Promise<RoleDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateRole = async ({ id, ...dto }: UpdateRoleDto & { id: string }): Promise<RoleDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const publishRole = async ({ id, note }: { id: string; note?: string }): Promise<RoleDetail> => (await axiosInstance.post(R.publish(id), { note })).data;
export const deprecateRole = async (id: string): Promise<RoleDetail> => (await axiosInstance.post(R.deprecate(id))).data;
