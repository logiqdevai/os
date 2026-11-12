import { useQuery } from "@tanstack/react-query";
import { CRM_KEY, useCrmMutation } from "../../common/hooks/use-crm-invalidate";
import { reorderById } from "../../common/hooks/reorder";
import { useOptimisticMutation } from "@/lib/query/optimistic";
import type { CrmSettings, SettingKind, SettingOption } from "../interfaces/settings.interfaces";
import * as service from "../services/settings.services";

const KEY = [...CRM_KEY, "settings"] as const;
const LIST: Record<SettingKind, keyof CrmSettings> = { "lead-sources": "lead_sources", "lead-statuses": "lead_statuses", "lifecycle-stages": "lifecycle_stages", "loss-reasons": "loss_reasons" };

/** Active options (pickers). `archived=true` also returns archived ones (settings screen). */
export const useCrmSettings = (archived = false, enabled = true) =>
    useQuery({ queryKey: [...KEY, archived], queryFn: () => service.getCrmSettings(archived), staleTime: 60_000, enabled });
export const useCrmMembers = (enabled = true) => useQuery({ queryKey: [...CRM_KEY, "members"], queryFn: () => service.getCrmMembers(), staleTime: 5 * 60_000, enabled });

/** Optimistic settings write: `fn` is applied to the option list of `kind` in every cached settings object. */
function useSettingsOptimistic<TVars extends { kind: SettingKind }, TData>(mutationFn: (v: TVars) => Promise<TData>, errorTitle: string, fn: (list: SettingOption[], v: TVars) => SettingOption[]) {
    return useOptimisticMutation<TData, TVars>({
        roots: [KEY],
        alsoInvalidate: [CRM_KEY],
        meta: { errorTitle },
        mutationFn,
        apply: (qc, v) => qc.setQueriesData<CrmSettings>({ queryKey: KEY }, (d) => (d ? { ...d, [LIST[v.kind]]: fn(d[LIST[v.kind]], v) } : d)),
    });
}

export const useCreateSettingOption = () => useCrmMutation(service.createSettingOption, { errorTitle: "Could not add option" });
/** Optimistic; making an option the default clears the flag on its siblings. */
export const useUpdateSettingOption = () =>
    useSettingsOptimistic(service.updateSettingOption, "Could not update option", (list, { id, kind: _k, ...body }) =>
        list.map((o) => (o.id === id ? { ...o, ...body } : body.is_default ? { ...o, is_default: false } : o)),
    );
export const useArchiveSettingOption = () =>
    useSettingsOptimistic(service.archiveSettingOption, "Could not archive option", (list, { id, archived }) =>
        list.map((o) => (o.id === id ? { ...o, archived_at: archived ? new Date().toISOString() : null } : o)),
    );
export const useReorderSettingOptions = () => useSettingsOptimistic(service.reorderSettingOptions, "Could not reorder", (list, { ids }) => reorderById(list, ids));
