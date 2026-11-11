import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { CalendarCheck, CalendarX2, ChevronLeft, ChevronRight, Clock, Globe, MapPin } from "lucide-react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCreatePublicBooking, usePublicBookingPage, usePublicSlots } from "@/features/calendar/hooks/use-calendar";
import type { PublicBookingResult, Slot } from "@/features/calendar/interfaces/calendar.interfaces";
import { publicBookingFormSchema, type PublicBookingFormValues } from "@/features/calendar/validation-schemas/calendar.schema";

const WINDOW_DAYS = 7;

/**
 * /book/:orgSlug/:slug — public booking page (19 §6, §8). No login, no app shell. Only slots are shown, never host calendars.
 * @api GET /public/booking-links/:orgSlug/:slug · GET /public/booking-links/:id/slots · POST /public/booking-links/:id/bookings (409 = slot taken, with fresh slots)
 * @states loading · not available (paused / archived / unknown) · no slots in range · slot taken · confirmed · pending confirmation · rate limited
 */
export default function PublicBookingPage() {
    const { orgSlug, slug } = useParams();
    const page = usePublicBookingPage(orgSlug, slug);
    usePageMetadata({ title: page.data ? `${page.data.name} · ${page.data.organization.name}` : "Book a time" });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
    const [day, setDay] = useState<Date | null>(null);
    const [slot, setSlot] = useState<Slot | null>(null);
    const [done, setDone] = useState<PublicBookingResult | null>(null);
    const [taken, setTaken] = useState(false);
    const slots = usePublicSlots(page.data?.id, { from: weekStart.toISOString(), to: addDays(weekStart, WINDOW_DAYS).toISOString() });
    const book = useCreatePublicBooking();
    const form = useForm<PublicBookingFormValues>({ resolver: zodResolver(publicBookingFormSchema), defaultValues: { name: "", email: "", phone: "", notes: "", answers: {} } });

    const days = useMemo(() => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const selectedDay = day ?? days.find((d) => slots.data?.some((s) => isSameDay(parseISO(s.start), d))) ?? days[0];
    const daySlots = (slots.data ?? []).filter((s) => isSameDay(parseISO(s.start), selectedDay));
    const maxAhead = page.data ? addDays(startOfDay(new Date()), page.data.max_days_ahead) : null;

    if (page.isLoading) {
        return <div className="mx-auto max-w-3xl space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-80 w-full" /></div>;
    }
    if (page.error || !page.data) {
        const status = getApiErrorStatus(page.error);
        return (
            <div className="grid min-h-dvh place-items-center bg-background px-4">
                <EmptyState icon={CalendarX2} title={status === 404 ? "This booking page is not available" : "Couldn't load this page"} description={status === 404 ? "The link may be paused or no longer exists. Contact the person who sent it." : getApiErrorMessage(page.error)} />
            </div>
        );
    }
    const p = page.data;

    const submit = form.handleSubmit((v) => {
        if (!slot) return;
        setTaken(false);
        book.mutate(
            { id: p.id, starts_at: slot.start, timezone: tz, name: v.name, email: v.email, phone: v.phone || undefined, notes: v.notes || undefined, answers: Object.keys(v.answers).length ? v.answers : undefined },
            {
                onSuccess: (res) => {
                    if (res.redirect_url) window.location.href = res.redirect_url;
                    else setDone(res);
                },
                onError: (e) => {
                    if (isAxiosError(e) && e.response?.status === 409) {
                        setTaken(true);
                        setSlot(null);
                        slots.refetch();
                    }
                },
            },
        );
    });

    return (
        <div className="min-h-dvh bg-background px-4 py-8 sm:py-12">
            <div className="mx-auto grid max-w-4xl overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-4 border-b border-border p-5 md:border-b-0 md:border-r">
                    <div className="flex items-center gap-2">
                        {p.organization.logo_url ? <img src={p.organization.logo_url} alt="" className="size-8 rounded-md object-cover" /> : <div className="grid size-8 place-items-center rounded-md bg-secondary text-xs font-medium text-foreground">{p.organization.name.slice(0, 2).toUpperCase()}</div>}
                        <span className="text-[13px] text-muted-foreground">{p.organization.name}</span>
                    </div>
                    <h1 className="text-xl font-medium text-foreground">{p.name}</h1>
                    <ul className="space-y-2 text-[13px] text-body">
                        <li className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{formatMinutes(p.duration_minutes)}</li>
                        {p.location && <li className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{p.location}</li>}
                        <li className="flex items-center gap-2"><Globe className="size-4 text-muted-foreground" />{tz}</li>
                    </ul>
                    {p.hosts.length > 0 && <p className="text-[13px] text-muted-foreground">With {p.hosts.map((h) => h.name).join(", ")}</p>}
                    {p.description && <p className="whitespace-pre-wrap text-[13px] text-body">{p.description}</p>}
                </aside>
                <main className="p-5">
                    {done ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <div className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><CalendarCheck className="size-6" /></div>
                            <h2 className="text-lg font-medium text-foreground">{done.status === "PENDING" ? "Request sent" : "You're booked"}</h2>
                            <p className="text-[13px] text-body">{format(parseISO(done.starts_at), "EEEE d MMMM yyyy, HH:mm")} – {format(parseISO(done.ends_at), "HH:mm")} with {done.host_name}</p>
                            {done.status === "PENDING" && <p className="text-[13px] text-muted-foreground">The host will confirm the time shortly.</p>}
                            {done.confirmation_message && <p className="max-w-md whitespace-pre-wrap text-[13px] text-body">{done.confirmation_message}</p>}
                        </div>
                    ) : slot ? (
                        <Form {...form}>
                            <form onSubmit={submit} className="space-y-4">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setSlot(null)}><ChevronLeft /> Back</Button>
                                <p className="text-[13px] font-medium text-foreground">{format(parseISO(slot.start), "EEEE d MMMM, HH:mm")} – {format(parseISO(slot.end), "HH:mm")}</p>
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Your name</FormLabel><FormControl><Input autoComplete="name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone (optional)</FormLabel><FormControl><Input type="tel" autoComplete="tel" {...field} /></FormControl></FormItem>)} />
                                {p.questions.map((q) => (
                                    <FormField key={q.key} control={form.control} name={`answers.${q.key}`} rules={q.required ? { required: `${q.label} is required` } : undefined} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{q.label}{q.required ? "" : " (optional)"}</FormLabel>
                                            <FormControl>{q.type === "textarea" ? <Textarea rows={3} {...field} value={field.value ?? ""} /> : <Input {...field} value={field.value ?? ""} />}</FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                ))}
                                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Anything to share before the meeting?</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>)} />
                                {book.error && !taken && <p className="text-[13px] text-danger">{getApiErrorMessage(book.error)}</p>}
                                <Button type="submit" className="w-full" loading={book.isPending}>{p.requires_confirmation ? "Request this time" : "Confirm booking"}</Button>
                            </form>
                        </Form>
                    ) : (
                        <div className="space-y-4">
                            {taken && <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">That time was just taken. Please pick another one.</p>}
                            <div className="flex items-center justify-between">
                                <h2 className="text-[15px] font-medium text-foreground">Pick a time</h2>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon-sm" aria-label="Earlier" disabled={weekStart <= startOfDay(new Date())} onClick={() => { setWeekStart((w) => addDays(w, -WINDOW_DAYS)); setDay(null); }}><ChevronLeft /></Button>
                                    <Button variant="outline" size="icon-sm" aria-label="Later" disabled={!!maxAhead && addDays(weekStart, WINDOW_DAYS) > maxAhead} onClick={() => { setWeekStart((w) => addDays(w, WINDOW_DAYS)); setDay(null); }}><ChevronRight /></Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((d) => {
                                    const has = slots.data?.some((s) => isSameDay(parseISO(s.start), d));
                                    const active = isSameDay(d, selectedDay);
                                    return (
                                        <button key={d.toISOString()} type="button" disabled={!has} onClick={() => setDay(d)} className={cn("flex flex-col items-center rounded-md border px-0.5 py-2 text-xs transition-colors disabled:opacity-40", active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}>
                                            <span className="uppercase">{format(d, "EEE")}</span>
                                            <span className="text-sm font-medium tabular">{format(d, "d")}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {slots.isLoading ? (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
                            ) : slots.error ? (
                                <p className="text-[13px] text-danger">{getApiErrorMessage(slots.error)}</p>
                            ) : !daySlots.length ? (
                                <p className="py-6 text-center text-[13px] text-muted-foreground">{slots.data?.length ? "No times on this day." : "No times available this week. Try the next one."}</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {daySlots.map((s) => (
                                        <Button key={s.start} variant="outline" onClick={() => setSlot(s)} className="tabular">{format(parseISO(s.start), "HH:mm")}</Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">Powered by Logiqdev OS</p>
        </div>
    );
}
