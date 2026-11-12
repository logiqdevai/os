import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useEntityRemove, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/automation.services";
import type { ApprovalDecision, InboundWebhookStatus, JobStatus, OutboundWebhookStatus, RunDetail, RunStatus } from "../interfaces/automation.interfaces";

const KEY = ["automation"] as const;
type Params = Record<string, unknown>;

/** Runs in these states change on their own (worker), so detail views poll them. */
const LIVE_STATUSES: RunStatus[] = ["PENDING", "RUNNING", "WAITING", "AWAITING_APPROVAL", "RETRY_SCHEDULED"];

/**
 * Mutation that refreshes every automation query when it settles. No success toast (the screen shows the result);
 * a failure is toasted once by the global MutationCache with `failure` as the title (`null`: the caller shows it inline).
 */
function mutation<TVars, TData>(fn: (v: TVars) => Promise<TData>, failure: string | null) {
    return () => {
        const qc = useQueryClient();
        return useMutation({ mutationFn: fn, meta: failure ? { errorTitle: failure } : { errorToast: false }, onSettled: () => qc.invalidateQueries({ queryKey: KEY }) });
    };
}
const RULES_KEY = [...KEY, "rules"] as const;

export const useAutomationOverview = () => useQuery({ queryKey: [...KEY, "overview"], queryFn: service.getOverview });
export const useAutomationUsage = (days: number, enabled = true) => useQuery({ queryKey: [...KEY, "usage", days], queryFn: () => service.getUsage(days), enabled });
export const useTriggerCatalog = () => useQuery({ queryKey: [...KEY, "triggers"], queryFn: service.getTriggers, staleTime: 60_000 });
export const useActionCatalog = () => useQuery({ queryKey: [...KEY, "actions"], queryFn: service.getActions, staleTime: 60_000 });
export const useRuleTemplates = (params: Params = {}) => useQuery({ queryKey: [...KEY, "templates", params], queryFn: () => service.getTemplates(params) });
export const useAutomationSettings = () => useQuery({ queryKey: [...KEY, "settings"], queryFn: service.getSettings });
export const useUpdateAutomationSettings = mutation(service.updateSettings, null);

export const useRules = (params: Params) => useQuery({ queryKey: [...KEY, "rules", params], queryFn: () => service.getRules(params), placeholderData: keepPreviousData });
export const useRule = (id: string | undefined) => useQuery({ queryKey: [...KEY, "rule", id], queryFn: () => service.getRule(id as string), enabled: !!id });
export const useRuleVersions = (id: string | undefined, enabled = true) => useQuery({ queryKey: [...KEY, "rule", id, "versions"], queryFn: () => service.getRuleVersions(id as string), enabled: !!id && enabled });
export const useCreateRule = mutation(service.createRule, "Could not create the workflow");
export const useUpdateRule = mutation(service.updateRule, null);
export const useDiscardDraft = mutation(service.discardDraft, "Could not discard the draft");
export const usePublishRule = mutation(service.publishRule, "Could not publish");
/** The switch flips at once everywhere the workflow is shown; rolled back if the API refuses (e.g. not published yet). */
export const useSetRuleEnabled = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.setRuleEnabled,
        apply: (qc, { id, enabled }: { id: string; enabled: boolean }) => patchEntity(qc, KEY, id, { enabled }),
        meta: { errorTitle: "Could not change the workflow" },
    });
export const useDuplicateRule = mutation(service.duplicateRule, "Could not duplicate");
/** Archived workflows leave the lists at once (the detail shows "Archived"). */
export const useArchiveRule = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.archiveRule,
        apply: (qc, id: string) => {
            removeEntity(qc, RULES_KEY, id);
            patchEntity(qc, [...KEY, "rule", id], id, { status: "ARCHIVED", enabled: false });
        },
        meta: { errorTitle: "Could not archive" },
    });
export const useRestoreRule = mutation(service.restoreRule, "Could not restore");
export const useDeleteRule = () => useEntityRemove({ root: RULES_KEY, mutationFn: service.deleteRule, alsoInvalidate: [KEY], meta: { errorTitle: "Could not delete" } });
export const useRestoreRuleVersion = mutation(service.restoreRuleVersion, "Could not restore the version");
export const useImportRule = mutation(service.importRule, "Could not import the workflow");
export const useRunRule = mutation(service.runRule, "Could not run");
export const useTestRule = mutation(service.testRule, "Could not start the test");

