import { Link, useSearchParams } from "react-router-dom";
import { Inbox, RefreshCw } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { EventSourceFilterOptions, EventSourceOptions, EventStateFilterOptions, ModuleKeyFilterOptions, ModuleKeyOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useAutomationEvent, useAutomationEvents, useReprocessEvent } from "@/features/automation/hooks/use-automation";
import type { PlatformEventRow } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, StatusBadge } from "../../components/automation-ui";

/**
 * /automation/events — event bus log (20 §2)
 * @perm VIEW automation.runs.read · reprocess automation.runs.manage
 * @api GET /automation/events · GET /automation/events/:id · POST /automation/events/:id/reprocess
 */
export default function EventLogPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const listParams = { ...params };
    delete listParams.event;
    const events = useAutomationEvents(listParams);
    const [sp, setSp] = useSearchParams();
    const openId = sp.get("event");
    const open = (id: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (id) n.set("event", id); else n.delete("event"); return n; });

    const columns: DataTableColumn<PlatformEventRow>[] = [
        {
            key: "key",
            header: "Event",
            cell: (e) => (
                <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-medium text-foreground">{e.event_key}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.entity_type ?? e.entity_kind ?? ""} {e.entity_id ? e.entity_id.slice(0, 8) : ""}</div>
                </div>
            ),
        },
        { key: "module", header: "Module", cell: (e) => getDropdownOptionLabel(ModuleKeyOptions, e.module), hideBelow: "md" },
        { key: "source", header: "Source", cell: (e) => <Badge variant="outline">{getDropdownOptionLabel(EventSourceOptions, e.source)}</Badge>, hideBelow: "lg" },
        { key: "actor", header: "Actor", cell: (e) => (e.actor_membership ? personName(e.actor_membership.user) : <span className="text-muted-foreground">{e.actor_type.toLowerCase()}</span>), hideBelow: "xl" },
        {
            key: "result",
            header: "Workflows",
            cell: (e) =>
                e.dead_lettered_at || e.processing_error ? <Badge variant="danger">Failed</Badge>
                    : !e.rules_processed_at ? <Badge variant="neutral">Pending</Badge>
                        : e.rules_matched_count ? <Badge variant="success">{e.rules_matched_count} started</Badge>
                            : <span className="text-xs text-muted-foreground">none</span>,
        },
        { key: "when", header: "When", cell: (e) => <span title={formatDateTime(e.occurred_at)}>{formatRelative(e.occurred_at)}</span>, hideBelow: "sm" },
    ];

    return (
        <Page>
            <PageHeader title="Event log" description="Every event modules publish on the bus, and which workflows and webhooks it reached." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search event keys…">
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>{ModuleKeyFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.source ?? "all"} onValueChange={(v) => setFilter("source", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by source"><SelectValue /></SelectTrigger>
                    <SelectContent>{EventSourceFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.state ?? "all"} onValueChange={(v) => setFilter("state", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by state"><SelectValue /></SelectTrigger>
                    <SelectContent>{EventStateFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={events.data?.data}
                rowKey={(e) => e.id}
                loading={events.isFetching}
                error={events.error}
                onRetry={() => events.refetch()}
                pagination={events.data?.pagination}
                onPageChange={setPage}
                onRowClick={(e) => open(e.id)}
                empty={{ icon: Inbox, title: "No events", description: "Events appear as soon as people and integrations change records." }}
            />
            <Sheet open={!!openId} onOpenChange={(o) => !o && open(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                    <EventDetail id={openId} />
                </SheetContent>
            </Sheet>
        </Page>
    );
}

function EventDetail({ id }: { id: string | null }) {
    const event = useAutomationEvent(id);
    const reprocess = useReprocessEvent();
    if (event.isPending) return <><SheetHeader><SheetTitle>Event</SheetTitle></SheetHeader><ListSkeleton /></>;
    if (event.error) return <><SheetHeader><SheetTitle>Event</SheetTitle></SheetHeader><ErrorState error={event.error} /></>;
    const e = event.data;
    return (
        <div className="space-y-5">
            <SheetHeader>
                <SheetTitle className="break-all font-mono text-sm">{e.event_key}</SheetTitle>
                <SheetDescription>{formatDateTime(e.occurred_at)} · {getDropdownOptionLabel(EventSourceOptions, e.source)}</SheetDescription>
            </SheetHeader>
            <KeyValueList
                items={[
                    { label: "Record", value: e.entity_id ? `${e.entity_type ?? e.entity_kind ?? ""} ${e.entity_id}` : null },
                    { label: "Actor", value: e.actor_membership ? personName(e.actor_membership.user) : e.actor_service_account?.name ?? e.actor_type },
                    { label: "Chain depth", value: String(e.trigger_depth) },
                    { label: "Caused by run", value: e.causation_run ? <Link className="text-info hover:underline" to={`/automation/runs/${e.causation_run.id}`}>{e.causation_run.rule.name}</Link> : null },
                    { label: "Processing", value: e.processing_error ?? (e.rules_processed_at ? `Matched ${e.rules_matched_count}` : "Pending") },
                ]}
            />
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-medium text-foreground">Runs started</h3>
                    <Can permission="automation.runs.manage">
                        <Button size="sm" variant="outline" loading={reprocess.isPending} onClick={() => reprocess.mutate(e.id, { onSuccess: (r) => toast({ title: `Reprocessed — ${r.runs_started} new run(s)` }), onError: (err) => toast({ variant: "destructive", title: "Could not reprocess", description: getApiErrorMessage(err) }) })}>
                            <RefreshCw /> Reprocess
                        </Button>
                    </Can>
                </div>
                {e.triggered_runs.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {e.triggered_runs.map((r) => (
                            <li key={r.id}><Link to={`/automation/runs/${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:bg-secondary"><span className="truncate">{r.rule.name}</span><StatusBadge status={r.status} /></Link></li>
                        ))}
                    </ul>
                ) : <p className="text-xs text-muted-foreground">No workflow ran for this event.</p>}
            </div>
            {e.webhook_deliveries.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-[13px] font-medium text-foreground">Webhook deliveries</h3>
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {e.webhook_deliveries.map((d) => <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]"><span className="truncate">{d.webhook.name}</span><StatusBadge status={d.status} /></li>)}
                    </ul>
                </div>
            )}
            <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Payload</h3><JsonBlock value={e.payload} /></div>
            {e.changes && <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Changes</h3><JsonBlock value={e.changes} /></div>}
        </div>
    );
}
