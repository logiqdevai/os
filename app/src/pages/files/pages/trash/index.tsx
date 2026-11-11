import { useState } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { useDeletionRequestAction, useDeletionRequests, useDocuments, useRequestDeletion, useRestoreDocument, useStorageUsage } from "@/features/files/hooks/use-files";
import type { DocumentRow } from "@/features/files/interfaces/files.interfaces";
import { FileIcon, formatBytes } from "../../components/files-ui";

/**
 * /files/trash — deleted files; restore (17 §13). Permanent deletion goes through a deletion request
 * approved by someone with documents.deletions.approve (sensitive), not from this list.
 * @perm VIEW documents.documents.read · restore documents.documents.restore · storage documents.storage.manage
 * @api GET /files/documents?status=DELETED · POST /files/documents/:id/restore · GET /files/storage-usage
 */
export default function FilesTrashPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const docs = useDocuments({ ...params, status: "DELETED" });
    const p = usePermissions();
    const usage = useStorageUsage(p.can("documents.storage.manage"));
    const restore = useRestoreDocument();
    const requestDeletion = useRequestDeletion();
    const deletionAction = useDeletionRequestAction();
    const canApproveDeletion = p.can("documents.deletions.approve");
    const pendingDeletions = useDeletionRequests({ status: "PENDING", limit: 50 }, canApproveDeletion || p.can("documents.documents.delete"));
    const [deleting, setDeleting] = useState<DocumentRow | null>(null);
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
    const requested = new Set((pendingDeletions.data?.data ?? []).map((r) => r.document_id));

    const columns: DataTableColumn<DocumentRow>[] = [
        { key: "name", header: "Name", cell: (d) => <div className="flex min-w-0 items-center gap-2"><FileIcon type={d.type_group} /><span className="truncate font-medium text-foreground">{d.title}</span></div> },
        { key: "folder", header: "Was in", cell: (d) => d.folder?.name ?? "—", hideBelow: "md" },
        { key: "size", header: "Size", cell: (d) => formatBytes(d.size), hideBelow: "sm" },
        { key: "deleted", header: "Deleted", cell: (d) => formatRelative(d.deleted_at), hideBelow: "sm" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            cell: (d) => {
                const req = pendingDeletions.data?.data.find((r) => r.document_id === d.id);
                return (
                    <div className="flex flex-wrap justify-end gap-1.5">
                        {p.can("documents.documents.restore") && <Button size="sm" variant="outline" loading={restore.isPending} onClick={() => restore.mutate(d.id, { onSuccess: () => toast({ title: "File restored" }), onError: fail("Could not restore") })}><ArchiveRestore /> Restore</Button>}
                        {req && canApproveDeletion ? (
                            <>
                                <Button size="sm" variant="destructive" loading={deletionAction.isPending} onClick={() => deletionAction.mutate({ id: req.id, action: "approve" }, { onSuccess: () => toast({ title: "Deleted permanently" }), onError: fail("Could not approve") })}>Approve deletion</Button>
                                <Button size="sm" variant="ghost" onClick={() => deletionAction.mutate({ id: req.id, action: "reject" }, { onSuccess: () => toast({ title: "Deletion rejected" }), onError: fail("Could not reject") })}>Reject</Button>
                            </>
                        ) : requested.has(d.id) ? <span className="self-center text-xs text-muted-foreground">Deletion requested</span> : p.can("documents.documents.delete") && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(d)}><Trash2 /> Delete forever</Button>}
                    </div>
                );
            },
        },
    ];

    return (
        <Page>
            <PageHeader title="Trash" description="Deleted files are kept here until the retention policy removes them." />
            {usage.data && (
                <StatGrid className="mb-5">
                    <StatCard label="Storage used" value={formatBytes(usage.data.used_bytes)} hint={usage.data.quota_bytes ? `of ${formatBytes(usage.data.quota_bytes)}` : `${usage.data.driver} storage`} />
                    <StatCard label="Files" value={usage.data.documents} hint={`${usage.data.versions} versions`} />
                    <StatCard label="In trash" value={usage.data.trash.documents} hint={formatBytes(usage.data.trash.bytes)} />
                    <StatCard label="Largest type" value={usage.data.by_type[0]?.type ?? "—"} hint={usage.data.by_type[0] ? formatBytes(usage.data.by_type[0].bytes) : undefined} />
                </StatGrid>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search the trash…" />
            <DataTable columns={columns} data={docs.data?.data} rowKey={(d) => d.id} loading={docs.isFetching} error={docs.error} onRetry={() => docs.refetch()} pagination={docs.data?.pagination} onPageChange={setPage} empty={{ icon: Trash2, title: "Trash is empty", description: "Files you delete show up here." }} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Request permanent deletion of “${deleting?.title}”?`}
                description="Permanent deletion needs approval by another person with the deletion permission. Legal holds block it. This cannot be undone once approved."
                confirmText="Request deletion"
                variant="destructive"
                isLoading={requestDeletion.isPending}
                onConfirm={() => deleting && requestDeletion.mutate({ document_id: deleting.id }, { onSuccess: () => { toast({ title: "Deletion requested", description: "An approver must confirm it." }); setDeleting(null); }, onError: fail("Could not request deletion") })}
            />
        </Page>
    );
}
