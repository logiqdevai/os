import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmArchive, useCrmMutation, useCrmPatchById, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/companies.services";

const KEY = [...CRM_KEY, "companies"] as const;

export const useCompanies = (params: Record<string, unknown>, enabled = true) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getCompanies(params), placeholderData: keepPreviousData, enabled });
export const useCompany = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getCompany(id as string), enabled: !!id });
export const useCompanyLookup = (search: string, enabled = true) =>
    useQuery({ queryKey: [...KEY, "lookup", search], queryFn: () => service.lookupCompanies({ search: search || undefined, limit: 20 }), enabled, placeholderData: keepPreviousData });

export const useCreateCompany = (meta: CrmMutationMeta = { errorTitle: "Could not create company" }) => useCrmMutation(service.createCompany, meta);
/** Optimistic; pass display objects through `optimistic` (e.g. `{ owner }` when sending `owner_membership_id`). */
export const useUpdateCompany = (meta: CrmMutationMeta = { errorTitle: "Could not update company" }) => useCrmUpdate(KEY, service.updateCompany, meta);
export const useArchiveCompany = () => useCrmArchive(KEY, service.archiveCompany, { errorTitle: "Could not archive company" });
export const useRestoreCompany = () => useCrmPatchById(KEY, service.restoreCompany, () => ({ archived_at: null }), { errorTitle: "Could not restore company" });
export const useDeleteCompany = () => useCrmRemove(KEY, service.deleteCompany, { errorTitle: "Could not delete company" });
export const useExportCompanies = () => useMutation({ mutationFn: service.exportCompanies, meta: { errorTitle: "Could not export" } });
