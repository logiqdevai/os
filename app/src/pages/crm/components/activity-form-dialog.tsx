import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityDirectionFormOptions, ActivityTypeFormOptions, PriorityFormOptions } from "@/config/constants/dropdowns/crm/activity-form.options";
import { activityFormSchema, type ActivityFormValues } from "@/features/crm/activities/validation-schemas/activities.schema";
import { useCreateActivity, useUpdateActivity } from "@/features/crm/activities/hooks/use-activities";
import type { Activity, ActivityType, CreateActivityDto, CrmRecordLink } from "@/features/crm/activities/interfaces/activities.interfaces";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { MemberSelect } from "./crm-pickers";

const defaultStart = () => {
    const d = new Date(Date.now() + 86400_000);
    d.setHours(10, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
};

interface Props {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    /** Record the activity belongs to (deal, company, contact, lead). */
    link?: CrmRecordLink;
    activity?: Activity | null;
    defaultType?: ActivityType;
}

/**
 * Schedule or log a call, meeting, email or follow-up (mockup `activity-new`).
 * @perm crm.activities.create · edit crm.activities.update
 * @api POST /crm/activities · PATCH /crm/activities/:id
 */
export function ActivityFormDialog({ open, onOpenChange, link, activity, defaultType = "CALL" }: Props) {
    const create = useCreateActivity();
    const update = useUpdateActivity();
    const form = useForm<ActivityFormValues>({ resolver: zodResolver(activityFormSchema), defaultValues: { type: defaultType, mode: "schedule", title: "", priority: "NORMAL" } });

    useEffect(() => {
        if (!open) return;
        form.reset({
            type: activity?.type ?? defaultType,
            mode: activity ? (activity.status === "COMPLETED" ? "log" : "schedule") : "schedule",
            title: activity?.title ?? "",
            starts_at: activity?.starts_at ? format(new Date(activity.starts_at), "yyyy-MM-dd'T'HH:mm") : activity ? "" : defaultStart(),
            duration_minutes: activity?.duration_minutes != null ? String(activity.duration_minutes) : "",
            priority: activity?.priority ?? "NORMAL",
            direction: activity?.direction ?? undefined,
            owner_membership_id: activity?.owner_membership_id ?? undefined,
            location: activity?.location ?? "",
            meeting_url: activity?.meeting_url ?? "",
            description: activity?.description ?? "",
            outcome: activity?.outcome ?? "",
        });
    }, [open, activity, defaultType, form]);

    const type = form.watch("type");
    const mode = form.watch("mode");
    const pending = create.isPending || update.isPending;

    const submit = form.handleSubmit((v) => {
        const dto: CreateActivityDto = {
            type: v.type,
            title: v.title,
            priority: v.priority,
            direction: v.type === "CALL" || v.type === "EMAIL" ? v.direction : undefined,
            starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : undefined,
            duration_minutes: v.duration_minutes ? Number(v.duration_minutes) : undefined,
            owner_membership_id: v.owner_membership_id || undefined,
            location: v.location || undefined,
            meeting_url: v.meeting_url || undefined,
            description: v.description || undefined,
            outcome: v.outcome || undefined,
        };
        const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not save activity", description: getApiErrorMessage(e) });
        if (activity) update.mutate({ id: activity.id, ...dto }, { onSuccess: () => { toast({ title: "Activity updated" }); onOpenChange(false); }, onError });
        else create.mutate({ ...dto, ...link, status: v.mode === "log" ? "COMPLETED" : "PLANNED" }, { onSuccess: () => { toast({ title: v.mode === "log" ? "Activity logged" : "Activity scheduled" }); onOpenChange(false); }, onError });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{activity ? "Edit activity" : "New activity"}</DialogTitle>
                            <DialogDescription>Schedule something to do, or log something that already happened.</DialogDescription>
                        </DialogHeader>
                        {!activity && (
                            <Tabs value={mode} onValueChange={(m) => form.setValue("mode", m as ActivityFormValues["mode"])}>
                                <TabsList className="w-full">
                                    <TabsTrigger value="schedule" className="flex-1">Schedule</TabsTrigger>
                                    <TabsTrigger value="log" className="flex-1">Log completed</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ActivityTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="priority" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{PriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Title</FormLabel><FormControl><Input autoFocus placeholder="Discovery call" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="starts_at" render={({ field }) => (
                                <FormItem><FormLabel>{mode === "log" ? "When" : "Due"}</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="duration_minutes" render={({ field }) => (
                                <FormItem><FormLabel>Duration (min)</FormLabel><FormControl><Input inputMode="numeric" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {(type === "CALL" || type === "EMAIL") && (
                                <FormField control={form.control} name="direction" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Direction</FormLabel>
                                        <Select value={field.value ?? "OUTBOUND"} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Direction"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{ActivityDirectionFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            )}
                            {(type === "MEETING" || type === "APPOINTMENT") && (
                                <>
                                    <FormField control={form.control} name="location" render={({ field }) => (
                                        <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="meeting_url" render={({ field }) => (
                                        <FormItem><FormLabel>Meeting link</FormLabel><FormControl><Input placeholder="https://meet…" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </>
                            )}
                            <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                <FormItem><FormLabel>Assigned to</FormLabel><MemberSelect label="Assigned to" value={field.value} onChange={field.onChange} allowNone /></FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Details</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {(mode === "log" || activity?.status === "COMPLETED") && (
                                <FormField control={form.control} name="outcome" render={({ field }) => (
                                    <FormItem className="sm:col-span-2"><FormLabel>Outcome</FormLabel><FormControl><Textarea rows={2} placeholder="Agreed to send a proposal" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{activity ? "Save changes" : mode === "log" ? "Log activity" : "Schedule"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
