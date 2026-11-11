import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { OrganizationModuleRow, OrganizationProfile, UpdateBrandingDto, UpdateOrganizationDto } from "../interfaces/organization.interfaces";

const R = ApiRoutes.admin.organization;

export const getOrganization = async (): Promise<OrganizationProfile> => (await axiosInstance.get(R.profile)).data;
export const updateOrganization = async (dto: UpdateOrganizationDto): Promise<OrganizationProfile> => (await axiosInstance.patch(R.profile, dto)).data;
export const updateBranding = async (dto: UpdateBrandingDto): Promise<OrganizationProfile> => (await axiosInstance.patch(R.branding, dto)).data;
export const getModules = async (): Promise<OrganizationModuleRow[]> => (await axiosInstance.get(R.modules)).data;
export const setModule = async ({ module, enabled }: { module: string; enabled: boolean }) => (await axiosInstance.put(R.module(module), { enabled })).data;
