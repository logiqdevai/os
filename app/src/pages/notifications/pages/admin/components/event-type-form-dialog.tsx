import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleLabelOptions, NotificationCategoryFormOptions, NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { eventTypeFormSchema, type EventTypeFormValues } from "@/features/notifications/validation-schemas/notification-admin.schema";
import { useCreateEventType, useUpdateEventType } from "@/features/notifications/hooks/use-notification-admin";
import type { EventTypeRow } from "@/features/notifications/interfaces/notification-admin.interfaces";
import type { NotificationCategory } from "@/features/notifications/interfaces/notifications.interfaces";
import { ChannelChecks } from "./admin-ui";

/** Register (or edit) an organization event type. Platform event types are never edited here. */
export function EventTypeFormDialog({ open, onOpenChange, eventType }: { open: boolean; onOpenChange: (o: boolean) => void; eventType?: EventTypeRow | null }) {
    const navigate = useNavigate();
    const create = useCreateEventType();
    const update = useUpdateEventType();
    const form = useForm<EventTypeFormValues>({
        resolver: zodResolver(eventTypeFormSchema),
        defaultValues: { key: "", module: "", name: "", description: "", category: "GENERAL", priority: "NORMAL", default_channels: ["IN_APP"], mandatory_by_default: false, supports_digest: true, customer_visible: false, is_active: true },
    });
    useEffect(() => {
        if (!open) return;
        form.reset(eventType
            ? { key: eventType.key, module: eventType.module, name: eventType.name, description: eventType.description ?? "", category: eventType.category, priority: eventType.priority, default_channels: eventType.default_channels, mandatory_by_default: eventType.mandatory_by_default, supports_digest: eventType.supports_digest, customer_visible: eventType.customer_visible, is_active: eventType.is_active }
            : { key: "", module: "", name: "", description: "", category: "GENERAL", priority: "NORMAL", default_channels: ["IN_APP"], mandatory_by_default: false, supports_digest: true, customer_visible: false, is_active: true });
    }, [open, eventType, form]);

    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { name: v.name, description: v.description || null, category: v.category as NotificationCategory, priority: v.priority, default_channels: v.default_channels, mandatory_by_default: v.mandatory_by_default, supports_digest: v.supports_digest, customer_visible: v.customer_visible, is_active: v.is_active };
        if (eventType) update.mutate({ id: eventType.id, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate({ ...dto, key: v.key, module: v.module }, { onSuccess: (row) => { onOpenChange(false); navigate(`/notifications/admin/events/${row.id}`); } });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{eventType ? "Edit event type" : "Register event type"}</DialogTitle>
                            <DialogDescription>Organization events can be emitted by Automation and used in templates, defaults and rules.</DialogDescription>
                        </DialogHeader>
                        {!eventType && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="key" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Key</FormLabel>
                                        <FormControl><Input placeholder="agency.client_review_due" {...field} /></FormControl>
                                        <FormDescription>Cannot change later.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="module" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Module</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Module"><SelectValue placeholder="Choose a module" /></SelectTrigger></FormControl>
                                            <SelectContent>{ModuleLabelOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        )}
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl><Input placeholder="Client review window closing" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea rows={2} {...field} /></FormControl>
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{NotificationCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="priority" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{NotificationPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="default_channels" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default channels</FormLabel>
                                <ChannelChecks value={field.value} onChange={field.onChange} />
                            </FormItem>
                        )} />
                        <div className="space-y-3 rounded-md border border-border p-3">
                            {([
                                ["mandatory_by_default", "Mandatory", "Members cannot mute it."],
                                ["supports_digest", "Can go into digests", "Batched for members who chose a digest."],
                                ["customer_visible", "Customer visible", "Portal users may receive it."],
                                ["is_active", "Active", "Inactive event types are not delivered."],
                            ] as const).map(([name, label, hint]) => (
                                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-3 space-y-0">
                                        <div>
                                            <FormLabel className="text-[13px]">{label}</FormLabel>
                                            <p className="text-xs text-muted-foreground">{hint}</p>
                                        </div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label={label} /></FormControl>
                                    </FormItem>
                                )} />
                            ))}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{eventType ? "Save" : "Register"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
