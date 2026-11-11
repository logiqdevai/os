import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/companies.services";

const KEY = [...CRM_KEY, "companies"] as const;

export const useCompanies = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getCompanies(params), placeholderData: keepPreviousData, enabled });
export const useCompany = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getCompany(id as string), enabled: !!id });
export const useCompanyLookup = (search: string, enabled = true) =>
    useQuery({ queryKey: [...KEY, "lookup", search], queryFn: () => service.lookupCompanies({ search: search || undefined, limit: 20 }), enabled, placeholderData: keepPreviousData });

export const useCreateCompany = () => useMutation({ mutationFn: service.createCompany, onSuccess: useCrmInvalidate() });
export const useUpdateCompany = () => useMutation({ mutationFn: service.updateCompany, onSuccess: useCrmInvalidate() });
export const useArchiveCompany = () => useMutation({ mutationFn: service.archiveCompany, onSuccess: useCrmInvalidate() });
export const useRestoreCompany = () => useMutation({ mutationFn: service.restoreCompany, onSuccess: useCrmInvalidate() });
export const useDeleteCompany = () => useMutation({ mutationFn: service.deleteCompany, onSuccess: useCrmInvalidate() });
export const useExportCompanies = () => useMutation({ mutationFn: service.exportCompanies });
