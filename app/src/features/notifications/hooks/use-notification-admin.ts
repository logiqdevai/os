import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEntityRemove, useEntityUpdate } from "@/lib/query/optimistic";
import * as service from "../services/notification-admin.services";

export const NOTIFICATION_ADMIN_KEY = ["notification-admin"] as const;
type Params = Record<string, unknown>;
const K = (...parts: unknown[]) => [...NOTIFICATION_ADMIN_KEY, ...parts];

export const useAdminEventTypes = (params: Params, enabled = true) =>
    useQuery({ queryKey: K("event-types", params), queryFn: () => service.getEventTypes(params), placeholderData: keepPreviousData, enabled });
export const useAdminEventType = (id: string | undefined) => useQuery({ queryKey: K("event-type", id), queryFn: () => service.getEventType(id as string), enabled: !!id, retry: false });
export const useAdminTemplates = (params: Params, enabled = true) =>
    useQuery({ queryKey: K("templates", params), queryFn: () => service.getTemplates(params), placeholderData: keepPreviousData, enabled });
export const useAdminTemplate = (id: string | undefined) => useQuery({ queryKey: K("template", id), queryFn: () => service.getTemplate(id as string), enabled: !!id });
export const useAdminDefaults = (enabled = true) => useQuery({ queryKey: K("defaults"), queryFn: service.getDefaults, enabled });
export const useDeliveryRules = () => useQuery({ queryKey: K("rules"), queryFn: service.getRules });
export const useDeliveries = (params: Params, enabled = true) =>
    useQuery({ queryKey: K("deliveries", params), queryFn: () => service.getDeliveries(params), placeholderData: keepPreviousData, enabled });
export const useDelivery = (id: string | undefined) => useQuery({ queryKey: K("delivery", id), queryFn: () => service.getDelivery(id as string), enabled: !!id, retry: false });
export const useEventLog = (params: Params, enabled = true) =>
    useQuery({ queryKey: K("events", params), queryFn: () => service.getEventLog(params), placeholderData: keepPreviousData, enabled });
export const useDigests = (params: Params, enabled = true) =>
    useQuery({ queryKey: K("digests", params), queryFn: () => service.getDigests(params), placeholderData: keepPreviousData, enabled });
export const useOrgNotificationSettings = () => useQuery({ queryKey: K("settings"), queryFn: service.getOrgSettings });

/**
 * Admin mutation: refreshes the admin screens and member preferences when it settles. No success toast (the screen shows
 * the result); a failure is toasted once by the global MutationCache with `failure` as the title — or, for autosaving
 * editors (`inline`), shown by their <SaveStatus /> instead.
 */
function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, failure: string, inline = false) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        meta: inline ? { errorToast: false } : { errorTitle: failure },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: NOTIFICATION_ADMIN_KEY });
            qc.invalidateQueries({ queryKey: ["notifications", "event-preferences"] });
        },
    });
}

export const useCreateEventType = () => useAdminMutation(service.createEventType, "Could not register the event type");
export const useUpdateEventType = () => useAdminMutation(service.updateEventType, "Could not save the event type");
export const useDeprecateEventType = () => useAdminMutation(service.deprecateEventType, "Could not deprecate");
export const useCreateTemplate = () => useAdminMutation(service.createTemplate, "Could not save the template");
/** Used by the autosaving template editor: errors show in its <SaveStatus />. */
export const useUpdateTemplate = () => useAdminMutation(service.updateTemplate, "Could not save the template", true);
export const useDeleteTemplate = () =>
    useEntityRemove({ root: K("templates"), mutationFn: service.deleteTemplate, alsoInvalidate: [NOTIFICATION_ADMIN_KEY], meta: { errorTitle: "Could not delete the template" } });
export const useRestoreTemplateVersion = () => useAdminMutation(service.restoreTemplateVersion, "Could not restore the version");
export const usePreviewTemplate = () => useMutation({ mutationFn: service.previewTemplate, meta: { errorTitle: "Could not render the preview" } });
/** `inline`: the autosaving default editor shows errors in its <SaveStatus />; creating an override toasts them. */
export const useSetDefault = (inline = false) => useAdminMutation(service.setDefault, "Could not save the default", inline);
/** The override leaves the table at once (module rows fall back to "Platform default" after the refresh). */
export const useRemoveDefault = () =>
    useEntityRemove({ root: K("defaults"), mutationFn: service.removeDefault, alsoInvalidate: [NOTIFICATION_ADMIN_KEY, ["notifications", "event-preferences"]], meta: { errorTitle: "Could not remove the default" } });
export const useCreateRule = () => useAdminMutation(service.createRule, "Could not create the rule");
/** Optimistic (the Active switch flips at once). `inline` for the autosaving rule editor (errors in its <SaveStatus />). */
export const useUpdateRule = (inline = false) =>
    useEntityUpdate({ root: K("rules"), mutationFn: service.updateRule, alsoInvalidate: [NOTIFICATION_ADMIN_KEY], meta: inline ? { errorToast: false } : { errorTitle: "Could not save the rule" } });
export const useDeleteRule = () =>
    useEntityRemove({ root: K("rules"), mutationFn: service.deleteRule, alsoInvalidate: [NOTIFICATION_ADMIN_KEY], meta: { errorTitle: "Could not delete the rule" } });
export const useRetryDelivery = () => useAdminMutation(service.retryDelivery, "Could not retry");
/** Autosaving settings page: errors show in its <SaveStatus />. */
export const useUpdateOrgNotificationSettings = () => useAdminMutation(service.updateOrgSettings, "Could not save the settings", true);
