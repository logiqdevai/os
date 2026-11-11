import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Pause, Play, Plus, UserMinus, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useMembers, useOffboardMember, useReactivateMember, useSuspendMember } from "@/features/admin/members/hooks/use-members";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import type { MemberListItem } from "@/features/admin/members/interfaces/members.interfaces";
import { MembershipStatusFilterOptions, MembershipTypeFilterOptions, MembershipTypeFormOptions } from "@/config/constants/dropdowns/admin/membership-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../components/person-cell";
import { MemberStatusBadge } from "../../components/status-badges";

type PendingAction = { kind: "suspend" | "reactivate" | "offboard"; member: MemberListItem } | null;

/**
 * Members — /admin/members?q=&status=&type=&branch_id=&role_id=
 * @perm VIEW users.members.read · suspend/reactivate users.members.manage · offboard users.members.offboard · invite users.members.invite
 * @api GET /members · POST /members/:id/suspend|reactivate|offboard
 */
export default function MembersPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const members = useMembers(params);
    const p = usePermissions();
    const session = useSessionData();
    const roles = useAssignableRoles(p.can("users.roles.read"));
    const suspend = useSuspendMember();
    const reactivate = useReactivateMember();
    const offboard = useOffboardMember();
    const [pending, setPending] = useState<PendingAction>(null);

    const runAction = () => {
        if (!pending) return;
        const { kind, member } = pending;
        const name = personName(member.user);
        const opts = {
            onSuccess: () => {
                toast({ title: kind === "suspend" ? `${name} suspended` : kind === "reactivate" ? `${name} reactivated` : `${name} offboarded` });
                setPending(null);
            },
            onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not update the member", description: getApiErrorMessage(e) }),
        };
        if (kind === "suspend") suspend.mutate(member.id, opts);
        else if (kind === "reactivate") reactivate.mutate(member.id, opts);
        else offboard.mutate({ id: member.id }, opts);
    };

    const columns: DataTableColumn<MemberListItem>[] = [
        { key: "name", header: "Member", cell: (m) => <PersonCell user={m.user} /> },
        {
            key: "roles",
            header: "Roles",
            hideBelow: "md",
            cell: (m) =>
                m.role_assignments.length ? (
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                        {m.role_assignments.slice(0, 3).map((a) => <Badge key={a.id} variant="secondary">{a.role.name}{a.scope_type !== "ORGANIZATION" && " · scoped"}</Badge>)}
                        {m.role_assignments.length > 3 && <Badge variant="secondary">+{m.role_assignments.length - 3}</Badge>}
                    </div>
                ) : <span className="text-xs text-warning">No role</span>,
        },
        { key: "branch", header: "Branch", hideBelow: "lg", cell: (m) => (m.branches.find((b) => b.is_primary) ?? m.branches[0])?.branch.name ?? <span className="text-ash">—</span> },
        { key: "type", header: "Type", hideBelow: "xl", cell: (m) => getDropdownOptionLabel(MembershipTypeFormOptions, m.type) },
        { key: "mfa", header: "MFA", hideBelow: "lg", cell: (m) => (m.user.mfa_enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>) },
        { key: "status", header: "Status", hideBelow: "sm", cell: (m) => <MemberStatusBadge status={m.status} /> },
        { key: "active", header: "Last sign-in", hideBelow: "xl", cell: (m) => <span className="text-muted-foreground">{formatRelative(m.user.last_login_at)}</span> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (m) =>
                (p.can("users.members.manage") || p.can("users.members.offboard")) && m.id !== session?.active_organization?.membership_id ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${personName(m.user)}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {p.can("users.members.manage") && m.status === "ACTIVE" && <DropdownMenuItem onSelect={() => setPending({ kind: "suspend", member: m })}><Pause /> Suspend</DropdownMenuItem>}
                            {p.can("users.members.manage") && (m.status === "SUSPENDED" || m.status === "DEACTIVATED") && <DropdownMenuItem onSelect={() => setPending({ kind: "reactivate", member: m })}><Play /> Reactivate</DropdownMenuItem>}
                            {p.can("users.members.offboard") && m.status !== "DEACTIVATED" && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setPending({ kind: "offboard", member: m })}><UserMinus /> Offboard</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null,
        },
    ];

    const confirmCopy = {
        suspend: { title: "Suspend", description: "They lose access to this organization right away. You can reactivate them later.", cta: "Suspend" },
        reactivate: { title: "Reactivate", description: "They get their access back. Offboarded members need their roles assigned again.", cta: "Reactivate" },
        offboard: { title: "Offboard", description: "Their roles, branches, teams and API keys are removed. Records they own stay in place.", cta: "Offboard" },
    } as const;

    return (
        <Page>
            <PageHeader
                title="Members"
                description="People in your organization, their roles and where they work."
                actions={
                    <Can permission="users.members.invite">
                        <Button asChild><Link to="/admin/invitations/new"><Plus /> Invite member</Link></Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, email or title…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{MembershipStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>{MembershipTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {!!session?.branches.length && (
                    <Select value={filters.branch_id ?? "all"} onValueChange={(v) => setFilter("branch_id", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by branch"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All branches</SelectItem>
                            {session.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                {!!roles.data?.length && (
                    <Select value={filters.role_id ?? "all"} onValueChange={(v) => setFilter("role_id", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            {roles.data.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </TableToolbar>
            <DataTable
                columns={columns}
                data={members.data?.data}
                rowKey={(m) => m.id}
                loading={members.isFetching}
                error={members.error}
                onRetry={() => members.refetch()}
                pagination={members.data?.pagination}
                onPageChange={setPage}
                rowHref={(m) => `/admin/members/${m.id}`}
                empty={{ icon: Users, title: search || Object.keys(filters).length ? "No members match" : "No members yet", description: "Invite people to give them access to this organization." }}
            />
            <ConfirmationDialog
                isOpen={!!pending}
                onClose={() => setPending(null)}
                title={pending ? `${confirmCopy[pending.kind].title} ${personName(pending.member.user)}?` : ""}
                description={pending ? confirmCopy[pending.kind].description : ""}
                confirmText={pending ? confirmCopy[pending.kind].cta : "Confirm"}
                variant={pending?.kind === "reactivate" ? "default" : "destructive"}
                isLoading={suspend.isPending || reactivate.isPending || offboard.isPending}
                onConfirm={runAction}
            />
        </Page>
    );
}
