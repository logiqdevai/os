import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CRM_KEY } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/insights.services";

export const useCrmDashboard = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...CRM_KEY, "dashboard", params], queryFn: () => service.getCrmDashboard(params), placeholderData: keepPreviousData });
export const useCrmForecast = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...CRM_KEY, "forecast", params], queryFn: () => service.getCrmForecast(params), placeholderData: keepPreviousData });
