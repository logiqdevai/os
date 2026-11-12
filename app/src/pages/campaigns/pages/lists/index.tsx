import { useState } from "react";
import { Archive, List, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { formatNumber, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useDeleteList, useListAction, useLists } from "@/features/communications/hooks/use-communications";
import type { RecipientList } from "@/features/communications/interfaces/communications.interfaces";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { ListFormDialog } from "../../components/list-form-dialog";
import { CampaignPaths } from "../../campaign-paths";

/**
 * /campaigns/lists
 * @perm VIEW communications.recipient_lists.read · create · archive · delete
 * @api GET /communications/lists · POST /lists · POST /lists/:id/archive · DELETE /lists/:id
 */
export default function ListsPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const lists = useLists(params);
    const { can } = usePermissions();
    const action = useListAction();
    const del = useDeleteList();
    const [formOpen, setFormOpen] = useState(false);
    const [archiving, setArchiving] = useState<RecipientList | null>(null);
    const [deleting, setDeleting] = useState<RecipientList | null>(null);

    const columns: DataTableColumn<RecipientList>[] = [
        {
            key: "name",
            header: "List",
            cell: (l) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{l.name}</div>
                    {l.description && <div className="truncate text-xs text-muted-foreground">{l.description}</div>}
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (l) => <span className="text-muted-foreground">{l.channel ? getDropdownOptionLabel(CommChannelFormOptions, l.channel) : "Any"}</span>, hideBelow: "sm" },
        { key: "members", header: "Members", cell: (l) => <span className="tabular">{formatNumber(l.member_count)}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "updated", header: "Updated", cell: (l) => <span className="text-muted-foreground">{formatRelative(l.updated_at)}</span>, hideBelow: "md" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (l) =>
                (can("communications.recipient_lists.archive") || can("communications.recipient_lists.delete")) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {can("communications.recipient_lists.archive") && <DropdownMenuItem onSelect={() => setArchiving(l)}><Archive /> Archive</DropdownMenuItem>}
                            {can("communications.recipient_lists.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(l)}><Trash2 /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Recipient lists"
                description="Static lists of CRM contacts, team members or imported addresses."
                actions={<Can permission="communications.recipient_lists.create"><Button onClick={() => setFormOpen(true)}><Plus /> New list</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search lists…" />
            <DataTable
                columns={columns}
                data={lists.data?.data}
                rowKey={(l) => l.id}
                loading={lists.isFetching}
                error={lists.error}
                onRetry={() => lists.refetch()}
                pagination={lists.data?.pagination}
                onPageChange={setPage}
                rowHref={(l) => CampaignPaths.list(l.id)}
                empty={{
                    icon: List,
                    title: search ? "No lists match your search" : "No recipient lists yet",
                    description: "Create a list and add contacts or paste addresses from a spreadsheet.",
                    action: can("communications.recipient_lists.create") && !search ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New list</Button> : undefined,
                }}
            />
            <ListFormDialog open={formOpen} onOpenChange={setFormOpen} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Archived lists can't be picked for new campaigns."
                confirmText="Archive"
                onConfirm={() => { if (!archiving) return; action.mutate({ id: archiving.id, action: "archive" }); setArchiving(null); }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="The list and its members are removed. Contacts stay in the CRM."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (!deleting) return; del.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}
