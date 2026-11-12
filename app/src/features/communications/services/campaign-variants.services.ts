import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { CampaignVariantInput, CampaignVariantsState } from "../interfaces/communications.interfaces";

const R = ApiRoutes.communications.campaigns;

export const getCampaignVariants = async (id: string): Promise<CampaignVariantsState> => (await axiosInstance.get(R.variants(id))).data;
export const setCampaignVariants = async ({ id, variants }: { id: string; variants: CampaignVariantInput[] }): Promise<CampaignVariantsState> =>
    (await axiosInstance.put(R.variants(id), { variants })).data;
export const pickCampaignWinner = async ({ id, variantId }: { id: string; variantId: string }): Promise<CampaignVariantsState> => (await axiosInstance.post(R.winner(id, variantId))).data;
