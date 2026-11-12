import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmArchive, useCrmMutation, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import { patchEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import type { LeadStatusRef } from "../interfaces/leads.interfaces";
import * as service from "../services/leads.services";

const KEY = [...CRM_KEY, "leads"] as const;

export const useLeads = (params: Record<string, unknown>) =>
    useQuery({ queryKey: [...KEY, "list", params], queryFn: () => service.getLeads(params), placeholderData: keepPreviousData });
export const useLead = (id: string | undefined) => useQuery({ queryKey: [...KEY, "detail", id], queryFn: () => service.getLead(id as string), enabled: !!id });
export const useConvertPreview = (id: string | undefined, enabled: boolean) =>
    useQuery({ queryKey: [...KEY, "convert-preview", id], queryFn: () => service.getConvertPreview(id as string), enabled: !!id && enabled, staleTime: 0 });

export const useCreateLead = (meta: CrmMutationMeta = { errorTitle: "Could not create lead" }) => useCrmMutation(service.createLead, meta);
/** Optimistic; pass display objects through `optimistic` (e.g. `{ owner }`). */
export const useUpdateLead = (meta: CrmMutationMeta = { errorTitle: "Could not update lead" }) => useCrmUpdate(KEY, service.updateLead, meta);
type StatusVars = Parameters<typeof service.setLeadStatus>[0] & { /** Display object of the new status (never sent). */ status?: LeadStatusRef };
/** Optimistic: the status badge changes at once. */
export const useSetLeadStatus = () =>
    useOptimisticMutation<unknown, StatusVars>({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not change the status" },
        mutationFn: ({ status: _s, ...dto }) => service.setLeadStatus(dto),
        apply: (qc, { id, status_id, status }) => patchEntity(qc, KEY, id, { status_id, ...(status ? { status } : {}) }),
    });
export const useConvertLead = () => useCrmMutation(service.convertLead, { errorTitle: "Could not convert the lead" });
export const useArchiveLead = () => useCrmArchive(KEY, service.archiveLead, { errorTitle: "Could not archive lead" });
export const useDeleteLead = () => useCrmRemove(KEY, service.deleteLead, { errorTitle: "Could not delete lead" });
export const useExportLeads = () => useMutation({ mutationFn: service.exportLeads, meta: { errorTitle: "Could not export" } });
