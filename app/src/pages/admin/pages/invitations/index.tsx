import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, Mail, MoreHorizontal, Plus, Send } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useCancelInvitation, useInvitations, useResendInvitation } from "@/features/admin/invitations/hooks/use-invitations";
import type { Invitation, InvitationSendResult } from "@/features/admin/invitations/interfaces/invitations.interfaces";
import { InvitationStatusFilterOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { MembershipTypeFormOptions } from "@/config/constants/dropdowns/admin/membership-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { InvitationStatusBadge } from "../../components/status-badges";
import { CopyField } from "../../components/copy-field";
import { InviteDialog } from "./components/invite-dialog";

/**
 * Invitations — /admin/invitations?status=  ·  /admin/invitations/new opens the invite dialog
 * @perm VIEW users.members.read | users.members.invite · send / resend / cancel users.members.invite
 * @api GET /invitations · POST /invitations · POST /invitations/:id/resend · POST /invitations/:id/cancel
 */
export default function InvitationsPage({ openInvite = false }: { openInvite?: boolean }) {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const invitations = useInvitations(params);
    const canInvite = usePermission("users.members.invite");
    const resend = useResendInvitation();
    const cancel = useCancelInvitation();
    const [inviteOpen, setInviteOpen] = useState(openInvite);
    const [cancelling, setCancelling] = useState<Invitation | null>(null);
    const [resent, setResent] = useState<InvitationSendResult | null>(null);

    useEffect(() => setInviteOpen(openInvite), [openInvite]);
    const closeInvite = (o: boolean) => {
        setInviteOpen(o);
        if (!o && openInvite) navigate("/admin/invitations", { replace: true });
    };

    const doResend = (i: Invitation) =>
        resend.mutate(i.id, {
            // A new link is shown in a dialog; an emailed invitation needs no confirmation (the row's sent date updates).
            onSuccess: (r) => { if (r.invite_url) setResent(r); },
        });

    const columns: DataTableColumn<Invitation>[] = [
        {
            key: "email",
            header: "Email",
            cell: (i) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{i.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{[i.role?.name ?? "No role", i.branch?.name, i.team?.name].filter(Boolean).join(" · ")}</div>
                </div>
            ),
        },
        { key: "type", header: "Type", hideBelow: "lg", cell: (i) => getDropdownOptionLabel(MembershipTypeFormOptions, i.type) },
        { key: "by", header: "Invited by", hideBelow: "md", cell: (i) => <span className="text-muted-foreground">{i.invited_by ? personName(i.invited_by) : "—"}</span> },
        { key: "sent", header: "Sent", hideBelow: "md", cell: (i) => <span className="text-muted-foreground">{formatRelative(i.last_sent_at ?? i.created_at)}{i.send_count > 1 ? ` · ${i.send_count}×` : ""}</span> },
        { key: "expires", header: "Expires", hideBelow: "xl", cell: (i) => <span className="text-muted-foreground">{i.status === "PENDING" ? formatDate(i.expires_at) : "—"}</span> },
        { key: "status", header: "Status", cell: (i) => <InvitationStatusBadge status={i.status} /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (i) =>
                canInvite && (i.status === "PENDING" || i.status === "EXPIRED") && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.email}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => doResend(i)}><Send /> Resend with a new link</DropdownMenuItem>
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setCancelling(i)}><Ban /> Cancel invitation</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Invitations"
                description="People invited to join. Links expire and work only for the invited email."
                actions={<Can permission="users.members.invite"><Button onClick={() => setInviteOpen(true)}><Plus /> Invite people</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search email…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{InvitationStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={invitations.data?.data}
                rowKey={(i) => i.id}
                loading={invitations.isFetching}
                error={invitations.error}
                onRetry={() => invitations.refetch()}
                pagination={invitations.data?.pagination}
                onPageChange={setPage}
                empty={{
                    icon: Mail,
                    title: search || filters.status ? "No invitations match" : "No invitations yet",
                    description: "Invite teammates, freelancers or guests by email.",
                    action: canInvite && !search ? <Button size="sm" onClick={() => setInviteOpen(true)}><Plus /> Invite people</Button> : undefined,
                }}
            />
            <InviteDialog open={inviteOpen} onOpenChange={closeInvite} />
            <ConfirmationDialog
                isOpen={!!cancelling}
                onClose={() => setCancelling(null)}
                title={`Cancel the invitation for ${cancelling?.email}?`}
                description="The link stops working. You can invite them again later."
                confirmText="Cancel invitation"
                variant="destructive"
                onConfirm={() => { if (cancelling) cancel.mutate(cancelling.id); setCancelling(null); }}
            />
            <Dialog open={!!resent} onOpenChange={(o) => !o && setResent(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New invitation link</DialogTitle>
                        <DialogDescription>The email could not be sent. Copy this link and send it to {resent?.email}. It is shown only once.</DialogDescription>
                    </DialogHeader>
                    {resent?.invite_url && <CopyField value={resent.invite_url} label="invitation link" />}
                    <DialogFooter><Button onClick={() => setResent(null)}>Done</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
