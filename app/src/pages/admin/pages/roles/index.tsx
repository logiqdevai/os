import { useState } from "react";
import { Copy, MoreHorizontal, Plus, Shield } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useRoles } from "@/features/admin/roles/hooks/use-roles";
import type { Role } from "@/features/admin/roles/interfaces/roles.interfaces";
import { RoleSourceFilterOptions, RoleStatusFilterOptions, RoleTypeFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { RoleStatusBadge } from "../../components/status-badges";
import { CreateRoleDialog } from "./components/create-role-dialog";

/**
 * Roles — /admin/roles?source=&status=&q=
 * @perm VIEW users.roles.read · create / clone users.roles.manage
 * @api GET /roles · POST /roles
 */
export default function RolesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const roles = useRoles({ ...params, order_by: "name", order_direction: "asc" });
    const canManage = usePermission("users.roles.manage");
    const [create, setCreate] = useState<{ open: boolean; templateId?: string }>({ open: false });

    const columns: DataTableColumn<Role>[] = [
        {
            key: "name",
            header: "Role",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">{r.name}</span>
                        {r.is_template ? <Badge variant="secondary">Template</Badge> : <Badge variant="info">Custom</Badge>}
                    </div>
                    {r.description && <div className="truncate text-xs text-muted-foreground">{r.description}</div>}
                </div>
            ),
        },
        { key: "type", header: "For", hideBelow: "md", cell: (r) => getDropdownOptionLabel(RoleTypeFormOptions, r.type) },
        { key: "perms", header: "Permissions", hideBelow: "sm", className: "text-right tabular", headerClassName: "text-right", cell: (r) => r._count?.permissions ?? 0 },
        { key: "members", header: "Assigned", hideBelow: "lg", className: "text-right tabular", headerClassName: "text-right", cell: (r) => r._count?.assignments ?? 0 },
        { key: "status", header: "Status", cell: (r) => <RoleStatusBadge status={r.status} /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (r) =>
                canManage && r.type !== "CUSTOMER_PORTAL" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setCreate({ open: true, templateId: r.id })}><Copy /> Clone as a custom role</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Roles"
                description="Bundles of permissions. System templates are read-only; clone one to make it your own."
                actions={<Can permission="users.roles.manage"><Button onClick={() => setCreate({ open: true })}><Plus /> New role</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search roles…">
                <Select value={filters.source ?? "all"} onValueChange={(v) => setFilter("source", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by source"><SelectValue /></SelectTrigger>
                    <SelectContent>{RoleSourceFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RoleStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={roles.data?.data}
                rowKey={(r) => r.id}
                loading={roles.isFetching}
                error={roles.error}
                onRetry={() => roles.refetch()}
                pagination={roles.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/admin/roles/${r.id}`}
                empty={{ icon: Shield, title: "No roles match", description: "Clear the filters to see every role." }}
            />
            <CreateRoleDialog open={create.open} templateId={create.templateId} onOpenChange={(o) => setCreate((c) => ({ ...c, open: o }))} />
        </Page>
    );
}
