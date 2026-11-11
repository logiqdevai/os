import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Bell, BellOff, Link2, MoreHorizontal, Paperclip, Plus, Tag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import {
    useAddAttachment,
    useAddChecklistItem,
    useAddDependency,
    useArchiveTask,
    useCreateComment,
    useCreateTask,
    useCycles,
    useDeleteChecklistItem,
    useDeleteComment,
    useDeleteTask,
    useRemoveAttachment,
    useRemoveDependency,
    useSetWatching,
    useTask,
    useTaskActivity,
    useTaskComments,
    useTaskLabels,
    useTaskLookup,
    useUpdateChecklistItem,
    useUpdateTask,
} from "@/features/tasks/hooks/use-tasks";
import type { TaskCommentVisibility, TaskDependencyType, TaskDetail, UpdateTaskDto } from "@/features/tasks/interfaces/tasks.interfaces";
import { TaskCommentVisibilityFormOptions, TaskDependencyTypeFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatRelative, personName } from "@/lib/format";
import { useSessionData } from "@/features/session/hooks/use-session";
import { cn } from "@/lib/utils";
import { AssigneePicker, LabelsPicker, PriorityPicker, ProjectPicker, StatusPicker } from "./task-pickers";
import { LabelChip, StatusIcon } from "./task-badges";

/**
 * Task detail (full page and side sheet): description, sub-tasks, checklist, links, attachments, comments, activity, properties.
 * @perm VIEW tasks.tasks.read · edit tasks.tasks.update · assign tasks.tasks.assign · delete tasks.tasks.delete · internal comments tasks.comments.internal.read
 * @api GET/PATCH /tasks/:key · /comments · /checklist · /dependencies · /attachments · /watchers · /activity
 */
