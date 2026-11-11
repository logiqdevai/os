import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { announcementFormSchema, type AnnouncementFormValues } from "@/features/notifications/validation-schemas/announcement.schema";
import { useCreateAnnouncement, useUpdateAnnouncement } from "@/features/notifications/hooks/use-notifications";
import type { Announcement } from "@/features/notifications/interfaces/notifications.interfaces";

const toLocal = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");
const toIso = (local: string | undefined) => (local ? new Date(local).toISOString() : null);

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    announcement?: Announcement | null;
}

/** Create / edit a draft or scheduled announcement (audience: every member). */
export function AnnouncementFormDialog({ open, onOpenChange, announcement }: Props) {
    const create = useCreateAnnouncement();
    const update = useUpdateAnnouncement();
    const form = useForm<AnnouncementFormValues>({
        resolver: zodResolver(announcementFormSchema),
        defaultValues: { title: "", body: "", severity: "NORMAL", requires_ack: false, publish_at: "", expires_at: "" },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                title: announcement?.title ?? "",
                body: announcement?.body ?? "",
                severity: announcement?.severity ?? "NORMAL",
                requires_ack: announcement?.requires_ack ?? false,
                publish_at: toLocal(announcement?.publish_at),
                expires_at: toLocal(announcement?.expires_at),
            });
        }
    }, [open, announcement, form]);

    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { title: v.title, body: v.body, severity: v.severity, requires_ack: v.requires_ack, publish_at: toIso(v.publish_at), expires_at: toIso(v.expires_at) };
        const options = { onSuccess: () => onOpenChange(false) };
        if (announcement) update.mutate({ id: announcement.id, ...dto }, options);
        else create.mutate(dto, options);
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{announcement ? "Edit announcement" : "New announcement"}</DialogTitle>
                            <DialogDescription>Goes to every member's inbox when published. Leave “Publish at” empty to publish manually.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input autoFocus placeholder="Planned maintenance on Saturday" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="body" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl><Textarea rows={5} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="severity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Severity</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{NotificationPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="requires_ack" render={({ field }) => (
                                <FormItem className="flex flex-col justify-end">
                                    <FormLabel>Require acknowledgement</FormLabel>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Require acknowledgement" /></FormControl>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="publish_at" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Publish at</FormLabel>
                                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                                    <FormDescription>Optional schedule.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="expires_at" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expires at</FormLabel>
                                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                                    <FormDescription>Removed from inboxes after.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{announcement ? "Save changes" : "Save draft"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
