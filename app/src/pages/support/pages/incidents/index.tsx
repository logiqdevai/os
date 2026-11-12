import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Siren } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermission } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    IncidentSeverityFilterOptions, IncidentSeverityOptions, IncidentSeverityTone, IncidentStatusFilterOptions, IncidentStatusOptions, IncidentStatusTone,
} from "@/config/constants/dropdowns/support/support.options";
import { useCreateIncident, useIncidents } from "@/features/support/hooks/use-support";
import { incidentFormSchema, type IncidentFormValues } from "@/features/support/validation-schemas/support.schema";
import type { IncidentListItem } from "@/features/support/interfaces/support.interfaces";
import { SUPPORT_PATHS } from "../../support-paths";

/**
 * Incidents — /support/incidents (13 §3, §5; mockup 13-support `incidents`).
 * One problem affecting many customers: tickets grouped under it and a status-page style timeline.
 * @perm VIEW support.tickets.read · declare / update support.tickets.update · customer-visible updates support.incidents.publish
 * @api GET/POST /support/incidents
 */
export default function IncidentsPage() {
    usePageMetadata({ title: "Incidents" });
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const incidents = useIncidents(params);
    const canCreate = usePermission("support.tickets.update");
    const [open, setOpen] = useState(false);

    const columns: DataTableColumn<IncidentListItem>[] = [
        {
            key: "title",
            header: "Incident",
            cell: (i) => (
                <div className="min-w-0">
                    <Link to={SUPPORT_PATHS.incident(i.id)} className="block truncate font-medium text-foreground hover:underline">{i.title}</Link>
                    <div className="truncate text-xs text-muted-foreground">{i.updates[0] ? i.updates[0].body : i.affected_services.join(", ") || "No updates yet"}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (i) => <Badge variant={IncidentStatusTone[i.status]}>{getDropdownOptionLabel(IncidentStatusOptions, i.status)}</Badge> },
        { key: "severity", header: "Severity", cell: (i) => <Badge variant={IncidentSeverityTone[i.severity]}>{getDropdownOptionLabel(IncidentSeverityOptions, i.severity)}</Badge>, hideBelow: "sm" },
        { key: "tickets", header: "Tickets", cell: (i) => <span className="tabular">{i._count?.tickets ?? i.ticket_count}</span>, hideBelow: "md", className: "text-right", headerClassName: "text-right" },
        { key: "started", header: "Started", cell: (i) => <span className="text-xs text-muted-foreground">{formatRelative(i.first_reported_at ?? i.created_at)}</span>, hideBelow: "lg" },
    ];

    return (
        <Page>
            <PageHeader
                title="Incidents"
                description="Group tickets about the same problem and keep customers informed with status updates."
                actions={<Can permission="support.tickets.update"><Button onClick={() => setOpen(true)}><Plus /> Declare incident</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search incidents…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{IncidentStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.severity ?? "all"} onValueChange={(v) => setFilter("severity", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Severity"><SelectValue /></SelectTrigger>
                    <SelectContent>{IncidentSeverityFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={incidents.data?.data}
                rowKey={(i) => i.id}
                loading={incidents.isFetching}
                error={incidents.error}
                onRetry={() => incidents.refetch()}
                pagination={incidents.data?.pagination}
                onPageChange={setPage}
                rowHref={(i) => SUPPORT_PATHS.incident(i.id)}
                empty={{ icon: Siren, title: search ? "No incidents match" : "No incidents", description: "When several customers report the same problem, declare an incident and link their tickets.", action: canCreate && !search ? <Button size="sm" onClick={() => setOpen(true)}><Plus /> Declare incident</Button> : undefined }}
            />
            <IncidentDialog open={open} onOpenChange={setOpen} />
        </Page>
    );
}

function IncidentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateIncident();
    const navigate = useNavigate();
    const form = useForm<IncidentFormValues>({ resolver: zodResolver(incidentFormSchema), defaultValues: { title: "", description: "", severity: "MINOR", affected_services: "" } });
    const submit = form.handleSubmit((v) =>
        create.mutate(
            { title: v.title, description: v.description || undefined, severity: v.severity, affected_services: (v.affected_services ?? "").split(",").map((x) => x.trim()).filter(Boolean) },
            {
                onSuccess: (inc) => { onOpenChange(false); form.reset(); navigate(SUPPORT_PATHS.incident(inc.id)); },
            },
        ),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>Declare an incident</DialogTitle><DialogDescription>Link affected tickets and post updates from the incident page.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input autoFocus placeholder="Checkout errors for EU customers" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>What is happening</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="severity" render={({ field }) => (
                                <FormItem><FormLabel>Severity</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{IncidentSeverityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="affected_services" render={({ field }) => (<FormItem><FormLabel>Affected services</FormLabel><FormControl><Input placeholder="Checkout, API" {...field} /></FormControl><FormDescription>Separated by commas.</FormDescription></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Declare</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
