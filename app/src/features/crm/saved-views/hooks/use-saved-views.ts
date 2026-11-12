import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation, useCrmRemove, useCrmUpdate, type CrmMutationMeta } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/saved-views.services";

const KEY = [...CRM_KEY, "saved-views"] as const;

export const useSavedViews = (entity_type: string) => useQuery({ queryKey: [...KEY, entity_type], queryFn: () => service.getSavedViews(entity_type), staleTime: 60_000 });
export const useTeamOptions = (enabled: boolean) => useQuery({ queryKey: [...KEY, "teams"], queryFn: service.getTeamOptions, staleTime: 5 * 60_000, enabled });

export const useCreateSavedView = (meta: CrmMutationMeta = { errorTitle: "Could not save view" }) => useCrmMutation(service.createSavedView, meta);
/** Optimistic. */
export const useUpdateSavedView = (meta: CrmMutationMeta = { errorTitle: "Could not update view" }) => useCrmUpdate(KEY, service.updateSavedView, meta);
export const useDeleteSavedView = () => useCrmRemove(KEY, service.deleteSavedView, { errorTitle: "Could not delete view" });
