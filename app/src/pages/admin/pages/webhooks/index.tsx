import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Pause, Play, Plus, Send, Trash2, Webhook } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NoAccessState } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { OutboundWebhookStatusOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useDeleteOutboundWebhook, useOutboundAction, useOutboundWebhooks } from "@/features/automation/hooks/use-automation";
import type { OutboundWebhook } from "@/features/automation/interfaces/automation.interfaces";
import { StatusBadge } from "../../../automation/components/automation-ui";
import { WebhookFormDialog } from "./components/webhook-form-dialog";
import type { WebhookSecret } from "./components/webhook-secret-dialog";

const STATUS_FILTER = [{ id: "all", label: "All statuses" }, ...OutboundWebhookStatusOptions];

/**
 * Webhooks — /admin/webhooks (mockup 01-admin `webhooks`). Signed outbound HTTP calls for platform events.
 * OutboundWebhook + WebhookDelivery are owned by 20 Automation and administered here with the same API.
 * @perm VIEW automation.webhooks.read · create/edit/test/pause/delete automation.webhooks.manage
 * @api GET/POST /automation/webhooks/outbound · POST …/:id/test|pause|resume · DELETE …/:id
 * @mcp automation_webhooks_list|get|create|update|set_enabled|test|rotate_secret|delete
 * @audit automation.webhook.created|updated|paused|resumed|secret_rotated|test_sent|deleted
 */
export default function WebhooksAdminPage() {
    const p = usePermissions();
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const hooks = useOutboundWebhooks(params, p.can("automation.webhooks.read"));
    const action = useOutboundAction();
    const remove = useDeleteOutboundWebhook();
    const canManage = p.can("automation.webhooks.manage");
    const [formOpen, setFormOpen] = useState(false);
    const [deleting, setDeleting] = useState<OutboundWebhook | null>(null);

    if (!p.can("automation.webhooks.read")) return <Page><NoAccessState /></Page>;

    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const run = (h: OutboundWebhook, a: "pause" | "resume" | "test") =>
        action.mutate({ id: h.id, action: a }, {
            onSuccess: (res) => {
                if (a === "test") toast({ title: res.status === "SUCCEEDED" ? `Test delivered (HTTP ${res.response_status_code})` : "Test delivery failed", description: res.error_message ?? undefined, variant: res.status === "SUCCEEDED" ? "default" : "destructive" });
                else toast({ title: a === "pause" ? "Webhook paused" : "Webhook enabled" });
            },
            onError: fail("Could not update the webhook"),
        });

    const columns: DataTableColumn<OutboundWebhook>[] = [
        {
            key: "name",
            header: "Webhook",
            cell: (h) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{h.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{h.url}</div>
                </div>
            ),
        },
        {
            key: "events",
            header: "Events",
            hideBelow: "lg",
            cell: (h) => <span className="line-clamp-1 font-mono text-xs" title={h.subscribed_events.join(", ")}>{h.subscribed_events.slice(0, 2).join(", ")}{h.subscribed_events.length > 2 ? ` +${h.subscribed_events.length - 2}` : ""}</span>,
        },
        { key: "status", header: "Status", cell: (h) => <StatusBadge status={h.status} /> },
        { key: "failures", header: "Failures in a row", hideBelow: "md", className: "text-right", cell: (h) => <span className={h.consecutive_failures ? "text-danger" : "text-muted-foreground"}>{h.consecutive_failures}</span> },
        { key: "last", header: "Last delivery", hideBelow: "sm", cell: (h) => formatRelative(h.last_delivery_at) },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (h) =>
                canManage && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${h.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => run(h, "test")}><Send /> Send test event</DropdownMenuItem>
                                {h.status === "ACTIVE" ? <DropdownMenuItem onSelect={() => run(h, "pause")}><Pause /> Disable</DropdownMenuItem> : <DropdownMenuItem onSelect={() => run(h, "resume")}><Play /> Enable</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(h)}><Trash2 /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Webhooks"
                description="Signed outbound HTTP calls for platform events, retried with backoff and logged. Shared with Automation."
                actions={canManage && <Button onClick={() => setFormOpen(true)}><Plus /> Create webhook</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or URL…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_FILTER.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            {hooks.data?.data.some((h) => h.status === "DISABLED") && (
                <div className="mb-3 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                    A webhook was disabled automatically after repeated failures. Fix the receiving endpoint, then enable it again.
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
                rowHref={(h) => `/admin/webhooks/${h.id}`}
                empty={{
                    icon: Webhook,
                    title: search || filters.status ? "No webhooks match" : "No webhooks yet",
                    description: "Send events such as crm.deal.won or tasks.* to another system as signed JSON.",
                    action: canManage ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> Create webhook</Button> : undefined,
                }}
            />
            <WebhookFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                hook={null}
                // The detail page shows the one-time secret from router state (never stored, never in the URL).
                onCreated={(h) => navigate(`/admin/webhooks/${h.id}`, { state: h.secret ? { secret: { title: `Signing secret for ${h.name}`, secret: h.secret } satisfies WebhookSecret } : undefined })}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="Deliveries stop immediately and the delivery log is removed. Workflows calling this webhook will fail."
                confirmText="Delete"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast({ title: "Webhook deleted" }); setDeleting(null); }, onError: fail("Could not delete") })}
            />
        </Page>
    );
}
