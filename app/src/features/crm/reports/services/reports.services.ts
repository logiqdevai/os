import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import { downloadCsv } from "../../common/services/crm-download.services";
import type { ReportByKey, ReportKey, ReportParams } from "../interfaces/reports.interfaces";

const R = () => ApiRoutes.crm.reports;

export const getReport = async <K extends ReportKey>(key: K, params: ReportParams): Promise<ReportByKey[K]> => (await axiosInstance.get(R().run(key), { params })).data;
export const exportReport = ({ key, params }: { key: ReportKey; params: ReportParams }) => downloadCsv(R().export(key), params as Record<string, unknown>, `crm-${key}.csv`);
