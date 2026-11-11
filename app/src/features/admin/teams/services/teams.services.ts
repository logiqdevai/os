import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CreateTeamDto, Paginated, Team, TeamDetail, UpdateTeamDto } from "../interfaces/teams.interfaces";

export const getTeams = async (params: Record<string, unknown>): Promise<Paginated<Team>> => (await axiosInstance.get(ApiRoutes.admin.teams.list, { params })).data;
export const getTeam = async (id: string): Promise<TeamDetail> => (await axiosInstance.get(ApiRoutes.admin.teams.detail(id))).data;
export const createTeam = async (dto: CreateTeamDto): Promise<Team> => (await axiosInstance.post(ApiRoutes.admin.teams.list, dto)).data;
export const updateTeam = async ({ id, ...dto }: UpdateTeamDto & { id: string }): Promise<Team> => (await axiosInstance.patch(ApiRoutes.admin.teams.detail(id), dto)).data;
export const archiveTeam = async (id: string): Promise<Team> => (await axiosInstance.post(ApiRoutes.admin.teams.archive(id))).data;
export const addTeamMember = async ({ id, membership_id }: { id: string; membership_id: string }) => (await axiosInstance.post(ApiRoutes.admin.teams.members(id), { membership_id })).data;
export const removeTeamMember = async ({ id, membership_id }: { id: string; membership_id: string }) => (await axiosInstance.delete(ApiRoutes.admin.teams.member(id, membership_id))).data;
