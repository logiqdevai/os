import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Paginated } from "@/features/time/timesheets/interfaces/timesheets.interfaces";
import type { BillingRate, BillingRateDto, UpdateBillingRateDto } from "../interfaces/rates.interfaces";

const R = ApiRoutes.time.rates;

export const getRates = async (params: Record<string, unknown>): Promise<Paginated<BillingRate>> => (await axiosInstance.get(R.list, { params })).data;
export const createRate = async (dto: BillingRateDto): Promise<BillingRate> => (await axiosInstance.post(R.list, dto)).data;
export const updateRate = async ({ id, ...dto }: UpdateBillingRateDto & { id: string }): Promise<BillingRate> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const archiveRate = async (id: string): Promise<BillingRate> => (await axiosInstance.post(R.archive(id))).data;