export function TaskDetailView({ taskKey, compact, onDeleted }: { taskKey: string; compact?: boolean; onDeleted?: () => void }) {
    const task = useTask(taskKey);
    if (task.isPending) return <PageSkeleton />;
    if (task.error) return <ErrorState error={task.error} onRetry={() => task.refetch()} />;
    return <TaskDetailBody task={task.data} compact={compact} onDeleted={onDeleted} />;
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function TaskDetailBody({ task: t, compact, onDeleted }: { task: TaskDetail; compact?: boolean; onDeleted?: () => void }) {
    const p = usePermissions();
    const navigate = useNavigate();
    const canEdit = p.can("tasks.tasks.update") && !t.archived_at;
    const canAssign = p.can("tasks.tasks.assign");
    const session = useSessionData();
    const me = session?.active_organization?.membership_id;
    const update = useUpdateTask();
    const archive = useArchiveTask();
    const remove = useDeleteTask();
    const watch = useSetWatching();
    const labels = useTaskLabels();
    const cycles = useCycles({ team_id: t.team_id ?? undefined, status: "PLANNED,ACTIVE", limit: 20 });
    const [title, setTitle] = useState<string | null>(null);
    const [desc, setDesc] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const patch = (dto: UpdateTaskDto) => update.mutate({ id: t.id, ...dto });
    const today = new Date().toISOString().slice(0, 10);
    const overdue = t.due_date && t.due_date.slice(0, 10) < today && t.status?.category !== "DONE" && t.status?.category !== "CANCELLED";

    return (
        <div className={cn("grid gap-6", !compact && "lg:grid-cols-[1fr_20rem]")}>
            <div className="min-w-0 space-y-6">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{t.identifier}</span>
                        {t.parent && <><span>·</span><span>Sub-task of</span><Link to={`/tasks/${t.parent.identifier}`} className="text-foreground hover:underline">{t.parent.identifier} {t.parent.title}</Link></>}
                        {t.archived_at && <Badge variant="warning">Archived</Badge>}
                        {t.blocked && <Badge variant="danger">Blocked</Badge>}
                    </div>
                    {title !== null ? (
                        <Input
                            autoFocus
                            value={title}
                            aria-label="Title"
                            className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-medium shadow-none focus-visible:ring-0"
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={() => { if (title.trim() && title.trim() !== t.title) patch({ title: title.trim() }); setTitle(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setTitle(null); }}
                        />
                    ) : (
                        <h1 className={cn("text-xl font-medium text-foreground", canEdit && "cursor-text rounded hover:bg-accent/50")} onClick={() => canEdit && setTitle(t.title)}>{t.title}</h1>
                    )}
                </div>

                <section aria-label="Description">
                    {desc !== null ? (
                        <div className="space-y-2">
                            <Textarea autoFocus rows={8} value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setDesc(null)}>Cancel</Button>
                                <Button size="sm" loading={update.isPending} onClick={() => patch({ description: desc })}>Save</Button>
                            </div>
                        </div>
                    ) : t.description ? (
                        <div className={cn("whitespace-pre-wrap rounded-md text-[13px] leading-relaxed text-body", canEdit && "cursor-text hover:bg-accent/40")} onClick={() => canEdit && setDesc(t.description ?? "")}>{t.description}</div>
                    ) : canEdit ? (
                        <button className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setDesc("")}>Add a description…</button>
                    ) : null}
                </section>

                <SubtasksSection task={t} canEdit={canEdit} />
                <ChecklistSection task={t} canEdit={canEdit} />
                <LinksSection task={t} canEdit={canEdit} />
                <AttachmentsSection task={t} canEdit={canEdit} />
                <CommentsSection task={t} me={me} />
                <ActivitySection taskId={t.id} />
            </div>

            <aside className={cn("space-y-4", !compact && "lg:sticky lg:top-4 lg:self-start")}>
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                    <Prop label="Status">
                        <StatusPicker statuses={t.workflow_statuses} value={t.status_id} onChange={(v) => v && patch({ status_id: v })} disabled={!canEdit} />
                    </Prop>
                    <Prop label="Priority"><PriorityPicker value={t.priority} onChange={(priority) => patch({ priority })} disabled={!canEdit} /></Prop>
                    <Prop label="Assignee">
                        {canEdit && canAssign ? (
                            <AssigneePicker value={t.assignee_membership_id} onChange={(v) => patch({ assignee_membership_id: v })} selected={t.assignee} />
                        ) : (
                            <div className="flex items-center gap-2">
                                <MemberAvatar person={t.assignee?.user} showName />
                                {canEdit && me && t.assignee_membership_id !== me && <Button size="sm" variant="ghost" onClick={() => patch({ assignee_membership_id: me })}>Take it</Button>}
                            </div>
                        )}
                    </Prop>
                    <Prop label="Labels">
                        <LabelsPicker
                            value={t.labels.map((l) => l.id)}
                            onChange={(ids) => patch({ label_ids: ids })}
                            disabled={!canEdit}
                            trigger={
                                <button type="button" className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md px-1 text-left hover:bg-accent/50 disabled:hover:bg-transparent" disabled={!canEdit}>
                                    {t.labels.length ? t.labels.map((l) => <LabelChip key={l.id} label={(labels.data ?? []).find((x) => x.id === l.id) ?? l} />) : <span className="flex items-center gap-1 text-[13px] text-muted-foreground"><Tag className="size-3.5" /> Add labels</span>}
                                </button>
                            }
                        />
                    </Prop>
                    <Prop label="Project"><ProjectPicker value={t.project_id} currentName={t.project?.name} onChange={(v) => patch({ project_id: v })} disabled={!canEdit} /></Prop>
                    <Prop label="Cycle">
                        <EntityPicker
                            items={[...(cycles.data?.data ?? []).map((c) => ({ id: c.id, label: c.name ?? `Cycle ${c.number}`, hint: c.status === "ACTIVE" ? "Active" : formatDate(c.starts_at, "d MMM") })), ...(t.cycle && !(cycles.data?.data ?? []).some((c) => c.id === t.cycle!.id) ? [{ id: t.cycle.id, label: t.cycle.name ?? `Cycle ${t.cycle.number}` }] : [])]}
                            value={t.cycle_id}
                            onChange={(v) => patch({ cycle_id: v })}
                            placeholder="No cycle"
                            noneLabel="No cycle"
                            disabled={!canEdit}
                            ariaLabel="Cycle"
                        />
                    </Prop>
                    <Prop label="Due date">
                        <Input type="date" aria-label="Due date" className={cn("h-8", overdue && "text-danger")} disabled={!canEdit} value={t.due_date?.slice(0, 10) ?? ""} onChange={(e) => patch({ due_date: e.target.value || null })} />
                    </Prop>
                    <Prop label="Estimate">
                        <Input
                            key={t.estimate_points ?? "none"}
                            aria-label="Estimate in points"
                            inputMode="decimal"
                            placeholder="Points"
                            className="h-8"
                            disabled={!canEdit}
                            defaultValue={t.estimate_points ? String(Number(t.estimate_points)) : ""}
                            onBlur={(e) => {
                                const v = e.target.value.trim();
                                const next = v ? Number(v) : null;
                                if (v && Number.isNaN(next)) return;
                                if ((next ?? null) !== (t.estimate_points ? Number(t.estimate_points) : null)) patch({ estimate_points: next });
                            }}
                        />
                    </Prop>
                    <Prop label="Customer">
                        <label className="flex items-center gap-2 text-[13px]"><Switch checked={t.customer_visible} disabled={!canEdit} onCheckedChange={(v) => patch({ customer_visible: v })} aria-label="Visible to customer" /> Visible in portal</label>
                    </Prop>
                    <Prop label="Blocked">
                        <Switch checked={t.blocked} disabled={!canEdit} onCheckedChange={(v) => patch({ blocked: v })} aria-label="Blocked" />
                    </Prop>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                        <span>Reporter</span>
                        <MemberAvatar person={t.reporter?.user} showName emptyLabel="Unknown" />
                    </div>
                    <div className="flex justify-between"><span>Created</span><span>{formatDateTime(t.created_at)}</span></div>
                    <div className="flex justify-between"><span>Updated</span><span>{formatRelative(t.updated_at)}</span></div>
                    {t.team && <div className="flex justify-between"><span>Team</span><span>{t.team.name}</span></div>}
                    {t.milestone && <div className="flex justify-between"><span>Milestone</span><span className="truncate">{t.milestone.name}</span></div>}
                    <div className="flex items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1" loading={watch.isPending} onClick={() => watch.mutate({ id: t.id, watching: !t.is_watching })}>
                            {t.is_watching ? <><BellOff /> Unsubscribe</> : <><Bell /> Subscribe</>}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => { void navigator.clipboard?.writeText(`${window.location.origin}/tasks/${t.identifier}`); toast({ title: "Link copied" }); }}><Link2 /> Copy link</DropdownMenuItem>
                                {p.can("tasks.tasks.archive") && !t.archived_at && <DropdownMenuItem onSelect={() => archive.mutate(t.id)}><Archive /> Archive</DropdownMenuItem>}
                                {p.can("tasks.tasks.delete") && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(true)}><Trash2 /> Delete</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </aside>

            <ConfirmationDialog
                isOpen={deleting}
                onClose={() => setDeleting(false)}
                title={`Delete ${t.identifier}?`}
                description="Comments, checklist and links are deleted. Sub-tasks are kept. This cannot be undone."
                confirmText="Delete task"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => remove.mutate(t.id, { onSuccess: () => { setDeleting(false); if (onDeleted) onDeleted(); else navigate("/tasks"); } })}
            />
        </div>
    );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return (
        <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium text-foreground">{children}</h2>
            {action}
        </div>
    );
}

