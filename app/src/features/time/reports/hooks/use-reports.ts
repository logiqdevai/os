import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { TIME_KEY } from "@/features/time/settings/hooks/use-time-settings";
import type { ReportFilters } from "../interfaces/reports.interfaces";
import * as service from "../services/reports.services";

const KEY = [...TIME_KEY, "reports"] as const;

export const useSummaryReport = (params: ReportFilters, enabled = true) =>
    useQuery({ queryKey: [...KEY, "summary", params], queryFn: () => service.getSummaryReport(params), placeholderData: keepPreviousData, enabled });
export const useUtilizationReport = (params: ReportFilters, enabled = true) =>
    useQuery({ queryKey: [...KEY, "utilization", params], queryFn: () => service.getUtilizationReport(params), placeholderData: keepPreviousData, enabled });
export const useUnbilled = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "unbilled", params], queryFn: () => service.getUnbilled(params), placeholderData: keepPreviousData });
export const useDownloadTimeCsv = () => useMutation({ mutationFn: service.downloadTimeCsv });
