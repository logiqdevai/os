import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, MoreHorizontal, Pause, Pencil, Play, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useListParams } from "@/hooks/use-list-params";
import { toast } from "@/hooks/use-toast";
import { useBookingLinks, useUpdateBookingLink } from "@/features/calendar/hooks/use-calendar";
import type { BookingLink, BookingLinkStatus } from "@/features/calendar/interfaces/calendar.interfaces";
import { BookingLinkStatusFilterOptions, BookingLinkStatusFormOptions, HostAssignmentFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMinutes } from "@/lib/format";
import { BookingLinkFormDialog } from "./components/booking-link-form-dialog";

const STATUS_VARIANT: Record<BookingLinkStatus, BadgeVariant> = { ACTIVE: "success", DRAFT: "neutral", PAUSED: "warning", ARCHIVED: "secondary" };

/**
 * /calendar/booking-links — 19 §6.
 * @perm calendar.booking_links.manage (route gate)
 * @api GET/POST/PATCH /calendar/booking-links
 */
export default function BookingLinksPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const links = useBookingLinks(params);
    const update = useUpdateBookingLink();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<BookingLink | null>(null);

    /** The menu item reads "Copied" for a moment (the menu stays open) instead of a toast. */
    const [copiedId, setCopiedId] = useState<string | null>(null);
    useEffect(() => {
        if (!copiedId) return;
        const t = setTimeout(() => setCopiedId(null), 1500);
        return () => clearTimeout(t);
    }, [copiedId]);
    const publicUrl = (l: BookingLink) => `${window.location.origin}${l.public_path}`;
    const copy = async (l: BookingLink) => {
        try {
            await navigator.clipboard.writeText(publicUrl(l));
            setCopiedId(l.id);
        } catch {
            toast({ variant: "destructive", title: "Could not copy", description: publicUrl(l) });
        }
    };

    const columns: DataTableColumn<BookingLink>[] = [
        {
            key: "name",
            header: "Link",
            cell: (l) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.public_path}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (l) => <Badge variant={STATUS_VARIANT[l.status]}>{getDropdownOptionLabel(BookingLinkStatusFormOptions, l.status)}</Badge> },
        { key: "duration", header: "Length", cell: (l) => formatMinutes(l.duration_minutes), hideBelow: "sm" },
        { key: "hosts", header: "Hosts", cell: (l) => <span className="truncate">{l.hosts.map((h) => h.name).join(", ")}{l.hosts.length > 1 ? ` · ${getDropdownOptionLabel(HostAssignmentFormOptions, l.host_assignment)}` : ""}</span>, hideBelow: "md" },
        { key: "upcoming", header: "Upcoming", cell: (l) => <span className="tabular">{l._count?.bookings ?? 0}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "stats", header: "30 days", cell: (l) => <span className="text-xs tabular text-muted-foreground">{l.stats_30d.page_views} views · {l.stats_30d.bookings} booked</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (l) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void copy(l); }}>{copiedId === l.id ? <><Check className="text-success" /> Copied</> : <><Copy /> Copy link</>}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => window.open(l.public_path, "_blank", "noopener")}><ExternalLink /> Open booking page</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setEditing(l); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        {l.status === "ACTIVE" ? (
                            <DropdownMenuItem onSelect={() => update.mutate({ id: l.id, status: "PAUSED" })}><Pause /> Pause</DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onSelect={() => update.mutate({ id: l.id, status: "ACTIVE" })}><Play /> Activate</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Booking links"
                description="Let customers book time with you or your team, based on real availability."
                actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New booking link</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search links…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{BookingLinkStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={links.data?.data}
                rowKey={(l) => l.id}
                loading={links.isFetching}
                error={links.error}
                onRetry={() => links.refetch()}
                pagination={links.data?.pagination}
                onPageChange={setPage}
                onRowClick={(l) => { setEditing(l); setFormOpen(true); }}
                empty={{ icon: Link2, title: search ? "No links match" : "No booking links yet", description: "Create one so customers can book you.", action: !search ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New booking link</Button> : undefined }}
            />
            <BookingLinkFormDialog open={formOpen} onOpenChange={setFormOpen} link={editing} />
        </Page>
    );
}
