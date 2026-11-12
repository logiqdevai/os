import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CreateDomainDto, OrganizationDomain } from "../interfaces/domains.interfaces";

export const getDomains = async (params: Record<string, unknown>): Promise<Paginated<OrganizationDomain>> => (await axiosInstance.get(ApiRoutes.admin.domains.list, { params })).data;
export const createDomain = async (dto: CreateDomainDto): Promise<OrganizationDomain> => (await axiosInstance.post(ApiRoutes.admin.domains.list, dto)).data;
export const updateDomain = async ({ id, ...dto }: { id: string; allow_discovery?: boolean; auto_provision?: boolean }): Promise<OrganizationDomain> => (await axiosInstance.patch(ApiRoutes.admin.domains.detail(id), dto)).data;
export const verifyDomain = async (id: string): Promise<OrganizationDomain> => (await axiosInstance.post(ApiRoutes.admin.domains.verify(id))).data;
export const deleteDomain = async (id: string): Promise<{ success: boolean }> => (await axiosInstance.delete(ApiRoutes.admin.domains.detail(id))).data;
