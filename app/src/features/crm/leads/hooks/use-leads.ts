import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/leads.services";

const KEY = [...CRM_KEY, "leads"] as const;

export const useLeads = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getLeads(params), placeholderData: keepPreviousData });
export const useLead = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getLead(id as string), enabled: !!id });
export const useConvertPreview = (id: string | undefined, enabled: boolean) =>
    useQuery({ queryKey: [...KEY, "convert-preview", id], queryFn: () => service.getConvertPreview(id as string), enabled: !!id && enabled, staleTime: 0 });

export const useCreateLead = () => useMutation({ mutationFn: service.createLead, onSuccess: useCrmInvalidate() });
export const useUpdateLead = () => useMutation({ mutationFn: service.updateLead, onSuccess: useCrmInvalidate() });
export const useSetLeadStatus = () => useMutation({ mutationFn: service.setLeadStatus, onSuccess: useCrmInvalidate() });
export const useConvertLead = () => useMutation({ mutationFn: service.convertLead, onSuccess: useCrmInvalidate() });
export const useArchiveLead = () => useMutation({ mutationFn: service.archiveLead, onSuccess: useCrmInvalidate() });
export const useDeleteLead = () => useMutation({ mutationFn: service.deleteLead, onSuccess: useCrmInvalidate() });
export const useExportLeads = () => useMutation({ mutationFn: service.exportLeads });
