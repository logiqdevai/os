import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SharePermissionOptions, ShareSubjectTypeOptions } from "@/config/constants/dropdowns/files/files.options";
import { useRevokeShare, useShares } from "@/features/files/hooks/use-files";
import type { DocumentShare } from "@/features/files/interfaces/files.interfaces";
import { FilesStatusBadge } from "../../components/files-ui";

/**
 * /files/shared?tab=with_me|by_org|links — shares (17 §9)
 * @perm VIEW documents.documents.read · revoke documents.documents.share
 * @api GET /files/shares?with_me=|links= · POST /files/shares/:id/revoke
 */
export default function SharedFilesPage() {
    const { params, setPage, filters, setFilter } = useListParams();
    const tab = filters.tab ?? "with_me";
    const query: Record<string, unknown> = { ...params, ...(tab === "with_me" ? { with_me: "true" } : tab === "links" ? { links: "true" } : {}) };
    delete query.tab;
    const shares = useShares(query);
    const revoke = useRevokeShare();
    const canShare = usePermission("documents.documents.share");
    const [revoking, setRevoking] = useState<DocumentShare | null>(null);

    const columns: DataTableColumn<DocumentShare>[] = [
        {
            key: "item",
            header: "Item",
            cell: (s) => (
                <div className="min-w-0">
                    {s.document ? <Link to={`/files/documents/${s.document.id}`} className="truncate font-medium text-foreground hover:underline">{s.document.title ?? s.document.filename}</Link> : s.folder ? <Link to={`/files?folder=${s.folder.id}`} className="truncate font-medium text-foreground hover:underline">{s.folder.name}</Link> : "—"}
                    <div className="truncate text-xs text-muted-foreground">by {s.shared_by ? personName(s.shared_by.user) : "—"} · {formatRelative(s.created_at)}</div>
                </div>
            ),
        },
        { key: "with", header: "With", cell: (s) => s.membership ? personName(s.membership.user) : s.team?.name ?? s.external_email ?? getDropdownOptionLabel(ShareSubjectTypeOptions, s.subject_type), hideBelow: "sm" },
        { key: "perm", header: "Access", cell: (s) => getDropdownOptionLabel(SharePermissionOptions, s.permission), hideBelow: "md" },
        { key: "expires", header: "Expires", cell: (s) => (s.expires_at ? formatDate(s.expires_at) : "Never"), hideBelow: "lg" },
        { key: "opens", header: "Opens", cell: (s) => <span className="tabular">{s.access_count}</span>, hideBelow: "lg" },
        { key: "status", header: "Status", cell: (s) => <FilesStatusBadge status={s.status} /> },
        { key: "actions", header: <span className="sr-only">Actions</span>, cell: (s) => canShare && s.status === "ACTIVE" && tab !== "with_me" && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setRevoking(s)}>Revoke</Button> },
    ];

    return (
        <Page>
            <PageHeader title="Shared" description="Files shared with you, and every share and public link of the organization you can see." />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "with_me" ? null : v)}>
                <TabsList className="mb-3">
                    <TabsTrigger value="with_me">Shared with me</TabsTrigger>
                    <TabsTrigger value="all">All shares</TabsTrigger>
                    <TabsTrigger value="links">Links</TabsTrigger>
                </TabsList>
            </Tabs>
            <TableToolbar />
            <DataTable columns={columns} data={shares.data?.data} rowKey={(s) => s.id} loading={shares.isFetching} error={shares.error} onRetry={() => shares.refetch()} pagination={shares.data?.pagination} onPageChange={setPage} empty={{ icon: Link2, title: tab === "with_me" ? "Nothing shared with you" : "No shares", description: "Share files from their detail page." }} />
            <ConfirmationDialog isOpen={!!revoking} onClose={() => setRevoking(null)} title="Revoke this share?" description="The person or link loses access immediately." confirmText="Revoke" variant="destructive" isLoading={revoke.isPending} onConfirm={() => revoking && revoke.mutate(revoking.id, { onSuccess: () => { toast({ title: "Share revoked" }); setRevoking(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not revoke", description: getApiErrorMessage(e) }) })} />
        </Page>
    );
}
