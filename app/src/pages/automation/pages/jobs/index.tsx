import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, MoreHorizontal, Pause, Play, Plus, Trash2, Zap } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { JobKindFormOptions, JobStatusFilterOptions, ModuleKeyOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useCreateJob, useDeleteJob, useJobAction, useJobHandlers, useJobs, usePreviewSchedule } from "@/features/automation/hooks/use-automation";
import type { JobKind, ScheduledJob } from "@/features/automation/interfaces/automation.interfaces";
import { StatusBadge, describeSchedule } from "../../components/automation-ui";


/**
 * /automation/jobs — scheduled jobs hosted by the engine (20 §7)
 * @perm VIEW automation.jobs.read · create/pause/resume/run now/delete automation.jobs.manage
 * @api GET /automation/jobs · POST /automation/jobs · POST /automation/jobs/:id/pause|resume|run-now · DELETE /automation/jobs/:id
 */
export default function JobsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const jobs = useJobs(params);
    const canManage = usePermission("automation.jobs.manage");
    const action = useJobAction();
    const remove = useDeleteJob();
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<ScheduledJob | null>(null);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const act = (j: ScheduledJob, a: "pause" | "resume" | "run-now") =>
        action.mutate({ id: j.id, action: a }, { onSuccess: () => toast({ title: a === "run-now" ? "Job ran" : a === "pause" ? "Job paused" : "Job resumed" }), onError: fail("Could not update the job") });

    const columns: DataTableColumn<ScheduledJob>[] = [
        {
            key: "name",
            header: "Job",
            cell: (j) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="truncate font-medium text-foreground">{j.name}</span>{j.rule && <Badge variant="info"><Zap className="size-3" /> workflow</Badge>}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{j.handler}</div>
                </div>
            ),
        },
        { key: "module", header: "Module", cell: (j) => getDropdownOptionLabel(ModuleKeyOptions, j.module), hideBelow: "lg" },
        { key: "schedule", header: "Schedule", cell: (j) => <span className="font-mono text-xs">{describeSchedule(j)}</span>, hideBelow: "md" },
        { key: "next", header: "Next run", cell: (j) => (j.next_run_at ? formatDateTime(j.next_run_at) : "—"), hideBelow: "sm" },
        { key: "last", header: "Last run", cell: (j) => (j.last_run_at ? <div className="space-y-0.5"><StatusBadge status={j.last_run_status} /><div className="text-xs text-muted-foreground">{formatRelative(j.last_run_at)}</div></div> : <span className="text-muted-foreground">Never</span>), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (j) => <div className="space-y-0.5"><StatusBadge status={j.status} />{j.consecutive_failures > 0 && <div className="text-xs text-danger">{j.consecutive_failures} failing</div>}</div> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (j) =>
                canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${j.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => act(j, "run-now")}><Play /> Run now</DropdownMenuItem>
                            {!j.rule_id && (j.status === "ACTIVE" ? <DropdownMenuItem onSelect={() => act(j, "pause")}><Pause /> Pause</DropdownMenuItem> : <DropdownMenuItem onSelect={() => act(j, "resume")}><Play /> Resume</DropdownMenuItem>)}
                            {!j.rule_id && (<><DropdownMenuSeparator /><DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(j)}><Trash2 /> Delete</DropdownMenuItem></>)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Scheduled jobs"
                description="Recurring work the engine schedules, runs, retries and logs — module jobs, workflow schedules and your own timed events."
                actions={canManage && <Button onClick={() => setFormOpen(true)}><Plus /> New job</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search jobs…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{JobStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={jobs.data?.data}
                rowKey={(j) => j.id}
                loading={jobs.isFetching}
                error={jobs.error}
                onRetry={() => jobs.refetch()}
                pagination={jobs.data?.pagination}
                onPageChange={setPage}
                rowHref={(j) => `/automation/jobs/${j.id}`}
                empty={{ icon: Clock, title: "No scheduled jobs", description: "Jobs appear when modules register them, when you publish a scheduled workflow, or when you create one." }}
            />
            <JobFormDialog open={formOpen} onOpenChange={setFormOpen} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="The job stops and its run history is deleted."
                confirmText="Delete"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast({ title: "Job deleted" }); setDeleting(null); }, onError: fail("Could not delete") })}
            />
        </Page>
    );
}

