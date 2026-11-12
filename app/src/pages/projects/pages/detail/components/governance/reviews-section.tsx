import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessagesSquare, MoreHorizontal, Pencil, Plus, SquarePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useGovernance, useGovernanceDelete, useGovernancePatch, useGovernancePost } from "@/features/projects/hooks/use-projects";
import type { ProjectReview, ProjectReviewType, ReviewActionItem } from "@/features/projects/interfaces/projects.interfaces";
import { ReviewTypeFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { PersonPicker } from "../../../../components/project-pickers";

const RETRO: ProjectReviewType[] = ["RETROSPECTIVE", "POST_PROJECT"];

/**
 * Reviews and retrospectives (05 §48–49). Actions can become Tasks (06).
 * @perm VIEW projects.projects.read · record / edit projects.projects.update · action → task tasks.tasks.create
 * @api /projects/:id/reviews · POST /reviews/:rid/actions/:index/task
 */
export function ReviewsSection({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
    const p = usePermissions();
    const reviews = useGovernance<ProjectReview[]>(projectId, "reviews");
    const remove = useGovernanceDelete("Could not delete the review");
    // The task link replaces the button once the task exists (no toast).
    const makeTask = useGovernancePost("Could not create the task");
    const canEdit = p.can("projects.projects.update") && !readOnly;
    const canTask = p.can("tasks.tasks.create") && !readOnly;
    const [editing, setEditing] = useState<ProjectReview | "new" | null>(null);
    const [deleting, setDeleting] = useState<ProjectReview | null>(null);

    const block = (label: string, value: string | null) => value ? <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-line text-[13px] text-body">{value}</dd></div> : null;

    return (
        <Section
            title="Reviews & retrospectives"
            description="Kickoff, milestone, quality and customer reviews; retrospectives with lessons learned."
            actions={canEdit && <Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus /> Record review</Button>}
        >
            {reviews.isPending ? <ListSkeleton rows={3} /> : reviews.error ? <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} /> : !reviews.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={MessagesSquare} title="No reviews yet" description="Record the kickoff, milestone reviews and a retrospective at the end." /></div>
            ) : (
                <ol className="space-y-3">
                    {reviews.data.map((r) => (
                        <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{r.title}</span>
                                <Badge variant={RETRO.includes(r.type) ? "violet" : "info"}>{getDropdownOptionLabel(ReviewTypeFormOptions, r.type)}</Badge>
                                <span className="text-xs text-muted-foreground">{r.held_at ? formatDate(r.held_at) : "Date not set"}</span>
                                {r.facilitator && <MemberAvatar person={r.facilitator.user} size="xs" showName />}
                                {canEdit && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Actions for ${r.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                                {block("Findings", r.findings)}
                                {block("Decisions", r.decisions)}
                                {block("Went well", r.went_well)}
                                {block("Went wrong", r.went_wrong)}
                                {block("Root causes", r.root_causes)}
                                {block("Lessons learned", r.lessons)}
                            </dl>
                            {r.actions.length > 0 && (
                                <div className="mt-3">
                                    <p className="mb-1 text-xs text-muted-foreground">Actions</p>
                                    <ul className="space-y-1.5">
                                        {r.actions.map((a, i) => (
                                            <li key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                                                <span className="min-w-0 flex-1 text-foreground">{a.title}</span>
                                                {a.owner && <MemberAvatar person={a.owner.user} size="xs" />}
                                                {a.due_date && <span className="text-xs text-muted-foreground">{formatDate(a.due_date)}</span>}
                                                {a.task ? (
                                                    <Link to={`/tasks/${a.task.identifier}`} className="font-mono text-xs text-info hover:underline">{a.task.identifier}</Link>
                                                ) : canTask && (
                                                    <Button size="sm" variant="ghost" loading={makeTask.isPending && makeTask.variables?.path === `reviews/${r.id}/actions/${i}/task`}
                                                        onClick={() => makeTask.mutate({ id: projectId, path: `reviews/${r.id}/actions/${i}/task` })}>
                                                        <SquarePlus /> Create task
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </li>
                    ))}
                </ol>
            )}
            <ReviewDialog projectId={projectId} review={editing} onClose={() => setEditing(null)} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete “${deleting?.title}”?`}
                description="The review is removed. Tasks created from its actions are kept."
                confirmText="Delete review"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, path: `reviews/${deleting.id}`, removeId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}

type Fields = { findings: string; decisions: string; went_well: string; went_wrong: string; root_causes: string; lessons: string };
const EMPTY: Fields = { findings: "", decisions: "", went_well: "", went_wrong: "", root_causes: "", lessons: "" };

/** Record a review (explicit button) or edit one (autosaves; "Done" closes). */
function ReviewDialog({ projectId, review, onClose }: { projectId: string; review: ProjectReview | "new" | null; onClose: () => void }) {
    const create = useGovernancePost("Could not record the review");
    const update = useGovernancePatch("Could not update the review", false);
    const [dirty, setDirty] = useState(false);
    const touch = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };
    const existing = review && review !== "new" ? review : null;
    const [type, setType] = useState<ProjectReviewType>("MILESTONE");
    const [title, setTitle] = useState("");
    const [heldAt, setHeldAt] = useState("");
    const [facilitator, setFacilitator] = useState<string | null>(null);
    const [fields, setFields] = useState<Fields>(EMPTY);
    const [actions, setActions] = useState<ReviewActionItem[]>([]);
    useEffect(() => {
        if (!review) return;
        setType(existing?.type ?? "MILESTONE");
        setTitle(existing?.title ?? "");
        setHeldAt(existing?.held_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
        setFacilitator(existing?.facilitator_membership_id ?? null);
        setFields(existing ? { findings: existing.findings ?? "", decisions: existing.decisions ?? "", went_well: existing.went_well ?? "", went_wrong: existing.went_wrong ?? "", root_causes: existing.root_causes ?? "", lessons: existing.lessons ?? "" } : EMPTY);
        setActions(existing?.actions.map(({ title, owner_membership_id, due_date, task_id, done }) => ({ title, owner_membership_id, due_date, task_id, done })) ?? []);
        setDirty(false);
    }, [review, existing]);
    const retro = RETRO.includes(type);
    const pending = create.isPending;
    const field = (key: keyof Fields, label: string) => (
        <div className="space-y-1.5">
            <Label htmlFor={`rv-${key}`}>{label}</Label>
            <Textarea id={`rv-${key}`} rows={2} value={fields[key]} onChange={(e) => { setDirty(true); setFields((f) => ({ ...f, [key]: e.target.value })); }} />
        </div>
    );
    const text = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim() || null]));
    const dto = {
        type, title: title.trim(), held_at: heldAt || null, facilitator_membership_id: facilitator, ...text,
        actions: actions.filter((a) => a.title.trim()).map((a) => ({ title: a.title.trim(), owner_membership_id: a.owner_membership_id ?? null, due_date: a.due_date || null, task_id: a.task_id ?? null, done: !!a.done })),
    };
    const autosave = useAutosave({
        value: dto,
        enabled: !!existing && dirty && !!dto.title,
        // Text fields show at once; the action rows (with owners and task links) come back with the refresh.
        save: (v) => update.mutateAsync({ id: projectId, path: `reviews/${existing!.id}`, dto: v, patch: { id: existing!.id, value: { ...text, type: v.type, title: v.title, held_at: v.held_at } } }),
    });
    const close = () => { if (existing && dto.title) autosave.flush(); onClose(); };
    const submit = () => {
        if (existing) return close();
        create.mutate({ id: projectId, path: "reviews", dto }, { onSuccess: onClose });
    };
    return (
        <Dialog open={!!review} onOpenChange={(o) => !o && !pending && close()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (title.trim()) submit(); }}>
                    <DialogHeader>
                        <DialogTitle>{existing ? "Edit review" : "Record review"}</DialogTitle>
                        <DialogDescription>Participants and action owners are notified.</DialogDescription>
                        {existing && <SaveStatus state={autosave} />}
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={(v) => touch(setType)(v as ProjectReviewType)}>
                                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                                <SelectContent>{ReviewTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="rv-date">Held on</Label>
                            <Input id="rv-date" type="date" value={heldAt} onChange={(e) => touch(setHeldAt)(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="rv-title">Title</Label>
                        <Input id="rv-title" autoFocus value={title} onChange={(e) => touch(setTitle)(e.target.value)} placeholder="Beta milestone review" maxLength={200} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Facilitator</Label>
                        <PersonPicker value={facilitator} onChange={touch(setFacilitator)} placeholder="Choose a facilitator" noneLabel="Nobody" selected={existing?.facilitator} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {retro ? (
                            <>
                                {field("went_well", "Went well")}
                                {field("went_wrong", "Went wrong")}
                                {field("root_causes", "Root causes")}
                                {field("lessons", "Lessons learned")}
                            </>
                        ) : (
                            <>
                                {field("findings", "Findings")}
                                {field("decisions", "Decisions")}
                            </>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Actions</Label>
                            <Button type="button" size="sm" variant="ghost" onClick={() => touch(setActions)([...actions, { title: "" }])}><Plus /> Add action</Button>
                        </div>
                        {actions.map((a, i) => (
                            <div key={i} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_11rem_9.5rem_auto]">
                                <Input aria-label={`Action ${i + 1}`} placeholder="What needs doing" value={a.title} onChange={(e) => touch(setActions)(actions.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                                <PersonPicker value={a.owner_membership_id ?? null} onChange={(v) => touch(setActions)(actions.map((x, j) => (j === i ? { ...x, owner_membership_id: v } : x)))} placeholder="Owner" noneLabel="No owner" selected={a.owner} />
                                <Input aria-label={`Due date of action ${i + 1}`} type="date" value={a.due_date?.slice(0, 10) ?? ""} onChange={(e) => touch(setActions)(actions.map((x, j) => (j === i ? { ...x, due_date: e.target.value || null } : x)))} />
                                <Button type="button" variant="ghost" size="icon" aria-label={`Remove action ${i + 1}`} onClick={() => touch(setActions)(actions.filter((_, j) => j !== i))} disabled={!!a.task_id}><X /></Button>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        {existing ? (
                            <Button type="button" onClick={close}>Done</Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending} disabled={!title.trim()}>Record review</Button>
                            </>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
