import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useCrmForecast } from "@/features/crm/insights/hooks/use-insights";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import { CrmPaths } from "../../crm-paths";
import { MemberAvatar, Money } from "../../components/crm-ui";

const HORIZONS = ["3", "6", "12"] as const;

/**
 * Forecast by expected close month (mockup `forecast`, 02 §11).
 * @route /crm/forecast?pipeline_id=&owner=&months=
 * @perm VIEW crm.forecast.read · money crm.financials.read (counts only without it)
 * @api GET /crm/forecast
 */
export default function ForecastPage() {
    const { filters, setFilter } = useListParams();
    const pipelines = usePipelines();
    const months = filters.months ?? "6";
    const forecast = useCrmForecast({ pipeline_id: filters.pipeline_id, owner: filters.owner, months });
    const [open, setOpen] = useState<string | null>(null);

    if (forecast.isPending) return <PageSkeleton />;
    if (forecast.error) return <Page><PageHeader title="Forecast" /><ErrorState error={forecast.error} onRetry={() => forecast.refetch()} /></Page>;
    const f = forecast.data;
    const cur = f.currency ?? "EUR";

    return (
        <Page>
            <PageHeader
                title="Forecast"
                description={f.financials_hidden ? "Amounts are hidden — you need the CRM financials permission." : "Open deals by expected close month, weighted by probability."}
                actions={
                    <>
                        <Select value={filters.pipeline_id ?? "all"} onValueChange={(v) => setFilter("pipeline_id", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Pipeline"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All pipelines</SelectItem>
                                {pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Owner"><SelectValue /></SelectTrigger>
                            <SelectContent>{OwnerFilterOptions.filter((o) => o.id !== "unassigned").map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "all" ? "Whole team" : "Only mine"}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={months} onValueChange={(v) => setFilter("months", v === "6" ? null : v)}>
                            <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Horizon"><SelectValue /></SelectTrigger>
                            <SelectContent>{HORIZONS.map((h) => <SelectItem key={h} value={h}>{h} months</SelectItem>)}</SelectContent>
                        </Select>
                    </>
                }
            />
            <StatGrid className="mb-5">
                <StatCard label="Open deals" value={f.totals.count} />
                <StatCard label="Total pipeline" value={<Money value={f.totals.total} currency={cur} compact />} />
                <StatCard label="Weighted forecast" tone="info" value={<Money value={f.totals.weighted} currency={cur} compact />} />
                <StatCard label="Commit" tone="success" value={<Money value={f.totals.commit} currency={cur} compact />} hint={<>Won in period <Money value={f.totals.won} currency={cur} compact /></>} />
            </StatGrid>
            {!f.totals.count && !f.totals.won ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState icon={TrendingUp} title="Nothing to forecast yet" description="Open deals with an expected close date appear here." /></div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-xs">Period</TableHead>
                                <TableHead className="text-right text-xs">Deals</TableHead>
                                <TableHead className="hidden text-right text-xs sm:table-cell">Total</TableHead>
                                <TableHead className="text-right text-xs">Weighted</TableHead>
                                <TableHead className="hidden text-right text-xs md:table-cell">Commit</TableHead>
                                <TableHead className="hidden text-right text-xs lg:table-cell">Best case</TableHead>
                                <TableHead className="hidden text-right text-xs md:table-cell">Won</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {f.buckets.map((b) => (
                                <Fragment key={b.key}>
                                    <TableRow className={cn("border-border-soft", b.count && "cursor-pointer")} onClick={() => b.count && setOpen(open === b.key ? null : b.key)} aria-expanded={b.count ? open === b.key : undefined}>
                                        <TableCell className={cn("text-[13px] font-medium", b.key === "overdue" ? "text-danger" : "text-foreground")}>
                                            <span className="inline-flex items-center gap-1">{b.count ? (open === b.key ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : <span className="w-3.5" />}{b.label}</span>
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] tabular">{b.count}</TableCell>
                                        <TableCell className="hidden text-right text-[13px] sm:table-cell"><Money value={b.total} currency={cur} /></TableCell>
                                        <TableCell className="text-right text-[13px] font-medium"><Money value={b.weighted} currency={cur} /></TableCell>
                                        <TableCell className="hidden text-right text-[13px] md:table-cell"><Money value={b.commit} currency={cur} /></TableCell>
                                        <TableCell className="hidden text-right text-[13px] lg:table-cell"><Money value={b.best_case} currency={cur} /></TableCell>
                                        <TableCell className="hidden text-right text-[13px] md:table-cell">{b.won_count ? <Money value={b.won} currency={cur} /> : <span className="text-ash">—</span>}</TableCell>
                                    </TableRow>
                                    {open === b.key && b.deals.map((d) => (
                                        <TableRow key={d.id} className="border-border-soft bg-secondary/50">
                                            <TableCell colSpan={2} className="text-[13px]">
                                                <div className="flex min-w-0 items-center gap-2 pl-5">
                                                    <MemberAvatar member={d.owner} />
                                                    <div className="min-w-0">
                                                        <Link to={CrmPaths.deal(d.id)} className="block truncate text-foreground hover:underline">{d.name}</Link>
                                                        <div className="truncate text-xs text-muted-foreground">{[d.company?.name, d.stage.name, formatDate(d.expected_close_date)].filter(Boolean).join(" · ")}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden text-right text-[13px] sm:table-cell"><Money value={d.value} currency={d.currency} /></TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground tabular">{d.probability ?? d.stage.probability}%</TableCell>
                                            <TableCell colSpan={3} className="hidden md:table-cell" />
                                        </TableRow>
                                    ))}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Page>
    );
}
