import { Link } from "react-router-dom";
import { BookOpen, CheckCheck, Clock, Eye, Search } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DocsAnalyticsPeriodOptions, WikiPageStatusOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useDocsAnalytics, useSpaces } from "@/features/docs/hooks/use-docs";
import { DocIcon } from "../../components/docs-ui";

const ALL = "all";

/**
 * /docs/analytics — reader analytics (15 §2, §7): views, popular pages, searches without results, review and
 * acknowledgement health. Only pages the viewer can read are counted.
 * @perm VIEW docs.analytics.read @api GET /docs/analytics?days=&space_id=
 * @states loading · error/403 · no views in the period
 */
export default function DocsAnalyticsPage() {
    const { filters, setFilter } = useListParams({ filters: { days: "30", space: ALL } });
    const days = Number(filters.days ?? "30");
    const spaceId = filters.space && filters.space !== ALL ? filters.space : undefined;
    const analytics = useDocsAnalytics({ days, space_id: spaceId });
    const spaces = useSpaces({ limit: 200 });

    const header = (
        <PageHeader
            title="Docs analytics"
            description="What people read and search for, and which pages need attention."
            actions={
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={filters.space ?? ALL} onValueChange={(v) => setFilter("space", v)}>
                        <SelectTrigger className="h-8 sm:w-48" aria-label="Space"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>All spaces</SelectItem>
                            {spaces.data?.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={String(days)} onValueChange={(v) => setFilter("days", v)}>
                        <SelectTrigger className="h-8 sm:w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{DocsAnalyticsPeriodOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            }
        />
    );

    if (analytics.isPending) return <PageSkeleton />;
    if (analytics.error) return <Page>{header}<ErrorState error={analytics.error} onRetry={() => analytics.refetch()} /></Page>;
    const a = analytics.data;
    const ackRate = a.acknowledgements.total ? Math.round((a.acknowledgements.acknowledged / a.acknowledgements.total) * 100) : null;
    const maxDay = Math.max(1, ...a.views.daily.map((d) => d.views));
    const maxTop = Math.max(1, ...a.views.top_pages.map((t) => t.views));

    return (
        <Page width="wide">
            {header}
            <StatGrid className="mb-6">
                <StatCard label="Pages" value={a.pages.total} hint={`${a.pages.by_status.PUBLISHED ?? 0} published · ${a.pages.by_status.DRAFT ?? 0} drafts`} icon={BookOpen} />
                <StatCard label="Views" value={a.views.total} hint={`Last ${days} days`} icon={Eye} />
                <StatCard label="Review overdue" value={a.pages.review_overdue} hint="Past their review date" tone={a.pages.review_overdue ? "warning" : "success"} icon={Clock} />
                <StatCard label="Acknowledged" value={ackRate === null ? "—" : `${ackRate}%`} hint={`${a.acknowledgements.acknowledged} of ${a.acknowledgements.total} required readings`} icon={CheckCheck} />
            </StatGrid>

            <Section title="Views per day" className="mb-6">
                <div className="rounded-lg border border-border bg-card p-4">
                    {!a.views.daily.length ? (
                        <p className="text-[13px] text-muted-foreground">No page views in this period.</p>
                    ) : (
                        <>
                            <div className="flex h-32 items-end gap-0.5" role="img" aria-label={`Views per day, highest ${maxDay}`}>
                                {a.views.daily.map((d) => (
                                    <div key={d.day} className="flex-1 rounded-t bg-primary/70 hover:bg-primary" style={{ height: `${Math.max(2, (d.views / maxDay) * 100)}%` }} title={`${formatDate(d.day)}: ${d.views} views, ${d.readers} readers`} />
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                                <span>{formatDate(a.views.daily[0].day)}</span>
                                <span>{formatDate(a.views.daily[a.views.daily.length - 1].day)}</span>
                            </div>
                        </>
                    )}
                </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Most read pages">
                    <div className="rounded-lg border border-border bg-card p-3">
                        {!a.views.top_pages.length ? <p className="text-[13px] text-muted-foreground">No views yet.</p> : (
                            <ul className="space-y-3">
                                {a.views.top_pages.map((t) => (
                                    <li key={t.page.id} className="space-y-1">
                                        <div className="flex items-center gap-2 text-[13px]">
                                            <DocIcon icon={t.page.icon} />
                                            <Link to={`/docs/pages/${t.page.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">{t.page.title}</Link>
                                            <span className="tabular text-foreground">{t.views}</span>
                                        </div>
                                        <ProgressBar value={(t.views / maxTop) * 100} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Section>
                <Section title="Searches">
                    <div className="space-y-3">
                        <QueryList title="Top searches" rows={a.search.top} empty="No searches in this period." />
                        <QueryList title="Searches with no results" rows={a.search.zero_results} empty="Every search found something." warn />
                    </div>
                </Section>
            </div>

            <Section title="Pages by status" className="mt-6">
                <div className="flex flex-wrap gap-2">
                    {Object.entries(a.pages.by_status).map(([status, n]) => <Badge key={status} variant="neutral">{getDropdownOptionLabel(WikiPageStatusOptions, status)}: {n}</Badge>)}
                </div>
            </Section>
        </Page>
    );
}

function QueryList({ title, rows, empty, warn }: { title: string; rows: { query: string; count: number }[]; empty: string; warn?: boolean }) {
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Search className="size-3.5" />{title}</div>
            {!rows.length ? <p className="text-xs text-muted-foreground">{empty}</p> : (
                <ul className="space-y-1.5">
                    {rows.map((r) => (
                        <li key={r.query} className="flex items-center gap-2 text-[13px]">
                            <span className={warn ? "min-w-0 flex-1 truncate text-warning" : "min-w-0 flex-1 truncate text-foreground"}>{r.query}</span>
                            <span className="tabular text-muted-foreground">{r.count}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
