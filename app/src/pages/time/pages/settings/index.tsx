import { useEffect, useState } from "react";
import { Archive, Plus, RotateCcw } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useActivityTypes, useArchiveActivityType, useCreateActivityType, useTimeSettings, useUpdateTimeSettings } from "@/features/time/settings/hooks/use-time-settings";
import type { TimeRoundingMode, TimeTrackingSettings, TimesheetApproverPolicy, UpdateTimeSettingsDto } from "@/features/time/settings/interfaces/time-settings.interfaces";
import { ApproverPolicyFormOptions, RoundingModeFormOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { Panel } from "@/pages/people/components/person";

/**
 * /time/settings — organization time rules (enforced by the API, new entries only) and activity types. Rules autosave
 * as they change (no Save button; <SaveStatus /> in the header).
 * @perm time.settings.manage · @api GET/PATCH /time/settings · /time/activity-types
 */
export default function TimeSettingsPage() {
    const q = useTimeSettings();
    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Time settings" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    return <SettingsForm settings={q.data} />;
}

function SettingsForm({ settings }: { settings: TimeTrackingSettings }) {
    const update = useUpdateTimeSettings({ inline: true });
    const [s, setS] = useState(settings);
    /** Set by the first edit; until then the form follows the server (refreshes never overwrite typing). */
    const [dirty, setDirty] = useState(false);
    useEffect(() => { if (!dirty) setS(settings); }, [settings, dirty]);
    const set = <K extends keyof TimeTrackingSettings>(k: K, v: TimeTrackingSettings[K]) => { setDirty(true); setS((prev) => ({ ...prev, [k]: v })); };
    const toggle = (k: keyof TimeTrackingSettings, label: string, hint?: string) => (
        <div className="flex items-start justify-between gap-3 py-2">
            <div><Label htmlFor={`s-${k}`} className="m-0">{label}</Label>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
            <Switch id={`s-${k}`} checked={!!s[k]} onCheckedChange={(v) => set(k, v as never)} />
        </div>
    );
    const toDto = (s: TimeTrackingSettings): UpdateTimeSettingsDto => ({
            require_approval: s.require_approval, approver_policy: s.approver_policy, lock_on_approval: s.lock_on_approval, allow_self_approval: s.allow_self_approval,
            default_billable: s.default_billable, require_billable_override_reason: s.require_billable_override_reason, rounding_increment_minutes: Number(s.rounding_increment_minutes) || 1,
            rounding_mode: s.rounding_mode, min_entry_minutes: s.min_entry_minutes ? Number(s.min_entry_minutes) : null, max_hours_per_day: s.max_hours_per_day ? Number(s.max_hours_per_day) : null,
            allow_overlapping_entries: s.allow_overlapping_entries, allow_future_entries: s.allow_future_entries, require_project: s.require_project, require_description: s.require_description,
            require_activity_type: s.require_activity_type, default_expected_hours_per_week: Number(s.default_expected_hours_per_week) || 40,
            utilization_target_percent: s.utilization_target_percent ? Number(s.utilization_target_percent) : null, utilization_billable_only: s.utilization_billable_only,
    });
    const autosave = useAutosave({ value: s, enabled: dirty, save: (v) => update.mutateAsync(toDto(v)) });
    return (
        <Page width="wide">
            <PageHeader title="Time settings" description="Rules apply to new and edited entries, never to history." actions={<SaveStatus state={autosave} />} />
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Approval">
                    {toggle("require_approval", "Timesheets need approval")}
                    <div className="space-y-1.5 py-2"><Label>Who approves</Label>
                        <Select value={s.approver_policy} onValueChange={(v) => set("approver_policy", v as TimesheetApproverPolicy)}><SelectTrigger aria-label="Who approves"><SelectValue /></SelectTrigger><SelectContent>{ApproverPolicyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {toggle("lock_on_approval", "Lock entries when approved")}
                    {toggle("allow_self_approval", "Allow approving your own timesheet")}
                </Panel>
                <Panel title="Billable">
                    {toggle("default_billable", "New entries are billable by default")}
                    {toggle("require_billable_override_reason", "Ask why when changing the default")}
                    <div className="grid gap-3 py-2 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="s-exp">Expected hours / week</Label><Input id="s-exp" type="number" min={1} max={80} value={s.default_expected_hours_per_week} onChange={(e) => set("default_expected_hours_per_week", e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="s-util">Utilization target %</Label><Input id="s-util" type="number" min={0} max={200} value={s.utilization_target_percent ?? ""} onChange={(e) => set("utilization_target_percent", e.target.value || null)} /></div>
                    </div>
                    {toggle("utilization_billable_only", "Utilization counts billable time only")}
                </Panel>
                <Panel title="Entry rules">
                    {toggle("require_project", "Project is required")}
                    {toggle("require_description", "Description is required")}
                    {toggle("require_activity_type", "Activity is required")}
                    {toggle("allow_future_entries", "Allow logging time in the future")}
                    {toggle("allow_overlapping_entries", "Allow overlapping start/end times")}
                    <div className="grid gap-3 py-2 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="s-max">Max hours per day</Label><Input id="s-max" type="number" min={1} max={24} value={s.max_hours_per_day ?? ""} onChange={(e) => set("max_hours_per_day", e.target.value || null)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="s-min">Min entry (minutes)</Label><Input id="s-min" type="number" min={1} value={s.min_entry_minutes ?? ""} onChange={(e) => set("min_entry_minutes", e.target.value ? Number(e.target.value) : null)} /></div>
                    </div>
                </Panel>
                <Panel title="Rounding">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>Mode</Label>
                            <Select value={s.rounding_mode} onValueChange={(v) => set("rounding_mode", v as TimeRoundingMode)}><SelectTrigger aria-label="Rounding mode"><SelectValue /></SelectTrigger><SelectContent>{RoundingModeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="s-inc">Increment (minutes)</Label><Input id="s-inc" type="number" min={1} max={60} value={s.rounding_increment_minutes} onChange={(e) => set("rounding_increment_minutes", Number(e.target.value))} /></div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Rounding is applied when an entry is saved or a timer stops; the original is kept in the audit log.</p>
                </Panel>
                <ActivityTypesPanel />
            </div>
        </Page>
    );
}

function ActivityTypesPanel() {
    const q = useActivityTypes(true);
    const archive = useArchiveActivityType();
    const create = useCreateActivityType();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [billable, setBillable] = useState(true);
    return (
        <Panel title="Activity types" actions={<Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus /> Add</Button>} className="lg:col-span-2">
            {q.error ? <ErrorState error={q.error} /> : (
                <ul className="divide-y divide-border">
                    {q.data?.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                            <span className="flex min-w-0 items-center gap-2 text-[13px]"><span className={t.archived_at ? "text-muted-foreground line-through" : "text-foreground"}>{t.name}</span>{t.default_billable === false && <Badge variant="secondary">Non-billable</Badge>}{t.is_default && <Badge variant="info">Default</Badge>}</span>
                            <Button size="icon-sm" variant="ghost" aria-label={t.archived_at ? `Restore ${t.name}` : `Archive ${t.name}`} onClick={() => archive.mutate({ id: t.id, restore: !!t.archived_at })}>{t.archived_at ? <RotateCcw /> : <Archive />}</Button>
                        </li>
                    ))}
                </ul>
            )}
            <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { setOpen(o); setName(""); } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>New activity type</DialogTitle><DialogDescription>E.g. Development, Design, Meeting, Support.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label htmlFor="at-name">Name</Label><Input id="at-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                        <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="at-bill" className="m-0">Billable by default</Label><Switch id="at-bill" checked={billable} onCheckedChange={setBillable} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button disabled={!name.trim()} loading={create.isPending} onClick={() => create.mutate({ name: name.trim(), default_billable: billable, ...(!billable && { default_non_billable_category: "INTERNAL" as const }) }, { onSuccess: () => { setOpen(false); setName(""); } })}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Panel>
    );
}
