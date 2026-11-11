import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Trash2, Upload, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber, formatRelative, personName } from "@/lib/format";
import { useAddListMembers, useList, useListMembers, useRemoveListMember } from "@/features/communications/hooks/use-communications";
import type { ListMemberInput, RecipientListMember } from "@/features/communications/interfaces/communications.interfaces";
import { ListFormDialog } from "../../components/list-form-dialog";
import { CampaignPaths } from "../../campaign-paths";

/** Parse pasted rows: `email`, `Name <email>`, `email,Name` or `Name,email` (CSV export). One per line. */
function parseRows(text: string): ListMemberInput[] {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !/^email\s*[,;]/i.test(line))
        .map((line) => {
            const angle = line.match(/^(.*)<([^>]+)>$/);
            if (angle) return { kind: "EXTERNAL" as const, address: angle[2].trim(), name: angle[1].trim().replace(/^"|"$/g, "") || undefined };
            const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
            const addrIdx = parts.findIndex((p) => p.includes("@") || /^\+?\d[\d\s-]{6,}$/.test(p));
            const address = parts[addrIdx >= 0 ? addrIdx : 0];
            const name = parts.filter((_, i) => i !== (addrIdx >= 0 ? addrIdx : 0)).join(" ").trim();
            return { kind: "EXTERNAL" as const, address, name: name || undefined };
        });
}

const memberName = (m: RecipientListMember) =>
    m.contact ? [m.contact.first_name, m.contact.last_name].filter(Boolean).join(" ") : m.membership ? personName(m.membership.user) : m.name ?? "—";
const memberAddress = (m: RecipientListMember) => m.address ?? m.contact?.email ?? m.contact?.mobile ?? m.membership?.user.email ?? "—";

/**
 * /campaigns/lists/:id
 * @perm VIEW communications.recipient_lists.read · add / remove members communications.recipient_lists.update
 * @api GET /communications/lists/:id · GET /lists/:id/members · POST /lists/:id/members · DELETE /lists/:id/members/:memberId
 */
export default function ListDetailPage() {
    const { id } = useParams();
    const { params, setPage, search, setSearch } = useListParams();
    const list = useList(id);
    const members = useListMembers(id, params);
    const canUpdate = usePermission("communications.recipient_lists.update");
    const add = useAddListMembers();
    const remove = useRemoveListMember();
    const [importOpen, setImportOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [text, setText] = useState("");
    const [removing, setRemoving] = useState<RecipientListMember | null>(null);
    const rows = useMemo(() => parseRows(text), [text]);

    if (list.isPending) return <PageSkeleton />;
    if (list.error) return <Page><ErrorState error={list.error} onRetry={() => list.refetch()} /></Page>;
    const l = list.data;

    const columns: DataTableColumn<RecipientListMember>[] = [
        { key: "name", header: "Name", cell: (m) => <span className="font-medium text-foreground">{memberName(m)}</span> },
        { key: "address", header: "Address", cell: (m) => <span className="text-muted-foreground">{memberAddress(m)}</span> },
        { key: "kind", header: "Type", hideBelow: "md", cell: (m) => <Badge>{m.kind === "CRM_CONTACT" ? "Contact" : m.kind === "MEMBERSHIP" ? "Member" : "Imported"}</Badge> },
        { key: "added", header: "Added", hideBelow: "lg", cell: (m) => <span className="text-muted-foreground">{formatRelative(m.created_at)}</span> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (m) => canUpdate && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${memberName(m)}`} onClick={() => setRemoving(m)}><Trash2 /></Button>,
        },
    ];

    const doImport = () =>
        add.mutate({ id: l.id, members: rows }, {
            onSuccess: (r) => {
                toast({ title: `${formatNumber(r.added)} added`, description: [r.skipped && `${r.skipped} already in the list`, r.invalid.length && `${r.invalid.length} invalid`].filter(Boolean).join(" · ") || undefined });
                setImportOpen(false);
                setText("");
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not add members", description: getApiErrorMessage(e) }),
        });

    return (
        <Page>
            <PageHeader
                back={{ to: CampaignPaths.lists, label: "Recipient lists" }}
                title={l.name}
                meta={<Badge>{formatNumber(l.member_count)} members</Badge>}
                description={l.description ?? undefined}
                actions={
                    <Can permission="communications.recipient_lists.update">
                        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
                        <Button onClick={() => setImportOpen(true)}><Upload /> Add people</Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search members…" />
            <DataTable
                columns={columns}
                data={members.data?.data}
                rowKey={(m) => m.id}
                loading={members.isFetching}
                error={members.error}
                onRetry={() => members.refetch()}
                pagination={members.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Users, title: search ? "No members match" : "This list is empty", description: "Paste addresses from a spreadsheet to add people.", action: canUpdate && !search ? <Button size="sm" onClick={() => setImportOpen(true)}><Upload /> Add people</Button> : undefined }}
            />
            <ListFormDialog open={editOpen} onOpenChange={setEditOpen} list={l} />
            <Dialog open={importOpen} onOpenChange={(o) => !add.isPending && setImportOpen(o)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add people</DialogTitle>
                        <DialogDescription>One per line: <code>email</code>, <code>Name &lt;email&gt;</code> or a CSV row with name and email (or phone for SMS lists). Only import people who agreed to hear from you.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"maria@acme.com\nNikos Georgiou <nikos@example.com>"} className="font-mono text-xs" aria-label="Addresses" />
                    <p className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"} detected. Duplicates and invalid addresses are skipped.</p>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={add.isPending}>Cancel</Button>
                        <Button onClick={doImport} loading={add.isPending} disabled={!rows.length}>Add {rows.length || ""}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title="Remove from list?"
                description={removing ? `${memberName(removing)} will no longer receive campaigns sent to this list.` : ""}
                confirmText="Remove"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => removing && remove.mutate({ id: l.id, memberId: removing.id }, { onSuccess: () => { toast({ title: "Removed from list" }); setRemoving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(e) }) })}
            />
        </Page>
    );
}
