import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { formatNumber, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useDeleteTemplate, useTemplateAction, useTemplates } from "@/features/communications/hooks/use-communications";
import type { Template } from "@/features/communications/interfaces/communications.interfaces";
import { CommTemplateCategoryFilterOptions, CommTemplateCategoryFormOptions, CommTemplateStatusFormOptions } from "@/config/constants/dropdowns/communications/comm-template-category-form.options";
import { CommChannelFilterOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { ChannelBadge } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

/**
 * /campaigns/templates
 * @perm VIEW communications.templates.read · create/duplicate · archive · delete
 * @api GET /communications/templates · POST /:id/duplicate · POST /:id/archive · DELETE /:id
 */
export default function TemplatesPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const templates = useTemplates(params);
    const { can } = usePermissions();
    const action = useTemplateAction();
    const del = useDeleteTemplate();
    const [deleting, setDeleting] = useState<Template | null>(null);
    const archived = filters.archived === "true";

    const run = (t: Template, a: "duplicate" | "archive" | "restore") =>
        action.mutate({ id: t.id, action: a }, { onSuccess: (res) => { if (a === "duplicate") navigate(CampaignPaths.template(res.id)); } });

    const columns: DataTableColumn<Template>[] = [
        {
            key: "name",
            header: "Template",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.current_version?.subject ?? t.description ?? "Not published yet"}</div>
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (t) => <ChannelBadge channel={t.channel} />, hideBelow: "sm" },
        { key: "category", header: "Category", cell: (t) => <span className="text-muted-foreground">{getDropdownOptionLabel(CommTemplateCategoryFormOptions, t.category)}</span>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (t) => <Badge variant={t.status === "ACTIVE" ? "success" : "neutral"}>{getDropdownOptionLabel(CommTemplateStatusFormOptions, t.status)}{t.current_version ? ` · v${t.current_version.version}` : ""}</Badge> },
        { key: "used", header: "Used", cell: (t) => <span className="tabular text-muted-foreground">{formatNumber(t.usage_count)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "md" },
        { key: "updated", header: "Updated", cell: (t) => <span className="text-muted-foreground">{formatRelative(t.updated_at)}</span>, hideBelow: "xl" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {can("communications.templates.create") && <DropdownMenuItem onSelect={() => run(t, "duplicate")}><Copy /> Duplicate</DropdownMenuItem>}
                        {can("communications.templates.archive") && (t.archived_at
                            ? <DropdownMenuItem onSelect={() => run(t, "restore")}><ArchiveRestore /> Restore</DropdownMenuItem>
                            : <DropdownMenuItem onSelect={() => run(t, "archive")}><Archive /> Archive</DropdownMenuItem>)}
                        {can("communications.templates.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(t)}><Trash2 /> Delete</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Templates"
                description="Reusable email and SMS content with {{variables}}. Campaigns and one-off messages use the published version."
                actions={<Can permission="communications.templates.create"><Button onClick={() => navigate(CampaignPaths.template_new)}><Plus /> New template</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search templates…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.category ?? "all"} onValueChange={(v) => setFilter("category", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommTemplateCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={archived ? "true" : "all"} onValueChange={(v) => setFilter("archived", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Archived"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Active</SelectItem>
                        <SelectItem value="true">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={templates.data?.data}
                rowKey={(t) => t.id}
                loading={templates.isFetching}
                error={templates.error}
                onRetry={() => templates.refetch()}
                pagination={templates.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => CampaignPaths.template(t.id)}
                empty={{
                    icon: FileText,
                    title: search || filters.channel || filters.category ? "No templates match your filters" : archived ? "No archived templates" : "No templates yet",
                    description: "Write a newsletter, a welcome email or an SMS reminder once and reuse it.",
                    action: can("communications.templates.create") && !search && !archived ? <Button size="sm" onClick={() => navigate(CampaignPaths.template_new)}><Plus /> New template</Button> : undefined,
                }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="All versions are deleted. Messages already sent keep their content."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (!deleting) return; del.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}
