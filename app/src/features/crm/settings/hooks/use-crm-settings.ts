import { useMutation, useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmInvalidate } from "../../common/hooks/use-crm-invalidate";
import * as service from "../services/settings.services";

const KEY = [...CRM_KEY, "settings"] as const;

/** Active options (pickers). `archived=true` also returns archived ones (settings screen). */
export const useCrmSettings = (archived = false, enabled = true) =>
    useQuery({ queryKey: [...KEY, archived], queryFn: () => service.getCrmSettings(archived), staleTime: 60_000, enabled });
export const useCrmMembers = (enabled = true) => useQuery({ queryKey: [...CRM_KEY, "members"], queryFn: () => service.getCrmMembers(), staleTime: 5 * 60_000, enabled });

export const useCreateSettingOption = () => useMutation({ mutationFn: service.createSettingOption, onSuccess: useCrmInvalidate() });
export const useUpdateSettingOption = () => useMutation({ mutationFn: service.updateSettingOption, onSuccess: useCrmInvalidate() });
export const useArchiveSettingOption = () => useMutation({ mutationFn: service.archiveSettingOption, onSuccess: useCrmInvalidate() });
export const useReorderSettingOptions = () => useMutation({ mutationFn: service.reorderSettingOptions, onSuccess: useCrmInvalidate() });
