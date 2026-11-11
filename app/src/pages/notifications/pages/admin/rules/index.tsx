import { useState } from "react";
import { Filter, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CoalesceKeyFormOptions, ModuleLabelOptions, NotificationChannelOptions, RuleKindFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useDeleteRule, useDeliveryRules, useUpdateRule } from "@/features/notifications/hooks/use-notification-admin";
import type { DeliveryRule, RuleKind } from "@/features/notifications/interfaces/notification-admin.interfaces";
import type { BadgeVariant } from "@/components/ui/badge";
import { RuleFormDialog } from "../components/rule-form-dialog";

const KIND_VARIANT: Record<RuleKind, BadgeVariant> = { DEDUPLICATE: "info", COALESCE: "violet", THROTTLE: "warning", SUPPRESS: "danger" };
const minutes = (s: number | null) => (!s ? "—" : s >= 3600 && s % 3600 === 0 ? `${s / 3600} h` : `${Math.round(s / 60)} min`);

/**
 * /notifications/admin/rules — deduplicate / coalesce / throttle / suppress before delivery (14 §9, §16).
 * @perm notifications.delivery_rules.manage · @api GET/POST/PATCH/DELETE /notification-delivery-rules
 * @states loading · empty ("only the built-in idempotency applies") · error / no-access
 */
export default function DeliveryRulesPage() {
    const q = useDeliveryRules();
    const update = useUpdateRule();
    const remove = useDeleteRule();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<DeliveryRule | null>(null);
    const [deleting, setDeleting] = useState<DeliveryRule | null>(null);
    const openForm = (r: DeliveryRule | null) => { setEditing(r); setFormOpen(true); };

    const columns: DataTableColumn<DeliveryRule>[] = [
        { key: "order", header: "#", cell: (r) => <span className="tabular text-muted-foreground">{r.priority}</span>, className: "w-10", hideBelow: "sm" },
        { key: "name", header: "Rule", cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
        { key: "kind", header: "Kind", cell: (r) => <Badge variant={KIND_VARIANT[r.kind]}>{getDropdownOptionLabel(RuleKindFormOptions, r.kind)}</Badge> },
        { key: "applies", header: "Applies to", cell: (r) => (r.event_type ? <code className="text-xs">{r.event_type.key}</code> : r.module ? getDropdownOptionLabel(ModuleLabelOptions, r.module) : "Every event"), hideBelow: "md" },
        { key: "channel", header: "Channel", cell: (r) => (r.channel ? getDropdownOptionLabel(NotificationChannelOptions, r.channel) : "All"), hideBelow: "lg" },
        {
            key: "limit",
            header: "Window / limit",
            cell: (r) => [minutes(r.window_seconds), r.max_per_window ? `max ${r.max_per_window}` : null, r.coalesce_key ? getDropdownOptionLabel(CoalesceKeyFormOptions, r.coalesce_key) : null].filter(Boolean).join(" · "),
            hideBelow: "lg",
        },
        {
            key: "active",
            header: "Active",
            cell: (r) => <Switch checked={r.is_active} onCheckedChange={(on) => update.mutate({ id: r.id, is_active: on })} onClick={(e) => e.stopPropagation()} aria-label={`Active: ${r.name}`} />,
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (r) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openForm(r)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Delivery rules" description="Deduplicate, coalesce, throttle or suppress notifications before they are delivered." actions={<Button onClick={() => openForm(null)}><Plus /> New rule</Button>} />
            <DataTable
                columns={columns}
                data={q.data}
                rowKey={(r) => r.id}
                loading={q.isFetching && !q.data}
                error={q.error}
                onRetry={() => q.refetch()}
                onRowClick={(r) => openForm(r)}
                empty={{ icon: Filter, title: "No delivery rules", description: "Only the built-in protection applies: the same event never reaches a person twice.", action: <Button size="sm" onClick={() => openForm(null)}><Plus /> New rule</Button> }}
            />
            <RuleFormDialog open={formOpen} onOpenChange={setFormOpen} rule={editing} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete “${deleting?.name}”?`}
                description="Notifications are no longer filtered by this rule."
                confirmText="Delete"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
            />
        </Page>
    );
}
