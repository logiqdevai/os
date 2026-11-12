import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { AssignRoleDto, EffectivePermissions, MemberBranchDto, MemberDetail, MemberListItem, UpdateMemberDto } from "../interfaces/members.interfaces";

const R = ApiRoutes.admin.members;

export const getMembers = async (params: Record<string, unknown>): Promise<Paginated<MemberListItem>> => (await axiosInstance.get(R.list, { params })).data;
export const getMember = async (id: string): Promise<MemberDetail> => (await axiosInstance.get(R.detail(id))).data;
export const getEffectivePermissions = async (id: string): Promise<EffectivePermissions> => (await axiosInstance.get(R.effective(id))).data;
export const updateMember = async ({ id, ...dto }: UpdateMemberDto & { id: string }) => (await axiosInstance.patch(R.detail(id), dto)).data;
export const suspendMember = async (id: string) => (await axiosInstance.post(R.suspend(id))).data;
export const reactivateMember = async (id: string) => (await axiosInstance.post(R.reactivate(id))).data;
export const resetMemberMfa = async (id: string): Promise<{ success: true; mfa_enabled: false }> => (await axiosInstance.post(R.mfa_reset(id))).data;
export const offboardMember = async ({ id, reason }: { id: string; reason?: string }) => (await axiosInstance.post(R.offboard(id), { reason })).data;
export const assignRole = async ({ id, ...dto }: AssignRoleDto & { id: string }) => (await axiosInstance.post(R.roles(id), dto)).data;
export const removeRole = async ({ id, assignment_id }: { id: string; assignment_id: string }) => (await axiosInstance.delete(R.role(id, assignment_id))).data;
export const addMemberBranch = async ({ id, ...dto }: MemberBranchDto & { id: string }) => (await axiosInstance.post(R.branches(id), dto)).data;
export const removeMemberBranch = async ({ id, branch_id }: { id: string; branch_id: string }) => (await axiosInstance.delete(R.branch(id, branch_id))).data;
export const setModuleAccess = async ({ id, module, enabled }: { id: string; module: string; enabled: boolean }) => (await axiosInstance.put(R.module(id, module), { enabled })).data;
export const resetModuleAccess = async ({ id, module }: { id: string; module: string }) => (await axiosInstance.delete(R.module(id, module))).data;
