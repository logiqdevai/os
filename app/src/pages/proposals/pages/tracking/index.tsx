import { Link } from "react-router-dom";
import { Activity, Eye, Flame, MailX, Timer } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProposalEventTypeOptions } from "@/config/constants/dropdowns/proposals/proposal-status.options";
import { ProposalTrackingPeriodOptions, ProposalTrackingTypeFilterOptions } from "@/config/constants/dropdowns/proposals/proposal-tracking.options";
import { useProposalTracking } from "@/features/proposals/hooks/use-proposals";
import type { ProposalTrackingEvent, ProposalTrackingProposal } from "@/features/proposals/interfaces/proposals.interfaces";
import { ProposalStatusBadge } from "../../components/proposal-badges";

const duration = (s: number | null | undefined) => {
    if (!s) return "—";
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

const EVENT_TONE: Record<string, "info" | "success" | "warning" | "danger" | "violet" | "neutral"> = {
    VIEWED: "info", DOWNLOADED: "violet", ACCEPTED: "success", REJECTED: "danger", CHANGES_REQUESTED: "warning", COMMENTED: "neutral", EXPIRED: "warning",
};

/**
 * /proposals/tracking — what customers did with proposals: views, time on page, sections read, downloads, comments, decisions.
 * @perm proposals.proposals.read (scoped; IP and device are personal data shown to readers only)
 * @api GET /proposals/tracking?type=&from=&to=&search=&page=
 * @states loading · empty · error · no-access (route gate)
 */
export default function ProposalTrackingPage() {
    usePageMetadata({ title: "Proposal tracking" });
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const days = Number(filters.period ?? 30) || 30;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const { period: _p, ...rest } = params as Record<string, string | number>;
    const q = useProposalTracking({ ...rest, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    const t = q.data;

    const columns: DataTableColumn<ProposalTrackingEvent>[] = [
        {
            key: "type", header: "Event",
            cell: (e) => (
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={EVENT_TONE[e.type] ?? "neutral"}>{getDropdownOptionLabel(ProposalEventTypeOptions, e.type)}</Badge>
                    {e.reminder && <Badge variant="neutral">Reminder</Badge>}
                </div>
            ),
        },
        {
            key: "proposal", header: "Proposal",
            cell: (e) => (
                <div className="min-w-0">
                    <Link to={`/proposals/${e.proposal.id}?tab=activity`} className="font-mono text-[12.5px] text-foreground hover:underline">{e.proposal.number}</Link>
                    <div className="truncate text-xs text-muted-foreground">{e.proposal.title}{e.proposal.company ? ` · ${e.proposal.company}` : ""}</div>
                </div>
            ),
        },
        { key: "actor", header: "By", hideBelow: "md", cell: (e) => <span className="text-[13px] text-foreground">{e.contact ?? e.detail ?? (e.actor === "customer" ? "Customer" : e.actor === "staff" ? "Team" : "System")}</span> },
        {
            key: "engagement", header: "Engagement", hideBelow: "sm",
            cell: (e) => e.type === "VIEWED"
                ? <span className="text-[13px] text-foreground">{duration(e.time_on_page_seconds)}{e.sections_opened ? <span className="text-muted-foreground"> · {e.sections_opened} sections</span> : null}</span>
                : <span className="text-muted-foreground">—</span>,
        },
        { key: "device", header: "Device", hideBelow: "xl", cell: (e) => <span className="block max-w-56 truncate text-xs text-muted-foreground" title={e.user_agent ?? undefined}>{[e.ip_address, e.user_agent].filter(Boolean).join(" · ") || "—"}</span> },
        { key: "when", header: "When", cell: (e) => <span className="whitespace-nowrap text-[13px] text-muted-foreground" title={formatDateTime(e.created_at)}>{formatRelative(e.created_at)}</span> },
    ];

    return (
        <Page>
            <PageHeader
                title="Tracking"
                description="What customers did with your proposals, newest first."
                actions={
                    <Select value={String(days)} onValueChange={(v) => setFilter("period", v === "30" ? null : v)}>
                        <SelectTrigger className="h-8 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{ProposalTrackingPeriodOptions.map((o) => <SelectItem key={String(o.id)} value={String(o.id)}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                }
            />

            {q.isPending ? (
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}</div>
            ) : t ? (
                <StatGrid className="mb-6">
                    <StatCard label="Views today" value={t.summary.views_today} hint={`${t.summary.views_in_range} in period`} icon={Eye} tone="info" />
                    <StatCard label="Hot proposals" value={t.summary.hot_proposals} hint="3+ views in 24h" icon={Flame} tone={t.summary.hot_proposals ? "success" : "default"} />
                    <StatCard label="Not opened" value={t.summary.not_opened} hint="sent over 3 days ago" icon={Activity} tone={t.summary.not_opened ? "warning" : "default"} />
                    <StatCard label="Avg. time on page" value={duration(t.summary.avg_time_on_page_seconds)} hint={`${t.summary.delivery_failures} delivery failure${t.summary.delivery_failures === 1 ? "" : "s"}`} icon={t.summary.delivery_failures ? MailX : Timer} tone={t.summary.delivery_failures ? "danger" : "default"} />
                </StatGrid>
            ) : null}

            {t && t.proposals.length > 0 && (
                <Section title="Most viewed" description="Views, time on page and the sections customers spent time on.">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {t.proposals.map((p) => <EngagementCard key={p.id} p={p} />)}
                    </div>
                </Section>
            )}

            <Section title="Activity">
                <TableToolbar search={search} onSearch={setSearch} placeholder="Search proposal or customer…">
                    <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Event type"><SelectValue /></SelectTrigger>
                        <SelectContent>{ProposalTrackingTypeFilterOptions.map((o) => <SelectItem key={String(o.id)} value={String(o.id)}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </TableToolbar>
                <DataTable
                    columns={columns}
                    data={t?.events.data}
                    rowKey={(e) => e.id}
                    loading={q.isPending}
                    error={q.error}
                    onRetry={() => q.refetch()}
                    pagination={t?.events.pagination}
                    onPageChange={setPage}
                    empty={{ icon: Eye, title: "No customer activity in this period", description: "Views, downloads, comments and decisions appear here once customers open sent proposals." }}
                />
            </Section>
            {q.error && !t && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        </Page>
    );
}

function EngagementCard({ p }: { p: ProposalTrackingProposal }) {
    const max = Math.max(1, ...p.sections.map((s) => s.seconds));
    return (
        <Link to={`/proposals/${p.id}?tab=activity`} className="block min-w-0 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">{p.number}</span>
                        {p.hot && <Badge variant="success"><Flame className="size-3" /> Hot</Badge>}
                    </div>
                    <div className="truncate text-[13.5px] font-medium text-foreground">{p.title}</div>
                    {p.company && <div className="truncate text-xs text-muted-foreground">{p.company}</div>}
                </div>
                {p.status && <ProposalStatusBadge status={p.status} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span><span className="tabular text-foreground">{p.views}</span> views</span>
                <span><span className="tabular text-foreground">{duration(p.time_on_page_seconds)}</span> on page</span>
                <span>last {formatRelative(p.last_viewed_at)}</span>
            </div>
            {p.sections.length > 0 ? (
                <ul className="mt-2 space-y-1">
                    {p.sections.map((s) => (
                        <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                            <div className="min-w-0">
                                <div className="truncate text-foreground">{s.title}</div>
                                <ProgressBar className="mt-0.5" value={Math.max(4, (s.seconds / max) * 100)} />
                            </div>
                            <span className="tabular text-muted-foreground">{duration(s.seconds)}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-xs text-muted-foreground">No section reading data yet.</p>
            )}
        </Link>
    );
}

