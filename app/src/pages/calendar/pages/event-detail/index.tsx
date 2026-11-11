import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Ban, Bell, Building2, CalendarDays, Check, HelpCircle, Lock, MapPin, Pencil, Repeat, Trash2, Users, Video, X } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AttendeeResponseOptions, EventVisibilityFormOptions, ReminderFormOptions, RepeatFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { useCalendarEvent, useCancelEvent, useDeleteEvent, useRespondEvent } from "@/features/calendar/hooks/use-calendar";
import type { AttendeeResponse } from "@/features/calendar/interfaces/calendar.interfaces";
import { EventFormDialog } from "../../components/event-form-dialog";
import { dotClass } from "../../utils/calendar.utils";

const RESPONSE_VARIANT: Record<AttendeeResponse, "success" | "warning" | "danger" | "neutral"> = { ACCEPTED: "success", TENTATIVE: "warning", DECLINED: "danger", NEEDS_ACTION: "neutral" };

/**
 * /calendar/events/:id?occurrence= — event detail (19 §3, §9).
 * @perm calendar.events.read_own / read · RSVP own row · edit/cancel calendar.events.update_own (organizer) · delete calendar.events.delete_own
 * @api GET /calendar/events/:id · POST /:id/respond · POST /:id/cancel · DELETE /:id · PATCH /:id
 * @states loading · 404 (private / no access) · cancelled banner · masked (busy only)
 */
