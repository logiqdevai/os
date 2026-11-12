import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { BulkActionDto, BulkResult } from "../interfaces/bulk.interfaces";

export const runBulkAction = async (dto: BulkActionDto): Promise<BulkResult> => (await axiosInstance.post(ApiRoutes.crm.bulk, dto)).data;
