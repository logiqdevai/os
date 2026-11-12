import { useState } from "react";
import { FileText, MoreHorizontal, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { EventScopeFilterOptions, NotificationChannelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useAdminTemplates, useDeleteTemplate } from "@/features/notifications/hooks/use-notification-admin";
import type { TemplateRow } from "@/features/notifications/interfaces/notification-admin.interfaces";
import { ScopeBadge } from "../components/admin-ui";
import { TemplateEditorDialog, type TemplateEditorTarget } from "../components/template-editor-dialog";

const CHANNEL_FILTER = [{ id: "all", label: "All channels" }, ...NotificationChannelOptions.filter((o) => o.id === "IN_APP" || o.id === "EMAIL")];

/**
 * /notifications/admin/templates — wording per event, channel and language (14 §10).
 * @perm notifications.templates.manage · platform defaults are read-only ("Customize" creates an organization copy)
 * @api GET /notification-templates?event_type_id&channel&scope&search · POST/PATCH/DELETE /notification-templates
 */
export default function TemplatesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const list = useAdminTemplates(params);
    const remove = useDeleteTemplate();
    const [editor, setEditor] = useState<TemplateEditorTarget | null>(null);
    const [deleting, setDeleting] = useState<TemplateRow | null>(null);

    const columns: DataTableColumn<TemplateRow>[] = [
        {
            key: "event",
            header: "Event",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{t.title}</div>
                    <code className="block truncate text-xs text-muted-foreground">{t.event_type?.key}</code>
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (t) => <Badge variant={t.channel === "EMAIL" ? "info" : "neutral"}>{getDropdownOptionLabel(NotificationChannelOptions, t.channel)}</Badge>, hideBelow: "sm" },
        { key: "locale", header: "Language", cell: (t) => t.locale ?? <span className="text-muted-foreground">Any</span>, hideBelow: "md" },
        { key: "scope", header: "Scope", cell: (t) => <ScopeBadge scope={t.scope} />, hideBelow: "md" },
        { key: "version", header: "Version", cell: (t) => <span className="tabular">v{t.version}</span>, hideBelow: "lg" },
        { key: "active", header: "State", cell: (t) => (t.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Off</Badge>), hideBelow: "sm" },
        { key: "updated", header: "Updated", cell: (t) => formatDate(t.updated_at), hideBelow: "xl" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {t.editable ? (
                            <>
                                <DropdownMenuItem onSelect={() => setEditor({ mode: "edit", template: t })}><Pencil /> Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(t)}><Trash2 /> Delete</DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuItem onSelect={() => setEditor({ mode: "customize", template: t })}><Wand2 /> Customize</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Templates"
                description="The wording of notifications per channel and language. Without a template the event's own title and text are used."
                actions={<Button onClick={() => setEditor({ mode: "create" })}><Plus /> New template</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search title or event key…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNEL_FILTER.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.scope ?? "all"} onValueChange={(v) => setFilter("scope", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by scope"><SelectValue /></SelectTrigger>
                    <SelectContent>{EventScopeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "all" ? "All templates" : o.label}</SelectItem>)}</SelectContent>
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
                onRowClick={(t) => setEditor(t.editable ? { mode: "edit", template: t } : { mode: "customize", template: t })}
                empty={{
                    icon: FileText,
                    title: search ? "No templates match" : "No templates yet",
                    description: "Notifications use the event's own title and text until you add a template.",
                    action: !search ? <Button size="sm" onClick={() => setEditor({ mode: "create" })}><Plus /> New template</Button> : undefined,
                }}
            />
            <TemplateEditorDialog target={editor} onClose={() => setEditor(null)} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this template?"
                description="The platform default (or the event's own text) is used again."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}
