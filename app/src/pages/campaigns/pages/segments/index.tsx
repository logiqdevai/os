import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Filter, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { formatNumber, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useDeleteSegment, useSegmentAction, useSegments } from "@/features/communications/hooks/use-communications";
import type { Segment } from "@/features/communications/interfaces/communications.interfaces";
import { SegmentEntityTypeFormOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CampaignPaths } from "../../campaign-paths";

/**
 * /campaigns/segments
 * @perm VIEW communications.segments.read · create · archive · delete
 * @api GET /communications/segments · POST /:id/refresh · POST /:id/archive · DELETE /:id
 */
export default function SegmentsPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch } = useListParams();
    const segments = useSegments(params);
    const { can } = usePermissions();
    const action = useSegmentAction();
    const del = useDeleteSegment();
    const [archiving, setArchiving] = useState<Segment | null>(null);
    const [deleting, setDeleting] = useState<Segment | null>(null);

    const columns: DataTableColumn<Segment>[] = [
        {
            key: "name",
            header: "Segment",
            cell: (s) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{s.name}</div>
                    {s.description && <div className="truncate text-xs text-muted-foreground">{s.description}</div>}
                </div>
            ),
        },
        { key: "type", header: "Who", cell: (s) => <Badge>{getDropdownOptionLabel(SegmentEntityTypeFormOptions, s.entity_type)}</Badge>, hideBelow: "sm" },
        { key: "channel", header: "Channel", cell: (s) => <span className="text-muted-foreground">{s.channel ? getDropdownOptionLabel(CommChannelFormOptions, s.channel) : "Any"}</span>, hideBelow: "md" },
        { key: "count", header: "People", cell: (s) => <span className="tabular">{s.last_count === null ? "—" : formatNumber(s.last_count)}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "evaluated", header: "Counted", cell: (s) => <span className="text-muted-foreground">{formatRelative(s.last_evaluated_at)}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (s) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => action.mutate({ id: s.id, action: "refresh" })}>
                            <RefreshCw /> Recount
                        </DropdownMenuItem>
                        {can("communications.segments.archive") && <DropdownMenuItem onSelect={() => setArchiving(s)}><Archive /> Archive</DropdownMenuItem>}
                        {can("communications.segments.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(s)}><Trash2 /> Delete</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Segments"
                description="Saved filters over your CRM contacts. Evaluated again every time a campaign sends."
                actions={<Can permission="communications.segments.create"><Button onClick={() => navigate(CampaignPaths.segment_new)}><Plus /> New segment</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search segments…" />
            <DataTable
                columns={columns}
                data={segments.data?.data}
                rowKey={(s) => s.id}
                loading={segments.isFetching}
                error={segments.error}
                onRetry={() => segments.refetch()}
                pagination={segments.data?.pagination}
                onPageChange={setPage}
                rowHref={(s) => CampaignPaths.segment(s.id)}
                empty={{
                    icon: Filter,
                    title: search ? "No segments match your search" : "No segments yet",
                    description: "Example: customers in Greece who opted in to email and were active in the last 90 days.",
                    action: can("communications.segments.create") && !search ? <Button size="sm" onClick={() => navigate(CampaignPaths.segment_new)}><Plus /> New segment</Button> : undefined,
                }}
            />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Archived segments can't be picked for new campaigns."
                confirmText="Archive"
                onConfirm={() => { if (!archiving) return; action.mutate({ id: archiving.id, action: "archive" }); setArchiving(null); }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="Campaigns that used it keep their recipients. This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (!deleting) return; del.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}
