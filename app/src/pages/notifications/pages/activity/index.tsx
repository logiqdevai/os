import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Page, PageHeader } from "@/components/ui/page";
import { TableToolbar } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { useActivity } from "@/features/notifications/hooks/use-notifications";
import type { ActivityItem } from "@/features/notifications/interfaces/notifications.interfaces";
import { initials, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleFilterOptions, ModuleLabelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { entityLink } from "@/lib/entity-link";

const dayLabel = (iso: string) => {
    const d = parseISO(iso);
    return isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, d MMMM yyyy");
};

/**
 * /notifications/activity — organization activity feed (14 §7), scope-limited by the API.
 * @perm notifications.activity.read
 * @api GET /activity?module=&search=&project_id=&company_id=
 */
export default function ActivityPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const feed = useActivity(params);

    const groups = useMemo(() => {
        const out: { day: string; rows: ActivityItem[] }[] = [];
        for (const r of feed.data?.data ?? []) {
            const day = dayLabel(r.occurred_at);
            const last = out[out.length - 1];
            if (last?.day === day) last.rows.push(r);
            else out.push({ day, rows: [r] });
        }
        return out;
    }, [feed.data]);

    const pagination = feed.data?.pagination;

    return (
        <Page width="wide">
            <PageHeader title="Activity" description="What happened across the organization, limited to what you can see." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search activity…">
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>{ModuleFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {feed.isLoading ? (
                    <ListSkeleton rows={8} />
                ) : feed.error ? (
                    <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
                ) : !groups.length ? (
                    <EmptyState icon={Activity} title="No activity for these filters" description="Activity is written by each module as people work." />
                ) : (
                    groups.map((g) => (
                        <div key={g.day}>
                            <div className="sticky top-0 border-b border-border bg-secondary/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">{g.day}</div>
                            {g.rows.map((r) => {
                                const href = entityLink(r.entity_type, r.entity_id);
                                const name = r.actor ? personName(r.actor.user) : "System";
                                return (
                                    <div key={r.id} className="flex gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
                                        <Avatar className="size-7 shrink-0">
                                            {r.actor?.user.profile_photo_url && <AvatarImage src={r.actor.user.profile_photo_url} alt="" />}
                                            <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] text-body">
                                                <span className="font-medium text-foreground">{name}</span>{" "}
                                                {r.summary.startsWith(name) ? r.summary.slice(name.length).trim() : r.summary}
                                            </p>
                                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                                <span className="tabular">{format(parseISO(r.occurred_at), "HH:mm")}</span>
                                                <span>· {getDropdownOptionLabel(ModuleLabelOptions, r.module)}</span>
                                                {r.entity_label && (href ? <Link to={href} className="truncate underline-offset-2 hover:text-foreground hover:underline">· {r.entity_label}</Link> : <span className="truncate">· {r.entity_label}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
                {pagination && pagination.total_pages > 1 && (
                    <div className="flex justify-center border-t border-border px-3 py-2 sm:justify-end">
                        <Pagination currentPage={pagination.page} totalPages={pagination.total_pages} onPageChange={setPage} />
                    </div>
                )}
            </div>
        </Page>
    );
}
