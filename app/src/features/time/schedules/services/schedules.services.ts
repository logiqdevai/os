import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { ReportScheduleDto, TimeReportSchedule } from "../interfaces/schedules.interfaces";

const R = ApiRoutes.time.schedules;

export const getSchedules = async (): Promise<TimeReportSchedule[]> => (await axiosInstance.get(R.list)).data;
export const getScheduleReports = async (): Promise<{ key: string; label: string }[]> => (await axiosInstance.get(R.reports)).data;
export const createSchedule = async (dto: ReportScheduleDto): Promise<TimeReportSchedule> => (await axiosInstance.post(R.list, dto)).data;
export const updateSchedule = async ({ id, ...dto }: Partial<ReportScheduleDto> & { id: string }): Promise<TimeReportSchedule> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const deleteSchedule = async (id: string) => (await axiosInstance.delete(R.detail(id))).data;
export const runSchedule = async (id: string): Promise<{ export_id: string; row_count: number; emailed: number; error: string | null }> => (await axiosInstance.post(R.run(id))).data;

/** Downloads a stored export CSV (scheduled runs). */
export async function downloadExport(id: string) {
    const res = await axiosInstance.get(ApiRoutes.time.exportDownload(id), { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-report-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
