import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, KeyRound, MoreHorizontal, Pencil, Pause, Play, Plus, RotateCcw, Send, Trash2, Webhook } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState, ListSkeleton, NoAccessState } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { environments } from "@/config/environments";
import { DeliveryStatusFilterOptions, InboundAuthSchemeOptions } from "@/config/constants/dropdowns/automation/automation.options";
import {
    useCreateOutboundWebhook, useDeleteOutboundWebhook, useDeliveries, useDelivery, useInboundAction, useInboundWebhooks, useOutboundAction,
    useOutboundWebhooks, useRetryDelivery, useUpdateOutboundWebhook,
} from "@/features/automation/hooks/use-automation";
import type { InboundWebhook, OutboundWebhook, WebhookDelivery } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, SecretReveal, StatusBadge, formatDuration } from "../../components/automation-ui";
import { InboundWebhookDialog } from "./components/inbound-webhook-dialog";

/**
 * /automation/webhooks?tab=outbound|inbound|deliveries (20 §12)
 * @perm VIEW automation.webhooks.read · manage automation.webhooks.manage (secrets are only shown once)
 * @api /automation/webhooks/outbound · /inbound · /deliveries (+ test, rotate-secret, pause, resume, revoke, retry)
 */
export default function WebhooksPage() {
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "outbound";
    const [secret, setSecret] = useState<{ title: string; secret: string; extra?: string } | null>(null);
    if (!p.can("automation.webhooks.read")) return <Page><NoAccessState /></Page>;

    return (
        <Page>
            <PageHeader title="Webhooks" description="Signed HTTP callbacks: send platform events to other systems, or let them start workflows." />
            <Tabs value={tab} onValueChange={(v) => setSp(() => new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList className="mb-4">
                    <TabsTrigger value="outbound">Outbound</TabsTrigger>
                    <TabsTrigger value="inbound">Inbound</TabsTrigger>
                    <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
                </TabsList>
                <TabsContent value="outbound"><OutboundTab onSecret={setSecret} /></TabsContent>
                <TabsContent value="inbound"><InboundTab onSecret={setSecret} /></TabsContent>
                <TabsContent value="deliveries"><DeliveriesTab /></TabsContent>
            </Tabs>
            <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{secret?.title}</DialogTitle>
                        <DialogDescription>{secret?.extra ?? "Use this secret to verify the X-Logiqdev-Signature header (HMAC-SHA256 of “timestamp.body”)."}</DialogDescription>
                    </DialogHeader>
                    {secret && <SecretReveal secret={secret.secret} />}
                    <DialogFooter><Button onClick={() => setSecret(null)}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}

type SecretSetter = (s: { title: string; secret: string; extra?: string }) => void;

function OutboundTab({ onSecret }: { onSecret: SecretSetter }) {
    const { params, setPage, search, setSearch } = useListParams();
    const hooks = useOutboundWebhooks(params);
    const action = useOutboundAction();
    const remove = useDeleteOutboundWebhook();
    const canManage = usePermissions().can("automation.webhooks.manage");
    const [editing, setEditing] = useState<OutboundWebhook | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<OutboundWebhook | null>(null);
    /** Result of the last "Send test" per endpoint, shown in its status cell (no success toast). */
    const [tested, setTested] = useState<Record<string, { ok: boolean; code: number | null | undefined }>>({});

    // Pause / resume are optimistic; rotate-secret opens the secret dialog; a test shows its result in the row.
    const run = (h: OutboundWebhook, a: "pause" | "resume" | "rotate-secret" | "test") =>
        action.mutate({ id: h.id, action: a }, {
            onSuccess: (res) => {
                if (a === "rotate-secret" && res.secret) onSecret({ title: `New secret for ${h.name}`, secret: res.secret, extra: "The previous secret keeps working for 24 hours." });
                else if (a === "test") {
                    setTested((t) => ({ ...t, [h.id]: { ok: res.status === "SUCCEEDED", code: res.response_status_code } }));
                    // The request worked but the receiver refused: an error worth interrupting for.
                    if (res.status !== "SUCCEEDED") toast({ variant: "destructive", title: "Test delivery failed", description: res.error_message ?? undefined });
                }
            },
        });

    const columns: DataTableColumn<OutboundWebhook>[] = [
        {
            key: "name",
            header: "Endpoint",
            cell: (h) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{h.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{h.url}</div>
                </div>
            ),
        },
        { key: "events", header: "Events", cell: (h) => <span className="line-clamp-1 font-mono text-xs">{h.subscribed_events.join(", ") || "—"}</span>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (h) => <div className="space-y-0.5"><StatusBadge status={h.status} />{h.consecutive_failures > 0 && <div className="text-xs text-danger">{h.consecutive_failures} failures in a row</div>}{action.isPending && action.variables?.id === h.id && action.variables.action === "test" ? <div className="text-xs text-muted-foreground">Sending test…</div> : tested[h.id] && <div className={tested[h.id].ok ? "text-xs text-success" : "text-xs text-danger"}>{tested[h.id].ok ? `Test delivered${tested[h.id].code ? ` (${tested[h.id].code})` : ""}` : "Test failed"}</div>}</div> },
        { key: "last", header: "Last delivery", cell: (h) => formatRelative(h.last_delivery_at), hideBelow: "md" },
        { key: "secret", header: "Secret", cell: (h) => <code className="font-mono text-xs text-muted-foreground">{h.secret_hint}</code>, hideBelow: "xl" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (h) =>
                canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${h.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => run(h, "test")}><Send /> Send test</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setEditing(h); setFormOpen(true); }}><Globe /> Edit</DropdownMenuItem>
                            {h.status === "ACTIVE" ? <DropdownMenuItem onSelect={() => run(h, "pause")}><Pause /> Pause</DropdownMenuItem> : <DropdownMenuItem onSelect={() => run(h, "resume")}><Play /> Resume</DropdownMenuItem>}
                            <DropdownMenuItem onSelect={() => run(h, "rotate-secret")}><KeyRound /> Rotate secret</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(h)}><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search endpoints…">
                {canManage && <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New endpoint</Button>}
            </TableToolbar>
            {hooks.data?.data.some((h) => h.status === "DISABLED") && (
                <div className="mb-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                    An endpoint was disabled automatically after repeated failures. Fix the receiver, then resume it.
                </div>
            )}
            <DataTable
                columns={columns}
                data={hooks.data?.data}
                rowKey={(h) => h.id}
                loading={hooks.isFetching}
                error={hooks.error}
                onRetry={() => hooks.refetch()}
                pagination={hooks.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Webhook, title: "No endpoints yet", description: "Send events such as crm.deal.won to another system with a signed POST.", action: canManage ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New endpoint</Button> : undefined }}
            />
            <OutboundFormDialog open={formOpen} onOpenChange={setFormOpen} hook={editing} onSecret={onSecret} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="Deliveries stop immediately. Workflows calling this endpoint will fail."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => {
                    if (deleting) remove.mutate(deleting.id); // optimistic: the row leaves at once
                    setDeleting(null);
                }}
            />
        </>
    );
}

