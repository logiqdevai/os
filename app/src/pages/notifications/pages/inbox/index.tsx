import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCheck, Inbox, Settings } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { TableToolbar } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import {
    useMarkNotificationsSeen, useNotificationAction, useNotificationCounts, useNotifications, useOpenNotification, useReadAllNotifications, useUpdateNotification,
} from "@/features/notifications/hooks/use-notifications";
import type { NotificationItem, NotificationState } from "@/features/notifications/interfaces/notifications.interfaces";
import { ModuleFilterOptions, NotificationCategoryFilterOptions, NotificationStateOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { NotificationRow } from "../../components/notification-row";

const EMPTY: Record<NotificationState, { title: string; description: string }> = {
    unread: { title: "You are all caught up", description: "New notifications about your work show up here." },
    all: { title: "No notifications yet", description: "Mentions, assignments, approvals and reminders will appear here." },
    action: { title: "Nothing is waiting on you", description: "Approvals and acknowledgements you need to handle appear here." },
    read: { title: "Nothing read yet", description: "" },
    snoozed: { title: "Nothing snoozed", description: "Snoozed notifications come back at the time you chose." },
    archived: { title: "Archive is empty", description: "Archived notifications are kept here." },
};

/**
 * /notifications — own inbox (14 §7).
 * @perm own inbox: any member (no key) · preferences link notifications.preferences.manage_own
 * @api GET /notifications · GET /notifications/unread-count · PATCH /notifications/:id · POST /notifications/:id/open · POST /notifications/read-all · POST /notifications/seen
 */
export default function InboxPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 30 });
    const state = (filters.state as NotificationState) ?? "unread";
    const list = useNotifications({ ...params, state });
    const counts = useNotificationCounts();
    const update = useUpdateNotification();
    const open = useOpenNotification();
    const act = useNotificationAction();
    const readAll = useReadAllNotifications();
    const seen = useMarkNotificationsSeen();

    // Opening the inbox clears the rail badge (seen), not the unread highlight.
    useEffect(() => {
        if (counts.data?.unseen) seen.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [counts.data?.unseen]);

    const onOpen = (n: NotificationItem) =>
        open.mutate(n.id, { onSuccess: (res) => navigate(res.action_url && res.action_url.startsWith("/") ? res.action_url : `/notifications/${n.id}`) });

    const rows = list.data?.data ?? [];
    const pagination = list.data?.pagination;

    return (
        <Page width="wide">
            <PageHeader
                title="Inbox"
                description="Everything that needs your attention, across modules."
                actions={
                    <>
                        <Button variant="outline" onClick={() => readAll.mutate(filters.module)} loading={readAll.isPending} disabled={!counts.data?.unread}>
                            <CheckCheck /> Mark all read
                        </Button>
                        <Can permission="notifications.preferences.manage_own">
                            <Button variant="ghost" asChild>
                                <Link to="/notifications/preferences"><Settings /> Preferences</Link>
                            </Button>
                        </Can>
                    </>
                }
            />
            <div className="mb-3 overflow-x-auto">
                <Tabs value={state} onValueChange={(v) => setFilter("state", v === "unread" ? null : v)}>
                    <TabsList>
                        {NotificationStateOptions.map((o) => (
                            <TabsTrigger key={o.id} value={o.id} className="gap-1.5">
                                {o.label}
                                {o.id === "unread" && !!counts.data?.unread && <span className="rounded-full bg-info-soft px-1.5 text-[11px] text-info tabular">{counts.data.unread}</span>}
                                {o.id === "action" && !!counts.data?.action && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] text-warning tabular">{counts.data.action}</span>}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search notifications…">
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {ModuleFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.category ?? "all"} onValueChange={(v) => setFilter("category", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {NotificationCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableToolbar>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {list.isLoading ? (
                    <ListSkeleton rows={8} />
                ) : list.error ? (
                    <ErrorState error={list.error} onRetry={() => list.refetch()} />
                ) : !rows.length ? (
                    <EmptyState icon={Inbox} title={search ? "No notifications match your search" : EMPTY[state].title} description={search ? undefined : EMPTY[state].description} />
                ) : (
                    <div className={list.isFetching ? "opacity-70 transition-opacity" : undefined}>
                        {rows.map((n) => (
                            <NotificationRow
                                key={n.id}
                                n={n}
                                onOpen={onOpen}
                                onUpdate={(dto) => update.mutate(dto)}
                                onAction={(row, action) => act.mutate({ id: row.id, action })}
                                actionPending={act.isPending && act.variables?.id === n.id}
                            />
                        ))}
                    </div>
                )}
                {pagination && pagination.total_pages > 1 && (
                    <div className="flex flex-col items-center justify-between gap-2 border-t border-border px-3 py-2 sm:flex-row">
                        <span className="text-xs text-muted-foreground tabular">{pagination.total} notifications</span>
                        <Pagination currentPage={pagination.page} totalPages={pagination.total_pages} onPageChange={setPage} />
                    </div>
                )}
            </div>
        </Page>
    );
}
