import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliveryStatusFilterOptions, DigestFrequencyFormOptions, NotificationChannelOptions, SkipReasonFilterOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useDeliveries, useDigests, useEventLog } from "@/features/notifications/hooks/use-notification-admin";
import type { DeliveryRow, DigestRow, EventLogRow } from "@/features/notifications/interfaces/notification-admin.interfaces";
import { DeliveryStatusBadge, DigestStatusBadge, EventStatusBadge } from "../components/admin-ui";
import { DeliverySheet } from "./delivery-sheet";

type Tab = "deliveries" | "events" | "digests";

/**
 * /notifications/admin/log?tab=deliveries|events|digests — "why did / didn't X get this?" (14 §9, §13).
 * @perm notifications.audit.read (sensitive: addresses and content) · retry notifications.deliveries.retry
 * @api GET /notification-deliveries · GET /notification-events · GET /notification-digests · GET /notification-deliveries/:id
 */
export default function DeliveryLogPage() {
    const [sp, setSp] = useSearchParams();
    const tab = (["deliveries", "events", "digests"].includes(sp.get("tab") ?? "") ? sp.get("tab") : "deliveries") as Tab;
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const { tab: _tab, ...query } = params as Record<string, unknown>;
    const deliveries = useDeliveries(query, tab === "deliveries");
    const events = useEventLog(query, tab === "events");
    const digests = useDigests(query, tab === "digests");
    const [open, setOpen] = useState<string | null>(null);
    const stats = deliveries.data?.stats;

    const setTab = (t: string) => setSp(() => (t === "deliveries" ? new URLSearchParams() : new URLSearchParams({ tab: t })), { replace: true });

    const deliveryColumns: DataTableColumn<DeliveryRow>[] = [
        {
            key: "notification",
            header: "Notification",
            cell: (d) => (
                <div className="min-w-0">
                    <div className="truncate text-foreground">{d.notification.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.notification.recipient_membership ? personName(d.notification.recipient_membership.user) : "—"} · {formatRelative(d.created_at)}</div>
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (d) => getDropdownOptionLabel(NotificationChannelOptions, d.channel), hideBelow: "md" },
        { key: "status", header: "Status", cell: (d) => <DeliveryStatusBadge status={d.status} skip={d.skip_reason} /> },
        { key: "attempts", header: "Attempts", cell: (d) => <span className="tabular">{d.attempt_count}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "destination", header: "Destination", cell: (d) => <span className="text-muted-foreground">{d.destination ?? "—"}</span>, hideBelow: "xl" },
        { key: "sent", header: "Sent", cell: (d) => (d.sent_at ? formatDateTime(d.sent_at) : "—"), hideBelow: "lg" },
    ];
    const eventColumns: DataTableColumn<EventLogRow>[] = [
        {
            key: "event",
            header: "Event",
            cell: (e) => (
                <div className="min-w-0">
                    <code className="block truncate text-xs text-foreground">{e.event_key}</code>
                    <div className="truncate text-xs text-muted-foreground">{e.entity_label ?? e.entity_type ?? "—"}</div>
                </div>
            ),
        },
        { key: "actor", header: "Actor", cell: (e) => (e.actor ? personName(e.actor.user) : "System"), hideBelow: "md" },
        { key: "status", header: "Status", cell: (e) => <EventStatusBadge status={e.status} /> },
        { key: "count", header: "Notifications", cell: (e) => <span className="tabular">{e.notification_count}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "sm" },
        { key: "received", header: "Received", cell: (e) => formatDateTime(e.received_at), hideBelow: "lg" },
        { key: "error", header: "Error", cell: (e) => <span className="text-danger">{e.error ?? ""}</span>, hideBelow: "xl" },
    ];
    const digestColumns: DataTableColumn<DigestRow>[] = [
        { key: "recipient", header: "Recipient", cell: (g) => (g.membership ? personName(g.membership.user) : "—") },
        { key: "frequency", header: "Cadence", cell: (g) => getDropdownOptionLabel(DigestFrequencyFormOptions, g.frequency), hideBelow: "sm" },
        { key: "items", header: "Items", cell: (g) => <span className="tabular">{g.item_count}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "scheduled", header: "Scheduled", cell: (g) => formatDateTime(g.scheduled_for), hideBelow: "md" },
        { key: "status", header: "Status", cell: (g) => <DigestStatusBadge status={g.status} /> },
        { key: "failure", header: "Failure", cell: (g) => <span className="text-danger">{g.failure_reason ?? ""}</span>, hideBelow: "lg" },
    ];

    return (
        <Page>
            <PageHeader title="Delivery log" description="Every event, notification and channel attempt — for support and audit." />
            {stats && tab === "deliveries" && (
                <StatGrid className="mb-4">
                    <StatCard label="Deliveries (24 h)" value={stats.total_24h} />
                    <StatCard label="Sent" value={stats.sent_24h} tone="success" />
                    <StatCard label="Failed" value={stats.failed_24h} tone={stats.failed_24h ? "danger" : "default"} />
                    <StatCard label="Skipped" value={stats.skipped_24h} hint={`${stats.pending_24h} waiting`} tone={stats.skipped_24h ? "warning" : "default"} />
                </StatGrid>
            )}
            <Tabs value={tab} onValueChange={setTab} className="mb-3">
                <TabsList>
                    <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="digests">Digests</TabsTrigger>
                </TabsList>
            </Tabs>
            {tab !== "digests" && (
                <TableToolbar search={search} onSearch={setSearch} placeholder={tab === "events" ? "Search event key, record or key…" : "Search title or event key…"}>
                    {tab === "deliveries" && (
                        <>
                            <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                                <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                                <SelectContent>{DeliveryStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={filters.skip_reason ?? "all"} onValueChange={(v) => setFilter("skip_reason", v)}>
                                <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Filter by skip reason"><SelectValue /></SelectTrigger>
                                <SelectContent>{SkipReasonFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </>
                    )}
                </TableToolbar>
            )}
            {tab === "deliveries" && (
                <DataTable
                    columns={deliveryColumns} data={deliveries.data?.data} rowKey={(d) => d.id} loading={deliveries.isFetching} error={deliveries.error} onRetry={() => deliveries.refetch()}
                    pagination={deliveries.data?.pagination} onPageChange={setPage} onRowClick={(d) => setOpen(d.id)}
                    empty={{ icon: ScrollText, title: "No deliveries", description: "Email and other channel attempts appear here once notifications are sent." }}
                />
            )}
            {tab === "events" && (
                <DataTable
                    columns={eventColumns} data={events.data?.data} rowKey={(e) => e.id} loading={events.isFetching} error={events.error} onRetry={() => events.refetch()}
                    pagination={events.data?.pagination} onPageChange={setPage}
                    empty={{ icon: ScrollText, title: "No events", description: "Events appear when modules notify people." }}
                />
            )}
            {tab === "digests" && (
                <DataTable
                    columns={digestColumns} data={digests.data?.data} rowKey={(g) => g.id} loading={digests.isFetching} error={digests.error} onRetry={() => digests.refetch()}
                    pagination={digests.data?.pagination} onPageChange={setPage}
                    empty={{ icon: ScrollText, title: "No digests", description: "Digests are created for members who chose daily or weekly summaries." }}
                />
            )}
            <DeliverySheet id={open} onClose={() => setOpen(null)} />
        </Page>
    );
}
