import { useState } from "react";
import { Archive, Layers, Link2, MoreHorizontal, Pencil, Plus, Share2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { cn } from "@/lib/utils";
import { useArchiveCalendar, useCalendars } from "@/features/calendar/hooks/use-calendar";
import type { CalendarRow } from "@/features/calendar/interfaces/calendar.interfaces";
import { CalendarKindFilterOptions, CalendarKindFormOptions, CalendarRoleOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { dotClass } from "../../utils/calendar.utils";
import { CalendarFormDialog } from "./components/calendar-form-dialog";
import { ShareSheet } from "./components/share-sheet";
import { FeedDialog } from "./components/feed-dialog";

/**
 * /calendar/calendars — calendars I can reach (19 §2, §10).
 * @perm view calendar.events.read(_own) · create PERSONAL calendar.events.create, others calendar.calendars.manage · share/edit: owner or MANAGE
 * @api GET/POST/PATCH /calendar/calendars · POST /:id/archive · POST/DELETE /:id/shares · POST/DELETE /:id/feed (iCal link)
 */
export default function CalendarsPage() {
    const { search, setSearch, filters, setFilter } = useListParams();
    const list = useCalendars({ ...(filters.kind ? { kind: filters.kind } : {}), ...(search ? { search } : {}) });
    const archive = useArchiveCalendar();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<CalendarRow | null>(null);
    const [sharing, setSharing] = useState<string | null>(null);
    const [archiving, setArchiving] = useState<CalendarRow | null>(null);
    const [feed, setFeed] = useState<CalendarRow | null>(null);

    const columns: DataTableColumn<CalendarRow>[] = [
        {
            key: "name",
            header: "Calendar",
            cell: (c) => (
                <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2.5 shrink-0 rounded-full", dotClass(c.color))} />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{c.name}{c.is_default ? " · default" : ""}</div>
                        {(c.owner || c.scope) && <div className="truncate text-xs text-muted-foreground">{c.owner?.name ?? c.scope?.name}</div>}
                    </div>
                </div>
            ),
        },
        { key: "kind", header: "Kind", cell: (c) => <Badge>{getDropdownOptionLabel(CalendarKindFormOptions, c.kind)}</Badge>, hideBelow: "sm" },
        { key: "role", header: "Your access", cell: (c) => getDropdownOptionLabel(CalendarRoleOptions, c.role), hideBelow: "md" },
        { key: "feed", header: "iCal", cell: (c) => (c.feed_enabled ? <Badge variant="info">Link on</Badge> : null), hideBelow: "lg" },
        { key: "upcoming", header: "Upcoming", cell: (c) => <span className="tabular">{c.upcoming_events}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (c) => {
                const manage = c.role === "MANAGE";
                return manage && c.kind !== "RESOURCE" ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(c); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSharing(c.id)}><Share2 /> Share</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setFeed(c)}><Link2 /> Subscription link (iCal)</DropdownMenuItem>
                            {!c.is_default && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(c)}><Archive /> Archive</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null;
            },
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Calendars"
                description="Your calendar, team calendars and calendars shared with you."
                actions={<Can anyOf={["calendar.events.create", "calendar.calendars.manage"]}><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New calendar</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search calendars…">
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{CalendarKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data}
                rowKey={(c) => c.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                rowHref={(c) => `/calendar?view=week&calendars=${c.id}`}
                empty={{ icon: Layers, title: "No calendars match" }}
            />
            <CalendarFormDialog open={formOpen} onOpenChange={setFormOpen} calendar={editing} />
            <ShareSheet calendarId={sharing} onClose={() => setSharing(null)} />
            <FeedDialog calendar={feed} onClose={() => setFeed(null)} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Its events are hidden from everyone's calendar. You can restore it later."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (archiving) archive.mutate(archiving.id); setArchiving(null); }}
            />
        </Page>
    );
}
