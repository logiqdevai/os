import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, ListPlus, MoreHorizontal, Plus, SquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Section } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useGovernance, useGovernanceDelete, useGovernancePatch, useGovernancePost } from "@/features/projects/hooks/use-projects";
import type { ChecklistPhase, ProjectChecklist, ProjectChecklistItem } from "@/features/projects/interfaces/projects.interfaces";
import { ChecklistPhaseFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";

/**
 * Phase checklists (05 §92). Required items that are still open block project completion.
 * @perm VIEW projects.projects.read · edit / tick projects.projects.update · item → task tasks.tasks.create
 * @api /projects/:id/checklists · /checklists/:cid/items · POST /checklists/:cid/items/:iid/task
 */
/** Optimistic checklist change: rewrite the items and recount progress, so ticks, adds and deletes show at once. */
const withItems = (fn: (items: ProjectChecklistItem[]) => ProjectChecklistItem[]) => (c: ProjectChecklist): ProjectChecklist => {
    const items = fn(c.items);
    return {
        ...c,
        items,
        progress: {
            ...c.progress,
            total: items.length,
            done: items.filter((i) => i.is_completed).length,
            required_open: items.filter((i) => i.is_required && !i.is_completed).length,
        },
    };
};

export function ChecklistsSection({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
    const p = usePermissions();
    const checklists = useGovernance<ProjectChecklist[]>(projectId, "checklists");
    const toggle = useGovernancePatch("Could not update the item");
    const addItem = useGovernancePost("Could not add the item");
    const removeItem = useGovernanceDelete("Could not delete the item");
    const removeList = useGovernanceDelete("Could not delete the checklist");
    // The task link appears on the item once it is created (no toast).
    const makeTask = useGovernancePost("Could not create the task");
    const patchItem = (c: ProjectChecklist, i: ProjectChecklistItem, dto: Partial<ProjectChecklistItem>) =>
        toggle.mutate({
            id: projectId, path: `checklists/${c.id}/items/${i.id}`, dto,
            patch: { id: c.id, value: withItems((items) => items.map((x) => (x.id === i.id ? { ...x, ...dto } : x))) },
        });
    const canEdit = p.can("projects.projects.update") && !readOnly;
    const canTask = p.can("tasks.tasks.create") && !readOnly;
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<ProjectChecklist | null>(null);
    const [drafts, setDrafts] = useState<Record<string, { title: string; required: boolean }>>({});

    const add = (c: ProjectChecklist) => {
        const d = drafts[c.id];
        if (!d?.title.trim()) return;
        const title = d.title.trim();
        const temp = { id: `temp-${Date.now()}`, title, is_required: d.required, is_completed: false, task_id: null, task: null } as unknown as ProjectChecklistItem;
        // Appears at once (temporary id, replaced by the refresh); the input clears immediately for the next item.
        addItem.mutate({ id: projectId, path: `checklists/${c.id}/items`, dto: { title, is_required: d.required }, patch: { id: c.id, value: withItems((items) => [...items, temp]) } });
        setDrafts((x) => ({ ...x, [c.id]: { title: "", required: d.required } }));
    };

    return (
        <Section
            title="Checklists"
            description="Kickoff, QA, launch, handover and closeout checks. Required items block completion."
            actions={canEdit && <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus /> New checklist</Button>}
        >
            {checklists.isPending ? <ListSkeleton rows={3} /> : checklists.error ? <ErrorState error={checklists.error} onRetry={() => checklists.refetch()} /> : !checklists.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ListChecks} title="No checklists" description="Add a launch or closeout checklist so nothing is forgotten." /></div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {checklists.data.map((c) => {
                        const pct = c.progress.total ? Math.round((c.progress.done / c.progress.total) * 100) : 0;
                        const draft = drafts[c.id] ?? { title: "", required: false };
                        return (
                            <div key={c.id} className="rounded-lg border border-border bg-card">
                                <div className="flex items-start gap-2 border-b border-border-soft p-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-foreground">{c.name}</span>
                                            {c.phase && <Badge variant="neutral">{getDropdownOptionLabel(ChecklistPhaseFormOptions, c.phase)}</Badge>}
                                            {c.progress.required_open > 0 && <Badge variant="warning">{c.progress.required_open} required open</Badge>}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                            <ProgressBar value={pct} tone={pct === 100 ? "success" : "default"} className="max-w-40" />
                                            <span className="tabular">{c.progress.done}/{c.progress.total}</span>
                                        </div>
                                    </div>
                                    {canEdit && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(c)}><Trash2 /> Delete checklist</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <ul className="divide-y divide-border-soft">
                                    {c.items.map((i) => (
                                        <li key={i.id} className="flex items-center gap-2.5 px-3 py-2">
                                            <Checkbox
                                                id={`ci-${i.id}`}
                                                checked={i.is_completed}
                                                disabled={!canEdit || i.id.startsWith("temp-")}
                                                onCheckedChange={(v) => patchItem(c, i, { is_completed: v === true })}
                                                aria-label={i.title}
                                            />
                                            <label htmlFor={`ci-${i.id}`} className={cn("min-w-0 flex-1 text-[13px]", i.is_completed ? "text-muted-foreground line-through" : "text-foreground")}>{i.title}</label>
                                            {i.is_required && <Badge variant={i.is_completed ? "neutral" : "warning"}>Required</Badge>}
                                            {i.task && <Link to={`/tasks/${i.task.identifier}`} className="font-mono text-xs text-info hover:underline">{i.task.identifier}</Link>}
                                            {(canEdit || (canTask && !i.task_id)) && !i.id.startsWith("temp-") && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canTask && !i.task_id && (
                                                            <DropdownMenuItem onSelect={() => makeTask.mutate({ id: projectId, path: `checklists/${c.id}/items/${i.id}/task` })}>
                                                                <SquarePlus /> Create task
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canEdit && (
                                                            <>
                                                                <DropdownMenuItem onSelect={() => patchItem(c, i, { is_required: !i.is_required })}>
                                                                    <ListChecks /> {i.is_required ? "Make optional" : "Make required"}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => removeItem.mutate({ id: projectId, path: `checklists/${c.id}/items/${i.id}`, patch: { id: c.id, value: withItems((items) => items.filter((x) => x.id !== i.id)) } })}><Trash2 /> Delete item</DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </li>
                                    ))}
                                    {!c.items.length && <li className="px-3 py-3 text-xs text-muted-foreground">No items yet.</li>}
                                </ul>
                                {canEdit && (
                                    <form className="flex flex-col gap-2 border-t border-border-soft p-2.5 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); add(c); }}>
                                        <Input className="h-8 flex-1" placeholder="Add an item…" value={draft.title} aria-label={`New item for ${c.name}`} onChange={(e) => setDrafts((x) => ({ ...x, [c.id]: { ...draft, title: e.target.value } }))} />
                                        <div className="flex items-center gap-2">
                                            <Switch id={`req-${c.id}`} checked={draft.required} onCheckedChange={(v) => setDrafts((x) => ({ ...x, [c.id]: { ...draft, required: v } }))} />
                                            <Label htmlFor={`req-${c.id}`} className="text-xs font-normal">Required</Label>
                                            <Button type="submit" size="sm" variant="outline" disabled={!draft.title.trim()}><ListPlus /> Add</Button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            <NewChecklistDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete “${deleting?.name}”?`}
                description="The checklist and its items are removed. Linked tasks are kept."
                confirmText="Delete checklist"
                variant="destructive"
                onConfirm={() => { if (deleting) removeList.mutate({ id: projectId, path: `checklists/${deleting.id}`, removeId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}

function NewChecklistDialog({ projectId, open, onOpenChange }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useGovernancePost("Could not add the checklist");
    const [name, setName] = useState("");
    const [phase, setPhase] = useState<ChecklistPhase>("launch");
    const [items, setItems] = useState("");
    const [allRequired, setAllRequired] = useState(false);
    useEffect(() => {
        if (open) {
            setName("");
            setPhase("launch");
            setItems("");
            setAllRequired(false);
        }
    }, [open]);
    const lines = items.split("\n").map((l) => l.trim()).filter(Boolean);
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) create.mutate({ id: projectId, path: "checklists", dto: { name: name.trim(), phase, items: lines.map((title) => ({ title, is_required: allRequired })) } }, { onSuccess: () => onOpenChange(false) });
                }}>
                    <DialogHeader>
                        <DialogTitle>New checklist</DialogTitle>
                        <DialogDescription>One item per line. You can mark single items required later.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                        <div className="space-y-1.5">
                            <Label htmlFor="cl-name">Name</Label>
                            <Input id="cl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch checklist" maxLength={200} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phase</Label>
                            <Select value={phase} onValueChange={(v) => setPhase(v as ChecklistPhase)}>
                                <SelectTrigger aria-label="Phase"><SelectValue /></SelectTrigger>
                                <SelectContent>{ChecklistPhaseFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="cl-items">Items</Label>
                        <Textarea id="cl-items" rows={6} value={items} onChange={(e) => setItems(e.target.value)} placeholder={"DNS switched\nAnalytics verified\nBackups configured"} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                        <Label htmlFor="cl-req" className="font-normal">Every item is required for completion</Label>
                        <Switch id="cl-req" checked={allRequired} onCheckedChange={setAllRequired} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>Create checklist{lines.length ? ` (${lines.length})` : ""}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
