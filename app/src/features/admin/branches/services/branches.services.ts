import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { Branch, BranchDetail, BranchDto } from "../interfaces/branches.interfaces";

const R = ApiRoutes.admin.branches;

export const getBranches = async (params: Record<string, unknown>): Promise<Paginated<Branch>> => (await axiosInstance.get(R.list, { params })).data;
export const getBranch = async (id: string): Promise<BranchDetail> => (await axiosInstance.get(R.detail(id))).data;
export const createBranch = async (dto: BranchDto): Promise<Branch> => (await axiosInstance.post(R.list, dto)).data;
export const updateBranch = async ({ id, ...dto }: Partial<BranchDto> & { id: string }): Promise<Branch> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const archiveBranch = async (id: string): Promise<Branch> => (await axiosInstance.post(R.archive(id))).data;
export const restoreBranch = async (id: string): Promise<Branch> => (await axiosInstance.post(R.restore(id))).data;
