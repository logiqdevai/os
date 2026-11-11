import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Building2, Check, MoreHorizontal, Pencil, Plus, X } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useArchiveResource, useCreateResource, useDecideResourceRequest, useResourceRequests, useResources, useUpdateResource } from "@/features/calendar/hooks/use-calendar";
import type { Resource } from "@/features/calendar/interfaces/calendar.interfaces";
import { resourceFormSchema, type ResourceFormValues } from "@/features/calendar/validation-schemas/calendar.schema";
import { ResourceKindFilterOptions, ResourceKindFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/format";

function ResourceFormDialog({ open, onOpenChange, resource }: { open: boolean; onOpenChange: (o: boolean) => void; resource: Resource | null }) {
    const create = useCreateResource();
    const update = useUpdateResource();
    const form = useForm<ResourceFormValues>({ resolver: zodResolver(resourceFormSchema), defaultValues: { name: "", kind: "ROOM", requires_approval: false } });
    useEffect(() => {
        if (open) form.reset({ name: resource?.name ?? "", kind: resource?.kind ?? "ROOM", code: resource?.code ?? "", capacity: resource?.capacity ? String(resource.capacity) : "", location: resource?.location ?? "", description: resource?.description ?? "", requires_approval: resource?.requires_approval ?? false });
    }, [open, resource, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { name: v.name, kind: v.kind, code: v.code || undefined, capacity: v.capacity ? Number(v.capacity) : undefined, location: v.location || undefined, description: v.description || undefined, requires_approval: v.requires_approval };
        const options = { onSuccess: () => onOpenChange(false) };
        if (resource) update.mutate({ id: resource.id, ...dto }, options);
        else create.mutate(dto, options);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{resource ? "Edit resource" : "New resource"}</DialogTitle>
                            <DialogDescription>Rooms and equipment people can add to events. Double bookings are blocked.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Aegean room" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField control={form.control} name="kind" render={({ field }) => (
                                <FormItem><FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ResourceKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="ATH-1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="capacity" render={({ field }) => (<FormItem><FormLabel>Capacity</FormLabel><FormControl><Input inputMode="numeric" placeholder="8" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Athens office, 2nd floor" {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="requires_approval" render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Requires approval" /></FormControl>
                                <FormLabel className="font-normal">Bookings need approval</FormLabel>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{resource ? "Save changes" : "Create resource"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * /calendar/resources — rooms and equipment (19 §6).
 * @perm view calendar.events.read(_own) · manage + approve calendar.resources.manage
 * @api GET/POST/PATCH /calendar/resources · POST /:id/archive · GET /calendar/resources/requests · POST /:id/requests/:eventId/approve|decline
 */
export default function ResourcesPage() {
    const { search, setSearch, filters, setFilter } = useListParams();
    const canManage = usePermission("calendar.resources.manage");
    const resources = useResources({ ...(filters.kind ? { kind: filters.kind } : {}), ...(search ? { search } : {}) });
    const requests = useResourceRequests(canManage);
    const decide = useDecideResourceRequest();
    const archive = useArchiveResource();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Resource | null>(null);
    const [archiving, setArchiving] = useState<Resource | null>(null);

    const columns: DataTableColumn<Resource>[] = [
        { key: "name", header: "Resource", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.name}</div>{r.location && <div className="truncate text-xs text-muted-foreground">{r.location}</div>}</div> },
        { key: "kind", header: "Kind", cell: (r) => <Badge>{getDropdownOptionLabel(ResourceKindFormOptions, r.kind)}</Badge>, hideBelow: "sm" },
        { key: "capacity", header: "Capacity", cell: (r) => (r.capacity ? <span className="tabular">{r.capacity}</span> : "—"), hideBelow: "md" },
        { key: "approval", header: "Approval", cell: (r) => (r.requires_approval ? "Required" : "Automatic"), hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (r) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(r); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(r)}><Archive /> Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Rooms & resources"
                description="Book rooms and equipment when you create an event."
                actions={<Can permission="calendar.resources.manage"><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New resource</Button></Can>}
            />
            {canManage && !!requests.data?.length && (
                <Section title="Waiting for approval" className="mb-6">
                    <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {requests.data.map((q) => (
                            <li key={q.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 text-[13px]">
                                    <p className="truncate font-medium text-foreground">{q.resource.name} · {q.event.title}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(q.event.starts_at)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" loading={decide.isPending} onClick={() => decide.mutate({ resourceId: q.resource.id, eventId: q.event.id, decision: "decline" })}><X /> Decline</Button>
                                    <Button size="sm" loading={decide.isPending} onClick={() => decide.mutate({ resourceId: q.resource.id, eventId: q.event.id, decision: "approve" })}><Check /> Approve</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search resources…">
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{ResourceKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={resources.data}
                rowKey={(r) => r.id}
                loading={resources.isFetching}
                error={resources.error}
                onRetry={() => resources.refetch()}
                empty={{ icon: Building2, title: search ? "No resources match" : "No rooms yet", description: canManage ? "Create the first room or piece of equipment." : "Ask an administrator to add rooms.", action: canManage && !search ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New resource</Button> : undefined }}
            />
            <ResourceFormDialog open={formOpen} onOpenChange={setFormOpen} resource={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="It can no longer be added to events. Existing bookings stay."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) })}
            />
        </Page>
    );
}
