import { useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, Lock, Pencil, Plus } from "lucide-react";
import { Page, PageHeader, Section, KeyValueList } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    DeliveryModeFormOptions, ModuleLabelOptions, NotificationCategoryFormOptions, NotificationChannelOptions, NotificationPriorityFormOptions, RuleKindFormOptions,
} from "@/config/constants/dropdowns/notifications/notification.options";
import { useAdminDefaults, useAdminEventType, useDeprecateEventType } from "@/features/notifications/hooks/use-notification-admin";
import type { EventTypeDetail, TemplateRow } from "@/features/notifications/interfaces/notification-admin.interfaces";
import { ChannelBadges, EventStatusBadge, ScopeBadge } from "../components/admin-ui";
import { EventTypeFormDialog } from "../components/event-type-form-dialog";
import { DefaultDialog } from "../components/default-dialog";
import { TemplateEditorDialog, type TemplateEditorTarget } from "../components/template-editor-dialog";

/**
 * /notifications/admin/events/:id — one event type: definition, organization default, templates, recent events, rules.
 * @perm view: any notifications admin key · edit definition notifications.event_types.manage (organization rows only)
 *       default notifications.defaults.manage · templates notifications.templates.manage
 * @api GET/PATCH /notification-event-types/:id · POST /:id/deprecate · PUT /notification-defaults · /notification-templates
 */
