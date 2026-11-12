import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as service from "../services/automation.services";
import type { RunStatus } from "../interfaces/automation.interfaces";

const KEY = ["automation"] as const;
type Params = Record<string, unknown>;

/** Runs in these states change on their own (worker), so detail views poll them. */
const LIVE_STATUSES: RunStatus[] = ["PENDING", "RUNNING", "WAITING", "AWAITING_APPROVAL", "RETRY_SCHEDULED"];

function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: KEY });
}
/** Mutation that refreshes every automation query on success; callers add toasts in their own callbacks. */
function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
    return () => {
        const invalidate = useInvalidate();
        return useMutation({ mutationFn: fn, onSuccess: invalidate });
    };
}

export const useAutomationOverview = () => useQuery({ queryKey: [...KEY, "overview"], queryFn: service.getOverview });
export const useAutomationUsage = (days: number, enabled = true) => useQuery({ queryKey: [...KEY, "usage", days], queryFn: () => service.getUsage(days), enabled });
export const useTriggerCatalog = () => useQuery({ queryKey: [...KEY, "triggers"], queryFn: service.getTriggers, staleTime: 60_000 });
export const useActionCatalog = () => useQuery({ queryKey: [...KEY, "actions"], queryFn: service.getActions, staleTime: 60_000 });
export const useRuleTemplates = (params: Params = {}) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => service.getTemplates(params) });
export const useAutomationSettings = () => useQuery({ queryKey: [...KEY, "settings"], queryFn: service.getSettings });
export const useUpdateAutomationSettings = mutation(service.updateSettings);

export const useRules = (params: Params) => useQuery({ queryKey: [...KEY, "rules", params], queryFn: () => service.getRules(params), placeholderData: keepPreviousData });
export const useRule = (id: string | undefined) => useQuery({ queryKey: [...KEY, "rule", id], queryFn: () => service.getRule(id as string), enabled: !!id });
export const useRuleVersions = (id: string | undefined, enabled = true) => useQuery({ queryKey: [...KEY, "rule", id, "versions"], queryFn: () => service.getRuleVersions(id as string), enabled: !!id && enabled });
export const useCreateRule = mutation(service.createRule);
export const useUpdateRule = mutation(service.updateRule);
export const useDiscardDraft = mutation(service.discardDraft);
export const usePublishRule = mutation(service.publishRule);
export const useSetRuleEnabled = mutation(service.setRuleEnabled);
export const useDuplicateRule = mutation(service.duplicateRule);
export const useArchiveRule = mutation(service.archiveRule);
export const useRestoreRule = mutation(service.restoreRule);
export const useDeleteRule = mutation(service.deleteRule);
export const useRestoreRuleVersion = mutation(service.restoreRuleVersion);
export const useImportRule = mutation(service.importRule);
export const useRunRule = mutation(service.runRule);
export const useTestRule = mutation(service.testRule);

export const useRuns = (params: Params, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "runs", params], queryFn: () => service.getRuns(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });
export const useRun = (id: string | undefined) =>
    useQuery({
        queryKey: [...KEY, "run", id],
        queryFn: () => service.getRun(id as string),
        enabled: !!id,
        refetchInterval: (q) => (q.state.data && LIVE_STATUSES.includes(q.state.data.status) ? 3000 : false),
    });
export const useRetryRun = mutation(service.retryRun);
export const useCancelRun = mutation(service.cancelRun);
export const useApprovals = (params: Params) => useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData });
export const useDecideApproval = mutation(service.decideApproval);
export const useAutomationEvents = (params: Params) => useQuery({ queryKey: [...KEY, "events", params], queryFn: () => service.getEvents(params), placeholderData: keepPreviousData });
export const useAutomationEvent = (id: string | null) => useQuery({ queryKey: [...KEY, "event", id], queryFn: () => service.getEvent(id as string), enabled: !!id });
export const useReprocessEvent = mutation(service.reprocessEvent);

export const useOutboundWebhooks = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "outbound", params], queryFn: () => service.getOutboundWebhooks(params), enabled });
export const useOutboundWebhook = (id: string | undefined) => useQuery({ queryKey: [...KEY, "outbound", "detail", id], queryFn: () => service.getOutboundWebhook(id as string), enabled: !!id });
export const useCreateOutboundWebhook = mutation(service.createOutboundWebhook);
export const useUpdateOutboundWebhook = mutation(service.updateOutboundWebhook);
export const useDeleteOutboundWebhook = mutation(service.deleteOutboundWebhook);
export const useOutboundAction = mutation(service.outboundAction);
export const useDeliveries = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "deliveries", params], queryFn: () => service.getDeliveries(params), placeholderData: keepPreviousData, enabled });
export const useDelivery = (id: string | null) => useQuery({ queryKey: [...KEY, "delivery", id], queryFn: () => service.getDelivery(id as string), enabled: !!id });
export const useRetryDelivery = mutation(service.retryDelivery);
export const useInboundWebhooks = (enabled = true) => useQuery({ queryKey: [...KEY, "inbound"], queryFn: service.getInboundWebhooks, enabled });
export const useCreateInboundWebhook = mutation(service.createInboundWebhook);
export const useUpdateInboundWebhook = mutation(service.updateInboundWebhook);
export const useInboundAction = mutation(service.inboundAction);

export const useJobs = (params: Params) => useQuery({ queryKey: [...KEY, "jobs", params], queryFn: () => service.getJobs(params), placeholderData: keepPreviousData });
export const useJob = (id: string | undefined) => useQuery({ queryKey: [...KEY, "job", id], queryFn: () => service.getJob(id as string), enabled: !!id });
export const useJobRuns = (id: string | undefined, params: Params) => useQuery({ queryKey: [...KEY, "job", id, "runs", params], queryFn: () => service.getJobRuns(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useJobHandlers = () => useQuery({ queryKey: [...KEY, "job-handlers"], queryFn: service.getJobHandlers, staleTime: 300_000 });
export const useCreateJob = mutation(service.createJob);
export const useUpdateJob = mutation(service.updateJob);
export const useDeleteJob = mutation(service.deleteJob);
export const useJobAction = mutation(service.jobAction);
export const usePreviewDateTrigger = () => useMutation({ mutationFn: service.previewDateTrigger });
export const usePreviewSchedule = () => useMutation({ mutationFn: service.previewSchedule });

export const useApprovalPolicies = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "approval-policies", params], queryFn: () => service.getApprovalPolicies(params), placeholderData: keepPreviousData, enabled });
export const useApprovalPolicy = (id: string | null) => useQuery({ queryKey: [...KEY, "approval-policy", id], queryFn: () => service.getApprovalPolicy(id as string), enabled: !!id });
export const useCreateApprovalPolicy = mutation(service.createApprovalPolicy);
export const useUpdateApprovalPolicy = mutation(service.updateApprovalPolicy);
export const useSetApprovalPolicyArchived = mutation(service.setApprovalPolicyArchived);
export const useScopeOptions = (search = "", enabled = true) => useQuery({ queryKey: [...KEY, "scope-options", search], queryFn: () => service.getScopeOptions(search), staleTime: 60_000, placeholderData: keepPreviousData, enabled });
export const useAgentsOverview = (days: number) => useQuery({ queryKey: [...KEY, "agents", days], queryFn: () => service.getAgentsOverview(days), placeholderData: keepPreviousData });
