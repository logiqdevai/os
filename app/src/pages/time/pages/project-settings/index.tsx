import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { useProjectTimeSettings, useTimeMembers, useUpdateProjectTimeSettings } from "@/features/time/settings/hooks/use-time-settings";
import type { ProjectTimeSettingsRow, TimeNonBillableCategory, UpdateProjectTimeSettingsDto } from "@/features/time/settings/interfaces/time-settings.interfaces";
import { NonBillableCategoryFormOptions, ProjectBillableDefaultOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { formatMinutes, personName } from "@/lib/format";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { ActivitySelect, NONE } from "../../components/pickers";

/**
 * /time/projects — per-project time settings (TimeProjectSettings): who may log, billability default, required task,
 * approver override and the budget alert. Projects without a row use the organization defaults.
 * @perm time.settings.manage · @api GET /time/project-settings · PATCH /time/project-settings/:projectId
 */
export default function ProjectTimeSettingsPage() {
    const { search, setSearch } = useListParams();
    const q = useProjectTimeSettings(search || undefined);
    const [editing, setEditing] = useState<ProjectTimeSettingsRow | null>(null);
    const orgBillable = q.data?.organization_default_billable;
    const columns: DataTableColumn<ProjectTimeSettingsRow>[] = [
        { key: "project", header: "Project", cell: (p) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{p.code ? `${p.code} · ` : ""}{p.name}</div>{p.company && <div className="truncate text-xs text-muted-foreground">{p.company.name}</div>}</div> },
        {
            key: "tracking", header: "Tracking", cell: (p) => (p.settings && !p.settings.time_tracking_enabled ? <Badge variant="neutral">Off</Badge>
                : <span className="text-xs text-muted-foreground">{p.settings?.members_only === false ? "Anyone" : "Members only"}{p.settings?.require_task ? " · task required" : ""}</span>),
        },
        {
            key: "billable", header: "Default", cell: (p) => {
                const v = p.settings?.default_billable;
                return v === null || v === undefined ? <span className="text-xs text-muted-foreground">Org ({orgBillable ? "billable" : "non-billable"})</span> : <Badge variant={v ? "success" : "neutral"}>{v ? "Billable" : "Non-billable"}</Badge>;
            }, hideBelow: "md",
        },
        {
            key: "budget", header: "Hours vs budget", cell: (p) => {
                const budget = p.budget_hours ? Number(p.budget_hours) * 60 : 0;
                return budget ? (
                    <div className="flex min-w-28 items-center gap-2"><Progress value={Math.min(100, (p.logged_minutes / budget) * 100)} className="h-1.5" /><span className="shrink-0 text-xs tabular text-muted-foreground">{Math.round((p.logged_minutes / budget) * 100)}%</span></div>
                ) : <span className="text-xs tabular text-muted-foreground">{formatMinutes(p.logged_minutes)}</span>;
            }, hideBelow: "lg",
        },
        { key: "approver", header: "Approver", cell: (p) => (p.settings?.approver ? personName(p.settings.approver.user) : <span className="text-xs text-muted-foreground">Policy</span>), hideBelow: "xl" },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-16", cell: (p) => <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button> },
    ];
    return (
        <Page>
            <PageHeader title="Project time settings" description="Override the organization rules for individual projects." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search projects…" />
            <DataTable columns={columns} data={q.data?.data} rowKey={(p) => p.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} onRowClick={setEditing}
                empty={{ icon: FolderKanban, title: "No projects", description: "Active projects appear here." }} />
            <EditDialog row={editing} onClose={() => setEditing(null)} />
        </Page>
    );
}

/** Project rules: every change autosaves (no Save button; "Done" closes) and the table row updates at once. */
function EditDialog({ row, onClose }: { row: ProjectTimeSettingsRow | null; onClose: () => void }) {
    const members = useTimeMembers("all", !!row);
    const save = useUpdateProjectTimeSettings({ inline: true });
    const [f, setF] = useState<UpdateProjectTimeSettingsDto>({});
    const [alert, setAlert] = useState("");
    const [dirty, setDirty] = useState(false);
    useEffect(() => {
        if (!row) return;
        const s = row.settings;
        setF({
            time_tracking_enabled: s?.time_tracking_enabled ?? true, members_only: s?.members_only ?? true, require_task: s?.require_task ?? false, default_billable: s?.default_billable ?? null,
            default_non_billable_category: s?.default_non_billable_category ?? null, default_activity_type_id: s?.default_activity_type_id ?? null, approver_membership_id: s?.approver_membership_id ?? null,
        });
        setAlert(s?.hours_alert_percent?.toString() ?? "");
        setDirty(false);
    }, [row]);
    const set = <K extends keyof UpdateProjectTimeSettingsDto>(k: K, v: UpdateProjectTimeSettingsDto[K]) => { setDirty(true); setF((p) => ({ ...p, [k]: v })); };
    const value = { ...f, hours_alert_percent: alert ? Number(alert) : null };
    const autosave = useAutosave({ value, enabled: !!row && dirty, save: (v) => save.mutateAsync({ projectId: row!.id, ...v }) });
    const close = () => { if (row && dirty) autosave.flush(); onClose(); };
    const billable = f.default_billable === null || f.default_billable === undefined ? "inherit" : f.default_billable ? "billable" : "non_billable";
    return (
        <Dialog open={!!row} onOpenChange={(o) => !o && close()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader><DialogTitle>{row?.name}</DialogTitle><DialogDescription>Time rules for this project. Changes save automatically.</DialogDescription><SaveStatus state={autosave} /></DialogHeader>
                <div className="space-y-4">
                    <Row label="Time tracking enabled"><Switch checked={!!f.time_tracking_enabled} onCheckedChange={(v) => set("time_tracking_enabled", v)} /></Row>
                    <Row label="Only project members can log time"><Switch checked={!!f.members_only} onCheckedChange={(v) => set("members_only", v)} /></Row>
                    <Row label="A task is required"><Switch checked={!!f.require_task} onCheckedChange={(v) => set("require_task", v)} /></Row>
                    <div className="space-y-1.5"><Label>Default billability</Label>
                        <Select value={billable} onValueChange={(v) => set("default_billable", v === "inherit" ? null : v === "billable")}><SelectTrigger aria-label="Default billability"><SelectValue /></SelectTrigger><SelectContent>{ProjectBillableDefaultOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {f.default_billable === false && (
                        <div className="space-y-1.5"><Label>Non-billable category</Label>
                            <Select value={f.default_non_billable_category ?? NONE} onValueChange={(v) => set("default_non_billable_category", v === NONE ? null : (v as TimeNonBillableCategory))}>
                                <SelectTrigger aria-label="Non-billable category"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value={NONE}>None</SelectItem>{NonBillableCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1.5"><Label>Default activity</Label><ActivitySelect value={f.default_activity_type_id ?? null} onChange={(v) => set("default_activity_type_id", v)} /></div>
                    <div className="space-y-1.5"><Label>Timesheet approver</Label>
                        <Select value={f.approver_membership_id ?? NONE} onValueChange={(v) => set("approver_membership_id", v === NONE ? null : v)}>
                            <SelectTrigger aria-label="Approver"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value={NONE}>Organization policy</SelectItem>{members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{personName(m.user)}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ps-alert">Alert at % of the hour budget</Label>
                        <Input id="ps-alert" type="number" min={1} max={500} value={alert} onChange={(e) => { setDirty(true); setAlert(e.target.value); }} className="w-28" disabled={!row?.budget_hours} />
                        <p className="text-xs text-muted-foreground">{row?.budget_hours ? `Budget ${Number(row.budget_hours)} h · logged ${formatMinutes(row.logged_minutes)}` : "Set an hour budget on the project first."}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={close}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="flex items-center justify-between gap-3 text-[13px] text-foreground"><span>{label}</span>{children}</label>;
}