const outboundSchema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    url: z.string().trim().url("Enter a full URL, e.g. https://example.com/hook"),
    events: z.string().trim().min(1, "Subscribe to at least one event (or *)"),
    description: z.string().max(1000).optional(),
});
type OutboundValues = z.infer<typeof outboundSchema>;

function OutboundFormDialog({ open, onOpenChange, hook, onSecret }: { open: boolean; onOpenChange: (o: boolean) => void; hook: OutboundWebhook | null; onSecret: SecretSetter }) {
    const create = useCreateOutboundWebhook();
    const update = useUpdateOutboundWebhook();
    const form = useForm<OutboundValues>({ resolver: zodResolver(outboundSchema), defaultValues: { name: "", url: "", events: "", description: "" } });
    useEffect(() => {
        if (open) form.reset({ name: hook?.name ?? "", url: hook?.url ?? "https://", events: hook?.subscribed_events.join(", ") ?? "", description: hook?.description ?? "" });
    }, [open, hook, form]);
    const pending = create.isPending;
    const toDto = (v: OutboundValues) => ({ name: v.name, url: v.url, description: v.description || undefined, subscribed_events: v.events.split(/[\s,]+/).filter(Boolean) });
    // Editing autosaves valid changes (<SaveStatus /> + "Done"); creating keeps an explicit button (the secret is shown once).
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (hook as OutboundWebhook).id, ...toDto(v) }), { enabled: !!hook });
    const close = () => { if (hook) autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit((v) => {
        if (hook) return close();
        create.mutate(toDto(v), { onSuccess: (h) => { onOpenChange(false); if (h.secret) onSecret({ title: `Signing secret for ${h.name}`, secret: h.secret }); } });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !pending && close())}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{hook ? "Edit endpoint" : "New outbound endpoint"}</DialogTitle>
                            <DialogDescription>Each delivery is a JSON POST signed with the endpoint secret, retried with backoff on failure.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Data warehouse" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="url" render={({ field }) => (<FormItem><FormLabel>URL</FormLabel><FormControl><Input className="font-mono text-xs" {...field} /></FormControl><FormDescription>HTTPS required in production; private network addresses are refused.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="events" render={({ field }) => (<FormItem><FormLabel>Events</FormLabel><FormControl><Textarea rows={2} className="font-mono text-xs" placeholder="crm.deal.won, tasks.*" {...field} /></FormControl><FormDescription>Comma separated. Use <code>module.*</code> for a whole module or <code>*</code> for everything.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter className="sm:items-center">
                            {hook ? (
                                <>
                                    <SaveStatus state={autosave} className="mr-auto" />
                                    <Button type="button" variant="outline" onClick={close}>Done</Button>
                                </>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>Create endpoint</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function InboundTab({ onSecret }: { onSecret: SecretSetter }) {
    const hooks = useInboundWebhooks();
    const action = useInboundAction();
    const canManage = usePermissions().can("automation.webhooks.manage");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<InboundWebhook | null>(null);
    const [revoking, setRevoking] = useState<InboundWebhook | null>(null);
    const base = environments.API_URL.replace(/\/$/, "");
    const onCreated = (h: InboundWebhook) => {
        if (h.secret) onSecret({ title: `Secret for ${h.name}`, secret: h.secret, extra: `POST ${base}${h.url_path} — sign the raw body with HMAC-SHA256 in the ${h.signature_header ?? "x-signature"} header (or send the token for bearer auth).` });
    };

    if (hooks.isPending) return <ListSkeleton />;
    if (hooks.error) return <ErrorState error={hooks.error} onRetry={() => hooks.refetch()} />;

    return (
        <>
            {canManage && <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New inbound endpoint</Button></div>}
            {!hooks.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState icon={Webhook} title="No inbound endpoints" description="Give an external system (forms, Zapier, a CI pipeline) a signed URL that starts a workflow." /></div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {hooks.data.map((h) => (
                        <div key={h.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-medium text-foreground">{h.name}</div>
                                    <div className="truncate font-mono text-xs text-muted-foreground">{h.event_key}</div>
                                </div>
                                <StatusBadge status={h.status} />
                            </div>
                            <code className="block break-all rounded-md bg-secondary p-2 font-mono text-xs text-foreground">POST {base}{h.url_path}</code>
                            <KeyValueList
                                items={[
                                    { label: "Auth", value: getDropdownOptionLabel(InboundAuthSchemeOptions, h.auth_scheme) },
                                    { label: "Workflow", value: h.rule ? <Link className="text-foreground hover:underline" to={`/automation/workflows/${h.rule.id}`}>{h.rule.name}</Link> : "Any workflow on this trigger" },
                                    ...(h.allowed_ip_ranges.length ? [{ label: "Allowed IPs", value: h.allowed_ip_ranges.join(", ") }] : []),
                                    { label: "Received", value: `${h.received_count}${h.last_received_at ? ` · ${formatRelative(h.last_received_at)}` : ""}` },
                                    { label: "Rejected", value: h.rejected_count ? <span className="text-danger">{h.rejected_count} · {h.last_rejection_reason}</span> : "0" },
                                ]}
                            />
                            {canManage && h.status !== "REVOKED" && (
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setEditing(h); setOpen(true); }}><Pencil /> Edit</Button>
                                    <Button size="sm" variant="outline" onClick={() => action.mutate({ id: h.id, action: "rotate-secret" }, { onSuccess: (r) => r.secret && onSecret({ title: `New secret for ${h.name}`, secret: r.secret, extra: "The old secret stops working now." }) })}><KeyRound /> Rotate secret</Button>
                                    <Button size="sm" variant="outline" className="text-danger" onClick={() => setRevoking(h)}>Revoke</Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <InboundWebhookDialog open={open} onOpenChange={setOpen} hook={editing} onCreated={onCreated} />
            <ConfirmationDialog
                isOpen={!!revoking}
                onClose={() => setRevoking(null)}
                title={`Revoke ${revoking?.name}?`}
                description="The URL stops accepting requests permanently."
                confirmText="Revoke"
                variant="destructive"
                onConfirm={() => {
                    if (revoking) action.mutate({ id: revoking.id, action: "revoke" }); // optimistic: the card shows "Revoked" at once
                    setRevoking(null);
                }}
            />
        </>
    );
}

function DeliveriesTab() {
    const { params, setPage, filters, setFilter } = useListParams();
    const listParams = { ...params };
    delete listParams.tab;
    delete listParams.delivery;
    const deliveries = useDeliveries(listParams);
    const [openId, setOpenId] = useState<string | null>(null);

    const columns: DataTableColumn<WebhookDelivery>[] = [
        { key: "event", header: "Event", cell: (d) => <div className="min-w-0"><div className="truncate font-mono text-xs text-foreground">{d.event_key}</div><div className="truncate text-xs text-muted-foreground">{d.webhook.name}</div></div> },
        { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
        { key: "code", header: "Response", cell: (d) => (d.response_status_code ? <Badge variant={d.response_status_code < 300 ? "success" : "danger"}>{d.response_status_code}</Badge> : <span className="text-xs text-muted-foreground">{d.error_message ? "error" : "—"}</span>), hideBelow: "sm" },
        { key: "attempt", header: "Attempts", cell: (d) => `${d.attempt}/${d.max_attempts}`, hideBelow: "md" },
        { key: "duration", header: "Time", cell: (d) => formatDuration(d.duration_ms), hideBelow: "lg" },
        { key: "when", header: "When", cell: (d) => formatRelative(d.created_at), hideBelow: "md" },
    ];

    return (
        <>
            <TableToolbar>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{DeliveryStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={deliveries.data?.data}
                rowKey={(d) => d.id}
                loading={deliveries.isFetching}
                error={deliveries.error}
                onRetry={() => deliveries.refetch()}
                pagination={deliveries.data?.pagination}
                onPageChange={setPage}
                onRowClick={(d) => setOpenId(d.id)}
                empty={{ icon: Send, title: "No deliveries", description: "Deliveries appear when subscribed events happen or a workflow calls a webhook." }}
            />
            <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-xl"><DeliveryDetail id={openId} /></SheetContent>
            </Sheet>
        </>
    );
}

function DeliveryDetail({ id }: { id: string | null }) {
    const d = useDelivery(id);
    const retry = useRetryDelivery();
    if (d.isPending) return <><SheetHeader><SheetTitle>Delivery</SheetTitle></SheetHeader><ListSkeleton /></>;
    if (d.error) return <><SheetHeader><SheetTitle>Delivery</SheetTitle></SheetHeader><ErrorState error={d.error} /></>;
    const x = d.data;
    return (
        <div className="space-y-5">
            <SheetHeader>
                <SheetTitle className="font-mono text-sm">{x.event_key}</SheetTitle>
                <SheetDescription className="break-all">{x.webhook.name} · {x.webhook.url}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={x.status} />
                {x.response_status_code && <Badge variant="outline">HTTP {x.response_status_code}</Badge>}
                <Can permission="automation.webhooks.manage">
                    {x.status !== "SUCCEEDED" && (
                        <Button size="sm" variant="outline" loading={retry.isPending} onClick={() => retry.mutate(x.id)}>
                            <RotateCcw /> Retry now
                        </Button>
                    )}
                </Can>
            </div>
            <KeyValueList items={[
                { label: "Attempts", value: `${x.attempt} of ${x.max_attempts}` },
                { label: "Next retry", value: x.next_retry_at ? formatDateTime(x.next_retry_at) : null },
                { label: "Delivered", value: x.delivered_at ? formatDateTime(x.delivered_at) : null },
                { label: "Error", value: x.error_message },
            ]} />
            <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Payload</h3><JsonBlock value={x.payload} /></div>
            {x.request_headers && <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Request headers</h3><JsonBlock value={x.request_headers} maxHeight="max-h-40" /></div>}
            {x.response_body && <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Response body</h3><pre className="max-h-60 overflow-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs">{x.response_body}</pre></div>}
        </div>
    );
}
