import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    ActionEntry, ApprovalRow, AutomationOverview, AutomationSettings, AutomationUsage, CreateInboundWebhookDto, CreateJobDto, CreateOutboundWebhookDto,
    InboundWebhook, JobHandler, JobRun, OutboundWebhook, Paginated, PlatformEventDetail, PlatformEventRow, Rule, RuleDefinitionFields, RuleListItem,
    RuleTemplate, RuleVersion, RunDetail, RunListItem, RunMode, ScheduledJob, TriggerEntry, UpdateAutomationSettingsDto, WebhookDelivery, WebhookDeliveryDetail,
} from "../interfaces/automation.interfaces";

const R = () => ApiRoutes.automation;
type Params = Record<string, unknown>;
const get = async <T,>(url: string, params?: Params): Promise<T> => (await axiosInstance.get(url, { params })).data;
const post = async <T,>(url: string, body?: unknown): Promise<T> => (await axiosInstance.post(url, body ?? {})).data;
const patch = async <T,>(url: string, body: unknown): Promise<T> => (await axiosInstance.patch(url, body)).data;
const del = async <T,>(url: string): Promise<T> => (await axiosInstance.delete(url)).data;

// Catalog, overview, settings
export const getOverview = () => get<AutomationOverview>(R().overview);
export const getUsage = (days: number) => get<AutomationUsage>(R().usage, { days });
export const getTriggers = () => get<TriggerEntry[]>(R().triggers);
export const getActions = () => get<ActionEntry[]>(R().actions);
export const getTemplates = (params: Params = {}) => get<RuleTemplate[]>(R().templates, params);
export const getSettings = () => get<AutomationSettings>(R().settings);
export const updateSettings = (dto: UpdateAutomationSettingsDto) => patch<AutomationSettings>(R().settings, dto);

// Rules
export const getRules = (params: Params) => get<Paginated<RuleListItem>>(R().rules.list, params);
export const getRule = (id: string) => get<Rule>(R().rules.detail(id));
export const createRule = (dto: Partial<RuleDefinitionFields>) => post<Rule>(R().rules.list, dto);
export const updateRule = ({ id, ...dto }: Partial<RuleDefinitionFields> & { id: string }) => patch<Rule>(R().rules.detail(id), dto);
export const discardDraft = (id: string) => post<Rule>(R().rules.discardDraft(id));
export const publishRule = ({ id, change_summary }: { id: string; change_summary?: string }) => post<Rule>(R().rules.publish(id), { change_summary });
export const setRuleEnabled = ({ id, enabled }: { id: string; enabled: boolean }) => post<Rule>(enabled ? R().rules.enable(id) : R().rules.disable(id));
export const duplicateRule = (id: string) => post<Rule>(R().rules.duplicate(id));
export const archiveRule = (id: string) => post<Rule>(R().rules.archive(id));
export const restoreRule = (id: string) => post<Rule>(R().rules.restore(id));
export const deleteRule = (id: string) => del<{ success: boolean }>(R().rules.detail(id));
export const getRuleVersions = (id: string) => get<RuleVersion[]>(R().rules.versions(id));
export const restoreRuleVersion = ({ id, version }: { id: string; version: number }) => post<Rule>(R().rules.restoreVersion(id, version));
export const exportRule = (id: string) => get<Record<string, unknown>>(R().rules.export(id));
export const importRule = (rule: Record<string, unknown>) => post<Rule>(R().rules.import, { rule });
export const runRule = ({ id, payload }: { id: string; payload?: Record<string, unknown> }) => post<RunListItem>(R().rules.run(id), { payload });
export const testRule = ({ id, mode, payload }: { id: string; mode: RunMode; payload?: Record<string, unknown> }) => post<RunListItem>(R().rules.test(id), { mode, payload });

// Runs, approvals, events
export const getRuns = (params: Params) => get<Paginated<RunListItem>>(R().runs.list, params);
export const getRun = (id: string) => get<RunDetail>(R().runs.detail(id));
export const retryRun = (id: string) => post<{ id: string }>(R().runs.retry(id));
export const cancelRun = (id: string) => post<{ id: string }>(R().runs.cancel(id));
export const getApprovals = (params: Params) => get<Paginated<ApprovalRow>>(R().approvals.list, params);
export const decideApproval = ({ id, decision, comment }: { id: string; decision: "APPROVED" | "REJECTED"; comment?: string }) => post(R().approvals.decide(id), { decision, comment });
export const getEvents = (params: Params) => get<Paginated<PlatformEventRow>>(R().events.list, params);
export const getEvent = (id: string) => get<PlatformEventDetail>(R().events.detail(id));
export const reprocessEvent = (id: string) => post<{ runs_started: number }>(R().events.reprocess(id));

// Webhooks
export const getOutboundWebhooks = (params: Params) => get<Paginated<OutboundWebhook>>(R().webhooks.outbound, params);
export const createOutboundWebhook = (dto: CreateOutboundWebhookDto) => post<OutboundWebhook>(R().webhooks.outbound, dto);
export const updateOutboundWebhook = ({ id, ...dto }: Partial<CreateOutboundWebhookDto> & { id: string }) => patch<OutboundWebhook>(R().webhooks.outboundDetail(id), dto);
export const deleteOutboundWebhook = (id: string) => del(R().webhooks.outboundDetail(id));
export const outboundAction = ({ id, action }: { id: string; action: "pause" | "resume" | "rotate-secret" | "test" }) => post<{ secret?: string; status?: string; response_status_code?: number | null; error_message?: string | null }>(R().webhooks.outboundAction(id, action));
export const getDeliveries = (params: Params) => get<Paginated<WebhookDelivery>>(R().webhooks.deliveries, params);
export const getDelivery = (id: string) => get<WebhookDeliveryDetail>(R().webhooks.delivery(id));
export const retryDelivery = (id: string) => post<WebhookDelivery>(R().webhooks.retryDelivery(id));
export const getInboundWebhooks = () => get<InboundWebhook[]>(R().webhooks.inbound);
export const createInboundWebhook = (dto: CreateInboundWebhookDto) => post<InboundWebhook>(R().webhooks.inbound, dto);
export const inboundAction = ({ id, action }: { id: string; action: "rotate-secret" | "revoke" }) => post<InboundWebhook>(R().webhooks.inboundAction(id, action));

// Jobs
export const getJobs = (params: Params) => get<Paginated<ScheduledJob>>(R().jobs.list, params);
export const getJob = (id: string) => get<ScheduledJob>(R().jobs.detail(id));
export const getJobRuns = (id: string, params: Params) => get<Paginated<JobRun>>(R().jobs.runs(id), params);
export const getJobHandlers = () => get<JobHandler[]>(R().jobs.handlers);
export const createJob = (dto: CreateJobDto) => post<ScheduledJob>(R().jobs.list, dto);
export const updateJob = ({ id, ...dto }: Partial<CreateJobDto> & { id: string }) => patch<ScheduledJob>(R().jobs.detail(id), dto);
export const deleteJob = (id: string) => del(R().jobs.detail(id));
export const jobAction = ({ id, action }: { id: string; action: "pause" | "resume" | "run-now" }) => post<ScheduledJob>(R().jobs.action(id, action));
export const previewSchedule = (dto: { kind: string; cron_expression?: string; interval_seconds?: number; timezone?: string }) => post<{ next_runs: string[] }>(R().jobs.preview, dto);
