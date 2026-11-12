import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { SecurityPolicy, UpdateSecurityPolicyDto } from "../interfaces/security.interfaces";

export const getSecurityPolicy = async (): Promise<SecurityPolicy> => (await axiosInstance.get(ApiRoutes.admin.securityPolicy)).data;
export const updateSecurityPolicy = async (dto: UpdateSecurityPolicyDto): Promise<SecurityPolicy> => (await axiosInstance.patch(ApiRoutes.admin.securityPolicy, dto)).data;
