import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { CatalogPermission, CreateGrantDto, PermissionGrant, SimulateDto, SimulateResult } from "../interfaces/permissions.interfaces";

const R = ApiRoutes.admin.permissions;

export const getCatalog = async (params: Record<string, unknown>): Promise<Paginated<CatalogPermission>> => (await axiosInstance.get(R.catalog, { params })).data;
export const getGrants = async (params: Record<string, unknown>): Promise<Paginated<PermissionGrant>> => (await axiosInstance.get(R.grants, { params })).data;
export const createGrant = async (dto: CreateGrantDto): Promise<PermissionGrant> => (await axiosInstance.post(R.grants, dto)).data;
export const revokeGrant = async (id: string) => (await axiosInstance.delete(R.grant(id))).data;
export const simulate = async (dto: SimulateDto): Promise<SimulateResult> => (await axiosInstance.post(R.simulate, dto)).data;
