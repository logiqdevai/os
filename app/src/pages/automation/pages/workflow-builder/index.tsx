import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Save } from "lucide-react";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useServiceAccounts } from "@/features/admin/service-accounts/hooks/use-service-accounts";
import {
    useActionCatalog, useCreateRule, useInboundWebhooks, useOutboundWebhooks, usePreviewSchedule, useRule, useRuleTemplates, useScopeOptions, useTriggerCatalog, useUpdateRule,
} from "@/features/automation/hooks/use-automation";
import type { ActionEntry, ConditionGroup, RuleDefinitionFields, RuleScopeType, RuleStep, TriggerKind } from "@/features/automation/interfaces/automation.interfaces";
import { ModuleKeyOptions, RuleScopeFormOptions, SchedulePresetOptions, TriggerKindFormOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { ConditionsEditor } from "./components/conditions-editor";
import { StepCard } from "./components/step-card";
import { DateTriggerEditor } from "./components/date-trigger-editor";
import { MemberPicker } from "../../components/automation-ui";

const NONE = "__none";
const builderSchema = z.object({
    name: z.string().trim().min(1, "Give the workflow a name").max(160),
    trigger_key: z.string().min(1, "Choose a trigger"),
    actions: z.array(z.object({ key: z.string().regex(/^[a-z0-9_]{1,40}$/, "Step keys use lowercase letters, digits and _") })).min(1, "Add at least one step"),
});

const emptyDraft = (): RuleDefinitionFields => ({
    name: "",
    description: "",
    module: null,
    trigger_kind: "EVENT",
    trigger_key: "",
    trigger_config: null,
    conditions: { all: [] },
    actions: [],
    scope_type: "ORGANIZATION",
    branch_id: null,
    team_id: null,
    project_id: null,
    run_as_service_account_id: null,
    owner_membership_id: null,
    serialize_per_record: false,
    max_retries: null,
    rate_limit_per_hour: null,
    allow_destructive_actions: false,
    require_approval_for_destructive: true,
});

/**
 * /automation/workflows/new · /automation/workflows/:id/edit — form-based builder: trigger → conditions → ordered steps → settings.
 * @perm create automation.rules.create · edit automation.rules.update · run-as service account automation.service_accounts.manage · destructive automation.actions.destructive.enable
 * @api POST /automation/rules · PATCH /automation/rules/:id (published workflows save a draft) · GET /automation/triggers · GET /automation/actions
 */
export default function WorkflowBuilderPage() {
    const { id } = useParams<{ id: string }>();
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const p = usePermissions();
    const session = useSessionData();
    const rule = useRule(id);
    const triggers = useTriggerCatalog();
    const actions = useActionCatalog();
    const templates = useRuleTemplates();
    const webhooks = useOutboundWebhooks({ limit: 200 }, p.can("automation.webhooks.read"));
    const inbound = useInboundWebhooks(p.can("automation.webhooks.read"));
    const serviceAccounts = useServiceAccounts({ limit: 200 }, p.can("automation.service_accounts.manage"));
    const create = useCreateRule();
    const update = useUpdateRule();
    const preview = usePreviewSchedule();
    const [draft, setDraft] = useState<RuleDefinitionFields>(emptyDraft);
    const [loaded, setLoaded] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [templateRef, setTemplateRef] = useState<string | null>(null);
    const [projectSearch, setProjectSearch] = useState("");
    const scopeOptions = useScopeOptions(projectSearch, draft.scope_type === "TEAM" || draft.scope_type === "PROJECT");
    const [knownProject, setKnownProject] = useState<{ id: string; label: string } | null>(null);

    // Load the rule (its unpublished draft wins) or a template.
    useEffect(() => {
        if (loaded) return;
        if (id && rule.data) {
            const r = rule.data;
            setDraft({ ...emptyDraft(), ...pick(r), ...((r.draft_definition as Partial<RuleDefinitionFields>) ?? {}) });
            setLoaded(true);
        } else if (!id) {
            const tpl = sp.get("template");
            if (tpl && templates.data) {
                const t = templates.data.find((x) => x.id === tpl || x.key === tpl);
                if (t) {
                    setDraft({ ...emptyDraft(), name: t.name, description: t.description ?? "", module: t.module, ...t.definition, conditions: t.definition.conditions ?? { all: [] } });
                    setTemplateRef(t.id ?? t.key);
                }
                setLoaded(true);
            } else if (!tpl) setLoaded(true);
        }
    }, [id, rule.data, templates.data, sp, loaded]);

    // Keep the chosen project's label while the search narrows the list.
    const projectItems = useMemo(() => {
        const items = (scopeOptions.data?.projects ?? []).map((p) => ({ id: p.id, label: p.code ? `${p.code} · ${p.name}` : p.name }));
        return knownProject && !items.some((i) => i.id === knownProject.id) ? [knownProject, ...items] : items;
    }, [scopeOptions.data, knownProject]);
    useEffect(() => {
        const hit = projectItems.find((i) => i.id === draft.project_id);
        if (hit && hit.id !== knownProject?.id) setKnownProject(hit);
    }, [projectItems, draft.project_id, knownProject]);

    const set = <K extends keyof RuleDefinitionFields>(key: K, value: RuleDefinitionFields[K]) => setDraft((d) => ({ ...d, [key]: value }));
    const actionMap = useMemo(() => new Map((actions.data ?? []).map((a) => [a.key, a])), [actions.data]);
    const trigger = triggers.data?.find((t) => t.key === draft.trigger_key);
    const isPublished = rule.data?.status === "PUBLISHED";
    const canSave = id ? p.can("automation.rules.update") : p.can("automation.rules.create");
    const pending = create.isPending || update.isPending;

    if (!canSave) return <Page><NoAccessState /></Page>;
    if ((id && rule.isPending) || triggers.isPending || actions.isPending) return <PageSkeleton />;
    if (rule.error) return <Page><ErrorState error={rule.error} onRetry={() => rule.refetch()} /></Page>;
    if (triggers.error || actions.error) return <Page><ErrorState error={triggers.error ?? actions.error} /></Page>;

    const setTriggerKind = (kind: TriggerKind) => {
        const key = kind === "MANUAL" ? "manual" : kind === "SCHEDULE" ? "schedule.cron" : "";
        const config = kind === "SCHEDULE" ? { cron: "0 9 * * 1-5", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : kind === "DATE_RELATIVE" ? { offset_days: 3, direction: "before" as const } : null;
        setDraft((d) => ({ ...d, trigger_kind: kind, trigger_key: key, trigger_config: config }));
    };

    const addStep = (a: ActionEntry) => {
        const base = a.key.split(".").pop()?.replace(/[^a-z0-9_]/g, "_") ?? "step";
        let key = base;
        for (let i = 2; draft.actions.some((s) => s.key === key); i++) key = `${base}_${i}`;
        const inputs: Record<string, unknown> = {};
        a.fields.forEach((f) => { if (f.default !== undefined) inputs[f.key] = f.default; });
        set("actions", [...draft.actions, { key, action_key: a.key, inputs, on_error: "stop" }]);
    };
    const moveStep = (i: number, dir: -1 | 1) => {
        const next = [...draft.actions];
        [next[i], next[i + dir]] = [next[i + dir], next[i]];
        set("actions", next);
    };

    const save = () => {
        const parsed = builderSchema.safeParse(draft);
        const issues = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
        const keys = draft.actions.map((s) => s.key);
        if (new Set(keys).size !== keys.length) issues.push("Each step needs a unique key");
        draft.actions.forEach((s, i) => {
            const a = actionMap.get(s.action_key);
            a?.fields.filter((f) => f.required && f.type !== "conditions").forEach((f) => {
                const v = s.inputs[f.key];
                if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) issues.push(`Step ${i + 1} (${a.name}): ${f.label} is required`);
            });
            if (s.action_key === "engine.approval" && !s.inputs.policy_id && !s.inputs.approver_membership_id) issues.push(`Step ${i + 1} (${a?.name ?? "Approval"}): choose an approval policy or an approver`);
        });
        setErrors(issues);
        if (issues.length) return;

        const body: Partial<RuleDefinitionFields> = {
            ...draft,
            description: draft.description || null,
            module: draft.module || null,
            conditions: draft.conditions ?? { all: [] },
            ...(templateRef && !id ? { template_id: templateRef } : {}),
        };
        if (!p.can("automation.service_accounts.manage")) delete body.run_as_service_account_id;
        const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not save the workflow", description: getApiErrorMessage(e) });
        if (id) {
            update.mutate({ id, ...body }, {
                onSuccess: () => { toast({ title: isPublished ? "Draft saved — publish to apply it" : "Workflow saved" }); navigate(`/automation/workflows/${id}`); },
                onError,
            });
        } else {
            create.mutate(body, { onSuccess: (r) => { toast({ title: "Workflow created as a draft" }); navigate(`/automation/workflows/${r.id}`); }, onError });
        }
    };

    const eventTriggers = (triggers.data ?? []).filter((t) => t.kind === "EVENT");
    const dateTriggers = (triggers.data ?? []).filter((t) => t.kind === "DATE_RELATIVE");
    const cron = draft.trigger_config?.cron ?? "";
    const preset = SchedulePresetOptions.some((o) => o.id === cron) ? cron : "custom";

    return (
        <Page width="narrow">
            <PageHeader
                title={id ? `Edit ${rule.data?.name ?? "workflow"}` : "New workflow"}
                back={{ to: id ? `/automation/workflows/${id}` : "/automation/workflows", label: id ? "Workflow" : "Workflows" }}
                description={isPublished ? "This workflow is live. Your changes are saved as a draft and only run after you publish them." : "Workflows start as drafts. Publish and enable them to run."}
                meta={rule.data && <Badge variant={isPublished ? "success" : "warning"}>{isPublished ? `Live v${rule.data.current_version}` : "Draft"}</Badge>}
            />

            <div className="space-y-8">
                <Section title="1. Name">
                    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="wf-name">Name</Label>
                            <Input id="wf-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Deal won → kick-off task" maxLength={160} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="wf-desc">Description</Label>
                            <Textarea id="wf-desc" rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Module</Label>
                            <Select value={draft.module ?? NONE} onValueChange={(v) => set("module", v === NONE ? null : v)}>
                                <SelectTrigger aria-label="Module"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Not set</SelectItem>
                                    {ModuleKeyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Section>

                <Section title="2. Trigger" description="What starts the workflow.">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <Select value={draft.trigger_kind} onValueChange={(v) => setTriggerKind(v as TriggerKind)}>
                            <SelectTrigger aria-label="Trigger type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TriggerKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {draft.trigger_kind === "EVENT" && (
                            <EventPicker value={draft.trigger_key} onChange={(key) => set("trigger_key", key)} options={eventTriggers} />
                        )}
                        {trigger && draft.trigger_kind === "EVENT" && (
                            <p className="text-xs text-muted-foreground">
                                {trigger.description}
                                {trigger.required_permission && !trigger.can_use && <span className="text-warning"> Needs {trigger.required_permission} (or a service account you manage).</span>}
                            </p>
                        )}

                        {draft.trigger_kind === "SCHEDULE" && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label>Repeat</Label>
                                    <Select value={preset} onValueChange={(v) => set("trigger_config", { ...draft.trigger_config, cron: v === "custom" ? cron : v })}>
                                        <SelectTrigger aria-label="Repeat"><SelectValue /></SelectTrigger>
                                        <SelectContent>{SchedulePresetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="wf-cron">Cron expression</Label>
                                    <Input id="wf-cron" className="font-mono" value={cron} onChange={(e) => set("trigger_config", { ...draft.trigger_config, cron: e.target.value })} placeholder="0 9 * * 1-5" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="wf-tz">Timezone</Label>
                                    <Input id="wf-tz" value={draft.trigger_config?.timezone ?? "UTC"} onChange={(e) => set("trigger_config", { ...draft.trigger_config, timezone: e.target.value })} />
                                </div>
                                <div className="sm:col-span-2">
                                    <Button type="button" variant="outline" size="sm" loading={preview.isPending} onClick={() => preview.mutate({ kind: "CRON", cron_expression: cron, timezone: draft.trigger_config?.timezone ?? "UTC" }, { onError: (e) => toast({ variant: "destructive", title: "Invalid schedule", description: getApiErrorMessage(e) }) })}>
                                        Preview next runs
                                    </Button>
                                    {preview.data && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{preview.data.next_runs.map((d) => <li key={d}>{formatDateTime(d)}</li>)}</ul>}
                                </div>
                            </div>
                        )}

                        {draft.trigger_kind === "DATE_RELATIVE" && (
                            <DateTriggerEditor
                                triggerKey={draft.trigger_key}
                                config={draft.trigger_config}
                                options={dateTriggers}
                                onChange={(key, config) => setDraft((d) => ({ ...d, trigger_key: key, trigger_config: config }))}
                            />
                        )}

                        {draft.trigger_kind === "MANUAL" && <p className="text-[13px] text-muted-foreground">Runs when someone with automation.rules.run presses “Run now”, or through the API / MCP.</p>}

                        {draft.trigger_kind === "INBOUND_WEBHOOK" && (
                            <div className="space-y-1.5">
                                <Label>Inbound endpoint</Label>
                                <Select value={draft.trigger_key || NONE} onValueChange={(v) => set("trigger_key", v === NONE ? "" : v)}>
                                    <SelectTrigger aria-label="Inbound endpoint"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>Choose an endpoint</SelectItem>
                                        {(inbound.data ?? []).filter((h) => h.status !== "REVOKED").map((h) => <SelectItem key={h.id} value={h.event_key}>{h.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {!inbound.data?.length && <p className="text-xs text-muted-foreground">Create an inbound endpoint under Webhooks first.</p>}
                            </div>
                        )}
                    </div>
                </Section>

                <Section title="3. Conditions" description="Optional. The workflow only continues when these match the event.">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <ConditionsEditor value={draft.conditions as ConditionGroup} onChange={(c) => set("conditions", c)} fields={trigger?.fields} />
                    </div>
                </Section>

                <Section title="4. Steps" description="Run in order. Use {{event.payload.field}} or {{steps.<key>.output.id}} in text inputs.">
                    <div className="space-y-3">
                        {draft.actions.map((s, i) => (
                            <StepCard
                                key={i}
                                index={i}
                                total={draft.actions.length}
                                step={s}
                                action={actionMap.get(s.action_key)}
                                webhooks={webhooks.data?.data ?? []}
                                triggerFields={trigger?.fields ?? []}
                                onChange={(next: RuleStep) => set("actions", draft.actions.map((x, idx) => (idx === i ? next : x)))}
                                onMove={(dir) => moveStep(i, dir)}
                                onRemove={() => set("actions", draft.actions.filter((_, idx) => idx !== i))}
                            />
                        ))}
                        <ActionPicker actions={actions.data ?? []} onPick={addStep} />
                    </div>
                </Section>

                <Section title="5. Settings">
                    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Scope</Label>
                                <Select value={draft.scope_type ?? "ORGANIZATION"} onValueChange={(v) => set("scope_type", v as RuleScopeType)}>
                                    <SelectTrigger aria-label="Scope"><SelectValue /></SelectTrigger>
                                    <SelectContent>{RuleScopeFormOptions.filter((o) => o.id !== "PROJECT_TYPE").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            {draft.scope_type === "BRANCH" && (
                                <div className="space-y-1.5">
                                    <Label>Branch</Label>
                                    <Select value={draft.branch_id ?? NONE} onValueChange={(v) => set("branch_id", v === NONE ? null : v)}>
                                        <SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Choose a branch</SelectItem>
                                            {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {draft.scope_type === "TEAM" && (
                                <div className="space-y-1.5">
                                    <Label>Team</Label>
                                    <EntityPicker
                                        items={(scopeOptions.data?.teams ?? []).map((t) => ({ id: t.id, label: t.name }))}
                                        value={draft.team_id}
                                        onChange={(v) => set("team_id", v)}
                                        placeholder="Choose a team"
                                        searchPlaceholder="Search teams…"
                                        loading={scopeOptions.isPending}
                                        ariaLabel="Team"
                                        className="h-9"
                                    />
                                </div>
                            )}
                            {draft.scope_type === "PROJECT" && (
                                <div className="space-y-1.5">
                                    <Label>Project</Label>
                                    <EntityPicker
                                        items={projectItems}
                                        value={draft.project_id}
                                        onChange={(v) => set("project_id", v)}
                                        onSearch={setProjectSearch}
                                        placeholder="Choose a project"
                                        searchPlaceholder="Search projects…"
                                        emptyText="No project found (needs projects.projects.read)"
                                        loading={scopeOptions.isFetching}
                                        ariaLabel="Project"
                                        className="h-9"
                                    />
                                </div>
                            )}
                        </div>
                        {draft.scope_type && draft.scope_type !== "ORGANIZATION" && (
                            <p className="-mt-2 text-xs text-muted-foreground">
                                The workflow only runs for events that carry the matching {draft.scope_type === "BRANCH" ? "branch" : draft.scope_type === "TEAM" ? "team" : "project"} id (for example tasks of that {draft.scope_type === "PROJECT" ? "project" : "team"}). Members scoped to it can see and edit the workflow.
                            </p>
                        )}
                        <div className="space-y-1.5">
                            <Label>Owner</Label>
                            <MemberPicker value={draft.owner_membership_id ? [draft.owner_membership_id] : []} onChange={(ids) => set("owner_membership_id", ids[0] ?? null)} placeholder="You (default)" />
                            <p className="text-xs text-muted-foreground">Steps run with the owner's permissions unless a service account is set.</p>
                        </div>
                        {p.can("automation.service_accounts.manage") && (
                            <div className="space-y-1.5">
                                <Label>Run as service account</Label>
                                <Select value={draft.run_as_service_account_id ?? NONE} onValueChange={(v) => set("run_as_service_account_id", v === NONE ? null : v)}>
                                    <SelectTrigger aria-label="Run as service account"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No — run as the owner</SelectItem>
                                        {(serviceAccounts.data?.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="wf-retries">Retries on failure</Label>
                                <Input id="wf-retries" type="number" min={0} max={20} placeholder="Organization default" value={draft.max_retries ?? ""} onChange={(e) => set("max_retries", e.target.value === "" ? null : Number(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="wf-rate">Max runs per hour</Label>
                                <Input id="wf-rate" type="number" min={1} placeholder="Organization default" value={draft.rate_limit_per_hour ?? ""} onChange={(e) => set("rate_limit_per_hour", e.target.value === "" ? null : Number(e.target.value))} />
                            </div>
                        </div>
                        <ToggleRow label="One run at a time per record" hint="Runs for the same record wait for each other." checked={!!draft.serialize_per_record} onChange={(v) => set("serialize_per_record", v)} />
                        <ToggleRow
                            label="Allow destructive and customer-facing steps"
                            hint={p.can("automation.actions.destructive.enable") ? "Also needs destructive actions enabled in Automation settings." : "Needs automation.actions.destructive.enable."}
                            checked={!!draft.allow_destructive_actions}
                            disabled={!p.can("automation.actions.destructive.enable") && !draft.allow_destructive_actions}
                            onChange={(v) => set("allow_destructive_actions", v)}
                        />
                        {draft.allow_destructive_actions && (
                            <ToggleRow label="Ask the owner to approve each destructive step" checked={draft.require_approval_for_destructive !== false} onChange={(v) => set("require_approval_for_destructive", v)} />
                        )}
                    </div>
                </Section>

                {errors.length > 0 && (
                    <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-[13px] text-danger">
                        <ul className="list-inside list-disc space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
                    </div>
                )}

                <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end md:-mx-6 md:px-6">
                    <Button variant="ghost" onClick={() => navigate(id ? `/automation/workflows/${id}` : "/automation/workflows")} disabled={pending}>Cancel</Button>
                    <Button onClick={save} loading={pending}><Save /> {id ? (isPublished ? "Save draft" : "Save") : "Create workflow"}</Button>
                </div>
            </div>
        </Page>
    );
}

function pick(r: RuleDefinitionFields): Partial<RuleDefinitionFields> {
    const keys: (keyof RuleDefinitionFields)[] = ["name", "description", "module", "trigger_kind", "trigger_key", "trigger_config", "conditions", "actions", "scope_type", "branch_id", "team_id", "project_id", "owner_membership_id", "run_as_service_account_id", "serialize_per_record", "max_retries", "retry_backoff_seconds", "rate_limit_per_hour", "max_trigger_depth", "allow_destructive_actions", "require_approval_for_destructive"];
    return Object.fromEntries(keys.map((k) => [k, r[k]])) as Partial<RuleDefinitionFields>;
}

function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <div className="text-[13px] text-foreground">{label}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
        </div>
    );
}

function EventPicker({ value, onChange, options }: { value: string; onChange: (key: string) => void; options: { key: string; name: string; module: string; can_use: boolean; source: string }[] }) {
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.key === value);
    const groups = useMemo(() => {
        const map = new Map<string, typeof options>();
        options.forEach((o) => map.set(o.module, [...(map.get(o.module) ?? []), o]));
        return [...map.entries()];
    }, [options]);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Event" className="w-full justify-between font-normal">
                    <span className={cn("truncate", !value && "text-muted-foreground")}>{selected ? selected.name : value || "Choose an event"}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search events…" />
                    <CommandList>
                        <CommandEmpty>No event found</CommandEmpty>
                        {groups.map(([module, items]) => (
                            <CommandGroup key={module} heading={getDropdownOptionLabel(ModuleKeyOptions, module)}>
                                {items.map((o) => (
                                    <CommandItem key={o.key} value={`${o.name} ${o.key}`} onSelect={() => { onChange(o.key); setOpen(false); }}>
                                        <Check className={cn("size-4", value === o.key ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px]">{o.name}</div>
                                            <div className="truncate font-mono text-xs text-muted-foreground">{o.key}</div>
                                        </div>
                                        {o.source === "discovered" && <Badge variant="info">seen</Badge>}
                                        {!o.can_use && <Badge variant="neutral">no access</Badge>}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function ActionPicker({ actions, onPick }: { actions: ActionEntry[]; onPick: (a: ActionEntry) => void }) {
    const [open, setOpen] = useState(false);
    const groups = useMemo(() => {
        const map = new Map<string, ActionEntry[]>();
        actions.forEach((a) => map.set(a.module, [...(map.get(a.module) ?? []), a]));
        return [...map.entries()];
    }, [actions]);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full border-dashed"><Plus /> Add step</Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search actions…" />
                    <CommandList>
                        <CommandEmpty>No action found</CommandEmpty>
                        {groups.map(([module, items]) => (
                            <CommandGroup key={module} heading={getDropdownOptionLabel(ModuleKeyOptions, module)}>
                                {items.map((a) => (
                                    <CommandItem key={a.key} value={`${a.name} ${a.key}`} disabled={!a.available} onSelect={() => { onPick(a); setOpen(false); }}>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px]">{a.name}</div>
                                            <div className="truncate text-xs text-muted-foreground">{a.description}</div>
                                        </div>
                                        {!a.available && <Badge variant="neutral">soon</Badge>}
                                        {a.available && !a.can_use && <Badge variant="neutral">no access</Badge>}
                                        {a.is_destructive && <Badge variant="danger">destructive</Badge>}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