function SubtasksSection({ task: t, canEdit }: { task: TaskDetail; canEdit: boolean }) {
    const create = useCreateTask();
    const canCreate = usePermissions().can("tasks.tasks.create");
    const [title, setTitle] = useState<string | null>(null);
    const done = t.subtasks.filter((s) => s.status?.category === "DONE").length;
    const add = () => {
        if (!title?.trim()) return setTitle(null);
        create.mutate({ title: title.trim(), parent_task_id: t.id, team_id: t.team_id ?? undefined, project_id: t.project_id ?? undefined }, { onSuccess: () => setTitle("") });
    };
    if (!t.subtasks.length && !(canEdit && canCreate)) return null;
    return (
        <section aria-label="Sub-tasks">
            <SectionTitle action={canEdit && canCreate && title === null && <Button variant="ghost" size="sm" onClick={() => setTitle("")}><Plus /> Add</Button>}>
                Sub-tasks {t.subtasks.length > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground tabular">{done}/{t.subtasks.length}</span>}
            </SectionTitle>
            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {t.subtasks.map((s) => (
                    <li key={s.id}>
                        <Link to={`/tasks/${s.identifier}`} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-accent/50">
                            <StatusIcon category={s.status?.category} color={s.status?.color} />
                            <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{s.identifier}</span>
                            <span className={cn("min-w-0 flex-1 truncate", s.status?.category === "DONE" && "text-muted-foreground line-through")}>{s.title}</span>
                            <MemberAvatar person={s.assignee?.user} size="xs" />
                        </Link>
                    </li>
                ))}
                {title !== null && (
                    <li className="flex items-center gap-2 px-3 py-2">
                        <Input autoFocus className="h-7" placeholder="Sub-task title" value={title} aria-label="Sub-task title" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setTitle(null); }} />
                        <Button size="sm" loading={create.isPending} onClick={add}>Add</Button>
                    </li>
                )}
                {!t.subtasks.length && title === null && <li className="px-3 py-2 text-[13px] text-muted-foreground">No sub-tasks</li>}
            </ul>
        </section>
    );
}

