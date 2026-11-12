import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Check, CheckCheck, UserX } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useBooking, useBookingAction } from "@/features/calendar/hooks/use-calendar";
import { BookingStatusFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime } from "@/lib/format";
import { BOOKING_STATUS_VARIANT } from "./booking-status";

/**
 * /calendar/bookings/:id — 19 §6.
 * @perm view calendar.bookings.read or the host · actions calendar.bookings.manage or the host (API decides)
 * @api GET /calendar/bookings/:id · POST /calendar/bookings/:id/confirm|cancel|no-show|complete
 */
export default function BookingDetailPage() {
    const { id } = useParams();
    const q = useBooking(id);
    const act = useBookingAction();
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reason, setReason] = useState("");

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Booking" back={{ to: "/calendar/bookings", label: "Bookings" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const b = q.data;
    const future = new Date(b.starts_at) > new Date();

    return (
        <Page width="narrow">
            <PageHeader
                back={{ to: "/calendar/bookings", label: "Bookings" }}
                title={b.invitee_name}
                documentTitle="Booking"
                meta={<Badge variant={BOOKING_STATUS_VARIANT[b.status]}>{getDropdownOptionLabel(BookingStatusFormOptions, b.status)}</Badge>}
                actions={
                    <>
                        {/* Optimistic: the status badge (and these buttons) change at once; a refusal rolls back with one toast. */}
                        {b.status === "PENDING" && <Button size="sm" onClick={() => act.mutate({ id: b.id, action: "confirm" })}><Check /> Confirm</Button>}
                        {b.status === "CONFIRMED" && !future && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: b.id, action: "complete" })}><CheckCheck /> Completed</Button>}
                        {b.status === "CONFIRMED" && !future && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: b.id, action: "no-show" })}><UserX /> No-show</Button>}
                        {(b.status === "PENDING" || b.status === "CONFIRMED") && <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}><Ban /> Cancel</Button>}
                    </>
                }
            />
            <div className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
                    <KeyValueList items={[
                        { label: "When", value: formatDateTime(b.starts_at) },
                        { label: "Invitee time zone", value: b.timezone },
                        { label: "Email", value: <a className="hover:underline" href={`mailto:${b.invitee_email}`}>{b.invitee_email}</a> },
                        { label: "Phone", value: b.invitee_phone },
                        { label: "Booking link", value: b.booking_link.name },
                        { label: "Host", value: b.host_name },
                        { label: "Booked", value: formatDateTime(b.created_at) },
                        { label: "Event", value: b.event_id ? <Link className="hover:underline" to={`/calendar/events/${b.event_id}`}>Open in calendar</Link> : null },
                    ]} />
                </div>
                {(b.notes || (b.answers && Object.keys(b.answers).length > 0)) && (
                    <Section title="From the invitee">
                        <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-[13px]">
                            {b.answers && Object.entries(b.answers).map(([k, v]) => (
                                <div key={k}>
                                    <p className="text-xs text-muted-foreground">{b.booking_link.questions?.find((q) => q.key === k)?.label ?? k}</p>
                                    <p className="whitespace-pre-wrap text-body">{v}</p>
                                </div>
                            ))}
                            {b.notes && <p className="whitespace-pre-wrap text-body">{b.notes}</p>}
                        </div>
                    </Section>
                )}
                {b.cancellation_reason && <p className="text-[13px] text-muted-foreground">Cancellation reason: {b.cancellation_reason}</p>}
            </div>
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel this booking?</DialogTitle>
                        <DialogDescription>The calendar event is cancelled too. Let the invitee know by email.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep booking</Button>
                        <Button variant="destructive" onClick={() => { act.mutate({ id: b.id, action: "cancel", reason: reason || undefined }); setCancelOpen(false); }}>Cancel booking</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