export default function EventDetailPage() {
    const { id } = useParams();
    const [sp] = useSearchParams();
    const occurrence = sp.get("occurrence");
    const navigate = useNavigate();
    const q = useCalendarEvent(id);
    const respond = useRespondEvent();
    const cancel = useCancelEvent();
    const remove = useDeleteEvent();
    const [editing, setEditing] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [deleting, setDeleting] = useState(false);

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Event" back={{ to: "/calendar", label: "Calendar" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const e = q.data;
    const start = occurrence ? parseISO(occurrence) : parseISO(e.starts_at);
    const end = new Date(start.getTime() + (parseISO(e.ends_at).getTime() - parseISO(e.starts_at).getTime()));
    const when = e.all_day ? `${format(start, "EEEE, d MMMM yyyy")} · All day` : `${format(start, "EEEE, d MMMM yyyy")} · ${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;
    const cancelled = e.status === "CANCELLED";

    if (e.masked) {
        return (
            <Page width="narrow">
                <PageHeader back={{ to: "/calendar", label: "Calendar" }} title="Busy" meta={<Badge variant="neutral"><Lock className="size-3" /> Private</Badge>} />
                <div className="rounded-lg border border-border bg-card p-5 text-sm text-body">
                    <p>{when}</p>
                    <p className="mt-2 text-muted-foreground">This time is blocked in {e.calendar.name}. The details are private.</p>
                </div>
            </Page>
        );
    }

    const doCancel = (onlyThis: boolean) =>
        cancel.mutate({ id: e.id, reason: reason || undefined, ...(onlyThis && occurrence ? { occurrence_start: occurrence } : {}) }, { onSuccess: () => { setCancelOpen(false); if (onlyThis) navigate("/calendar"); } });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/calendar", label: "Calendar" }}
                title={<span className={cn(cancelled && "line-through opacity-70")}>{e.title}</span>}
                documentTitle={e.title}
                meta={<>
                    {cancelled && <Badge variant="danger">Cancelled</Badge>}
                    {e.status === "TENTATIVE" && <Badge variant="neutral">Tentative</Badge>}
                    {e.event_type && <Badge variant="info">{e.event_type.name}</Badge>}
                </>}
                actions={!cancelled && (
                    <>
                        {e.can_edit && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
                        {e.can_edit && <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}><Ban /> Cancel event</Button>}
                        {e.can_delete && <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}><Trash2 /> Delete</Button>}
                    </>
                )}
            />
            {cancelled && (
                <div className="mb-4 rounded-lg border border-border bg-danger-soft px-4 py-3 text-[13px] text-danger">
                    This event was cancelled{e.cancellation_reason ? `: ${e.cancellation_reason}` : "."}
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                    <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
                        <p className="flex items-start gap-2 text-[13px] text-foreground"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{when}</p>
                        {e.recurrence && <p className="flex items-center gap-2 text-[13px] text-body"><Repeat className="size-4 text-muted-foreground" />{getDropdownOptionLabel(RepeatFormOptions, e.recurrence.freq)}{e.recurrence.count ? ` · ${e.recurrence.count} times` : ""}</p>}
                        {e.location && <p className="flex items-center gap-2 text-[13px] text-body"><MapPin className="size-4 text-muted-foreground" />{e.location}</p>}
                        {e.meeting_url && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Button size="sm" asChild><a href={e.meeting_url} target="_blank" rel="noreferrer"><Video /> Join meeting</a></Button>
                                <span className="truncate text-xs text-muted-foreground">{e.meeting_url}</span>
                            </div>
                        )}
                        {e.resources?.length ? <p className="flex items-center gap-2 text-[13px] text-body"><Building2 className="size-4 text-muted-foreground" />{e.resources.map((r) => `${r.name}${r.status === "REQUESTED" ? " (requested)" : ""}`).join(", ")}</p> : null}
                        <p className="flex items-center gap-2 text-[13px] text-body"><span className={cn("ml-1 size-2 rounded-full", dotClass(e.calendar.color))} /><span className="ml-1">{e.calendar.name} · {getDropdownOptionLabel(EventVisibilityFormOptions, e.visibility)}</span></p>
                        {e.reminders?.length ? <p className="flex items-center gap-2 text-[13px] text-body"><Bell className="size-4 text-muted-foreground" />{e.reminders.map((r) => getDropdownOptionLabel(ReminderFormOptions, String(r.minutes_before))).join(", ")}</p> : null}
                    </div>
                    {e.my_attendee && !e.is_organizer && !cancelled && (
                        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[13px] text-foreground">Going? <span className="text-muted-foreground">Your answer: {getDropdownOptionLabel(AttendeeResponseOptions, e.my_attendee.response)}</span></p>
                            <div className="flex flex-wrap gap-2">
                                {([["ACCEPTED", "Yes", Check], ["TENTATIVE", "Maybe", HelpCircle], ["DECLINED", "No", X]] as const).map(([r, label, Icon]) => (
                                    <Button key={r} size="sm" variant={e.my_attendee?.response === r ? "default" : "outline"} loading={respond.isPending && respond.variables?.response === r} onClick={() => respond.mutate({ id: e.id, response: r })}>
                                        <Icon /> {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                    <Section title="Notes">
                        <div className="rounded-lg border border-border bg-card p-4 text-[13px] text-body">
                            {e.description ? <p className="whitespace-pre-wrap">{e.description}</p> : <p className="text-muted-foreground">No notes.</p>}
                        </div>
                    </Section>
                </div>
                <aside className="space-y-4">
                    <Section title={<span className="inline-flex items-center gap-1.5"><Users className="size-4" /> People</span>}>
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {(e.attendees ?? []).map((a) => (
                                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] text-foreground">{a.name ?? a.email}{a.is_organizer ? " · organizer" : ""}</p>
                                        {a.kind === "EXTERNAL" && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
                                    </div>
                                    <Badge variant={RESPONSE_VARIANT[a.response]}>{getDropdownOptionLabel(AttendeeResponseOptions, a.response)}</Badge>
                                </li>
                            ))}
                            {!e.attendees?.length && <li className="px-3 py-2 text-[13px] text-muted-foreground">Only you.</li>}
                        </ul>
                    </Section>
                    {(e.project || e.company || e.booking) && (
                        <Section title="Related">
                            <ul className="space-y-1 rounded-lg border border-border bg-card p-3 text-[13px]">
                                {e.project && <li><Link className="hover:underline" to={`/projects/${e.project.id}`}>Project · {e.project.name}</Link></li>}
                                {e.company && <li><Link className="hover:underline" to={`/crm/companies/${e.company.id}`}>Customer · {e.company.name}</Link></li>}
                                {e.booking && <li><Link className="hover:underline" to={`/calendar/bookings/${e.booking.id}`}>Booking · {e.booking.invitee_name}</Link></li>}
                            </ul>
                        </Section>
                    )}
                </aside>
            </div>
            <EventFormDialog open={editing} onOpenChange={setEditing} eventId={e.id} />
            <Dialog open={cancelOpen} onOpenChange={(o) => !cancel.isPending && setCancelOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel “{e.title}”?</DialogTitle>
                        <DialogDescription>Attendees are notified. The event stays in the calendar as cancelled.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} placeholder="Reason (optional, shared with attendees)" value={reason} onChange={(ev) => setReason(ev.target.value)} aria-label="Reason" />
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancel.isPending}>Keep event</Button>
                        {e.recurring && occurrence && <Button variant="outline" loading={cancel.isPending} onClick={() => doCancel(true)}>Only this one</Button>}
                        <Button variant="destructive" loading={cancel.isPending} onClick={() => doCancel(false)}>{e.recurring ? "Cancel all" : "Cancel event"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={deleting}
                onClose={() => setDeleting(false)}
                title="Delete this event?"
                description="It is removed for everyone, without a cancellation notice. Prefer “Cancel event” when people were invited."
                confirmText="Delete"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => remove.mutate(e.id, { onSuccess: () => navigate("/calendar") })}
            />
        </Page>
    );
}
