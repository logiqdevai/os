import { useEffect, useRef } from "react";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreateBookingLink, useUpdateBookingLink } from "@/features/calendar/hooks/use-calendar";
import { bookingLinkFormSchema, type BookingLinkFormValues } from "@/features/calendar/validation-schemas/calendar.schema";
import type { BookingLink } from "@/features/calendar/interfaces/calendar.interfaces";
import { BookingLinkStatusFormOptions, HostAssignmentFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { PeoplePicker } from "../../../components/people-picker";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    link?: BookingLink | null;
}

/** Create / edit a public booking link (hosts, duration, notice, window, confirmation). */
export function BookingLinkFormDialog({ open, onOpenChange, link }: Props) {
    const session = useSessionData();
    const create = useCreateBookingLink();
    const update = useUpdateBookingLink({ inline: true });
    const form = useForm<BookingLinkFormValues>({
        resolver: zodResolver(bookingLinkFormSchema),
        defaultValues: { name: "", slug: "", status: "ACTIVE", host_assignment: "SINGLE", host_ids: [], duration_minutes: "30", buffer_after_minutes: "0", min_notice_minutes: "60", max_days_ahead: "60", requires_confirmation: false },
    });

    useEffect(() => {
        if (!open) return;
        form.reset({
            name: link?.name ?? "",
            slug: link?.slug ?? "",
            description: link?.description ?? "",
            status: link?.status ?? "ACTIVE",
            host_assignment: link?.host_assignment ?? "SINGLE",
            host_ids: link?.hosts.map((h) => h.membership_id) ?? (session?.active_organization?.membership_id ? [session.active_organization.membership_id] : []),
            duration_minutes: String(link?.duration_minutes ?? 30),
            buffer_after_minutes: String(link?.buffer_after_minutes ?? 0),
            min_notice_minutes: String(link?.min_notice_minutes ?? 60),
            max_days_ahead: String(link?.max_days_ahead ?? 60),
            requires_confirmation: link?.requires_confirmation ?? false,
            location: link?.location ?? "",
            confirmation_message: link?.confirmation_message ?? "",
        });
    }, [open, link, form, session]);

    const pending = create.isPending;
    const toDto = (v: BookingLinkFormValues) => ({
            name: v.name, slug: v.slug, description: v.description || undefined, status: v.status, host_assignment: v.host_assignment,
            hosts: v.host_ids.map((membership_id, i) => ({ membership_id, priority: i })), duration_minutes: Number(v.duration_minutes), slot_interval_minutes: Math.min(Number(v.duration_minutes), 60),
            buffer_after_minutes: Number(v.buffer_after_minutes), min_notice_minutes: Number(v.min_notice_minutes), max_days_ahead: Number(v.max_days_ahead), requires_confirmation: v.requires_confirmation,
            location: v.location || undefined, confirmation_message: v.confirmation_message || undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    // Editing autosaves every valid change (no "Save changes"; "Done" closes). Creating keeps "Create link".
    const linkRef = useRef(link);
    if (link) linkRef.current = link;
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: linkRef.current!.id, ...toDto(v) }), { enabled: open && !!link });
    const close = () => {
        if (link) void form.trigger().then((ok) => ok && autosave.flush());
        onOpenChange(false);
    };
    const submit = form.handleSubmit((v) => {
        if (link) return close();
        create.mutate(toDto(v), { onSuccess: () => onOpenChange(false) });
    });

    const meName = session?.user ? [session.user.first_name, session.user.last_name].filter(Boolean).join(" ") || session.user.email : "You";

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !pending && close())}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{link ? "Edit booking link" : "New booking link"}</DialogTitle>
                            <DialogDescription>Customers pick a free time from the hosts' availability. Nothing is reserved until they submit.</DialogDescription>
                            {link && <SaveStatus state={autosave} />}
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl><Input autoFocus placeholder="Intro call" {...field} onChange={(e) => { field.onChange(e); if (!link && !form.getFieldState("slug").isDirty) form.setValue("slug", slugify(e.target.value)); }} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="slug" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Link address</FormLabel>
                                <FormControl><Input placeholder="intro-call" {...field} /></FormControl>
                                <FormDescription>/book/{session?.active_organization?.slug ?? "your-org"}/{field.value || "…"}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="host_ids" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Hosts</FormLabel>
                                <PeoplePicker value={field.value} onChange={field.onChange} placeholder="Add host" known={{ ...(session?.active_organization ? { [session.active_organization.membership_id]: meName } : {}), ...Object.fromEntries((link?.hosts ?? []).map((h) => [h.membership_id, h.name])) }} />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="host_assignment" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>With several hosts</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Host assignment"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{HostAssignmentFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{BookingLinkStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="duration_minutes" render={({ field }) => (
                                <FormItem><FormLabel>Duration (min)</FormLabel><FormControl><Input type="number" min={5} max={480} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="buffer_after_minutes" render={({ field }) => (
                                <FormItem><FormLabel>Break after (min)</FormLabel><FormControl><Input type="number" min={0} max={240} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="min_notice_minutes" render={({ field }) => (
                                <FormItem><FormLabel>Minimum notice (min)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="max_days_ahead" render={({ field }) => (
                                <FormItem><FormLabel>Bookable days ahead</FormLabel><FormControl><Input type="number" min={1} max={365} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="location" render={({ field }) => (
                            <FormItem><FormLabel>Location or meeting link</FormLabel><FormControl><Input placeholder="Google Meet link is sent after booking" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} placeholder="Shown on the booking page" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="requires_confirmation" render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Requires confirmation" /></FormControl>
                                <FormLabel className="font-normal">A host confirms each booking</FormLabel>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmation_message" render={({ field }) => (
                            <FormItem><FormLabel>Message after booking</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            {link ? (
                                <Button type="button" onClick={close}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>Create link</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
