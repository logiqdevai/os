import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SaveStatus } from "@/components/ui/save-status";
import { InlineText } from "@/components/ui/inline-edit";
import { useAutosave } from "@/hooks/use-autosave";
import {
    useArchiveTaskLabel,
    useArchiveTaskStatus,
    useArchiveTaskType,
    useCreateTaskLabel,
    useCreateTaskStatus,
    useCreateTaskType,
    useReorderTaskStatuses,
    useTaskLabels,
    useTaskStatuses,
    useTaskTypes,
    useUpdateTaskLabel,
    useUpdateTaskStatus,
    useWorkflows,
} from "@/features/tasks/hooks/use-tasks";
import type { TaskLabel, TaskStatus, TaskStatusCategory, TaskType } from "@/features/tasks/interfaces/tasks.interfaces";
import { TaskStatusCategoryFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { ColorTokenFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { LabelDot, StatusIcon } from "../../components/task-badges";

/**
 * /tasks/settings?tab=statuses|types|labels — workflows per team, task types and labels.
 * @perm tasks.workflows.manage · @api /task-statuses · /task-types · /task-labels
 * @audit workflow changed · type or label created, archived
 */
export default function TaskSettingsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "statuses";
    return (
        <Page width="wide">
            <PageHeader title="Task setup" description="Each team has its own workflow. Types and labels are shared by the organization." />
            <Tabs value={tab} onValueChange={(t) => setSp({ tab: t }, { replace: true })}>
                <TabsList>
                    <TabsTrigger value="statuses">Workflows</TabsTrigger>
                    <TabsTrigger value="types">Types</TabsTrigger>
                    <TabsTrigger value="labels">Labels</TabsTrigger>
                </TabsList>
                <TabsContent value="statuses" className="mt-4"><WorkflowSection /></TabsContent>
                <TabsContent value="types" className="mt-4"><TypesSection /></TabsContent>
                <TabsContent value="labels" className="mt-4"><LabelsSection /></TabsContent>
            </Tabs>
        </Page>
    );
}

function WorkflowSection() {
    const workflows = useWorkflows();
    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);
    const [team, setTeam] = useState<string>("");
    const teamId = team || teams[0]?.id || "none";
    const statuses = useTaskStatuses(teamId === "none" ? null : teamId, !workflows.isPending);
    const reorder = useReorderTaskStatuses();
    const archive = useArchiveTaskStatus();
    const [editing, setEditing] = useState<TaskStatus | null>(null);
    const [open, setOpen] = useState(false);
    const [archiving, setArchiving] = useState<TaskStatus | null>(null);
    const [replacement, setReplacement] = useState("");
    const list = statuses.data ?? [];

    const move = (i: number, dir: -1 | 1) => {
        const ids = list.map((s) => s.id);
        [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
        reorder.mutate(ids);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={teamId} onValueChange={setTeam}>
                    <SelectTrigger className="h-8 w-52" aria-label="Team workflow"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.task_key ? ` · ${t.task_key}` : ""}</SelectItem>)}
                        <SelectItem value="none">Organization (no team)</SelectItem>
                    </SelectContent>
                </Select>
                <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add status</Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {statuses.isPending ? <ListSkeleton /> : statuses.error ? <ErrorState error={statuses.error} onRetry={() => statuses.refetch()} /> : !list.length ? <EmptyState compact title="No statuses" /> : (
                    <ul className="divide-y divide-border-soft">
                        {list.map((s, i) => (
                            <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                <StatusIcon category={s.category} color={s.color} />
                                <span className="text-[13px] font-medium text-foreground">{s.name}</span>
                                {s.is_default && <span className="text-xs text-muted-foreground">Default</span>}
                                <span className="text-xs text-muted-foreground">· {getDropdownOptionLabel(TaskStatusCategoryFormOptions, s.category)}</span>
                                <span className="ml-auto text-xs text-muted-foreground tabular">{s._count?.tasks ?? 0} tasks</span>
                                <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                    <Button variant="ghost" size="icon-sm" aria-label={`Move ${s.name} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setOpen(true); }}><Pencil /></Button>
                                    <Button variant="ghost" size="icon-sm" aria-label={`Archive ${s.name}`} disabled={list.length <= 1} onClick={() => { setReplacement(list.find((x) => x.id !== s.id && x.category === s.category)?.id ?? list.find((x) => x.id !== s.id)?.id ?? ""); setArchiving(s); }}><Archive /></Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <StatusDialog open={open} onOpenChange={setOpen} status={editing} teamId={teamId === "none" ? null : teamId} all={list} />
            <Dialog open={!!archiving} onOpenChange={(o) => !o && setArchiving(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Archive "{archiving?.name}"?</DialogTitle>
                        <DialogDescription>{archiving?._count?.tasks ? `${archiving._count.tasks} tasks use it. They move to the status you choose.` : "No tasks use this status."}</DialogDescription>
                    </DialogHeader>
                    {!!archiving?._count?.tasks && (
                        <Select value={replacement} onValueChange={setReplacement}>
                            <SelectTrigger aria-label="Replacement status"><SelectValue placeholder="Move tasks to…" /></SelectTrigger>
                            <SelectContent>{list.filter((s) => s.id !== archiving.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setArchiving(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={!!archiving?._count?.tasks && !replacement}
                            onClick={() => { if (archiving) archive.mutate({ id: archiving.id, replacement_status_id: archiving._count?.tasks ? replacement : undefined }); setArchiving(null); }}
                        >
                            Archive status
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** New status (explicit "Add status") or edit one (autosaves; "Done" closes). */
function StatusDialog({ open, onOpenChange, status, teamId, all }: { open: boolean; onOpenChange: (o: boolean) => void; status: TaskStatus | null; teamId: string | null; all: TaskStatus[] }) {
    const create = useCreateTaskStatus();
    const update = useUpdateTaskStatus({ inline: true });
    const [dirty, setDirty] = useState(false);
    const touch = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };
    const [name, setName] = useState("");
    const [category, setCategory] = useState<TaskStatusCategory>("TODO");
    const [color, setColor] = useState("neutral");
    const [isDefault, setIsDefault] = useState(false);
    const [transitions, setTransitions] = useState<string[]>([]);
    const [key, setKey] = useState("");
    const k = `${open}-${status?.id ?? "new"}`;
    if (key !== k) {
        setKey(k);
        setDirty(false);
        setName(status?.name ?? "");
        setCategory(status?.category ?? "TODO");
        setColor(status?.color ?? "neutral");
        setIsDefault(status?.is_default ?? false);
        setTransitions(status?.allowed_transitions ?? []);
    }
    const pending = create.isPending;
    const dto = { name: name.trim(), category, color, is_default: isDefault, allowed_transitions: transitions };
    const autosave = useAutosave({ value: dto, enabled: open && !!status && dirty && !!dto.name, save: (v) => update.mutateAsync({ id: status!.id, ...v }) });
    const close = () => { if (status && dto.name) autosave.flush(); onOpenChange(false); };
    const save = () => {
        if (status) return close();
        create.mutate({ ...dto, team_id: teamId ?? undefined }, { onSuccess: () => onOpenChange(false) });
    };
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !pending && close())}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{status ? "Edit status" : "New status"}</DialogTitle>
                    <DialogDescription>The category drives boards, reports and cycle progress.</DialogDescription>
                    {status && <SaveStatus state={autosave} />}
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="ts-name">Name</Label><Input id="ts-name" autoFocus value={name} onChange={(e) => touch(setName)(e.target.value)} placeholder="QA" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={(v) => touch(setCategory)(v as TaskStatusCategory)}>
                                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                                <SelectContent>{TaskStatusCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Color</Label>
                            <Select value={color} onValueChange={touch(setColor)}>
                                <SelectTrigger aria-label="Color"><SelectValue /></SelectTrigger>
                                <SelectContent>{ColorTokenFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Can move to (none selected = any)</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {all.filter((s) => s.id !== status?.id).map((s) => {
                                const on = transitions.includes(s.slug);
                                return (
                                    <button key={s.id} type="button" aria-pressed={on} onClick={() => touch(setTransitions)(on ? transitions.filter((t) => t !== s.slug) : [...transitions, s.slug])} className={on ? "rounded-xs border border-info bg-info-soft px-1.5 text-xs text-info" : "rounded-xs border border-border px-1.5 text-xs text-muted-foreground"}>
                                        {s.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3"><span className="text-[13px]">Default for new tasks</span><Switch checked={isDefault} onCheckedChange={touch(setIsDefault)} aria-label="Default status" /></div>
                </div>
                <DialogFooter>
                    {status ? (
                        <Button onClick={close}>Done</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button disabled={!name.trim()} loading={pending} onClick={save}>Add status</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TypesSection() {
    const types = useTaskTypes();
    const create = useCreateTaskType();
    const archive = useArchiveTaskType();
    const [name, setName] = useState("");
    const columns: DataTableColumn<TaskType>[] = [
        { key: "name", header: "Type", cell: (t) => <span className="font-medium text-foreground">{t.name} {t.is_default && <span className="text-xs font-normal text-muted-foreground">· Default</span>}</span> },
        { key: "count", header: "Tasks", className: "tabular text-right", headerClassName: "text-right", cell: (t) => t._count?.tasks ?? 0 },
        { key: "a", header: <span className="sr-only">Actions</span>, className: "w-10", cell: (t) => <Button variant="ghost" size="icon-sm" aria-label={`Archive ${t.name}`} onClick={() => archive.mutate(t.id)}>{t.archived_at ? <RotateCcw /> : <Archive />}</Button> },
    ];
    return (
        <div className="space-y-3">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate({ name: name.trim() }, { onSuccess: () => setName("") }); }}>
                <Input className="h-8 sm:max-w-xs" placeholder="New type, e.g. Spike" value={name} onChange={(e) => setName(e.target.value)} aria-label="New type name" />
                <Button type="submit" size="sm" disabled={!name.trim()} loading={create.isPending}><Plus /> Add</Button>
            </form>
            <DataTable columns={columns} data={types.data} rowKey={(t) => t.id} loading={types.isFetching} error={types.error} onRetry={() => types.refetch()} empty={{ title: "No types" }} />
        </div>
    );
}

function LabelsSection() {
    const labels = useTaskLabels();
    const create = useCreateTaskLabel();
    const update = useUpdateTaskLabel();
    const archive = useArchiveTaskLabel();
    const [name, setName] = useState("");
    const [color, setColor] = useState("info");
    const columns: DataTableColumn<TaskLabel>[] = [
        {
            key: "name", header: "Label",
            // Rename in place: saves on blur / Enter, Esc reverts.
            cell: (l) => <span className="flex items-center gap-2 font-medium text-foreground"><LabelDot color={l.color} /><InlineText value={l.name} aria-label={`Name of ${l.name}`} maxLength={60} onSave={(name) => update.mutate({ id: l.id, name })} /></span>,
        },
        {
            key: "color", header: "Color", hideBelow: "sm",
            cell: (l) => (
                <Select value={l.color ?? "neutral"} onValueChange={(v) => update.mutate({ id: l.id, color: v })}>
                    <SelectTrigger className="h-7 w-28" aria-label={`Color of ${l.name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ColorTokenFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            ),
        },
        { key: "count", header: "Tasks", className: "tabular text-right", headerClassName: "text-right", cell: (l) => l._count?.assignments ?? 0 },
        { key: "a", header: <span className="sr-only">Actions</span>, className: "w-10", cell: (l) => <Button variant="ghost" size="icon-sm" aria-label={`Archive ${l.name}`} onClick={() => archive.mutate(l.id)}><Archive /></Button> },
    ];
    return (
        <div className="space-y-3">
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate({ name: name.trim(), color }, { onSuccess: () => setName("") }); }}>
                <Input className="h-8 sm:max-w-xs" placeholder="New label, e.g. frontend" value={name} onChange={(e) => setName(e.target.value)} aria-label="New label name" />
                <Select value={color} onValueChange={setColor}>
                    <SelectTrigger className="h-8 w-28" aria-label="Label color"><SelectValue /></SelectTrigger>
                    <SelectContent>{ColorTokenFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="submit" size="sm" disabled={!name.trim()} loading={create.isPending}><Plus /> Add</Button>
            </form>
            <DataTable columns={columns} data={labels.data} rowKey={(l) => l.id} loading={labels.isFetching} error={labels.error} onRetry={() => labels.refetch()} empty={{ title: "No labels yet" }} />
        </div>
    );
}
