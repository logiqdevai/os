import { CalendarCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useBookings } from "@/features/calendar/hooks/use-calendar";
import type { Booking } from "@/features/calendar/interfaces/calendar.interfaces";
import { BookingStatusFilterOptions, BookingStatusFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/format";
import { BOOKING_STATUS_VARIANT } from "./booking-status";

/**
 * /calendar/bookings — 19 §6. All bookings with calendar.bookings.read, otherwise the ones I host.
 * @api GET /calendar/bookings?status=&upcoming=&search=
 */
export default function BookingsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ filters: { upcoming: "true" } });
    const bookings = useBookings(params);

    const columns: DataTableColumn<Booking>[] = [
        {
            key: "invitee",
            header: "Invitee",
            cell: (b) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{b.invitee_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.invitee_email}</div>
                </div>
            ),
        },
        { key: "when", header: "When", cell: (b) => <span className="tabular">{formatDateTime(b.starts_at)}</span> },
        { key: "status", header: "Status", cell: (b) => <Badge variant={BOOKING_STATUS_VARIANT[b.status]}>{getDropdownOptionLabel(BookingStatusFormOptions, b.status)}</Badge> },
        { key: "link", header: "Link", cell: (b) => b.booking_link.name, hideBelow: "md" },
        { key: "host", header: "Host", cell: (b) => b.host_name ?? "—", hideBelow: "lg" },
    ];

    return (
        <Page>
            <PageHeader title="Bookings" description="Times customers booked through your booking links." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search by name or email…">
                <Select value={filters.upcoming === "true" ? "upcoming" : "all"} onValueChange={(v) => setFilter("upcoming", v === "upcoming" ? "true" : "false")}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Time range"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{BookingStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={bookings.data?.data}
                rowKey={(b) => b.id}
                loading={bookings.isFetching}
                error={bookings.error}
                onRetry={() => bookings.refetch()}
                pagination={bookings.data?.pagination}
                onPageChange={setPage}
                rowHref={(b) => `/calendar/bookings/${b.id}`}
                empty={{ icon: CalendarCheck, title: "No bookings match", description: "Share a booking link so customers can book time with you." }}
            />
        </Page>
    );
}
