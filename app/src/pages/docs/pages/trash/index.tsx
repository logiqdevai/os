import { useState } from "react";
import { Link } from "react-router-dom";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { useDeletePage, useDocsTrash, usePageAction } from "@/features/docs/hooks/use-docs";
import type { WikiPageListItem } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "../../components/docs-ui";

/**
 * /docs/trash?tab=deleted|archived — restore or permanently delete pages (15 §3)
 * @perm VIEW docs.pages.read · restore docs.pages.archive · delete forever docs.pages.delete
 * @api GET /docs/trash · POST /docs/pages/:id/restore|unarchive · DELETE /docs/pages/:id
 */
export default function DocsTrashPage() {
    const { params, setPage, filters, setFilter } = useListParams();
    const tab = filters.tab === "archived" ? "archived" : "deleted";
    const trash = useDocsTrash({ ...params, tab });
    const action = usePageAction();
    const remove = useDeletePage();
    const p = usePermissions();
    const [deleting, setDeleting] = useState<WikiPageListItem | null>(null);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const columns: DataTableColumn<WikiPageListItem>[] = [
        { key: "title", header: "Page", cell: (pg) => <div className="flex min-w-0 items-center gap-2"><DocIcon icon={pg.icon} /><div className="min-w-0"><div className="truncate font-medium text-foreground">{pg.title}</div><div className="truncate text-xs text-muted-foreground">{pg.space.name}</div></div></div> },
        { key: "when", header: tab === "deleted" ? "Deleted" : "Archived", cell: (pg) => formatRelative(tab === "deleted" ? pg.deleted_at : pg.archived_at), hideBelow: "sm" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            cell: (pg) => (
                <div className="flex justify-end gap-1.5">
                    {p.can("docs.pages.archive") && <Button size="sm" variant="outline" onClick={() => action.mutate({ id: pg.id, action: tab === "deleted" ? "restore" : "unarchive" }, { onSuccess: () => toast({ title: "Page restored" }), onError: fail("Could not restore") })}><ArchiveRestore /> Restore</Button>}
                    {p.can("docs.pages.delete") && <Button size="sm" variant="outline" className="text-danger" onClick={() => setDeleting(pg)}><Trash2 /> Delete</Button>}
                </div>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Trash" description="Deleted pages stay here until someone deletes them forever." />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "deleted" ? null : v)}>
                <TabsList className="mb-3"><TabsTrigger value="deleted">Deleted</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger></TabsList>
            </Tabs>
            <TableToolbar />
            <DataTable columns={columns} data={trash.data?.data} rowKey={(pg) => pg.id} loading={trash.isFetching} error={trash.error} onRetry={() => trash.refetch()} pagination={trash.data?.pagination} onPageChange={setPage} empty={{ icon: Trash2, title: "Trash is empty", description: <>Pages you delete show up here. <Link className="text-info hover:underline" to="/docs">Back to Docs</Link></> }} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete “${deleting?.title}” forever?`}
                description="The page, its versions and comments are removed permanently. This cannot be undone."
                confirmText="Delete forever"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast({ title: "Page deleted" }); setDeleting(null); }, onError: fail("Could not delete") })}
            />
        </Page>
    );
}
