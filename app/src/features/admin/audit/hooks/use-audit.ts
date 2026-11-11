import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as service from "../services/audit.services";

export const useAuditEvents = (params: Record<string, unknown>) =>
    useQuery({ queryKey: ["admin", "audit", "list", params], queryFn: () => service.getAuditEvents(params), placeholderData: keepPreviousData });

export const useAuditEvent = (id: string | null) => useQuery({ queryKey: ["admin", "audit", "detail", id], queryFn: () => service.getAuditEvent(id as string), enabled: !!id });

export const useAuditEventTypes = () => useQuery({ queryKey: ["admin", "audit", "types"], queryFn: service.getAuditEventTypes, staleTime: Infinity });
