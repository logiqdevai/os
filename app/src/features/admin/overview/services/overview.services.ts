import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { AdminOverview } from "../interfaces/overview.interfaces";

export const getOverview = async (): Promise<AdminOverview> => (await axiosInstance.get(ApiRoutes.admin.overview)).data;
