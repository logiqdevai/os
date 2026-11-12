import { useEffect, useRef } from "react";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useCalendarTeams, useCreateCalendar, useUpdateCalendar } from "@/features/calendar/hooks/use-calendar";
import { calendarFormSchema, type CalendarFormValues } from "@/features/calendar/validation-schemas/calendar.schema";
import type { CalendarRow } from "@/features/calendar/interfaces/calendar.interfaces";
import { CalendarKindFormOptions, ColorTokenOptions, EventVisibilityFormOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { cn } from "@/lib/utils";
import { dotClass } from "../../../utils/calendar.utils";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    calendar?: CalendarRow | null;
}

/**
 * New / edit calendar. PERSONAL needs calendar.events.create; TEAM and ORGANIZATION need calendar.calendars.manage.
 * Editing autosaves every valid change ("Done" closes); creating keeps "Create calendar".
 */
export function CalendarFormDialog({ open, onOpenChange, calendar }: Props) {
    const canManage = usePermission("calendar.calendars.manage");
    const teams = useCalendarTeams(open && canManage);
    const create = useCreateCalendar();
    const update = useUpdateCalendar({ inline: true });
    const form = useForm<CalendarFormValues>({
        resolver: zodResolver(calendarFormSchema),
        defaultValues: { kind: "PERSONAL", name: "", color: "info", default_visibility: "TEAM", free_busy_only: false },
    });
    const kind = useWatch({ control: form.control, name: "kind" });

    useEffect(() => {
        if (open) {
            form.reset({
                kind: (calendar?.kind as CalendarFormValues["kind"]) ?? "PERSONAL",
                name: calendar?.name ?? "",
                description: calendar?.description ?? "",
                color: (calendar?.color as CalendarFormValues["color"]) ?? "info",
                team_id: undefined,
                default_visibility: calendar?.default_visibility ?? "TEAM",
                free_busy_only: calendar?.free_busy_only ?? false,
            });
        }
    }, [open, calendar, form]);

    const pending = create.isPending;
    const kinds = CalendarKindFormOptions.filter((o) => o.id === "PERSONAL" || (canManage && (o.id === "TEAM" || o.id === "ORGANIZATION")));
    const calendarRef = useRef(calendar);
    if (calendar) calendarRef.current = calendar;
    const autosave = useFormAutosave(
        form,
        (v) => update.mutateAsync({ id: calendarRef.current!.id, name: v.name, description: v.description, color: v.color, default_visibility: v.default_visibility, free_busy_only: v.free_busy_only }),
        { enabled: open && !!calendar },
    );
    const close = () => {
        if (calendar) void form.trigger().then((ok) => ok && autosave.flush());
        onOpenChange(false);
    };
    const submit = form.handleSubmit((v) => {
        if (calendar) return close();
        create.mutate({ kind: v.kind, name: v.name, description: v.description || undefined, color: v.color, team_id: v.kind === "TEAM" ? v.team_id : undefined, default_visibility: v.default_visibility, free_busy_only: v.free_busy_only }, { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !pending && close())}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{calendar ? "Edit calendar" : "New calendar"}</DialogTitle>
                            <DialogDescription>Calendars group events. Share them with people or teams afterwards.</DialogDescription>
                            {calendar && <SaveStatus state={autosave} />}
                        </DialogHeader>
                        {!calendar && (
                            <FormField control={form.control} name="kind" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{kinds.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                        {!calendar && kind === "TEAM" && (
                            <FormField control={form.control} name="team_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Team</FormLabel>
                                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Team"><SelectValue placeholder="Choose a team" /></SelectTrigger></FormControl>
                                        <SelectContent>{(teams.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl><Input autoFocus placeholder="Web team" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="color" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Color"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {ColorTokenOptions.map((o) => (
                                                <SelectItem key={o.id} value={o.id}><span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", dotClass(o.id))} />{o.label}</span></SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="default_visibility" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New events are</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Default visibility"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{EventVisibilityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="free_busy_only" render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Free/busy only" /></FormControl>
                                <div>
                                    <FormLabel className="font-normal">Others only see free/busy</FormLabel>
                                    <FormDescription>Unless you share the calendar with them.</FormDescription>
                                </div>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            {calendar ? (
                                <Button type="button" onClick={close}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>Create calendar</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