export const useRuns = (params: Params, options: { enabled?: boolean } = {}) =>
    useQuery({ queryKey: [...KEY, "runs", params], queryFn: () => service.getRuns(params), placeholderData: keepPreviousData, enabled: options.enabled ?? true });
export const useRun = (id: string | undefined) =>
    useQuery({
        queryKey: [...KEY, "run", id],
        queryFn: () => service.getRun(id as string),
        enabled: !!id,
        refetchInterval: (q) => (q.state.data && LIVE_STATUSES.includes(q.state.data.status) ? 3000 : false),
    });
export const useRetryRun = mutation(service.retryRun, "Could not retry the run");
export const useCancelRun = mutation(service.cancelRun, "Could not cancel the run");
export const useApprovals = (params: Params) => useQuery({ queryKey: [...KEY, "approvals", params], queryFn: () => service.getApprovals(params), placeholderData: keepPreviousData });
type DecideVars = { id: string; decision: "APPROVED" | "REJECTED"; comment?: string };
/** The decision shows at once (list row and run detail); rolled back if the API refuses (expired, already decided…). */
export const useDecideApproval = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: (v: DecideVars) => service.decideApproval(v),
        apply: (qc, { id, decision, comment }: DecideVars) => {
            const patch = { decision: decision as ApprovalDecision, decided_at: new Date().toISOString(), ...(comment ? { comment } : {}) };
            patchEntity(qc, [...KEY, "approvals"], id, { ...patch, can_decide: false });
            // Run detail: the approval sits on its step.
            qc.setQueriesData<RunDetail>({ queryKey: [...KEY, "run"] }, (run) =>
                run?.steps ? { ...run, steps: run.steps.map((st) => (st.approval?.id === id ? { ...st, approval: { ...st.approval, ...patch } } : st)) } : run,
            );
        },
        meta: { errorTitle: "Could not decide" },
    });
export const useAutomationEvents = (params: Params) => useQuery({ queryKey: [...KEY, "events", params], queryFn: () => service.getEvents(params), placeholderData: keepPreviousData });
export const useAutomationEvent = (id: string | null) => useQuery({ queryKey: [...KEY, "event", id], queryFn: () => service.getEvent(id as string), enabled: !!id });
export const useReprocessEvent = mutation(service.reprocessEvent, "Could not reprocess");

export const useOutboundWebhooks = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "outbound", params], queryFn: () => service.getOutboundWebhooks(params), enabled });
export const useOutboundWebhook = (id: string | undefined) => useQuery({ queryKey: [...KEY, "outbound", "detail", id], queryFn: () => service.getOutboundWebhook(id as string), enabled: !!id });
export const useCreateOutboundWebhook = mutation(service.createOutboundWebhook, "Could not create the endpoint");
export const useUpdateOutboundWebhook = mutation(service.updateOutboundWebhook, "Could not save the endpoint");
export const useDeleteOutboundWebhook = () => useEntityRemove({ root: [...KEY, "outbound"], mutationFn: service.deleteOutboundWebhook, alsoInvalidate: [KEY], meta: { errorTitle: "Could not delete" } });
type OutboundActionVars = Parameters<typeof service.outboundAction>[0];
/** Pause / resume flip the status at once; rotate-secret and test are outward and wait for the API (their result is shown). */
export const useOutboundAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.outboundAction,
        apply: (qc, { id, action }: OutboundActionVars) => {
            if (action === "pause" || action === "resume") patchEntity(qc, KEY, id, { status: (action === "pause" ? "PAUSED" : "ACTIVE") as OutboundWebhookStatus });
        },
        meta: { errorTitle: "Could not update the endpoint" },
    });
