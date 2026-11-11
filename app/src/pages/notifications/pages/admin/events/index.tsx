import { useState } from "react";
import { Lock, Plus, Zap } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { EventScopeFilterOptions, ModuleFilterOptions, ModuleLabelOptions, NotificationCategoryFormOptions, NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useAdminEventTypes } from "@/features/notifications/hooks/use-notification-admin";
import type { EventTypeRow } from "@/features/notifications/interfaces/notification-admin.interfaces";
import { ChannelBadges, ScopeBadge } from "../components/admin-ui";
import { EventTypeFormDialog } from "../components/event-type-form-dialog";

/**
 * /notifications/admin/events — event catalog (14 §4, §14; mockup "Event catalog").
 * @perm VIEW any of notifications.defaults.manage / event_types.manage / templates.manage / delivery_rules.manage · register: notifications.event_types.manage
 * @api GET /notification-event-types?module&category&scope&search · POST /notification-event-types
 * @states loading · empty · error / no-access · platform rows locked
 */
export default function EventCatalogPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const list = useAdminEventTypes(params);
    const canRegister = usePermission("notifications.event_types.manage");
    const [creating, setCreating] = useState(false);

    const columns: DataTableColumn<EventTypeRow>[] = [
        {
            key: "key",
            header: "Event",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                        {t.name}
                        {(t.mandatory_by_default || t.org_mandatory) && <Lock className="size-3 text-muted-foreground" aria-label="Mandatory" />}
                    </div>
                    <code className="block truncate text-xs text-muted-foreground">{t.key}</code>
                </div>
            ),
        },
        { key: "module", header: "Module", cell: (t) => getDropdownOptionLabel(ModuleLabelOptions, t.module), hideBelow: "md" },
        { key: "category", header: "Category", cell: (t) => <Badge>{getDropdownOptionLabel(NotificationCategoryFormOptions, t.category)}</Badge>, hideBelow: "lg" },
        { key: "priority", header: "Priority", cell: (t) => getDropdownOptionLabel(NotificationPriorityFormOptions, t.priority), hideBelow: "xl" },
        { key: "channels", header: "Default channels", cell: (t) => <ChannelBadges channels={t.default_channels} />, hideBelow: "sm" },
        { key: "scope", header: "Scope", cell: (t) => <ScopeBadge scope={t.scope} />, hideBelow: "md" },
        {
            key: "state",
            header: "State",
            cell: (t) => (t.deprecated_at ? <Badge variant="neutral">Deprecated</Badge> : t.is_active ? (t.org_enabled === false ? <Badge variant="warning">Off for org</Badge> : <Badge variant="success">Active</Badge>) : <Badge variant="neutral">Inactive</Badge>),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Event catalog"
                description="Every event a module can emit. Adapt platform events with organization defaults and templates."
                actions={<Can permission="notifications.event_types.manage"><Button onClick={() => setCreating(true)}><Plus /> Register event</Button></Can>}
            />
            {list.data && (
                <StatGrid className="mb-4 lg:grid-cols-3">
                    <StatCard label="Event types" value={list.data.stats.total} />
                    <StatCard label="Mandatory by default" value={list.data.stats.mandatory} hint="Cannot be muted" />
                    <StatCard label="Customer visible" value={list.data.stats.customer_visible} hint="Can reach the portal" className="col-span-2 lg:col-span-1" />
                </StatGrid>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search key or name…">
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>{ModuleFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.scope ?? "all"} onValueChange={(v) => setFilter("scope", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by scope"><SelectValue /></SelectTrigger>
                    <SelectContent>{EventScopeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(t) => t.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => `/notifications/admin/events/${t.id}`}
                empty={{
                    icon: Zap,
                    title: search ? "No event types match" : "No event types yet",
                    description: "Event types register themselves the first time a module emits them.",
                    action: canRegister && !search ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> Register event</Button> : undefined,
                }}
            />
            <EventTypeFormDialog open={creating} onOpenChange={setCreating} />
        </Page>
    );
}
