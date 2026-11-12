import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { getTeams } from "@/features/admin/teams/services/teams.services";
import type { SavedView, SaveViewDto } from "../interfaces/saved-views.interfaces";

const R = () => ApiRoutes.crm.saved_views;

export const getSavedViews = async (entity_type: string): Promise<SavedView[]> => (await axiosInstance.get(R().list, { params: { entity_type } })).data;
export const createSavedView = async (dto: SaveViewDto): Promise<SavedView> => (await axiosInstance.post(R().list, dto)).data;
export const updateSavedView = async ({ id, ...dto }: Partial<SaveViewDto> & { id: string }): Promise<SavedView> => (await axiosInstance.patch(R().detail(id), dto)).data;
export const deleteSavedView = async (id: string) => (await axiosInstance.delete(R().detail(id))).data;
/** Teams to share a view with (needs organizations.teams.read). */
export const getTeamOptions = async () => (await getTeams({ limit: 200 })).data.map((t) => ({ id: t.id, name: t.name }));
