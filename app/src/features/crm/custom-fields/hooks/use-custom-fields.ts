import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmPatchById, useCrmRemove, useCrmUpdate } from "../../common/hooks/use-crm-invalidate";
import { reorderById } from "../../common/hooks/reorder";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import type { CustomFieldDefinition, CustomFieldEntity } from "../interfaces/custom-fields.interfaces";
import * as service from "../services/custom-fields.services";

const KEY = [...CRM_KEY, "custom-fields"] as const;

/** Active definitions for one record type (forms, detail panels, exports). */
export const useCustomFields = (entity_type: CustomFieldEntity | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, entity_type ?? "all"], queryFn: () => service.getCustomFields({ entity_type }), staleTime: 60_000, enabled });
/** Settings: every definition including archived ones. */
export const useAllCustomFields = () => useQuery({ queryKey: [...KEY, "all-with-archived"], queryFn: () => service.getCustomFields({ include_archived: true }) });
export const useCustomFieldGroups = (enabled = true) => useQuery({ queryKey: [...KEY, "groups"], queryFn: service.getCustomFieldGroups, staleTime: 60_000, enabled });

export const useCreateCustomField = () => useCrmMutation(service.createCustomField, { errorTitle: "Could not create field" });
export const useUpdateCustomField = () => useCrmMutation(service.updateCustomField, { errorTitle: "Could not save field" });
/** Optimistic: the field moves to / out of the archived list at once. */
export const useArchiveCustomField = () => useCrmPatchById(KEY, service.archiveCustomField, () => ({ archived_at: new Date().toISOString() }), { errorTitle: "Could not archive field" });
export const useRestoreCustomField = () => useCrmPatchById(KEY, service.restoreCustomField, () => ({ archived_at: null }), { errorTitle: "Could not restore field" });
export const useDeleteCustomField = () => useCrmRemove(KEY, service.deleteCustomField, { errorTitle: "Could not delete field" });
/** Optimistic: the list takes the new order at once. */
export const useReorderCustomFields = () =>
    useOptimisticMutation({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle: "Could not reorder fields" },
        mutationFn: service.reorderCustomFields,
        apply: (qc, ids) => qc.setQueriesData<CustomFieldDefinition[]>({ queryKey: KEY }, (d) => (Array.isArray(d) && d.some((x) => "key" in x) ? reorderById(d, ids) : d)),
    });
export const useCreateCustomFieldGroup = () => useCrmMutation(service.createCustomFieldGroup, { errorTitle: "Could not add group" });
export const useUpdateCustomFieldGroup = () => useCrmUpdate(KEY, service.updateCustomFieldGroup, { errorTitle: "Could not rename group" });
export const useDeleteCustomFieldGroup = () => useCrmRemove(KEY, service.deleteCustomFieldGroup, { errorTitle: "Could not delete group" });
