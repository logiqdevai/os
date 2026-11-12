import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import type { CustomFieldEntity } from "../interfaces/custom-fields.interfaces";
import * as service from "../services/custom-fields.services";

const KEY = [...CRM_KEY, "custom-fields"] as const;

/** Active definitions for one record type (forms, detail panels, exports). */
export const useCustomFields = (entity_type: CustomFieldEntity | undefined, enabled = true) =>
    useQuery({ queryKey: [...KEY, entity_type ?? "all"], queryFn: () => service.getCustomFields({ entity_type }), staleTime: 60_000, enabled });
/** Settings: every definition including archived ones. */
export const useAllCustomFields = () => useQuery({ queryKey: [...KEY, "all-with-archived"], queryFn: () => service.getCustomFields({ include_archived: true }) });
export const useCustomFieldGroups = (enabled = true) => useQuery({ queryKey: [...KEY, "groups"], queryFn: service.getCustomFieldGroups, staleTime: 60_000, enabled });

export const useCreateCustomField = () => useMutation({ mutationFn: service.createCustomField, onSuccess: useCrmInvalidate() });
export const useUpdateCustomField = () => useMutation({ mutationFn: service.updateCustomField, onSuccess: useCrmInvalidate() });
export const useArchiveCustomField = () => useMutation({ mutationFn: service.archiveCustomField, onSuccess: useCrmInvalidate() });
export const useRestoreCustomField = () => useMutation({ mutationFn: service.restoreCustomField, onSuccess: useCrmInvalidate() });
export const useDeleteCustomField = () => useMutation({ mutationFn: service.deleteCustomField, onSuccess: useCrmInvalidate() });
export const useReorderCustomFields = () => useMutation({ mutationFn: service.reorderCustomFields, onSuccess: useCrmInvalidate() });
export const useCreateCustomFieldGroup = () => useMutation({ mutationFn: service.createCustomFieldGroup, onSuccess: useCrmInvalidate() });
export const useUpdateCustomFieldGroup = () => useMutation({ mutationFn: service.updateCustomFieldGroup, onSuccess: useCrmInvalidate() });
export const useDeleteCustomFieldGroup = () => useMutation({ mutationFn: service.deleteCustomFieldGroup, onSuccess: useCrmInvalidate() });
