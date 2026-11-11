import { List, Lock } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useCatalog } from "@/features/admin/permissions/hooks/use-permissions-admin";
import type { CatalogPermission } from "@/features/admin/permissions/interfaces/permissions.interfaces";
import { ModuleKeyFilterOptions, ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";

/**
 * Permission catalog — /admin/permissions?module=&q=  (read-only; keys are defined in code)
 * @perm VIEW users.permissions.read
 * @api GET /permissions
 */
export default function PermissionCatalogPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 100 });
    const catalog = useCatalog(params);

    const columns: DataTableColumn<CatalogPermission>[] = [
        {
            key: "key",
            header: "Permission",
            cell: (p) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <code className="truncate text-[12.5px] text-foreground">{p.key}</code>
                        {p.is_sensitive && <Lock className="size-3 flex-none text-warning" aria-label="Sensitive" />}
                    </div>
                    {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                </div>
            ),
        },
        { key: "module", header: "Module", hideBelow: "sm", cell: (p) => <Badge>{getDropdownOptionLabel(ModuleKeyOptions, p.module)}</Badge> },
        { key: "flags", header: "Flags", hideBelow: "md", cell: (p) => <div className="flex gap-1">{p.is_sensitive && <Badge variant="warning">Sensitive</Badge>}{p.is_field_level && <Badge variant="violet">Field-level</Badge>}</div> },
        { key: "roles", header: "Roles using it", hideBelow: "lg", className: "text-right tabular", headerClassName: "text-right", cell: (p) => p.roles_using },
        { key: "held", header: "You", hideBelow: "md", cell: (p) => (p.held ? <Badge variant="success">Held</Badge> : <span className="text-ash">—</span>) },
    ];

    return (
        <Page>
            <PageHeader title="Permission catalog" description="Every permission the product checks. Roles combine these; organizations cannot add new keys." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search keys or descriptions…">
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>{ModuleKeyFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.sensitive ?? "all"} onValueChange={(v) => setFilter("sensitive", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter sensitive"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All keys</SelectItem>
                        <SelectItem value="true">Sensitive only</SelectItem>
                    </SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={catalog.data?.data}
                rowKey={(p) => p.key}
                loading={catalog.isFetching}
                error={catalog.error}
                onRetry={() => catalog.refetch()}
                pagination={catalog.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: List, title: "No permission matches", description: "Try another module or search term." }}
            />
        </Page>
    );
}
