import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, personName } from "@/lib/format";
import { useAutomationSettings, useAutomationUsage, useUpdateAutomationSettings } from "@/features/automation/hooks/use-automation";
import type { UpdateAutomationSettingsDto } from "@/features/automation/interfaces/automation.interfaces";

type NumKey = "org_rate_limit_per_hour" | "default_rule_rate_limit_per_hour" | "max_trigger_depth" | "default_max_retries" | "default_retry_backoff_seconds" | "run_retention_days" | "event_retention_days" | "job_run_retention_days";

const NUMBERS: { key: NumKey; label: string; hint: string; min: number; max: number; nullable?: boolean }[] = [
    { key: "org_rate_limit_per_hour", label: "Runs per hour (organization)", hint: "New runs are skipped as rate-limited above this.", min: 1, max: 1_000_000 },
    { key: "default_rule_rate_limit_per_hour", label: "Runs per hour per workflow", hint: "Default; a workflow can set its own.", min: 1, max: 1_000_000 },
    { key: "max_trigger_depth", label: "Loop protection depth", hint: "How many workflow → event → workflow hops are allowed (1–10).", min: 1, max: 10 },
    { key: "default_max_retries", label: "Retries", hint: "Retries for transient failures before a run is dead-lettered.", min: 0, max: 20 },
    { key: "default_retry_backoff_seconds", label: "Retry backoff (seconds)", hint: "Doubles with every attempt.", min: 5, max: 86_400 },
    { key: "run_retention_days", label: "Keep run history (days)", hint: "Empty keeps forever. At least 7.", min: 7, max: 3650, nullable: true },
    { key: "event_retention_days", label: "Keep event log (days)", hint: "Empty keeps forever. At least 7.", min: 7, max: 3650, nullable: true },
    { key: "job_run_retention_days", label: "Keep job runs (days)", hint: "Empty keeps forever. At least 7.", min: 7, max: 3650, nullable: true },
];

/**
 * /automation/settings — limits, safety, retention (20 §6, §8, §10) + usage
 * @perm VIEW automation.rules.read · edit automation.settings.manage · destructive switch automation.actions.destructive.enable
 * @api GET/PATCH /automation/settings · GET /automation/usage?days=
 */
