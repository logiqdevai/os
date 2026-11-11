import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, GitPullRequestArrow, MessageSquareText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permission";
import { useCreateProjectChild, useProjectChildAction, useProjectChildren } from "@/features/projects/hooks/use-projects";
import {
    changeRequestFormSchema,
    statusUpdateFormSchema,
    type ChangeRequestFormValues,
    type StatusUpdateFormValues,
} from "@/features/projects/validation-schemas/projects.schema";
import type { ChangeRequest, ProjectDetail, StatusUpdate } from "@/features/projects/interfaces/projects.interfaces";
import { ChangeRequestStatusFormOptions, ProjectHealthFormOptions, ProjectPriorityFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatRelative } from "@/lib/format";
import { HealthBadge, ProjectPriorityBadge } from "../../../components/project-badges";

/**
 * Status updates (health RAG) and change requests.
 * @perm write/publish projects.status_updates.publish · change requests projects.change_requests.manage / .approve
 */
export function UpdatesTab({ project }: { project: ProjectDetail }) {
    const p = usePermissions();
    const updates = useProjectChildren<StatusUpdate>(project.id, "status-updates");
    const changes = useProjectChildren<ChangeRequest>(project.id, "change-requests");
    const publish = useProjectChildAction("Update published");
    const decide = useProjectChildAction("Decision saved");
    const [writing, setWriting] = useState(false);
    const [requesting, setRequesting] = useState(false);

    const crColumns: DataTableColumn<ChangeRequest>[] = [
        { key: "n", header: "#", className: "w-16 font-mono text-xs text-muted-foreground", cell: (c) => `CR-${c.number}` },
        { key: "title", header: "Change", cell: (c) => <span className="line-clamp-1 font-medium text-foreground">{c.title}</span> },
        { key: "priority", header: "Priority", hideBelow: "md", cell: (c) => <ProjectPriorityBadge priority={c.priority} /> },
        { key: "impact", header: "Impact", hideBelow: "lg", cell: (c) => (c.timeline_impact_days ? `+${c.timeline_impact_days} days` : "—") },
        { key: "status", header: "Status", cell: (c) => <Badge variant={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "danger" : "neutral"}>{getDropdownOptionLabel(ChangeRequestStatusFormOptions, c.status)}</Badge> },
        {
            key: "decide",
            header: <span className="sr-only">Decide</span>,
            className: "w-20",
            cell: (c) => p.can("projects.change_requests.approve") && ["REQUESTED", "UNDER_REVIEW", "ESTIMATING", "AWAITING_APPROVAL"].includes(c.status) && (
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Approve CR-${c.number}`} disabled={decide.isPending} onClick={() => decide.mutate({ id: project.id, kind: "change-requests", itemId: c.id, action: "decide", dto: { decision: "APPROVED" } })}><Check className="text-success" /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Reject CR-${c.number}`} disabled={decide.isPending} onClick={() => decide.mutate({ id: project.id, kind: "change-requests", itemId: c.id, action: "decide", dto: { decision: "REJECTED" } })}><X className="text-danger" /></Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-8">
            <Section
                title="Status updates"
                description="Weekly health and progress. Published updates set the project health."
                actions={p.can("projects.status_updates.publish") && <Button size="sm" onClick={() => setWriting(true)}><Plus /> Write update</Button>}
            >
                {updates.isPending ? <ListSkeleton rows={3} /> : updates.error ? <ErrorState error={updates.error} onRetry={() => updates.refetch()} /> : !updates.data.length ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={MessageSquareText} title="No updates yet" description="Share what was done, what is next and the current health." /></div>
                ) : (
                    <ol className="space-y-3">
                        {updates.data.map((u) => (
                            <li key={u.id} className="rounded-lg border border-border bg-card p-4">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <MemberAvatar person={u.owner?.user} size="xs" showName />
                                    <span>·</span>
                                    <span>{u.published_at ? formatRelative(u.published_at) : `Draft · ${formatDate(u.created_at)}`}</span>
                                    {u.health && <HealthBadge health={u.health} />}
                                    {u.customer_visible && <Badge variant="info">Shared with customer</Badge>}
                                    {!u.published_at && p.can("projects.status_updates.publish") && (
                                        <Button size="sm" variant="outline" className="ml-auto" loading={publish.isPending} onClick={() => publish.mutate({ id: project.id, kind: "status-updates", itemId: u.id, action: "publish" })}>Publish</Button>
                                    )}
                                </div>
                                <p className="whitespace-pre-line text-[13px] text-foreground">{u.summary}</p>
                                {(u.completed_work || u.upcoming_work || u.risks_summary) && (
                                    <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-3">
                                        {u.completed_work && <div><dt className="text-xs text-muted-foreground">Done</dt><dd className="whitespace-pre-line text-body">{u.completed_work}</dd></div>}
                                        {u.upcoming_work && <div><dt className="text-xs text-muted-foreground">Next</dt><dd className="whitespace-pre-line text-body">{u.upcoming_work}</dd></div>}
                                        {u.risks_summary && <div><dt className="text-xs text-muted-foreground">Risks</dt><dd className="whitespace-pre-line text-body">{u.risks_summary}</dd></div>}
                                    </dl>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </Section>

            <Section
                title="Change requests"
                description="Scope, timeline or cost changes. Commercial approval stays with proposals and contracts."
                actions={p.can("projects.change_requests.manage") && <Button size="sm" variant="outline" onClick={() => setRequesting(true)}><Plus /> New change request</Button>}
            >
                <DataTable columns={crColumns} data={changes.data} rowKey={(c) => c.id} loading={changes.isFetching} error={changes.error} onRetry={() => changes.refetch()} empty={{ icon: GitPullRequestArrow, title: "No change requests" }} />
            </Section>

            <StatusUpdateDialog open={writing} onOpenChange={setWriting} project={project} />
            <ChangeRequestDialog open={requesting} onOpenChange={setRequesting} projectId={project.id} />
        </div>
    );
}

function StatusUpdateDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectDetail }) {
    const create = useCreateProjectChild("Status update");
    const form = useForm<StatusUpdateFormValues>({ resolver: zodResolver(statusUpdateFormSchema) });
    const [publishNow, setPublishNow] = useState(true);
    useEffect(() => {
        if (open) {
            const pct = project.summary.tasks.total ? Math.round((project.summary.tasks.done / project.summary.tasks.total) * 100) : project.progress_percent;
            form.reset({ summary: "", health: project.health === "UNKNOWN" ? "HEALTHY" : project.health, progress_percent: String(pct), completed_work: "", upcoming_work: "", risks_summary: "", customer_visible: false });
            setPublishNow(true);
        }
    }, [open, project, form]);
    const submit = form.handleSubmit((v) => {
        create.mutate({
            id: project.id,
            kind: "status-updates",
            dto: {
                summary: v.summary, health: v.health, progress_percent: v.progress_percent ? Number(v.progress_percent) : undefined, completed_work: v.completed_work || undefined,
                upcoming_work: v.upcoming_work || undefined, risks_summary: v.risks_summary || undefined, customer_visible: v.customer_visible, publish: publishNow,
            },
        }, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Status update</DialogTitle>
                            <DialogDescription>{project.name}</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="summary" render={({ field }) => (
                            <FormItem><FormLabel>Summary</FormLabel><FormControl><Textarea autoFocus rows={3} placeholder="Design approved; development started on schedule." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="health" render={({ field }) => (
                                <FormItem><FormLabel>Health</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Health"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ProjectHealthFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="progress_percent" render={({ field }) => (
                                <FormItem><FormLabel>Progress %</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="completed_work" render={({ field }) => (
                                <FormItem><FormLabel>Done since last update</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="upcoming_work" render={({ field }) => (
                                <FormItem><FormLabel>Next</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="risks_summary" render={({ field }) => (
                            <FormItem><FormLabel>Risks & blockers</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <div className="space-y-3 rounded-md border border-border p-3">
                            <FormField control={form.control} name="customer_visible" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 space-y-0">
                                    <div>
                                        <FormLabel className="font-normal">Share with the customer</FormLabel>
                                        {project.visibility !== "CUSTOMER_VISIBLE" && <FormDescription>Make the project customer-visible first.</FormDescription>}
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={project.visibility !== "CUSTOMER_VISIBLE"} /></FormControl>
                                </FormItem>
                            )} />
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[13px]">Publish now (otherwise save as draft)</span>
                                <Switch checked={publishNow} onCheckedChange={setPublishNow} aria-label="Publish now" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>{publishNow ? "Publish update" : "Save draft"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ChangeRequestDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string }) {
    const create = useCreateProjectChild("Change request");
    const form = useForm<ChangeRequestFormValues>({ resolver: zodResolver(changeRequestFormSchema) });
    useEffect(() => {
        if (open) form.reset({ title: "", description: "", priority: "MEDIUM", timeline_impact_days: "", customer_visible: false });
    }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate({
        id: projectId,
        kind: "change-requests",
        dto: { title: v.title, description: v.description || undefined, priority: v.priority, timeline_impact_days: v.timeline_impact_days ? Number(v.timeline_impact_days) : undefined, customer_visible: v.customer_visible },
    }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New change request</DialogTitle>
                            <DialogDescription>Numbered per project (CR-1, CR-2 …).</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Change</FormLabel><FormControl><Input autoFocus placeholder="Add a blog section" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="priority" render={({ field }) => (
                                <FormItem><FormLabel>Priority</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ProjectPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="timeline_impact_days" render={({ field }) => (
                                <FormItem><FormLabel>Timeline impact (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="customer_visible" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-border p-3">
                                <FormLabel className="font-normal">Visible to the customer</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
