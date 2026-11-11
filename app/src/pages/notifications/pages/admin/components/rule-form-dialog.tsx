import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoalesceKeyFormOptions, ModuleLabelOptions, RuleKindFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { ruleFormSchema, type RuleFormValues } from "@/features/notifications/validation-schemas/notification-admin.schema";
import { useAdminEventTypes, useCreateRule, useUpdateRule } from "@/features/notifications/hooks/use-notification-admin";
import type { DeliveryRule, DeliveryRuleDto } from "@/features/notifications/interfaces/notification-admin.interfaces";

const EMPTY: RuleFormValues = { name: "", kind: "DEDUPLICATE", target: "all", module: "", event_type_id: "", channel: "any", window_minutes: "60", max_per_window: "", coalesce_key: "RECORD", priority: "10", is_active: true };

/** Create / edit a delivery rule (14 §9). */
export function RuleFormDialog({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (o: boolean) => void; rule?: DeliveryRule | null }) {
    const types = useAdminEventTypes({ limit: 200, active: "true" }, open);
    const create = useCreateRule();
    const update = useUpdateRule();
    const form = useForm<RuleFormValues>({ resolver: zodResolver(ruleFormSchema), defaultValues: EMPTY });
    const kind = useWatch({ control: form.control, name: "kind" });
    const target = useWatch({ control: form.control, name: "target" });

    useEffect(() => {
        if (!open) return;
        form.reset(rule
            ? {
                name: rule.name, kind: rule.kind, target: rule.event_type_id ? "event" : rule.module ? "module" : "all", module: rule.module ?? "", event_type_id: rule.event_type_id ?? "",
                channel: rule.channel === "IN_APP" || rule.channel === "EMAIL" ? rule.channel : "any", window_minutes: rule.window_seconds ? String(Math.round(rule.window_seconds / 60)) : "",
                max_per_window: rule.max_per_window ? String(rule.max_per_window) : "", coalesce_key: rule.coalesce_key ?? "RECORD", priority: String(rule.priority), is_active: rule.is_active,
            }
            : EMPTY);
    }, [open, rule, form]);

    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto: DeliveryRuleDto = {
            name: v.name, kind: v.kind,
            module: v.target === "module" ? v.module : null, event_type_id: v.target === "event" ? v.event_type_id : null,
            channel: v.channel === "any" ? null : v.channel,
            window_seconds: v.kind === "SUPPRESS" ? null : Number(v.window_minutes) * 60,
            max_per_window: v.kind === "THROTTLE" ? Number(v.max_per_window) : null,
            coalesce_key: v.kind === "COALESCE" ? v.coalesce_key : null,
            priority: Number(v.priority), is_active: v.is_active,
        };
        if (rule) update.mutate({ id: rule.id, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{rule ? "Edit rule" : "New delivery rule"}</DialogTitle>
                            <DialogDescription>Rules run before delivery, lowest order number first. Mandatory events are never filtered.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="One SLA warning per ticket per hour" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="kind" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Kind</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{RuleKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormDescription>{RuleKindFormOptions.find((o) => o.id === kind)?.hint}</FormDescription>
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="target" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Applies to</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Applies to"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">Every event</SelectItem>
                                            <SelectItem value="module">One module</SelectItem>
                                            <SelectItem value="event">One event</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="any">Every channel</SelectItem>
                                            <SelectItem value="IN_APP">In-app</SelectItem>
                                            <SelectItem value="EMAIL">Email</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        {target === "module" && (
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
                        )}
                        {target === "event" && (
                            <FormField control={form.control} name="event_type_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Event</FormLabel>
                                    <EntityPicker
                                        items={(types.data?.data ?? []).map((t) => ({ id: t.id, label: t.name, keywords: t.key, hint: <code className="text-xs">{t.key}</code> }))}
                                        value={field.value} onChange={(id) => field.onChange(id ?? "")} loading={types.isLoading}
                                        placeholder="Choose an event" searchPlaceholder="Search events…" ariaLabel="Event"
                                    />
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <div className="grid gap-4 sm:grid-cols-3">
                            {kind !== "SUPPRESS" && (
                                <FormField control={form.control} name="window_minutes" render={({ field }) => (
                                    <FormItem><FormLabel>Window (min)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            {kind === "THROTTLE" && (
                                <FormField control={form.control} name="max_per_window" render={({ field }) => (
                                    <FormItem><FormLabel>Max per window</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            {kind === "COALESCE" && (
                                <FormField control={form.control} name="coalesce_key" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Group by</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Group by"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{CoalesceKeyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="priority" render={({ field }) => (
                                <FormItem><FormLabel>Order</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Active" /></FormControl>
                                <FormLabel className="font-normal">Active</FormLabel>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{rule ? "Save" : "Create rule"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