function ChecklistSection({ task: t, canEdit }: { task: TaskDetail; canEdit: boolean }) {
    const add = useAddChecklistItem();
    const toggle = useUpdateChecklistItem();
    const remove = useDeleteChecklistItem();
    const [title, setTitle] = useState("");
    if (!t.checklist_items.length && !canEdit) return null;
    const done = t.checklist_items.filter((i) => i.is_completed).length;
    return (
        <section aria-label="Checklist">
            <SectionTitle>Checklist {t.checklist_items.length > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground tabular">{done}/{t.checklist_items.length}</span>}</SectionTitle>
            <ul className="space-y-1">
                {t.checklist_items.map((i) => (
                    <li key={i.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40">
                        <Checkbox checked={i.is_completed} disabled={!canEdit} aria-label={i.title} onCheckedChange={(v) => toggle.mutate({ id: t.id, itemId: i.id, is_completed: v === true })} />
                        <span className={cn("flex-1 text-[13px]", i.is_completed && "text-muted-foreground line-through")}>{i.title}</span>
                        {canEdit && <Button variant="ghost" size="icon-sm" className="opacity-60 group-hover:opacity-100" aria-label={`Remove ${i.title}`} onClick={() => remove.mutate({ id: t.id, itemId: i.id })}><X /></Button>}
                    </li>
                ))}
            </ul>
            {canEdit && (
                <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate({ id: t.id, title: title.trim() }, { onSuccess: () => setTitle("") }); }}>
                    <Input className="h-8" placeholder="Add an item…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="New checklist item" />
                    <Button type="submit" size="sm" variant="outline" disabled={!title.trim()} loading={add.isPending}>Add</Button>
                </form>
            )}
        </section>
    );
}

