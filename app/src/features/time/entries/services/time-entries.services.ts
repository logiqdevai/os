import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { TimeEntry, TimeEntryDetail, TimeEntryDto, TimeEntryList, WeekGridResult, WeekGridRow } from "../interfaces/time-entries.interfaces";

const R = ApiRoutes.time.entries;

export const getTimeEntries = async (params: Record<string, unknown>): Promise<TimeEntryList> => (await axiosInstance.get(R.list, { params })).data;
export const getTimeEntry = async (id: string): Promise<TimeEntryDetail> => (await axiosInstance.get(R.detail(id))).data;
export const createTimeEntry = async (dto: TimeEntryDto): Promise<TimeEntry> => (await axiosInstance.post(R.list, dto)).data;
export const updateTimeEntry = async ({ id, ...dto }: Partial<TimeEntryDto> & { id: string }): Promise<TimeEntry> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const deleteTimeEntry = async (id: string) => (await axiosInstance.delete(R.detail(id))).data;
export const approveTimeEntry = async (id: string): Promise<TimeEntry> => (await axiosInstance.post(R.approve(id), {})).data;
export const rejectTimeEntry = async ({ id, reason }: { id: string; reason: string }): Promise<TimeEntry> => (await axiosInstance.post(R.reject(id), { reason })).data;
export const unlockTimeEntry = async ({ id, reason }: { id: string; reason: string }): Promise<TimeEntry> => (await axiosInstance.post(R.unlock(id), { reason })).data;
export const saveWeekGrid = async (dto: { period_start: string; membership_id?: string; rows: WeekGridRow[] }): Promise<WeekGridResult> =>
    (await axiosInstance.put(R.bulk, dto)).data;
