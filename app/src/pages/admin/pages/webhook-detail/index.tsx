import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { KeyRound, Pause, Pencil, Play, RotateCcw, Send, Trash2 } from "lucide-react";
import { KeyValueList, Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState, ListSkeleton, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative } from "@/lib/format";
import { DeliveryStatusFilterOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useDeleteOutboundWebhook, useDeliveries, useDelivery, useOutboundAction, useOutboundWebhook, useRetryDelivery } from "@/features/automation/hooks/use-automation";
import type { WebhookDelivery } from "@/features/automation/interfaces/automation.interfaces";
import { JsonBlock, StatusBadge, formatDuration } from "../../../automation/components/automation-ui";
import { WebhookFormDialog } from "../webhooks/components/webhook-form-dialog";
import { WebhookSecretDialog, type WebhookSecret } from "../webhooks/components/webhook-secret-dialog";

type Confirm = "delete" | "rotate" | null;

/**
 * Webhook detail — /admin/webhooks/:id?tab=overview|deliveries (mockup 01-admin `webhook`)
 * @perm VIEW automation.webhooks.read · edit/test/enable/rotate/retry/delete automation.webhooks.manage
 * @api GET/PATCH/DELETE /automation/webhooks/outbound/:id · POST …/:id/test|pause|resume|rotate-secret ·
 *      GET /automation/webhooks/deliveries?webhook_id= · GET …/deliveries/:id · POST …/deliveries/:id/retry
 * @states loading · error / not found · no-access · disabled after failures · empty delivery log
 */