export default function EventTypeDetailPage() {
    const { id } = useParams();
    const q = useAdminEventType(id);
    const canDefaults = usePermission("notifications.defaults.manage");
    const canTemplates = usePermission("notifications.templates.manage");
    const defaults = useAdminDefaults(canDefaults);
    const deprecate = useDeprecateEventType();
    const [editing, setEditing] = useState(false);
    const [defaultOpen, setDefaultOpen] = useState(false);
    const [deprecating, setDeprecating] = useState(false);
    const [template, setTemplate] = useState<TemplateEditorTarget | null>(null);

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Event type" back={{ to: "/notifications/admin/events", label: "Event catalog" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const t: EventTypeDetail = q.data;
    const d = t.org_default;

    const templateColumns: DataTableColumn<TemplateRow>[] = [
        { key: "channel", header: "Channel", cell: (r) => getDropdownOptionLabel(NotificationChannelOptions, r.channel) },
        { key: "title", header: "Title", cell: (r) => <span className="truncate">{r.title}</span> },
        { key: "locale", header: "Language", cell: (r) => r.locale ?? "Any", hideBelow: "sm" },
        { key: "scope", header: "Scope", cell: (r) => <ScopeBadge scope={r.organization_id ? "organization" : "platform"} />, hideBelow: "md" },
        { key: "version", header: "Version", cell: (r) => `v${r.version}`, hideBelow: "md" },
    ];

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/notifications/admin/events", label: "Event catalog" }}
                title={t.name}
                documentTitle={t.name}
                meta={<>
                    <ScopeBadge scope={t.scope} />
                    {t.deprecated_at && <Badge variant="neutral">Deprecated</Badge>}
                    {(t.mandatory_by_default || d?.is_mandatory) && <Badge variant="danger"><Lock className="size-3" /> Mandatory</Badge>}
                </>}
                actions={t.editable && !t.deprecated_at && (
                    <Can permission="notifications.event_types.manage">
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
                        <Button variant="outline" size="sm" onClick={() => setDeprecating(true)}><Ban /> Deprecate</Button>
                    </Can>
                )}
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                    <Section title="Definition" description={t.scope === "platform" ? "Defined by the platform. Adapt it with the organization default and templates." : undefined}>
                        <div className="rounded-lg border border-border bg-card p-4">
                            <KeyValueList items={[
                                { label: "Key", value: <code className="text-xs">{t.key}</code> },
                                { label: "Module", value: getDropdownOptionLabel(ModuleLabelOptions, t.module) },
                                { label: "Category", value: getDropdownOptionLabel(NotificationCategoryFormOptions, t.category) },
                                { label: "Priority", value: getDropdownOptionLabel(NotificationPriorityFormOptions, t.priority) },
                                { label: "Default channels", value: <ChannelBadges channels={t.default_channels} /> },
                                { label: "Forced channels (mandatory)", value: <ChannelBadges channels={t.forced_channels} /> },
                                { label: "Digest", value: t.supports_digest ? "Can be batched" : "Always immediate" },
                                { label: "Customer visible", value: t.customer_visible ? "Yes" : "No" },
                            ]} />
                            {t.description && <p className="mt-3 text-[13px] text-body">{t.description}</p>}
                        </div>
                    </Section>
                    <Section
                        title="Templates"
                        actions={canTemplates && <Button size="sm" variant="outline" onClick={() => setTemplate({ mode: "create", event_type_id: t.id })}><Plus /> Add template</Button>}
                    >
                        <DataTable
                            columns={templateColumns}
                            data={t.templates}
                            rowKey={(r) => r.id}
                            onRowClick={canTemplates ? (r) => setTemplate(r.organization_id ? { mode: "edit", template: { ...r, scope: "organization", editable: true } } : { mode: "customize", template: { ...r, scope: "platform", editable: false, event_type: { id: t.id, key: t.key, name: t.name, module: t.module } } }) : undefined}
                            empty={{ title: "No templates", description: "The event's own title and text are used." }}
                        />
                    </Section>
                    <Section title="Recent events" description={`${t.stats.notifications_30d} notifications in the last 30 days.`}>
                        <DataTable
                            columns={[
                                { key: "when", header: "Received", cell: (e) => formatDateTime(e.received_at) },
                                { key: "record", header: "Record", cell: (e) => e.entity_label ?? e.entity_type ?? "—", hideBelow: "sm" },
                                { key: "status", header: "Status", cell: (e) => <EventStatusBadge status={e.status} /> },
                                { key: "count", header: "Notifications", cell: (e) => <span className="tabular">{e.notification_count}</span>, className: "text-right", headerClassName: "text-right" },
                            ]}
                            data={t.recent_events}
                            rowKey={(e) => e.id}
                            empty={{ title: "Not emitted yet" }}
                        />
                    </Section>
                </div>
                <aside className="space-y-4">
                    <Section title="Organization default" actions={canDefaults && <Button size="sm" variant="ghost" onClick={() => setDefaultOpen(true)}><Pencil /> Edit</Button>}>
                        <div className="rounded-lg border border-border bg-card p-4 text-[13px]">
                            {d ? (
                                <KeyValueList columns={1} items={[
                                    { label: "Notify members", value: d.enabled ? "Yes" : "No" },
                                    { label: "Channels", value: <ChannelBadges channels={d.channels} /> },
                                    { label: "Email", value: getDropdownOptionLabel(DeliveryModeFormOptions, d.delivery_mode) },
                                    { label: "Mandatory", value: d.is_mandatory ? "Yes" : "No" },
                                ]} />
                            ) : (
                                <p className="text-muted-foreground">No override: the module default or the platform default applies.</p>
                            )}
                        </div>
                    </Section>
                    <Section title="Delivery rules">
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card text-[13px]">
                            {t.rules.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2"><span className="truncate">{r.name}</span><Badge>{getDropdownOptionLabel(RuleKindFormOptions, r.kind)}</Badge></li>)}
                            {!t.rules.length && <li className="px-3 py-2 text-muted-foreground">No rules for this event.</li>}
                        </ul>
                    </Section>
                </aside>
            </div>
            <EventTypeFormDialog open={editing} onOpenChange={setEditing} eventType={t} />
            <DefaultDialog
                target={defaultOpen ? { event_type_id: t.id, label: t.name, platformChannels: t.default_channels } : null}
                existing={d}
                enabledChannels={defaults.data?.enabled_channels ?? ["IN_APP", "EMAIL"]}
                onClose={() => setDefaultOpen(false)}
            />
            <TemplateEditorDialog target={template} onClose={() => setTemplate(null)} />
            <ConfirmationDialog
                isOpen={deprecating}
                onClose={() => setDeprecating(false)}
                title="Deprecate this event type?"
                description="History is kept; it is no longer delivered and cannot be emitted again."
                confirmText="Deprecate"
                variant="destructive"
                isLoading={deprecate.isPending}
                onConfirm={() => deprecate.mutate(t.id, { onSuccess: () => setDeprecating(false) })}
            />
        </Page>
    );
}