export default function AutomationSettingsPage() {
    const p = usePermissions();
    const settings = useAutomationSettings();
    const usage = useAutomationUsage(30, p.can("automation.runs.read"));
    const update = useUpdateAutomationSettings();
    const [form, setForm] = useState<Record<string, string | boolean>>({});
    const canEdit = p.can("automation.settings.manage");

    useEffect(() => {
        if (!settings.data) return;
        const s = settings.data;
        setForm({
            ...Object.fromEntries(NUMBERS.map((n) => [n.key, s[n.key] === null ? "" : String(s[n.key])])),
            destructive_actions_enabled: s.destructive_actions_enabled,
            destructive_requires_approval: s.destructive_requires_approval,
            dead_letter_alerts_enabled: s.dead_letter_alerts_enabled,
            dead_letter_alert_notify_rule_owner: s.dead_letter_alert_notify_rule_owner,
        });
    }, [settings.data]);

    if (settings.isPending) return <PageSkeleton />;
    if (settings.error) return <Page><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Page>;
    const s = settings.data;

    const save = () => {
        const dto: Record<string, unknown> = {};
        for (const n of NUMBERS) {
            const raw = String(form[n.key] ?? "");
            if (raw === "") {
                if (!n.nullable) return toast({ variant: "destructive", title: `${n.label} is required` });
                dto[n.key] = null;
                continue;
            }
            const v = Number(raw);
            if (!Number.isInteger(v) || v < n.min || v > n.max) return toast({ variant: "destructive", title: `${n.label} must be between ${n.min} and ${n.max}` });
            dto[n.key] = v;
        }
        for (const k of ["destructive_requires_approval", "dead_letter_alerts_enabled", "dead_letter_alert_notify_rule_owner"]) dto[k] = !!form[k];
        if (form.destructive_actions_enabled !== s.destructive_actions_enabled) dto.destructive_actions_enabled = !!form.destructive_actions_enabled;
        update.mutate(dto as UpdateAutomationSettingsDto, { onSuccess: () => toast({ title: "Settings saved" }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) });
    };

    const toggle = (key: string, label: string, hint: string, disabled = !canEdit) => (
        <div className="flex items-start justify-between gap-4">
            <div><div className="text-[13px] text-foreground">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
            <Switch checked={!!form[key]} onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))} disabled={disabled} aria-label={label} />
        </div>
    );

    return (
        <Page width="narrow">
            <PageHeader title="Automation settings" description={canEdit ? "Guardrails for every workflow of the organization." : "Read only — you need automation.settings.manage to change these."} />

            {usage.data && (
                <Section title="Usage (30 days)" className="mb-8">
                    <StatGrid>
                        <StatCard label="Runs" value={usage.data.runs_total} />
                        <StatCard label="Steps executed" value={usage.data.steps_total} />
                        <StatCard label="Job runs" value={usage.data.job_runs_total} />
                        <StatCard label="Webhook deliveries" value={Object.values(usage.data.deliveries_by_status).reduce((a, b) => a + (b ?? 0), 0)} />
                    </StatGrid>
                    {usage.data.top_events.length > 0 && (
                        <div className="mt-3 rounded-lg border border-border bg-card p-3">
                            <div className="mb-2 text-xs text-muted-foreground">Busiest events</div>
                            <ul className="space-y-1">
                                {usage.data.top_events.map((e) => {
                                    const max = usage.data!.top_events[0].count || 1;
                                    return (
                                        <li key={e.event_key} className="grid grid-cols-[minmax(0,1fr)_80px_40px] items-center gap-2 text-xs">
                                            <span className="truncate font-mono">{e.event_key}</span>
                                            <span className="h-1.5 rounded-full bg-secondary"><span className="block h-1.5 rounded-full bg-info" style={{ width: `${(e.count / max) * 100}%` }} /></span>
                                            <span className="text-right tabular text-muted-foreground">{e.count}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </Section>
            )}

            <div className="space-y-8">
                <Section title="Limits & retries">
                    <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                        {NUMBERS.map((n) => (
                            <div key={n.key} className="space-y-1.5">
                                <Label htmlFor={n.key}>{n.label}</Label>
                                <Input id={n.key} type="number" min={n.min} max={n.max} value={String(form[n.key] ?? "")} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, [n.key]: e.target.value }))} />
                                <p className="text-xs text-muted-foreground">{n.hint}</p>
                            </div>
                        ))}
                    </div>
                </Section>
                <Section title="Safety">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        {toggle("destructive_actions_enabled", "Allow destructive and customer-facing steps", s.destructive_actions_enabled_at ? `Enabled ${formatDateTime(s.destructive_actions_enabled_at)}${s.destructive_actions_enabled_by ? ` by ${personName(s.destructive_actions_enabled_by.user)}` : ""}.` : "Deletes, payments and sends to customers. Needs automation.actions.destructive.enable.", !canEdit || !p.can("automation.actions.destructive.enable"))}
                        {toggle("destructive_requires_approval", "Require approval for destructive steps", "The workflow owner approves each destructive step before it runs.")}
                        {toggle("dead_letter_alerts_enabled", "Alert on dead-lettered runs", "Sends a notification when a run fails after all retries.")}
                        {toggle("dead_letter_alert_notify_rule_owner", "Alert the workflow owner", "Besides the chosen recipients.")}
                        <div className="text-xs text-muted-foreground">Default service account: {s.default_service_account ? s.default_service_account.name : "none — workflows run as their owner"}</div>
                    </div>
                </Section>
                {canEdit && (
                    <div className="flex justify-end">
                        <Button onClick={save} loading={update.isPending}><Save /> Save settings</Button>
                    </div>
                )}
            </div>
        </Page>
    );
}
