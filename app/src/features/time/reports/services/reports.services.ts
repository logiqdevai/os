import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { ReportFilters, TimeSummaryReport, UnbilledReport, UtilizationReport } from "../interfaces/reports.interfaces";

const R = ApiRoutes.time.reports;

export const getSummaryReport = async (params: ReportFilters): Promise<TimeSummaryReport> => (await axiosInstance.get(R.summary, { params })).data;
export const getUtilizationReport = async (params: ReportFilters): Promise<UtilizationReport> => (await axiosInstance.get(R.utilization, { params })).data;
export const getUnbilled = async (params: Record<string, unknown>): Promise<UnbilledReport> => (await axiosInstance.get(ApiRoutes.time.unbilled, { params })).data;

/** Downloads the CSV export (the API logs it as a TimeExport and audits it). */
export async function downloadTimeCsv(params: ReportFilters) {
    const res = await axiosInstance.get(R.export, { params, responseType: "blob" });
    const disposition = String(res.headers["content-disposition"] ?? "");
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "time-entries.csv";
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return { rows: Number(res.headers["x-row-count"] ?? 0) };
}