function LinksSection({ task: t, canEdit }: { task: TaskDetail; canEdit: boolean }) {
    const add = useAddDependency();
    const remove = useRemoveDependency();
    const [adding, setAdding] = useState(false);
    const [type, setType] = useState<TaskDependencyType>("BLOCKS");
    const [search, setSearch] = useState("");
    const lookup = useTaskLookup({ search: search || undefined, limit: 15 }, adding);
    const links = [
        ...t.dependencies_from.map((d) => ({ id: d.id, label: getDropdownOptionLabel(TaskDependencyTypeFormOptions, d.type), task: d.target })),
        ...t.dependencies_to.map((d) => ({ id: d.id, label: d.type === "BLOCKS" ? "Blocked by" : d.type === "DUPLICATE_OF" ? "Duplicated by" : "Related to", task: d.source })),
    ];
    if (!links.length && !canEdit) return null;
    return (
        <section aria-label="Links">
            <SectionTitle action={canEdit && !adding && <Button variant="ghost" size="sm" onClick={() => setAdding(true)}><Link2 /> Link task</Button>}>Links</SectionTitle>
            {links.length > 0 && (
                <ul className="mb-2 divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {links.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                            <span className="w-24 shrink-0 text-xs text-muted-foreground">{l.label}</span>
                            <StatusIcon category={l.task.status?.category} color={l.task.status?.color} />
                            <Link to={`/tasks/${l.task.identifier}`} className="min-w-0 flex-1 truncate hover:underline"><span className="font-mono text-xs text-muted-foreground">{l.task.identifier}</span> {l.task.title}</Link>
                            {canEdit && <Button variant="ghost" size="icon-sm" aria-label="Remove link" onClick={() => remove.mutate({ id: t.id, depId: l.id })}><X /></Button>}
                        </li>
                    ))}
                </ul>
            )}
            {!links.length && !adding && <p className="text-[13px] text-muted-foreground">No linked tasks</p>}
            {adding && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={type} onValueChange={(v) => setType(v as TaskDependencyType)}>
                        <SelectTrigger className="h-8 sm:w-40" aria-label="Link type"><SelectValue /></SelectTrigger>
                        <SelectContent>{TaskDependencyTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex-1">
                        <EntityPicker
                            items={(lookup.data ?? []).filter((x) => x.id !== t.id).map((x) => ({ id: x.id, label: `${x.identifier} ${x.title}`, hint: x.project?.name }))}
                            value={null}
                            onSearch={setSearch}
                            loading={lookup.isFetching}
                            placeholder="Find a task…"
                            searchPlaceholder="Identifier or title…"
                            onChange={(id) => id && add.mutate({ id: t.id, target_task_id: id, type }, { onSuccess: () => setAdding(false) })}
                        />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
            )}
        </section>
    );
}

function AttachmentsSection({ task: t, canEdit }: { task: TaskDetail; canEdit: boolean }) {
    const add = useAddAttachment();
    const remove = useRemoveAttachment();
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    if (!t.attachments.length && !canEdit) return null;
    return (
        <section aria-label="Attachments">
            <SectionTitle action={canEdit && !adding && <Button variant="ghost" size="sm" onClick={() => setAdding(true)}><Paperclip /> Add link</Button>}>Attachments</SectionTitle>
            {t.attachments.length > 0 ? (
                <ul className="space-y-1">
                    {t.attachments.map((a) => {
                        const href = a.document.external_url ?? a.document.url;
                        const label = a.document.title ?? a.document.filename;
                        return (
                            <li key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px]">
                                <Paperclip className="size-4 shrink-0 text-ash" />
                                {href ? <a href={href} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline">{label}</a> : <span className="min-w-0 flex-1 truncate">{label}</span>}
                                <span className="hidden text-xs text-muted-foreground sm:inline">{formatDate(a.created_at, "d MMM")}</span>
                                {canEdit && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={() => remove.mutate({ id: t.id, attId: a.id })}><X /></Button>}
                            </li>
                        );
                    })}
                </ul>
            ) : !adding && <p className="text-[13px] text-muted-foreground">No attachments</p>}
            {adding && (
                <form
                    className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!url.trim()) return;
                        add.mutate({ id: t.id, file_name: name.trim() || undefined, url: url.trim() }, { onSuccess: () => { setAdding(false); setName(""); setUrl(""); } });
                    }}
                >
                    <Input className="h-8" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Attachment name" />
                    <Input className="h-8" placeholder="https://figma.com/…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Attachment link" />
                    <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={!url.trim()} loading={add.isPending}>Attach</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                    </div>
                </form>
            )}
        </section>
    );
}

