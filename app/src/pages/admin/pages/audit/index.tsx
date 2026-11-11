import { useMemo, useState } from "react";
import { FileClock, Lock, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useAuditEvents, useAuditEventTypes } from "@/features/admin/audit/hooks/use-audit";
import type { AuditEvent } from "@/features/admin/audit/interfaces/audit.interfaces";
import { AuditActorTypeFilterOptions, AuditActorTypeFormOptions, AuditOutcomeFilterOptions, AuditRangeFilterOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { AuditOutcomeBadge } from "../../components/status-badges";
import { MemberPicker } from "../../components/member-picker";
import { AuditEventSheet } from "./components/audit-event-sheet";

/**
 * Audit log — /admin/audit?event_type=&actor_user_id=&actor_type=&resource_type=&outcome=&range=&q=
 * @perm organizations.audit.read (branch-scoped readers only see their branches' events)
 * @api GET /audit-events · GET /audit-events/:id · GET /audit-event-types
 */
export default function AuditPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const [, setSp] = useSearchParams();
    const types = useAuditEventTypes();
    const [openId, setOpenId] = useState<string | null>(null);

    // `range` is a UI preset; the API takes `from`.
    const query = useMemo(() => {
        const { range, actor_name: _n, ...rest } = params as Record<string, string | number>;
        return range ? { ...rest, from: new Date(Date.now() - Number(range) * 86400000).toISOString() } : rest;
    }, [params]);
    const events = useAuditEvents(query);
    const resourceTypes = useMemo(() => [...new Set((types.data ?? []).map((t) => t.resource))].sort(), [types.data]);

    const columns: DataTableColumn<AuditEvent>[] = [
        {
            key: "event",
            header: "Event",
            cell: (e) => {
                const meta = types.data?.find((t) => t.event_type === e.event_type);
                return (
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <code className="truncate text-[12.5px] text-foreground">{e.event_type}</code>
                            {meta?.sensitive && <Lock className="size-3 flex-none text-warning" aria-label="Sensitive" />}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{meta?.description ?? e.resource_type ?? ""}</div>
                    </div>
                );
            },
        },
        { key: "actor", header: "Actor", hideBelow: "md", cell: (e) => <span className="truncate">{e.actor_user ? personName(e.actor_user) : e.actor_service_account?.name ?? getDropdownOptionLabel(AuditActorTypeFormOptions, e.actor_type)}</span> },
        { key: "resource", header: "Resource", hideBelow: "lg", cell: (e) => <span className="text-muted-foreground">{e.resource_type ?? "—"}{e.resource_id && <code className="ml-1 text-xs">{e.resource_id.slice(0, 8)}</code>}</span> },
        { key: "when", header: "When", hideBelow: "sm", cell: (e) => <span className="whitespace-nowrap text-muted-foreground" title={formatDateTime(e.created_at)}>{formatRelative(e.created_at)}</span> },
        { key: "outcome", header: "Outcome", cell: (e) => <AuditOutcomeBadge outcome={e.outcome} /> },
    ];

    return (
        <Page>
            <PageHeader title="Audit log" description="Every change to access, settings and data, from every channel (app, API, agents, automation). Entries cannot be edited." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search event, resource id or IP…" className="flex-wrap">
                <Select value={filters.event_type ?? "all"} onValueChange={(v) => setFilter("event_type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-56" aria-label="Filter by event type"><SelectValue placeholder="All events" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All events</SelectItem>
                        {resourceTypes.map((res) => (
                            <SelectGroup key={res}>
                                <SelectLabel>{res}</SelectLabel>
                                {types.data?.filter((t) => t.resource === res).map((t) => <SelectItem key={t.event_type} value={t.event_type}>{t.event_type}</SelectItem>)}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filters.resource_type ?? "all"} onValueChange={(v) => setFilter("resource_type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by resource"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any resource</SelectItem>
                        {resourceTypes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.actor_type ?? "all"} onValueChange={(v) => setFilter("actor_type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by actor type"><SelectValue /></SelectTrigger>
                    <SelectContent>{AuditActorTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.outcome ?? "all"} onValueChange={(v) => setFilter("outcome", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by outcome"><SelectValue /></SelectTrigger>
                    <SelectContent>{AuditOutcomeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.range ?? "all"} onValueChange={(v) => setFilter("range", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by date"><SelectValue /></SelectTrigger>
                    <SelectContent>{AuditRangeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex w-full items-center gap-1 sm:w-56">
                    <MemberPicker
                        value={filters.actor_user_id}
                        valueLabel={filters.actor_name}
                        placeholder="Any person"
                        className="h-8"
                        onChange={(_id, label, m) => setSp((prev) => { const n = new URLSearchParams(prev); n.set("actor_user_id", m.user_id); n.set("actor_name", label); n.delete("page"); return n; })}
                    />
                    {filters.actor_user_id && <Button variant="ghost" size="icon-sm" aria-label="Clear person filter" onClick={() => setSp((prev) => { const n = new URLSearchParams(prev); n.delete("actor_user_id"); n.delete("actor_name"); return n; })}><X /></Button>}
                </div>
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
                onRowClick={(e) => setOpenId(e.id)}
                empty={{ icon: FileClock, title: "No events match", description: "Widen the date range or clear the filters." }}
            />
            <AuditEventSheet id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} />
        </Page>
    );
}
