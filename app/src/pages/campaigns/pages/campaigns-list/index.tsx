import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Copy, Layers, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber, personName } from "@/lib/format";
import { useCampaignAction, useCampaigns, useDeleteCampaign } from "@/features/communications/hooks/use-communications";
import type { Campaign } from "@/features/communications/interfaces/communications.interfaces";
import { CampaignStatusFilterOptions } from "@/config/constants/dropdowns/communications/campaign-status-filter.options";
import { CommChannelFilterOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CampaignStatusBadge, ChannelBadge, pct } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

const EDITABLE = ["DRAFT", "PENDING_APPROVAL", "APPROVED"];

/**
 * /campaigns — all campaigns.
 * @perm VIEW communications.campaigns.read · create · update · archive · delete
 * @api GET /communications/campaigns · POST /:id/duplicate · POST /:id/archive · DELETE /:id
 */
export default function CampaignsListPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const campaigns = useCampaigns(params);
    const { can } = usePermissions();
    const action = useCampaignAction();
    const del = useDeleteCampaign();
    const [archiving, setArchiving] = useState<Campaign | null>(null);
    const [deleting, setDeleting] = useState<Campaign | null>(null);

    const duplicate = (c: Campaign) =>
        action.mutate({ id: c.id, action: "duplicate" }, {
            onSuccess: (copy) => { toast({ title: "Campaign duplicated" }); navigate(CampaignPaths.edit(copy.id)); },
            onError: (e) => toast({ variant: "destructive", title: "Could not duplicate", description: getApiErrorMessage(e) }),
        });

    const columns: DataTableColumn<Campaign>[] = [
        {
            key: "name",
            header: "Campaign",
            cell: (c) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.subject ?? c.body_text?.slice(0, 80) ?? "No content yet"}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (c) => <CampaignStatusBadge status={c.status} /> },
        { key: "channel", header: "Channel", cell: (c) => <ChannelBadge channel={c.channel} />, hideBelow: "sm" },
        {
            key: "when",
            header: "Sent / scheduled",
            hideBelow: "md",
            cell: (c) => <span className="text-muted-foreground">{formatDateTime(c.completed_at ?? c.started_at ?? c.scheduled_at)}</span>,
        },
        { key: "sent", header: "Sent", cell: (c) => <span className="tabular">{formatNumber(c.sent_count)}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "md" },
        { key: "open", header: "Opens", cell: (c) => <span className="tabular">{c.sent_count ? pct((c.opened_count / (c.delivered_count || c.sent_count)) * 100) : "—"}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "lg" },
        { key: "owner", header: "Owner", cell: (c) => <span className="text-muted-foreground">{c.owner ? personName(c.owner.user) : "—"}</span>, hideBelow: "xl" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (c) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {can("communications.campaigns.update") && EDITABLE.includes(c.status) && (
                            <DropdownMenuItem onSelect={() => navigate(CampaignPaths.edit(c.id))}><Pencil /> Edit</DropdownMenuItem>
                        )}
                        {can("communications.campaigns.create") && <DropdownMenuItem onSelect={() => duplicate(c)}><Copy /> Duplicate</DropdownMenuItem>}
                        {can("communications.campaigns.archive") && !["SCHEDULED", "SENDING", "PAUSED"].includes(c.status) && (
                            <DropdownMenuItem onSelect={() => setArchiving(c)}><Archive /> Archive</DropdownMenuItem>
                        )}
                        {can("communications.campaigns.delete") && c.sent_count === 0 && !["SCHEDULED", "SENDING", "PAUSED"].includes(c.status) && (
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(c)}><Trash2 /> Delete</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Campaigns"
                description="Bulk email and SMS to lists and segments, with approval, scheduling and tracking."
                actions={
                    <Can permission="communications.campaigns.create">
                        <Button onClick={() => navigate(CampaignPaths.new)}><Plus /> New campaign</Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search campaigns…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{CampaignStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={campaigns.data?.data}
                rowKey={(c) => c.id}
                loading={campaigns.isFetching}
                error={campaigns.error}
                onRetry={() => campaigns.refetch()}
                pagination={campaigns.data?.pagination}
                onPageChange={setPage}
                rowHref={(c) => CampaignPaths.detail(c.id)}
                empty={{
                    icon: Layers,
                    title: search || filters.status || filters.channel ? "No campaigns match your filters" : "No campaigns yet",
                    description: "Create a campaign, pick a list or segment, write the message and send or schedule it.",
                    action: can("communications.campaigns.create") && !search ? <Button size="sm" onClick={() => navigate(CampaignPaths.new)}><Plus /> New campaign</Button> : undefined,
                }}
            />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Archived campaigns are hidden from the list. Their history and statistics are kept."
                confirmText="Archive"
                isLoading={action.isPending}
                onConfirm={() =>
                    archiving &&
                    action.mutate({ id: archiving.id, action: "archive" }, {
                        onSuccess: () => { toast({ title: "Campaign archived" }); setArchiving(null); },
                        onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }),
                    })
                }
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() =>
                    deleting &&
                    del.mutate(deleting.id, {
                        onSuccess: () => { toast({ title: "Campaign deleted" }); setDeleting(null); },
                        onError: (e) => toast({ variant: "destructive", title: "Could not delete", description: getApiErrorMessage(e) }),
                    })
                }
            />
        </Page>
    );
}
