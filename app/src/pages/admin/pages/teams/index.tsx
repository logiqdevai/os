import { useState } from "react";
import { Archive, MoreHorizontal, Pencil, Plus, UsersRound } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useArchiveTeam, useTeams } from "@/features/admin/teams/hooks/use-teams";
import type { Team } from "@/features/admin/teams/interfaces/teams.interfaces";
import { TeamKindFilterOptions, TeamKindFormOptions } from "@/config/constants/dropdowns/admin/team-kind-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { TeamFormDialog } from "./components/team-form-dialog";

/**
 * REFERENCE LIST PAGE — /admin/teams
 * @perm VIEW organizations.teams.read · ACTION organizations.teams.manage
 * @api GET /teams · POST /teams · PATCH /teams/:id · POST /teams/:id/archive
 * @states loading (skeleton) · empty · error / 403 · pagination in the URL
 */
export default function TeamsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const teams = useTeams(params);
    const canManage = usePermission("organizations.teams.manage");
    const archive = useArchiveTeam();
    const [editing, setEditing] = useState<Team | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [archiving, setArchiving] = useState<Team | null>(null);

    const columns: DataTableColumn<Team>[] = [
        {
            key: "name",
            header: "Team",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{t.name}</div>
                    {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                </div>
            ),
        },
        { key: "kind", header: "Kind", cell: (t) => <Badge>{getDropdownOptionLabel(TeamKindFormOptions, t.kind)}</Badge>, hideBelow: "sm" },
        { key: "key", header: "Task key", cell: (t) => (t.task_key ? <code className="text-xs">{t.task_key}</code> : <span className="text-ash">—</span>), hideBelow: "md" },
        { key: "branch", header: "Branch", cell: (t) => t.branch?.name ?? <span className="text-muted-foreground">Whole organization</span>, hideBelow: "lg" },
        { key: "members", header: "Members", cell: (t) => <span className="tabular">{t._count?.members ?? 0}</span>, className: "text-right", headerClassName: "text-right" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) =>
                canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                                <MoreHorizontal />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(t); setFormOpen(true); }}>
                                <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(t)}>
                                <Archive /> Archive
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Teams"
                description="Teams, departments and business units. Roles can be scoped to a team."
                actions={
                    <Can permission="organizations.teams.manage">
                        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                            <Plus /> New team
                        </Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search teams…">
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by kind">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TeamKindFilterOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={teams.data?.data}
                rowKey={(t) => t.id}
                loading={teams.isFetching}
                error={teams.error}
                onRetry={() => teams.refetch()}
                pagination={teams.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => `/admin/teams/${t.id}`}
                empty={{
                    icon: UsersRound,
                    title: search ? "No teams match your search" : "No teams yet",
                    description: "Create teams to group members and give task ids a prefix.",
                    action: canManage && !search ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New team</Button> : undefined,
                }}
            />
            <TeamFormDialog open={formOpen} onOpenChange={setFormOpen} team={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Archived teams are hidden from pickers. Members keep their other teams."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() =>
                    archiving &&
                    archive.mutate(archiving.id, {
                        onSuccess: () => { toast({ title: "Team archived" }); setArchiving(null); },
                        onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }),
                    })
                }
            />
        </Page>
    );
}