export const useDeliveries = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "deliveries", params], queryFn: () => service.getDeliveries(params), placeholderData: keepPreviousData, enabled });
export const useDelivery = (id: string | null) => useQuery({ queryKey: [...KEY, "delivery", id], queryFn: () => service.getDelivery(id as string), enabled: !!id });
export const useRetryDelivery = mutation(service.retryDelivery, "Could not retry");
export const useInboundWebhooks = (enabled = true) => useQuery({ queryKey: [...KEY, "inbound"], queryFn: service.getInboundWebhooks, enabled });
export const useCreateInboundWebhook = mutation(service.createInboundWebhook, "Could not create the endpoint");
export const useUpdateInboundWebhook = mutation(service.updateInboundWebhook, null);
type InboundActionVars = Parameters<typeof service.inboundAction>[0];
/** Revoke shows at once; rotate-secret waits for the new secret. */
export const useInboundAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.inboundAction,
        apply: (qc, { id, action }: InboundActionVars) => {
            if (action === "revoke") patchEntity(qc, KEY, id, { status: "REVOKED" as InboundWebhookStatus });
        },
        meta: { errorTitle: "Could not update the endpoint" },
    });

export const useJobs = (params: Params) => useQuery({ queryKey: [...KEY, "jobs", params], queryFn: () => service.getJobs(params), placeholderData: keepPreviousData });
export const useJob = (id: string | undefined) => useQuery({ queryKey: [...KEY, "job", id], queryFn: () => service.getJob(id as string), enabled: !!id });
export const useJobRuns = (id: string | undefined, params: Params) => useQuery({ queryKey: [...KEY, "job", id, "runs", params], queryFn: () => service.getJobRuns(id as string, params), enabled: !!id, placeholderData: keepPreviousData });
export const useJobHandlers = () => useQuery({ queryKey: [...KEY, "job-handlers"], queryFn: service.getJobHandlers, staleTime: 300_000 });
export const useCreateJob = mutation(service.createJob, "Could not create the job");
export const useUpdateJob = mutation(service.updateJob, "Could not update the job");
export const useDeleteJob = () => useEntityRemove({ root: [...KEY, "jobs"], mutationFn: service.deleteJob, alsoInvalidate: [KEY], meta: { errorTitle: "Could not delete" } });
type JobActionVars = Parameters<typeof service.jobAction>[0];
/** Pause / resume flip the status at once; "Run now" is outward and waits for the API. */
export const useJobAction = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.jobAction,
        apply: (qc, { id, action }: JobActionVars) => {
            if (action === "pause" || action === "resume") patchEntity(qc, KEY, id, { status: (action === "pause" ? "PAUSED" : "ACTIVE") as JobStatus });
        },
        meta: { errorTitle: "Could not update the job" },
    });
export const usePreviewDateTrigger = () => useMutation({ mutationFn: service.previewDateTrigger, meta: { errorTitle: "Preview failed" } });
export const usePreviewSchedule = () => useMutation({ mutationFn: service.previewSchedule, meta: { errorTitle: "Invalid schedule" } });

export const useApprovalPolicies = (params: Params, enabled = true) => useQuery({ queryKey: [...KEY, "approval-policies", params], queryFn: () => service.getApprovalPolicies(params), placeholderData: keepPreviousData, enabled });
export const useApprovalPolicy = (id: string | null) => useQuery({ queryKey: [...KEY, "approval-policy", id], queryFn: () => service.getApprovalPolicy(id as string), enabled: !!id });
export const useCreateApprovalPolicy = mutation(service.createApprovalPolicy, "Could not create the policy");
export const useUpdateApprovalPolicy = mutation(service.updateApprovalPolicy, null);
/** Archive / restore: the policy leaves the current list (active or archived) at once; the detail gets archived_at. */
export const useSetApprovalPolicyArchived = () =>
    useOptimisticMutation({
        roots: [KEY],
        mutationFn: service.setApprovalPolicyArchived,
        apply: (qc, { id, archived }: { id: string; archived: boolean }) => {
            removeEntity(qc, [...KEY, "approval-policies"], id);
            patchEntity(qc, [...KEY, "approval-policy", id], id, { archived_at: archived ? new Date().toISOString() : null });
        },
        meta: { errorTitle: "Could not update the policy" },
    });
export const useScopeOptions = (search = "", enabled = true) => useQuery({ queryKey: [...KEY, "scope-options", search], queryFn: () => service.getScopeOptions(search), staleTime: 60_000, placeholderData: keepPreviousData, enabled });
export const useAgentsOverview = (days: number) => useQuery({ queryKey: [...KEY, "agents", days], queryFn: () => service.getAgentsOverview(days), placeholderData: keepPreviousData });
