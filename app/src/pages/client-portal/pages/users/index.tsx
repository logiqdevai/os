import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MailPlus, MoreHorizontal, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { InviteLinkNotice } from "../../components/invite-link";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { InvitationStatusFilterOptions, InvitationStatusOptions, InvitationStatusTone, PortalMembershipStatusFilterOptions, PortalMembershipStatusOptions, PortalMembershipStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { useCancelPortalInvitation, useCustomerRoles, usePortalInvitations, usePortalUsers, useResendPortalInvitation, useUpdatePortalUser } from "@/features/client-portal/hooks/use-client-portal";
import type { PortalInvitationRow, PortalMembershipRow } from "@/features/client-portal/interfaces/client-portal.interfaces";
import { InviteDialog } from "../../components/invite-dialog";
import { CLIENT_PORTAL_PATHS } from "../../client-portal-paths";

/**
 * Portal users and invitations — /client-portal/users (+ /users/invite opens the invite dialog).
 * Mockup 07-portal `users`, `invitations`, `invite`.
 * @perm VIEW portal.users.read · role / status / invitations portal.users.manage*
 */
export default function PortalUsersPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const tab = filters.tab ?? "users";
    const canManage = usePermission("portal.users.manage");
    const [inviteOpen, setInviteOpen] = useState(location.pathname.endsWith("/invite"));
    useEffect(() => setInviteOpen(location.pathname.endsWith("/invite") && canManage), [location.pathname, canManage]);
    const closeInvite = (o: boolean) => {
        setInviteOpen(o);
        if (!o && location.pathname.endsWith("/invite")) navigate(CLIENT_PORTAL_PATHS.users, { replace: true });
    };
    const { tab: _tab, ...queryParams } = params;
    void _tab;

    return (
        <Page>
            <PageHeader
                title="Portal users"
                description="Client people who can sign in to the portal, and pending invitations."
                actions={<Can permission="portal.users.manage"><Button asChild><Link to={CLIENT_PORTAL_PATHS.invite}><MailPlus /> Invite</Link></Button></Can>}
            />
            <Tabs value={tab} onValueChange={(v) => { setFilter("status", null); setFilter("tab", v === "users" ? null : v); }} className="mb-3">
                <TabsList>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="invitations">Invitations</TabsTrigger>
                </TabsList>
            </Tabs>
            {tab === "users" ? (
                <UsersTable params={queryParams} search={search} setSearch={setSearch} filters={filters} setFilter={setFilter} setPage={setPage} />
            ) : (
                <InvitationsTable params={queryParams} search={search} setSearch={setSearch} filters={filters} setFilter={setFilter} setPage={setPage} />
            )}
            <InviteDialog open={inviteOpen} onOpenChange={closeInvite} />
        </Page>
    );
}

interface TableProps {
    params: Record<string, unknown>;
    search: string;
    setSearch: (v: string) => void;
    filters: Record<string, string>;
    setFilter: (k: string, v: string | null) => void;
    setPage: (p: number) => void;
}

function UsersTable({ params, search, setSearch, filters, setFilter, setPage }: TableProps) {
    const users = usePortalUsers(params);
    const roles = useCustomerRoles();
    const update = useUpdatePortalUser();
    const canManage = usePermission("portal.users.manage");
    const columns: DataTableColumn<PortalMembershipRow>[] = [
        { key: "user", header: "User", cell: (u) => <div className="min-w-0"><MemberAvatar person={u.user} showName size="xs" /><div className="truncate pl-7 text-xs text-muted-foreground">{u.user.email}</div></div> },
        { key: "company", header: "Client", cell: (u) => (u.company ? <Link className="hover:underline" to={CLIENT_PORTAL_PATHS.client(u.company.id)}>{u.company.name}</Link> : "—"), hideBelow: "sm" },
        { key: "role", header: "Role", cell: (u) => <Badge variant="neutral">{u.role?.name ?? "No role"}</Badge>, hideBelow: "md" },
        { key: "status", header: "Status", cell: (u) => <Badge variant={PortalMembershipStatusTone[u.status]}>{getDropdownOptionLabel(PortalMembershipStatusOptions, u.status)}</Badge> },
        { key: "active", header: "Last active", cell: (u) => <span className="text-xs text-muted-foreground">{u.last_active_at ? formatRelative(u.last_active_at) : "Never"}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (u) =>
                canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.user.email}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change role</DropdownMenuLabel>
                            {roles.data?.map((r) => (
                                <DropdownMenuItem key={r.id} disabled={u.role?.id === r.id} onSelect={() => update.mutate({ id: u.id, role_id: r.id, optimistic: { role: r } })}>{r.name}</DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            {u.status === "ACTIVE" ? (
                                <DropdownMenuItem onSelect={() => update.mutate({ id: u.id, status: "SUSPENDED" })}>Suspend</DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onSelect={() => update.mutate({ id: u.id, status: "ACTIVE" })}>Reactivate</DropdownMenuItem>
                            )}
                            {u.status !== "DEACTIVATED" && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => update.mutate({ id: u.id, status: "DEACTIVATED" })}>Deactivate</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or email…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{PortalMembershipStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.role_id ?? "all"} onValueChange={(v) => setFilter("role_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Role"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Any role</SelectItem>{roles.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={users.data?.data} rowKey={(u) => u.id} loading={users.isFetching} error={users.error} onRetry={() => users.refetch()} pagination={users.data?.pagination} onPageChange={setPage} empty={{ icon: Users, title: search ? "No users match" : "No portal users yet", description: "Invite people from your clients to give them portal access." }} />
        </>
    );
}

function InvitationsTable({ params, search, setSearch, filters, setFilter, setPage }: TableProps) {
    const invitations = usePortalInvitations(params);
    const resend = useResendPortalInvitation();
    const cancel = useCancelPortalInvitation();
    const canManage = usePermission("portal.users.manage");
    const [newLink, setNewLink] = useState<{ email: string; url: string } | null>(null);
    const columns: DataTableColumn<PortalInvitationRow>[] = [
        { key: "email", header: "Email", cell: (i) => <span className="font-medium text-foreground">{i.email}</span> },
        { key: "client", header: "Client", cell: (i) => i.customer?.name ?? "—", hideBelow: "sm" },
        { key: "role", header: "Role", cell: (i) => i.role?.name ?? "—", hideBelow: "md" },
        { key: "status", header: "Status", cell: (i) => <Badge variant={InvitationStatusTone[i.status]}>{getDropdownOptionLabel(InvitationStatusOptions, i.status)}</Badge> },
        { key: "expires", header: "Expires", cell: (i) => <span className="text-xs text-muted-foreground">{formatDate(i.expires_at)}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (i) =>
                canManage && (i.status === "PENDING" || i.status === "EXPIRED") && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.email}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => resend.mutate(i.id, { onSuccess: (r) => setNewLink(!r.email_sent && r.invite_url ? { email: i.email, url: r.invite_url } : null) })}>Resend</DropdownMenuItem>
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => cancel.mutate(i.id)}>Cancel invitation</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];
    return (
        <>
            {newLink && <InviteLinkNotice email={newLink.email} url={newLink.url} onDismiss={() => setNewLink(null)} />}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search email…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{InvitationStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={invitations.data?.data} rowKey={(i) => i.id} loading={invitations.isFetching} error={invitations.error} onRetry={() => invitations.refetch()} pagination={invitations.data?.pagination} onPageChange={setPage} empty={{ icon: MailPlus, title: "No invitations", description: "Invitations you send appear here until they are accepted." }} />
        </>
    );
}