export default function WebhookDetailPage() {
    const { id } = useParams();
    const p = usePermissions();
    const navigate = useNavigate();
    const location = useLocation();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") === "deliveries" ? "deliveries" : "overview";
    const hook = useOutboundWebhook(p.can("automation.webhooks.read") ? id : undefined);
    const action = useOutboundAction();
    const remove = useDeleteOutboundWebhook();
    const [editOpen, setEditOpen] = useState(false);
    const [confirm, setConfirm] = useState<Confirm>(null);
    const [secret, setSecret] = useState<WebhookSecret | null>(() => (location.state as { secret?: WebhookSecret } | null)?.secret ?? null);

    // The one-time secret arrives in router state after "Create webhook": drop it from history right away.
    useEffect(() => {
        if ((location.state as { secret?: unknown } | null)?.secret) navigate(location.pathname + location.search, { replace: true, state: null });
    }, [location, navigate]);

    if (!p.can("automation.webhooks.read")) return <Page><NoAccessState /></Page>;
    if (hook.isPending) return <PageSkeleton />;
    if (hook.error) return <Page><PageHeader title="Webhook" back={{ to: "/admin/webhooks", label: "Webhooks" }} /><ErrorState error={hook.error} onRetry={() => hook.refetch()} /></Page>;

    const h = hook.data;
    const canManage = p.can("automation.webhooks.manage");
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const run = (a: "pause" | "resume" | "test" | "rotate-secret") =>
        action.mutate({ id: h.id, action: a }, {
            onSuccess: (res) => {
                if (a === "rotate-secret" && res.secret) { setSecret({ title: `New signing secret for ${h.name}`, secret: res.secret, note: "The previous secret keeps working for 24 hours." }); setConfirm(null); }
                else if (a === "test") toast({ title: res.status === "SUCCEEDED" ? `Test delivered (HTTP ${res.response_status_code})` : "Test delivery failed", description: res.error_message ?? undefined, variant: res.status === "SUCCEEDED" ? "default" : "destructive" });
                else toast({ title: a === "pause" ? "Webhook disabled" : "Webhook enabled" });
            },
            onError: (e) => { fail("Could not update the webhook")(e); setConfirm(null); },
        });

    const stats = h.stats_7d ?? {};
    const total = Object.values(stats).reduce((a, b) => a + (b ?? 0), 0);
    const ok = stats.SUCCEEDED ?? 0;
    const failed = (stats.FAILED ?? 0) + (stats.DEAD_LETTERED ?? 0);

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/webhooks", label: "Webhooks" }}
                title={h.name}
                meta={<StatusBadge status={h.status} />}
                description={<span className="break-all font-mono text-xs">{h.url}</span>}
                actions={canManage && (
                    <>
                        <Button variant="outline" loading={action.isPending && action.variables?.action === "test"} onClick={() => run("test")}><Send /> Send test</Button>
                        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
                        {h.status === "ACTIVE"
                            ? <Button variant="outline" onClick={() => run("pause")}><Pause /> Disable</Button>
                            : <Button variant="outline" onClick={() => run("resume")}><Play /> Enable</Button>}
                    </>
                )}
            />
            {h.status === "DISABLED" && (
                <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                    Disabled automatically after {h.consecutive_failures} failures in a row{h.disabled_reason ? `: ${h.disabled_reason}` : ""}. Fix the endpoint, then enable it again.
                </div>
            )}
            <Tabs value={tab} onValueChange={(v) => setSp(() => (v === "overview" ? new URLSearchParams() : new URLSearchParams({ tab: v })), { replace: true })}>
                <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard label="Deliveries (7 days)" value={total} />
                        <StatCard label="Success rate" value={total ? `${Math.round((ok / total) * 100)}%` : "—"} />
                        <StatCard label="Failed (7 days)" value={failed} />
                        <StatCard label="Failures in a row" value={h.consecutive_failures} />
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Section title="Settings" className="lg:col-span-2">
                            <div className="rounded-lg border border-border bg-card p-4">
                                <KeyValueList items={[
                                    { label: "Events", value: <div className="flex flex-wrap gap-1">{h.subscribed_events.map((e) => <Badge key={e} variant="neutral" className="font-mono">{e}</Badge>)}</div> },
                                    { label: "Description", value: h.description },
                                    { label: "Attempts", value: `${h.max_attempts}, backoff from ${h.retry_backoff_seconds}s` },
                                    { label: "Timeout", value: `${h.timeout_seconds}s` },
                                    { label: "Auto-disable after", value: h.disable_after_failures ? `${h.disable_after_failures} failures in a row` : "Never" },
                                    { label: "Created", value: formatDateTime(h.created_at) },
                                ]} />
                            </div>
                        </Section>
                        <Section title="Signing">
                            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                                <KeyValueList columns={1} items={[
                                    { label: "Algorithm", value: "HMAC-SHA256 (X-Logiqdev-Signature)" },
                                    { label: "Secret", value: <code className="font-mono text-xs">{h.secret_hint}</code> },
                                    { label: "Last success", value: h.last_success_at ? formatRelative(h.last_success_at) : "Never" },
                                    { label: "Last failure", value: h.last_failure_at ? formatRelative(h.last_failure_at) : "Never" },
                                ]} />
                                {canManage && (
                                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                                        <Button size="sm" variant="outline" onClick={() => setConfirm("rotate")}><KeyRound /> Rotate secret</Button>
                                        <Button size="sm" variant="outline" className="text-danger" onClick={() => setConfirm("delete")}><Trash2 /> Delete</Button>
                                    </div>
                                )}
                            </div>
                        </Section>
                    </div>
                </TabsContent>
                <TabsContent value="deliveries">
                    <DeliveriesLog webhookId={h.id} />
                </TabsContent>
            </Tabs>

            <WebhookFormDialog open={editOpen} onOpenChange={setEditOpen} hook={h} />
            <WebhookSecretDialog secret={secret} onClose={() => setSecret(null)} />
            <ConfirmationDialog
                isOpen={confirm === "rotate"}
                onClose={() => setConfirm(null)}
                title="Rotate the signing secret?"
                description="A new secret is shown once. The previous one keeps working for 24 hours so you can update the receiver."
                confirmText="Rotate"
                isLoading={action.isPending}
                onConfirm={() => run("rotate-secret")}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${h.name}?`}
                description="Deliveries stop immediately and the delivery log is removed. Workflows calling this webhook will fail."
                confirmText="Delete"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => remove.mutate(h.id, { onSuccess: () => { toast({ title: "Webhook deleted" }); navigate("/admin/webhooks", { replace: true }); }, onError: (e) => { fail("Could not delete")(e); setConfirm(null); } })}
            />
        </Page>
    );
}

/** Delivery log of one webhook: status filter, row → detail sheet with payload, response and retry. */
function DeliveriesLog({ webhookId }: { webhookId: string }) {
    const [sp, setSp] = useSearchParams();
    const status = sp.get("status") ?? "all";
    const [page, setPage] = useState(1);
    const deliveries = useDeliveries({ webhook_id: webhookId, page, limit: 25, ...(status !== "all" && { status }) });
    const [openId, setOpenId] = useState<string | null>(null);

    const columns: DataTableColumn<WebhookDelivery>[] = [
        { key: "event", header: "Event", cell: (d) => <span className="truncate font-mono text-xs text-foreground">{d.event_key}</span> },
        { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
        { key: "code", header: "Response", hideBelow: "sm", cell: (d) => (d.response_status_code ? <Badge variant={d.response_status_code < 300 ? "success" : "danger"}>{d.response_status_code}</Badge> : <span className="text-xs text-muted-foreground">{d.error_message ? "error" : "—"}</span>) },
        { key: "attempt", header: "Attempts", hideBelow: "md", cell: (d) => `${d.attempt}/${d.max_attempts}` },
        { key: "duration", header: "Time", hideBelow: "lg", cell: (d) => formatDuration(d.duration_ms) },
        { key: "when", header: "When", hideBelow: "md", cell: (d) => formatRelative(d.created_at) },
    ];

    return (
        <>
            <TableToolbar>
                <Select value={status} onValueChange={(v) => { setPage(1); setSp((prev) => { const next = new URLSearchParams(prev); if (v === "all") next.delete("status"); else next.set("status", v); return next; }, { replace: true }); }}>
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
                empty={{ icon: Send, title: "No deliveries yet", description: "Deliveries appear when a subscribed event happens. Use “Send test” to try the endpoint." }}
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
                <SheetDescription>{formatDateTime(x.created_at)} · key <span className="font-mono">{x.id.slice(0, 8)}</span></SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={x.status} />
                {x.response_status_code && <Badge variant="outline">HTTP {x.response_status_code}</Badge>}
                <Can permission="automation.webhooks.manage">
                    {x.status !== "SUCCEEDED" && (
                        <Button size="sm" variant="outline" loading={retry.isPending} onClick={() => retry.mutate(x.id, { onSuccess: (r) => toast({ title: r.status === "SUCCEEDED" ? "Delivered" : "Retry failed", variant: r.status === "SUCCEEDED" ? "default" : "destructive" }), onError: (e) => toast({ variant: "destructive", title: "Could not retry", description: getApiErrorMessage(e) }) })}>
                            <RotateCcw /> Retry now
                        </Button>
                    )}
                </Can>
            </div>
            <KeyValueList items={[
                { label: "Attempts", value: `${x.attempt} of ${x.max_attempts}` },
                { label: "Duration", value: formatDuration(x.duration_ms) },
                { label: "Next retry", value: x.next_retry_at ? formatDateTime(x.next_retry_at) : null },
                { label: "Delivered", value: x.delivered_at ? formatDateTime(x.delivered_at) : null },
                { label: "Error", value: x.error_message },
            ]} />
            <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Payload</h3><JsonBlock value={x.payload} /></div>
            {x.request_headers && <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Request headers</h3><JsonBlock value={x.request_headers} maxHeight="max-h-40" /></div>}
            {x.response_body && <div className="space-y-2"><h3 className="text-[13px] font-medium text-foreground">Response body</h3><pre className="max-h-60 overflow-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs text-foreground">{x.response_body}</pre></div>}
        </div>
    );
}
