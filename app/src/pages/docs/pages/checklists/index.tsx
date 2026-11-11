import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiChecklistKindFilterOptions, WikiChecklistKindFormOptions, WikiChecklistRunStatusFilterOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useChecklistRuns, useChecklists, useCreateChecklist } from "@/features/docs/hooks/use-docs";
import type { WikiChecklist, WikiChecklistKind, WikiChecklistRun } from "@/features/docs/interfaces/docs.interfaces";
import { DocsStatusBadge } from "../../components/docs-ui";

/**
 * /docs/checklists?tab=templates|runs — onboarding / offboarding checklists and their runs (15 §7)
 * @perm VIEW docs.pages.read · manage docs.checklists.manage
 * @api GET /docs/checklists · POST /docs/checklists · GET /docs/runs
 */
export default function ChecklistsPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const tab = filters.tab ?? "checklists";
    const listParams = { ...params };
    delete listParams.tab;
    const checklists = useChecklists(tab === "checklists" ? listParams : { limit: 1 });
    const runs = useChecklistRuns(tab === "runs" ? listParams : { limit: 1 });
    const canManage = usePermission("docs.checklists.manage");
    const [open, setOpen] = useState(false);

    const checklistColumns: DataTableColumn<WikiChecklist>[] = [
        { key: "name", header: "Checklist", cell: (c) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{c.name}</div>{c.description && <div className="truncate text-xs text-muted-foreground">{c.description}</div>}</div> },
        { key: "kind", header: "Kind", cell: (c) => <Badge variant={c.kind === "ONBOARDING" ? "info" : "violet"}>{getDropdownOptionLabel(WikiChecklistKindFormOptions, c.kind)}</Badge> },
        { key: "items", header: "Items", cell: (c) => <span className="tabular">{c._count?.items ?? 0}</span>, hideBelow: "sm" },
        { key: "runs", header: "Runs", cell: (c) => <span className="tabular">{c._count?.runs ?? 0}</span>, hideBelow: "md" },
        { key: "active", header: "Status", cell: (c) => (c.archived_at ? <Badge variant="neutral">Archived</Badge> : c.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>), hideBelow: "md" },
    ];
    const runColumns: DataTableColumn<WikiChecklistRun>[] = [
        { key: "subject", header: "Person", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{personName(r.subject.user)}</div><div className="truncate text-xs text-muted-foreground">{r.checklist.name}</div></div> },
        { key: "progress", header: "Progress", cell: (r) => <div className="flex min-w-24 items-center gap-2"><Progress value={r.progress_percent} className="h-1.5" /><span className="text-xs tabular text-muted-foreground">{r.progress_percent}%</span></div> },
        { key: "status", header: "Status", cell: (r) => <DocsStatusBadge status={r.status} />, hideBelow: "sm" },
        { key: "due", header: "Due", cell: (r) => (r.due_at ? formatDate(r.due_at) : "—"), hideBelow: "md" },
    ];

    return (
        <Page>
            <PageHeader title="Checklists" description="Repeatable onboarding and offboarding steps that link to the right pages and forms." actions={canManage && <Button onClick={() => setOpen(true)}><Plus /> New checklist</Button>} />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "checklists" ? null : v)}>
                <TabsList className="mb-4">
                    <TabsTrigger value="checklists">Checklists</TabsTrigger>
                    <TabsTrigger value="runs">Runs</TabsTrigger>
                </TabsList>
                <TabsContent value="checklists">
                    <TableToolbar search={search} onSearch={setSearch} placeholder="Search checklists…">
                        <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
                            <SelectContent>{WikiChecklistKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={checklistColumns} data={checklists.data?.data} rowKey={(c) => c.id} loading={checklists.isFetching} error={checklists.error} onRetry={() => checklists.refetch()} pagination={checklists.data?.pagination} onPageChange={setPage} rowHref={(c) => `/docs/checklists/${c.id}`} empty={{ icon: ListChecks, title: "No checklists yet", description: "Create an onboarding checklist and start it for each new member." }} />
                </TabsContent>
                <TabsContent value="runs">
                    <TableToolbar>
                        <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                            <SelectContent>{WikiChecklistRunStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={runColumns} data={runs.data?.data} rowKey={(r) => r.id} loading={runs.isFetching} error={runs.error} onRetry={() => runs.refetch()} pagination={runs.data?.pagination} onPageChange={setPage} rowHref={(r) => `/docs/checklist-runs/${r.id}`} empty={{ icon: ListChecks, title: "No runs", description: "Start a checklist for a member from the checklist page." }} />
                </TabsContent>
            </Tabs>
            <NewChecklistDialog open={open} onOpenChange={setOpen} onCreated={(id) => navigate(`/docs/checklists/${id}`)} />
        </Page>
    );
}

const schema = z.object({ name: z.string().trim().min(1, "Required").max(160), kind: z.enum(["ONBOARDING", "OFFBOARDING"]), description: z.string().max(2000).optional() });

function NewChecklistDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
    const create = useCreateChecklist();
    const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "", kind: "ONBOARDING", description: "" } });
    const submit = form.handleSubmit((v) => create.mutate({ name: v.name, kind: v.kind as WikiChecklistKind, description: v.description || undefined, items: [] }, {
        onSuccess: (c) => { toast({ title: "Checklist created — add its items" }); onOpenChange(false); form.reset(); onCreated(c.id); },
        onError: (e) => toast({ variant: "destructive", title: "Could not create", description: getApiErrorMessage(e) }),
    }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New checklist</DialogTitle><DialogDescription>You add the items on the next screen.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Developer onboarding" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="kind" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Kind</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{WikiChecklistKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
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