function CommentsSection({ task: t, me }: { task: TaskDetail; me?: string | null }) {
    const p = usePermissions();
    const comments = useTaskComments(t.id);
    const create = useCreateComment();
    const remove = useDeleteComment();
    const canInternal = p.can("tasks.comments.internal.read");
    const canWrite = p.canAny("tasks.tasks.update", "tasks.tasks.create");
    const [body, setBody] = useState("");
    const [visibility, setVisibility] = useState<TaskCommentVisibility>(canInternal ? "INTERNAL" : "CUSTOMER_VISIBLE");
    const visibilityOptions = TaskCommentVisibilityFormOptions.filter((o) => (o.id === "INTERNAL" ? canInternal : t.customer_visible));
    const post = () => body.trim() && create.mutate({ id: t.id, body: body.trim(), visibility }, { onSuccess: () => setBody("") });

    return (
        <section aria-label="Comments">
            <SectionTitle>Comments</SectionTitle>
            {comments.isPending ? null : comments.error ? <ErrorState error={comments.error} onRetry={() => comments.refetch()} /> : (
                <ul className="space-y-3">
                    {comments.data.map((c) => (
                        <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <MemberAvatar person={c.author?.user} size="xs" showName emptyLabel="Customer" />
                                <span>{formatRelative(c.created_at)}</span>
                                {c.visibility === "CUSTOMER_VISIBLE" && <Badge variant="info">Customer can see</Badge>}
                                {c.edited_at && <span>(edited)</span>}
                                {(c.author_membership_id === me || p.can("tasks.tasks.delete")) && (
                                    <Button variant="ghost" size="icon-sm" className="ml-auto size-6" aria-label="Delete comment" onClick={() => remove.mutate({ id: t.id, commentId: c.id })}><Trash2 className="size-3.5" /></Button>
                                )}
                            </div>
                            <p className="whitespace-pre-wrap text-[13px] text-foreground">{c.body}</p>
                        </li>
                    ))}
                    {!comments.data.length && <li><EmptyState compact title="No comments yet" className="py-4" /></li>}
                </ul>
            )}
            {canWrite && visibilityOptions.length > 0 && (
                <div className="mt-3 space-y-2">
                    <Textarea
                        rows={3}
                        placeholder="Leave a comment… (Ctrl+Enter to send)"
                        value={body}
                        aria-label="New comment"
                        onChange={(e) => setBody(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); post(); } }}
                    />
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Label className="sr-only" htmlFor="comment-visibility">Visibility</Label>
                            <Select value={visibility} onValueChange={(v) => setVisibility(v as TaskCommentVisibility)}>
                                <SelectTrigger id="comment-visibility" className="h-8 w-44" aria-label="Comment visibility"><SelectValue /></SelectTrigger>
                                <SelectContent>{visibilityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Button size="sm" disabled={!body.trim()} loading={create.isPending} onClick={post}>Comment</Button>
                    </div>
                </div>
            )}
        </section>
    );
}

const EVENT_LABELS: Record<string, string> = {
    "task.created": "created the task",
    "task.updated": "updated the task",
    "task.status_changed": "changed the status",
    "task.assigned": "changed the assignee",
    "task.commented": "commented",
    "task.archived": "archived the task",
    "task.restored": "restored the task",
    "task.dependency_added": "linked a task",
    "task.attachment_added": "added an attachment",
    "task.checklist_item_added": "added a checklist item",
};

function ActivitySection({ taskId }: { taskId: string }) {
    const activity = useTaskActivity(taskId);
    const [open, setOpen] = useState(false);
    if (activity.isPending || activity.error) return null;
    const items = [
        ...activity.data.status_history.map((h) => ({ id: h.id, at: h.changed_at, text: `${h.changed_by ? personName(h.changed_by.user) : "Someone"} moved ${h.from_status ? `from ${h.from_status.name} ` : ""}to ${h.to_status?.name ?? "no status"}` })),
        ...activity.data.events.filter((e) => !["task.status_changed", "task.updated"].includes(e.event_type) && EVENT_LABELS[e.event_type]).map((e) => ({ id: e.id, at: e.created_at, text: `${e.actor ? personName(e.actor) : "System"} ${EVENT_LABELS[e.event_type]}` })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const shown = open ? items : items.slice(0, 5);
    return (
        <section aria-label="Activity">
            <SectionTitle action={items.length > 5 && <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Show less" : `Show all (${items.length})`}</Button>}>Activity</SectionTitle>
            <ol className="space-y-1.5 border-l border-border pl-4">
                {shown.map((i) => (
                    <li key={i.id} className="text-xs text-muted-foreground"><span className="text-foreground">{i.text}</span> · {formatRelative(i.at)}</li>
                ))}
            </ol>
        </section>
    );
}
