import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Rocket } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { useCreateRelease, useReleases } from "@/features/tasks/hooks/use-tasks";
import type { Release } from "@/features/tasks/interfaces/tasks.interfaces";
import { releaseFormSchema, type ReleaseFormValues } from "@/features/tasks/validation-schemas/tasks.schema";
import { ReleaseStatusFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { ProjectPicker } from "../../components/task-pickers";
import { releaseVariant } from "../../components/task-badges";

/**
 * /tasks/releases — shippable sets of tasks with deployments.
 * @perm VIEW tasks.tasks.read · manage tasks.releases.manage · @api GET/POST /releases
 */
export default function ReleasesPage() {
    const { params, setPage, search, setSearch } = useListParams({ limit: 25 });
    const releases = useReleases(params);
    const [open, setOpen] = useState(false);
    const columns: DataTableColumn<Release>[] = [
        { key: "name", header: "Release", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.name} {r.version && <span className="font-mono text-xs text-muted-foreground">{r.version}</span>}</div><div className="truncate text-xs text-muted-foreground">{r.project?.name ?? r.team?.name ?? "—"}</div></div> },
        { key: "status", header: "Status", cell: (r) => <Badge variant={releaseVariant[r.status]}>{getDropdownOptionLabel(ReleaseStatusFormOptions, r.status)}</Badge> },
        {
            key: "progress", header: "Progress", hideBelow: "md",
            cell: (r) => {
                const pct = r.progress?.total ? Math.round((r.progress.done / r.progress.total) * 100) : 0;
                return <div className="flex min-w-28 items-center gap-2"><ProgressBar value={pct} /><span className="text-xs tabular text-muted-foreground">{r.progress?.done ?? 0}/{r.progress?.total ?? 0}</span></div>;
            },
        },
        { key: "deploy", header: "Latest deploy", hideBelow: "lg", cell: (r) => (r.deployments[0] ? `${r.deployments[0].environment} · ${r.deployments[0].status.toLowerCase().replace("_", " ")}` : "—") },
        { key: "date", header: "Target", hideBelow: "sm", cell: (r) => (r.released_at ? `Released ${formatDate(r.released_at)}` : formatDate(r.target_date)) },
    ];
    return (
        <Page>
            <PageHeader title="Releases" description="Group finished work into versions and track deployments." actions={<Can permission="tasks.releases.manage"><Button onClick={() => setOpen(true)}><Plus /> New release</Button></Can>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search releases…" />
            <DataTable
                columns={columns}
                data={releases.data?.data}
                rowKey={(r) => r.id}
                loading={releases.isFetching}
                error={releases.error}
                onRetry={() => releases.refetch()}
                pagination={releases.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/tasks/releases/${r.id}`}
                empty={{ icon: Rocket, title: search ? "No releases match" : "No releases yet" }}
            />
            <ReleaseDialog open={open} onOpenChange={setOpen} />
        </Page>
    );
}

function ReleaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateRelease();
    const form = useForm<ReleaseFormValues>({ resolver: zodResolver(releaseFormSchema) });
    useEffect(() => { if (open) form.reset({ name: "", version: "", project_id: null, target_date: "", notes: "", customer_visible: false }); }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate({ ...v, version: v.version || undefined, project_id: v.project_id ?? undefined, target_date: v.target_date || undefined, notes: v.notes || undefined }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New release</DialogTitle><DialogDescription>Add tasks to it from the task's Release field or the release page.</DialogDescription></DialogHeader>
                        <div className="grid grid-cols-[1fr_7rem] gap-4">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Website 2.0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="version" render={({ field }) => (<FormItem><FormLabel>Version</FormLabel><FormControl><Input placeholder="2.0.0" {...field} /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="project_id" render={({ field }) => (<FormItem><FormLabel>Project</FormLabel><ProjectPicker value={field.value} onChange={field.onChange} /></FormItem>)} />
                        <FormField control={form.control} name="target_date" render={({ field }) => (<FormItem><FormLabel>Target date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Release notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="customer_visible" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-border p-3"><FormLabel className="font-normal">Visible to customers</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create release</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
