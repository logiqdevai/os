import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MultiPicker } from "@/components/ui/multi-picker";
import { useCreateOutboundWebhook, useTriggerCatalog, useUpdateOutboundWebhook } from "@/features/automation/hooks/use-automation";
import type { OutboundWebhook } from "@/features/automation/interfaces/automation.interfaces";
import { EVENT_PATTERN, outboundWebhookSchema, type OutboundWebhookFormValues } from "@/features/automation/validation-schemas/outbound-webhook.schema";

/**
 * Create / edit an outbound webhook (OutboundWebhook, owned by 20 Automation, administered here).
 * Events come from the platform event catalog (GET /automation/triggers, kind EVENT), plus prefix wildcards.
 * @perm automation.webhooks.manage · @api POST /automation/webhooks/outbound · PATCH /automation/webhooks/outbound/:id
 */
export function WebhookFormDialog({ open, onOpenChange, hook, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; hook: OutboundWebhook | null; onCreated?: (h: OutboundWebhook) => void }) {
    const create = useCreateOutboundWebhook();
    const update = useUpdateOutboundWebhook();
    const catalog = useTriggerCatalog();
    const [pattern, setPattern] = useState("");
    const form = useForm<OutboundWebhookFormValues>({
        resolver: zodResolver(outboundWebhookSchema),
        defaultValues: { name: "", url: "https://", description: "", subscribed_events: [], max_attempts: 5, timeout_seconds: 10 },
    });

    useEffect(() => {
        if (!open) return;
        setPattern("");
        form.reset({
            name: hook?.name ?? "",
            url: hook?.url ?? "https://",
            description: hook?.description ?? "",
            subscribed_events: hook?.subscribed_events ?? [],
            max_attempts: hook?.max_attempts ?? 5,
            timeout_seconds: hook?.timeout_seconds ?? 10,
        });
    }, [open, hook, form]);

    const items = useMemo(
        () =>
            (catalog.data ?? [])
                .filter((t) => t.kind === "EVENT")
                .map((t) => ({ id: t.key, label: t.name, hint: <span className="font-mono">{t.key}</span>, keywords: `${t.key} ${t.module} ${t.description}` })),
        [catalog.data]
    );
    // Wildcards and keys missing from the catalog still show a readable chip.
    const selected = form.watch("subscribed_events");
    const known = Object.fromEntries((selected ?? []).map((k) => [k, k === "*" ? "All events (*)" : k.endsWith(".*") ? `Every ${k.slice(0, -2)} event (${k})` : k]));

    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { ...v, description: v.description || undefined };
        if (hook) update.mutate({ id: hook.id, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate(dto, { onSuccess: (h) => { onOpenChange(false); onCreated?.(h); } });
    });

    const addPattern = () => {
        const p = pattern.trim().toLowerCase();
        if (!EVENT_PATTERN.test(p)) return form.setError("subscribed_events", { message: "Use an event key, a prefix like crm.* or * for everything" });
        const current = form.getValues("subscribed_events");
        if (!current.includes(p)) form.setValue("subscribed_events", [...current, p], { shouldDirty: true, shouldValidate: true });
        setPattern("");
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{hook ? "Edit webhook" : "Create webhook"}</DialogTitle>
                            <DialogDescription>Receive events as signed JSON. Each delivery is retried with backoff and logged.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Data warehouse" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="url" render={({ field }) => (<FormItem><FormLabel>Endpoint URL</FormLabel><FormControl><Input className="font-mono text-xs" inputMode="url" {...field} /></FormControl><FormDescription>HTTPS; private network addresses are refused.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="subscribed_events" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Events</FormLabel>
                                <MultiPicker
                                    ariaLabel="Events"
                                    items={items}
                                    value={field.value}
                                    onChange={field.onChange}
                                    known={known}
                                    loading={catalog.isPending}
                                    placeholder="Add event"
                                    searchPlaceholder="Search events…"
                                    emptyText={catalog.error ? "Could not load the event catalog" : "No matching events"}
                                />
                                <div className="flex gap-2">
                                    <Input aria-label="Event pattern" placeholder="crm.* or *" className="h-8 font-mono text-xs" value={pattern} onChange={(e) => setPattern(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPattern(); } }} />
                                    <Button type="button" size="sm" variant="outline" onClick={addPattern} disabled={!pattern.trim()}><Plus /> Add</Button>
                                </div>
                                <FormDescription>Pick events, or add a whole module with <code>module.*</code>, or <code>*</code> for everything.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="max_attempts" render={({ field }) => (<FormItem><FormLabel>Attempts</FormLabel><FormControl><Input type="number" min={1} max={20} value={field.value} onChange={(e) => field.onChange(Number(e.target.value) || 1)} /></FormControl><FormDescription>Retries back off exponentially.</FormDescription><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="timeout_seconds" render={({ field }) => (<FormItem><FormLabel>Timeout (seconds)</FormLabel><FormControl><Input type="number" min={1} max={30} value={field.value} onChange={(e) => field.onChange(Number(e.target.value) || 1)} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{hook ? "Save" : "Create webhook"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
