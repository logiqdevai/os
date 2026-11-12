import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowDown, ArrowUp, Play, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiChecklistAssigneeFormOptions, WikiChecklistKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useArchiveChecklist, useChecklist, useReplaceChecklistItems, useStartChecklistRun, useUpdateChecklist } from "@/features/docs/hooks/use-docs";
import type { ChecklistItemInput, WikiChecklistAssigneeKind } from "@/features/docs/interfaces/docs.interfaces";
import { DocsMemberPicker } from "../../components/docs-ui";

/** An item being edited: `_key` is a client-only key so new items keep their identity until the server gives them an id. */
type DraftItem = ChecklistItemInput & { _key: string };
let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const toInput = ({ _key: _k, ...it }: DraftItem): ChecklistItemInput => ({ ...it, title: it.title.trim() });

/**
 * /docs/checklists/:id — edit items, start a run for a member (15 §7)
 * Items autosave (PUT replaces the list; no Save button); items without a title wait until they get one.
 * @perm VIEW docs.pages.read · edit/start docs.checklists.manage
 * @api GET /docs/checklists/:id · PATCH · PUT /docs/checklists/:id/items · POST /docs/checklists/:id/runs · POST …/archive
 */
export default function ChecklistDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const checklist = useChecklist(id);
    const canManage = usePermission("docs.checklists.manage");
    const replace = useReplaceChecklistItems();
    const update = useUpdateChecklist();
    const start = useStartChecklistRun();
    const archive = useArchiveChecklist();
    const [items, setItems] = useState<DraftItem[]>([]);
    const [dirty, setDirty] = useState(false);
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const [startOpen, setStartOpen] = useState(false);
    const [subject, setSubject] = useState<string[]>([]);
    const [dueAt, setDueAt] = useState("");
    const [archiving, setArchiving] = useState(false);

    // Load the items once per checklist: refetches after an autosave must not overwrite what is being edited.
    const loadedId = useRef<string | null>(null);
    useEffect(() => {
        const data = checklist.data;
        if (!data?.items || loadedId.current === data.id) return;
        loadedId.current = data.id;
        setItems(data.items.map((i) => ({ _key: i.id, id: i.id, title: i.title, description: i.description ?? undefined, page_id: i.page_id ?? undefined, form_id: i.form_id ?? undefined, due_offset_days: i.due_offset_days ?? undefined, assignee_kind: i.assignee_kind, assignee_membership_id: i.assignee_membership_id ?? undefined, is_required: i.is_required, requires_acknowledgement: i.requires_acknowledgement })));
        setDirty(false);
    }, [checklist.data]);

    // Autosave the list. The compared value leaves out server ids, so adopting the new ids does not trigger another save.
    const untitled = items.some((i) => !i.title.trim());
    const compared = useMemo(() => items.map(({ _key: _k, id: _id, ...it }) => it), [items]);
    const autosave = useAutosave({
        value: compared,
        enabled: canManage && dirty && !untitled,
        save: async () => {
            const sent = itemsRef.current;
            const saved = await replace.mutateAsync({ id, items: sent.map(toInput) });
            // New items get their server id (matched by position in the list that was sent).
            const ids = new Map(sent.map((it, i) => [it._key, it.id ?? saved.items?.[i]?.id]));
            setItems((list) => (list.some((it) => !it.id && ids.get(it._key)) ? list.map((it) => (it.id ? it : { ...it, id: ids.get(it._key) })) : list));
        },
    });
    const saving = autosave.status === "pending" || autosave.status === "saving";

    if (checklist.isPending) return <PageSkeleton />;
    if (checklist.error) return <Page><ErrorState error={checklist.error} onRetry={() => checklist.refetch()} /></Page>;
    const c = checklist.data;
    const edit = (i: number, patch: Partial<ChecklistItemInput>) => { setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it))); setDirty(true); };
    const move = (i: number, d: -1 | 1) => { setItems((list) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; }); setDirty(true); };


    return (
        <Page width="narrow">
            <PageHeader
                back={{ to: "/docs/checklists", label: "Checklists" }}
                title={c.name}
                description={c.description ?? undefined}
                meta={<><Badge variant={c.kind === "ONBOARDING" ? "info" : "violet"}>{getDropdownOptionLabel(WikiChecklistKindFormOptions, c.kind)}</Badge>{c.archived_at && <Badge variant="neutral">Archived</Badge>}</>}
                actions={canManage && !c.archived_at && (
                    <>
                        <Button variant="outline" onClick={() => setArchiving(true)}><Archive /> Archive</Button>
                        <Button onClick={() => { setSubject([]); setDueAt(""); setStartOpen(true); }} disabled={!items.length || untitled || saving}><Play /> Start for a member</Button>
                    </>
                )}
            />
            {canManage && (
                <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
                    <div><div className="text-[13px] text-foreground">Active</div><div className="text-xs text-muted-foreground">Inactive checklists cannot be started.</div></div>
                    <Switch checked={c.is_active} onCheckedChange={(v) => update.mutate({ id, is_active: v })} aria-label="Active" />
                </div>
            )}
            <Section title="Items" description="Each run copies these items; due dates count from the run start. Changes save automatically." actions={canManage && <><SaveStatus state={autosave} /><Button size="sm" variant="outline" onClick={() => { setItems((l) => [...l, { _key: newKey(), title: "", assignee_kind: "SUBJECT", is_required: true }]); setDirty(true); }}><Plus /> Add item</Button></>}>
                {!items.length ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState compact title="No items yet" description="Add the steps a new member (or their manager) completes." /></div>
                ) : (
                    <ol className="space-y-2">
                        {items.map((it, i) => (
                            <li key={it._key} className="space-y-3 rounded-lg border border-border bg-card p-3">
                                <div className="flex items-center gap-2">
                                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs tabular">{i + 1}</span>
                                    <Input value={it.title} onChange={(e) => edit(i, { title: e.target.value })} placeholder="Set up laptop and accounts" disabled={!canManage} aria-label={`Item ${i + 1} title`} />
                                    {canManage && (
                                        <div className="flex shrink-0">
                                            <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => { setItems((l) => l.filter((_, idx) => idx !== i)); setDirty(true); }}><Trash2 /></Button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Done by</Label>
                                        <Select value={it.assignee_kind ?? "SUBJECT"} onValueChange={(v) => edit(i, { assignee_kind: v as WikiChecklistAssigneeKind })} disabled={!canManage}>
                                            <SelectTrigger className="h-8" aria-label="Done by"><SelectValue /></SelectTrigger>
                                            <SelectContent>{WikiChecklistAssigneeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs" htmlFor={`due-${i}`}>Due after (days)</Label>
                                        <Input id={`due-${i}`} className="h-8" inputMode="numeric" value={it.due_offset_days ?? ""} onChange={(e) => edit(i, { due_offset_days: e.target.value === "" ? undefined : Number(e.target.value) || 0 })} disabled={!canManage} />
                                    </div>
                                    <label className="flex items-center gap-2 self-end pb-1.5 text-xs text-muted-foreground">
                                        <Switch checked={it.is_required !== false} onCheckedChange={(v) => edit(i, { is_required: v })} disabled={!canManage} aria-label="Required" /> Required
                                    </label>
                                </div>
                                {it.assignee_kind === "SPECIFIC_MEMBER" && <DocsMemberPicker value={it.assignee_membership_id} onChange={(mid) => edit(i, { assignee_membership_id: mid })} disabled={!canManage} />}
                            </li>
                        ))}
                    </ol>
                )}
                {canManage && untitled && <p role="alert" className="mt-3 text-xs text-warning">Every item needs a title — changes are saved once it has one.</p>}
            </Section>

            <Dialog open={startOpen} onOpenChange={(o) => !start.isPending && setStartOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Start “{c.name}”</DialogTitle><DialogDescription>Creates a run with every item for the chosen member.</DialogDescription></DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5"><Label>Member</Label><DocsMemberPicker value={subject[0]} onChange={(mid) => setSubject(mid ? [mid] : [])} /></div>
                        <div className="space-y-1.5"><Label htmlFor="run-due">Due date (optional)</Label><Input id="run-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setStartOpen(false)} disabled={start.isPending}>Cancel</Button>
                        <Button disabled={!subject.length} loading={start.isPending} onClick={() => start.mutate({ id, subject_membership_id: subject[0], due_at: dueAt ? new Date(dueAt).toISOString() : undefined }, { onSuccess: (r) => navigate(`/docs/checklist-runs/${r.id}`) })}>Start</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog isOpen={archiving} onClose={() => setArchiving(false)} title={`Archive ${c.name}?`} description="Running checklists continue; it can no longer be started." confirmText="Archive" variant="destructive" onConfirm={() => { archive.mutate(id); setArchiving(false); }} />
        </Page>
    );
}
