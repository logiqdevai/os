import { useState } from "react";
import { Phone, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { TableToolbar } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { ActivityDueFilterOptions, ActivityTypeFilterOptions } from "@/config/constants/dropdowns/crm/activity-form.options";
import { OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useActivities, useActivitySummary } from "@/features/crm/activities/hooks/use-activities";
import { ActivityRow, useActivityDialogs } from "../../components/activity-items";
import { ActivityFormDialog } from "../../components/activity-form-dialog";

/**
 * Activities (mockup `activities`): my open work by default, overdue / today / upcoming / completed.
 * @route /crm/activities?due=open|overdue|today|upcoming|completed|all&owner=me|all&type=&q=
 * @perm VIEW crm.activities.read · create crm.activities.create · complete/edit crm.activities.update · delete crm.activities.delete
 * @api GET /crm/activities · GET /crm/activities/summary · POST /crm/activities/:id/complete
 */
export default function ActivitiesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 30 });
    const due = filters.due ?? "open";
    const owner = filters.owner ?? "me";
    const { due: _d, owner: _o, ...rest } = params;
    const query = {
        ...rest,
        ...(owner !== "all" && { owner }),
        ...(due === "completed" ? { status: "COMPLETED", order_by: "completed_at" } : due === "all" ? {} : { due }),
    };
    const activities = useActivities(query);
    const summary = useActivitySummary();
    const canCreate = usePermission("crm.activities.create");
    const [creating, setCreating] = useState(false);
    const { setEditing, setDeleting, dialogs } = useActivityDialogs();
    const rows = activities.data?.data;
    const pg = activities.data?.pagination;

    const count = (id: string) => (id === "open" ? summary.data?.open : id === "overdue" ? summary.data?.overdue : id === "today" ? summary.data?.today : undefined);

    return (
        <Page>
            <PageHeader
                title="Activities"
                description="Calls, meetings, emails and follow-ups across your deals, companies and leads."
                actions={<Can permission="crm.activities.create"><Button onClick={() => setCreating(true)}><Plus /> New activity</Button></Can>}
            />
            <div className="-mx-4 mb-3 overflow-x-auto px-4 md:mx-0 md:px-0">
                <Tabs value={due} onValueChange={(v) => setFilter("due", v === "open" ? null : v)}>
                    <TabsList>
                        {ActivityDueFilterOptions.map((o) => (
                            <TabsTrigger key={o.id} value={o.id} className="gap-1.5">
                                {o.label}
                                {owner === "me" && !!count(o.id) && <Badge variant={o.id === "overdue" ? "danger" : "neutral"} className="h-4 px-1">{count(o.id)}</Badge>}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search activities…">
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>{ActivityTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={owner} onValueChange={(v) => setFilter("owner", v === "me" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {OwnerFilterOptions.filter((o) => o.id !== "unassigned").map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "me" ? "Assigned to me" : "Everyone"}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableToolbar>
            <div className="rounded-lg border border-border bg-card">
                {activities.isPending ? <ListSkeleton />
                    : activities.error ? <ErrorState error={activities.error} onRetry={() => activities.refetch()} />
                        : !rows?.length ? (
                            <EmptyState
                                icon={Phone}
                                title={due === "overdue" ? "Nothing overdue" : due === "today" ? "Nothing due today" : "No activities"}
                                description="Schedule follow-ups on deals and leads so nothing slips."
                                action={canCreate ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New activity</Button> : undefined}
                            />
                        ) : (
                            <div className="divide-y divide-border-soft px-4">
                                {rows.map((a) => <ActivityRow key={a.id} activity={a} onEdit={setEditing} onDelete={setDeleting} showRecord />)}
                            </div>
                        )}
                {pg && pg.total_pages > 1 && (
                    <div className="flex justify-center border-t border-border px-3 py-2">
                        <Pagination currentPage={pg.page} totalPages={pg.total_pages} onPageChange={setPage} />
                    </div>
                )}
            </div>
            <ActivityFormDialog open={creating} onOpenChange={setCreating} />
            {dialogs}
        </Page>
    );
}
