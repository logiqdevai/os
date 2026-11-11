import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes, format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalendarEvent, useCalendarPreferences, useCalendars, useCreateEvent, useEventTypes, useUpdateEvent } from "@/features/calendar/hooks/use-calendar";
import { eventFormSchema, type EventFormValues } from "@/features/calendar/validation-schemas/calendar.schema";
import type { EventDto } from "@/features/calendar/interfaces/calendar.interfaces";
import { EventVisibilityFormOptions, ReminderFormOptions, RepeatFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { PeoplePicker } from "./people-picker";

interface EventFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Edit an existing event (whole series). */
    eventId?: string | null;
    /** Prefilled start for a new event (clicked slot). */
    initialStart?: Date | null;
}

const NONE = "__none";

/** Create / edit an event: calendar, type, time, repeat, attendees, guests, place, link, reminder, visibility. */
export function EventFormDialog({ open, onOpenChange, eventId, initialStart }: EventFormDialogProps) {
    const navigate = useNavigate();
    const detail = useCalendarEvent(open && eventId ? eventId : undefined);
    const calendars = useCalendars({}, open);
    const types = useEventTypes(open);
    const prefs = useCalendarPreferences(open);
    const create = useCreateEvent();
    const update = useUpdateEvent();
    const writable = useMemo(() => (calendars.data ?? []).filter((c) => c.role === "WRITE" || c.role === "MANAGE"), [calendars.data]);

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: { title: "", calendar_id: "", date: "", end_date: "", start_time: "09:00", end_time: "09:30", all_day: false, repeat: "none", visibility: "TEAM", attendee_ids: [], reminder: "10" },
    });
    const allDay = useWatch({ control: form.control, name: "all_day" });
    const repeat = useWatch({ control: form.control, name: "repeat" });

    useEffect(() => {
        if (!open) return;
        const e = detail.data;
        if (eventId && e && !e.masked) {
            const s = parseISO(e.starts_at);
            const en = parseISO(e.ends_at);
            form.reset({
                title: e.title,
                calendar_id: e.calendar.id,
                event_type_id: e.event_type?.id ?? NONE,
                date: format(s, "yyyy-MM-dd"),
                end_date: format(e.all_day ? addMinutes(en, -1) : en, "yyyy-MM-dd"),
                start_time: format(s, "HH:mm"),
                end_time: format(en, "HH:mm"),
                all_day: e.all_day,
                repeat: e.recurrence?.freq ?? "none",
                repeat_count: e.recurrence?.count ? String(e.recurrence.count) : "",
                visibility: e.visibility,
                location: e.location ?? "",
                meeting_url: e.meeting_url ?? "",
                description: e.description ?? "",
                attendee_ids: (e.attendees ?? []).filter((a) => a.membership_id && !a.is_organizer).map((a) => a.membership_id as string),
                guest_emails: (e.attendees ?? []).filter((a) => !a.membership_id).map((a) => a.email).join(", "),
                reminder: e.reminders?.find((r) => !r.personal) ? String(e.reminders.find((r) => !r.personal)?.minutes_before) : "none",
            });
        } else if (!eventId) {
            const start = initialStart ?? new Date(Math.ceil(Date.now() / (30 * 60_000)) * 30 * 60_000);
            const end = addMinutes(start, prefs.data?.default_event_duration ?? 30);
            form.reset({
                title: "",
                calendar_id: prefs.data?.default_calendar_id ?? writable.find((c) => c.is_default)?.id ?? writable[0]?.id ?? "",
                event_type_id: NONE,
                date: format(start, "yyyy-MM-dd"),
                end_date: format(end, "yyyy-MM-dd"),
                start_time: format(start, "HH:mm"),
                end_time: format(end, "HH:mm"),
                all_day: false,
                repeat: "none",
                repeat_count: "",
                visibility: "TEAM",
                location: "",
                meeting_url: "",
                description: "",
                attendee_ids: [],
                guest_emails: "",
                reminder: String(prefs.data?.default_reminders?.[0]?.minutes_before ?? 10),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, eventId, detail.data, initialStart, prefs.data, writable.length]);

    const pending = create.isPending || update.isPending;
    const loading = (eventId && detail.isLoading) || calendars.isLoading;

    const submit = form.handleSubmit((v) => {
        const starts = v.all_day ? new Date(`${v.date}T00:00`) : new Date(`${v.date}T${v.start_time}`);
        const ends = v.all_day ? new Date(new Date(`${v.end_date}T00:00`).getTime() + 86_400_000) : new Date(`${v.end_date}T${v.end_time}`);
        const guests = (v.guest_emails ?? "").split(/[,\s]+/).filter(Boolean);
        const dto: EventDto = {
            calendar_id: v.calendar_id,
            event_type_id: v.event_type_id && v.event_type_id !== NONE ? v.event_type_id : undefined,
            title: v.title,
            description: v.description || undefined,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            all_day: v.all_day,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            recurrence: v.repeat === "none" ? null : { freq: v.repeat, interval: 1, count: v.repeat_count ? Number(v.repeat_count) : null, ...(v.repeat === "WEEKLY" ? { byday: [starts.getDay()] } : {}) },
            visibility: v.visibility,
            location: v.location ?? "",
            meeting_url: v.meeting_url ?? "",
            attendees: [...v.attendee_ids.map((membership_id) => ({ membership_id })), ...guests.map((email) => ({ email }))],
            reminders: v.reminder === "none" ? [] : [{ minutes_before: Number(v.reminder) }],
        };
        if (eventId) update.mutate({ id: eventId, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate(dto, { onSuccess: (e) => { onOpenChange(false); navigate(`/calendar/events/${e.id}`); } });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{eventId ? "Edit event" : "New event"}</DialogTitle>
                    <DialogDescription>{eventId ? "Changes apply to the whole series. Attendees are told when the time or place changes." : "Invited members get a notification and can answer from their inbox."}</DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
                ) : !writable.length ? (
                    <p className="text-sm text-muted-foreground">You have no calendar you can add events to.</p>
                ) : (
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-4">
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl><Input autoFocus placeholder="Design review" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="calendar_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Calendar</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Calendar"><SelectValue placeholder="Choose a calendar" /></SelectTrigger></FormControl>
                                            <SelectContent>{writable.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="event_type_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <Select
                                            value={field.value ?? NONE}
                                            onValueChange={(v) => {
                                                field.onChange(v);
                                                const t = types.data?.find((x) => x.id === v);
                                                if (t && !eventId) {
                                                    if (!form.getFieldState("visibility").isDirty) form.setValue("visibility", t.default_visibility);
                                                    if (t.default_duration_minutes && !form.getValues("all_day")) {
                                                        const s = new Date(`${form.getValues("date")}T${form.getValues("start_time")}`);
                                                        const e = addMinutes(s, t.default_duration_minutes);
                                                        form.setValue("end_date", format(e, "yyyy-MM-dd"));
                                                        form.setValue("end_time", format(e, "HH:mm"));
                                                    }
                                                }
                                            }}
                                        >
                                            <FormControl><SelectTrigger aria-label="Event type"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>No type</SelectItem>
                                                {(types.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="all_day" render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="All day" /></FormControl>
                                    <FormLabel className="font-normal">All day</FormLabel>
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="col-span-1">
                                        <FormLabel>Starts</FormLabel>
                                        <FormControl><Input type="date" {...field} onChange={(e) => { field.onChange(e); if (form.getValues("end_date") < e.target.value) form.setValue("end_date", e.target.value); }} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {!allDay && (
                                    <FormField control={form.control} name="start_time" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Time</FormLabel>
                                            <FormControl><Input type="time" step={300} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                                <FormField control={form.control} name="end_date" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ends</FormLabel>
                                        <FormControl><Input type="date" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {!allDay && (
                                    <FormField control={form.control} name="end_time" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Time</FormLabel>
                                            <FormControl><Input type="time" step={300} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="repeat" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Repeat</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Repeat"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{RepeatFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                {repeat !== "none" && (
                                    <FormField control={form.control} name="repeat_count" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of times</FormLabel>
                                            <FormControl><Input type="number" min={1} max={730} placeholder="Forever" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                            <FormField control={form.control} name="attendee_ids" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>People</FormLabel>
                                    <PeoplePicker
                                        value={field.value}
                                        onChange={field.onChange}
                                        excludeMe
                                        known={Object.fromEntries((detail.data?.attendees ?? []).filter((a) => a.membership_id).map((a) => [a.membership_id as string, a.name ?? a.email]))}
                                    />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="guest_emails" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Guests outside the organization</FormLabel>
                                    <FormControl><Input placeholder="lena@acme.com, tom@acme.com" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="location" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Location</FormLabel>
                                        <FormControl><Input placeholder="Athens office · Room 2" {...field} /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="meeting_url" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Meeting link</FormLabel>
                                        <FormControl><Input placeholder="https://meet.google.com/…" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="reminder" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reminder</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Reminder"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{ReminderFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="visibility" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Visibility</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Visibility"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{EventVisibilityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}>{eventId ? "Save changes" : "Create event"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
