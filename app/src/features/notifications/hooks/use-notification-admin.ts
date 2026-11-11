import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
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

function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string | null, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: NOTIFICATION_ADMIN_KEY });
            qc.invalidateQueries({ queryKey: ["notifications", "event-preferences"] });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}

export const useCreateEventType = () => useAdminMutation(service.createEventType, "Event type registered", "Could not register the event type");
export const useUpdateEventType = () => useAdminMutation(service.updateEventType, "Event type saved", "Could not save the event type");
export const useDeprecateEventType = () => useAdminMutation(service.deprecateEventType, "Event type deprecated", "Could not deprecate");
export const useCreateTemplate = () => useAdminMutation(service.createTemplate, "Template saved", "Could not save the template");
export const useUpdateTemplate = () => useAdminMutation(service.updateTemplate, "New version saved", "Could not save the template");
export const useDeleteTemplate = () => useAdminMutation(service.deleteTemplate, "Template deleted", "Could not delete the template");
export const useRestoreTemplateVersion = () => useAdminMutation(service.restoreTemplateVersion, "Version restored", "Could not restore the version");
export const usePreviewTemplate = () => useMutation({ mutationFn: service.previewTemplate });
export const useSetDefault = () => useAdminMutation(service.setDefault, "Default saved", "Could not save the default");
export const useRemoveDefault = () => useAdminMutation(service.removeDefault, "Default removed", "Could not remove the default");
export const useCreateRule = () => useAdminMutation(service.createRule, "Rule created", "Could not create the rule");
export const useUpdateRule = () => useAdminMutation(service.updateRule, "Rule saved", "Could not save the rule");
export const useDeleteRule = () => useAdminMutation(service.deleteRule, "Rule deleted", "Could not delete the rule");
export const useRetryDelivery = () => useAdminMutation(service.retryDelivery, "Delivery retried", "Could not retry");
export const useUpdateOrgNotificationSettings = () => useAdminMutation(service.updateOrgSettings, "Settings saved", "Could not save the settings");
