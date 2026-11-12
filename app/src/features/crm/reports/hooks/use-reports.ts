import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY } from "../../common/hooks/use-crm-invalidate";
import type { ReportKey, ReportParams } from "../interfaces/reports.interfaces";
import * as service from "../services/reports.services";

export const useCrmReport = <K extends ReportKey>(key: K, params: ReportParams) =>
    useQuery({ queryKey: [...CRM_KEY, "reports", key, params], queryFn: () => service.getReport(key, params), placeholderData: keepPreviousData });
export const useExportReport = () => useMutation({ mutationFn: service.exportReport });
