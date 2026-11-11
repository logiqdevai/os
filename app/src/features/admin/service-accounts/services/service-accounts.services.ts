import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { ServiceAccount, ServiceAccountDetail, ServiceAccountDto, ServiceAccountRoleDto } from "../interfaces/service-accounts.interfaces";

const R = ApiRoutes.admin.serviceAccounts;

export const getServiceAccounts = async (params: Record<string, unknown>): Promise<Paginated<ServiceAccount>> => (await axiosInstance.get(R.list, { params })).data;
export const getServiceAccount = async (id: string): Promise<ServiceAccountDetail> => (await axiosInstance.get(R.detail(id))).data;
export const createServiceAccount = async (dto: ServiceAccountDto): Promise<ServiceAccountDetail> => (await axiosInstance.post(R.list, dto)).data;
export const updateServiceAccount = async ({ id, ...dto }: Partial<ServiceAccountDto> & { id: string }): Promise<ServiceAccountDetail> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const setServiceAccountStatus = async ({ id, action }: { id: string; action: "suspend" | "reactivate" | "revoke" }): Promise<ServiceAccountDetail> =>
    (await axiosInstance.post(R[action](id))).data;
export const assignServiceAccountRole = async ({ id, ...dto }: ServiceAccountRoleDto & { id: string }) => (await axiosInstance.post(R.roles(id), dto)).data;
export const removeServiceAccountRole = async ({ id, assignment_id }: { id: string; assignment_id: string }) => (await axiosInstance.delete(R.role(id, assignment_id))).data;
