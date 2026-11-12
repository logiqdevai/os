import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { InboundAuthSchemeOptions, InboundEditableStatusOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useCreateInboundWebhook, useRules, useUpdateInboundWebhook } from "@/features/automation/hooks/use-automation";
import type { InboundAuthScheme, InboundWebhook } from "@/features/automation/interfaces/automation.interfaces";
import { inboundWebhookSchema, type InboundWebhookFormValues } from "@/features/automation/validation-schemas/inbound-webhook.schema";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hook: InboundWebhook | null;
    onCreated: (hook: InboundWebhook) => void;
}

const empty: InboundWebhookFormValues = { name: "", description: "", slug: "", auth_scheme: "HMAC_SHA256", signature_header: "", rule_id: null, allowed_ip_ranges: "", rate_limit_per_minute: "", status: "ACTIVE" };

/**
 * Create / edit an inbound webhook endpoint and link it to the workflow it starts (20 §12, §14).
 * @perm automation.webhooks.manage · linking a workflow also needs automation.rules.update (server-checked)
 * @api POST /automation/webhooks/inbound · PATCH /automation/webhooks/inbound/:id (slug is immutable)
 */
export function InboundWebhookDialog({ open, onOpenChange, hook, onCreated }: Props) {
    const create = useCreateInboundWebhook();
    const update = useUpdateInboundWebhook();
    const canLink = usePermission("automation.rules.update");
    const rules = useRules({ limit: 200, archived: "false" });
    const form = useForm<InboundWebhookFormValues>({ resolver: zodResolver(inboundWebhookSchema), defaultValues: empty });
    const pending = create.isPending || update.isPending;

    useEffect(() => {
        if (!open) return;
        form.reset(hook ? {
            name: hook.name,
            description: hook.description ?? "",
            slug: hook.slug,
            auth_scheme: hook.auth_scheme,
            signature_header: hook.signature_header ?? "",
            rule_id: hook.rule_id,
            allowed_ip_ranges: hook.allowed_ip_ranges.join("\n"),
            rate_limit_per_minute: hook.rate_limit_per_minute ? String(hook.rate_limit_per_minute) : "",
            status: hook.status === "PAUSED" ? "PAUSED" : "ACTIVE",
        } : empty);
    }, [open, hook, form]);

    const submit = form.handleSubmit((v) => {
        const dto = {
            name: v.name,
            description: v.description || undefined,
            auth_scheme: v.auth_scheme as InboundAuthScheme,
            signature_header: v.signature_header || undefined,
            allowed_ip_ranges: v.allowed_ip_ranges.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean),
            rate_limit_per_minute: v.rate_limit_per_minute ? Number(v.rate_limit_per_minute) : null,
            ...(canLink ? { rule_id: v.rule_id } : {}),
        };
        const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not save the endpoint", description: getApiErrorMessage(e) });
        if (hook) {
            update.mutate({ id: hook.id, ...dto, status: v.status }, { onSuccess: () => { toast({ title: "Endpoint updated" }); onOpenChange(false); }, onError });
        } else {
            create.mutate({ ...dto, slug: v.slug || undefined }, { onSuccess: (h) => { onOpenChange(false); onCreated(h); }, onError });
        }
    });

    const ruleItems = (rules.data?.data ?? []).map((r) => ({ id: r.id, label: r.name, hint: r.status === "PUBLISHED" ? (r.enabled ? "live" : "disabled") : "draft" }));

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{hook ? `Edit ${hook.name}` : "New inbound endpoint"}</DialogTitle>
                            <DialogDescription>Each accepted request publishes inbound_webhook.&lt;slug&gt; on the event bus and starts the linked workflow.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Website leads" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="slug" render={({ field }) => (
                            <FormItem><FormLabel>Slug</FormLabel><FormControl><Input placeholder="generated when empty" disabled={!!hook} {...field} /></FormControl>{hook && <FormDescription>The URL cannot change; create a new endpoint instead.</FormDescription>}<FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="auth_scheme" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Authentication</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Authentication"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{InboundAuthSchemeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="signature_header" render={({ field }) => (<FormItem><FormLabel>Signature header</FormLabel><FormControl><Input placeholder="x-signature" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="rule_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Workflow to start</FormLabel>
                                <EntityPicker items={ruleItems} value={field.value} onChange={field.onChange} noneLabel="Any workflow using this trigger" placeholder="Any workflow using this trigger" searchPlaceholder="Search workflows…" loading={rules.isPending} disabled={!canLink} ariaLabel="Workflow to start" />
                                <FormDescription>{canLink ? "The linked workflow runs for every accepted request, whatever its own trigger." : "Linking a workflow needs automation.rules.update."}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="rate_limit_per_minute" render={({ field }) => (<FormItem><FormLabel>Requests per minute</FormLabel><FormControl><Input inputMode="numeric" placeholder="120 (default)" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            {hook && (
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{InboundEditableStatusOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            )}
                        </div>
                        <FormField control={form.control} name="allowed_ip_ranges" render={({ field }) => (
                            <FormItem><FormLabel>Allowed IP addresses</FormLabel><FormControl><Textarea rows={2} className="font-mono text-xs" placeholder={"203.0.113.10\n198.51.100.0/24"} {...field} /></FormControl><FormDescription>One IPv4 address or CIDR per line. Empty = any address.</FormDescription><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{hook ? "Save" : "Create"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