const jobSchema = z.object({
    name: z.string().trim().min(1, "Required").max(160),
    key: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,80}$/, "3–81 lowercase letters, digits, dot, dash or underscore"),
    handler: z.string().min(1, "Choose what the job does"),
    kind: z.enum(["CRON", "INTERVAL", "ONCE"]),
    cron_expression: z.string().optional(),
    interval_seconds: z.coerce.number().int().min(30, "At least 30 seconds").optional().or(z.literal("").transform(() => undefined)),
    run_at: z.string().optional(),
    timezone: z.string().min(1),
    event_key: z.string().regex(/^(schedule|custom)\.[a-z0-9_.-]+$/, "Must start with schedule. or custom.").optional().or(z.literal("")),
    description: z.string().max(1000).optional(),
}).superRefine((v, ctx) => {
    if (v.kind === "CRON" && !v.cron_expression) ctx.addIssue({ code: "custom", path: ["cron_expression"], message: "Required" });
    if (v.kind === "INTERVAL" && !v.interval_seconds) ctx.addIssue({ code: "custom", path: ["interval_seconds"], message: "Required" });
    if (v.kind === "ONCE" && !v.run_at) ctx.addIssue({ code: "custom", path: ["run_at"], message: "Required" });
});
type JobValues = z.input<typeof jobSchema>;

function JobFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateJob();
    const handlers = useJobHandlers();
    const preview = usePreviewSchedule();
    const creatable = (handlers.data ?? []).filter((h) => h.user_creatable);
    const form = useForm<JobValues>({
        resolver: zodResolver(jobSchema),
        defaultValues: { name: "", key: "", handler: "", kind: "CRON", cron_expression: "0 9 * * 1", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, event_key: "", description: "" },
    });
    useEffect(() => {
        if (open) form.reset({ name: "", key: "", handler: creatable[0]?.key ?? "", kind: "CRON", cron_expression: "0 9 * * 1", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, event_key: "", description: "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, handlers.data]);
    const kind = form.watch("kind") as JobKind;

    const submit = form.handleSubmit((raw) => {
        const v = jobSchema.parse(raw);
        create.mutate(
            {
                name: v.name, key: v.key, handler: v.handler, kind: v.kind, timezone: v.timezone, description: v.description || undefined,
                cron_expression: v.kind === "CRON" ? v.cron_expression : undefined,
                interval_seconds: v.kind === "INTERVAL" ? (v.interval_seconds as number) : undefined,
                run_at: v.kind === "ONCE" && v.run_at ? new Date(v.run_at).toISOString() : undefined,
                payload: v.event_key ? { event_key: v.event_key } : undefined,
            },
            { onSuccess: () => { toast({ title: "Job scheduled" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not create the job", description: getApiErrorMessage(e) }) },
        );
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New scheduled job</DialogTitle>
                            <DialogDescription>For example: publish <code>schedule.weekly_report</code> every Monday so a workflow can react to it.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Weekly pipeline report" {...field} onChange={(e) => { field.onChange(e); if (!form.getFieldState("key").isDirty) form.setValue("key", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)); }} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="key" render={({ field }) => (<FormItem><FormLabel>Key</FormLabel><FormControl><Input className="font-mono text-xs" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField
                            control={form.control}
                            name="handler"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>What it does</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Handler"><SelectValue placeholder="Choose a handler" /></SelectTrigger></FormControl>
                                        <SelectContent>{creatable.map((h) => <SelectItem key={h.key} value={h.key}>{h.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormDescription>{creatable.find((h) => h.key === field.value)?.description}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="event_key" render={({ field }) => (<FormItem><FormLabel>Event key</FormLabel><FormControl><Input className="font-mono text-xs" placeholder="schedule.weekly_report" {...field} /></FormControl><FormDescription>Leave empty to use schedule.&lt;key&gt;.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField
                            control={form.control}
                            name="kind"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Schedule</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Schedule type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{JobKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {kind === "CRON" && <FormField control={form.control} name="cron_expression" render={({ field }) => (<FormItem><FormLabel>Cron expression</FormLabel><FormControl><Input className="font-mono" placeholder="0 9 * * 1" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                        {kind === "INTERVAL" && <FormField control={form.control} name="interval_seconds" render={({ field }) => (<FormItem><FormLabel>Every (seconds)</FormLabel><FormControl><Input type="number" min={30} {...field} value={(field.value as number | string | undefined) ?? ""} /></FormControl><FormMessage /></FormItem>)} />}
                        {kind === "ONCE" && <FormField control={form.control} name="run_at" render={({ field }) => (<FormItem><FormLabel>Run at</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                        <FormField control={form.control} name="timezone" render={({ field }) => (<FormItem><FormLabel>Timezone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {kind !== "ONCE" && (
                            <div>
                                <Button type="button" variant="outline" size="sm" loading={preview.isPending} onClick={() => preview.mutate({ kind, cron_expression: form.getValues("cron_expression"), interval_seconds: Number(form.getValues("interval_seconds")) || undefined, timezone: form.getValues("timezone") }, { onError: (e) => toast({ variant: "destructive", title: "Invalid schedule", description: getApiErrorMessage(e) }) })}>Preview next runs</Button>
                                {preview.data && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{preview.data.next_runs.map((d) => <li key={d}>{formatDateTime(d)}</li>)}</ul>}
                            </div>
                        )}
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create job</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
