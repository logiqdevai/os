import { Building2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalClientStatusFilterOptions, PortalClientStatusOptions, PortalClientStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalClients } from "@/features/client-portal/hooks/use-client-portal";
import type { PortalClientRow } from "@/features/client-portal/interfaces/client-portal.interfaces";
import { CLIENT_PORTAL_PATHS } from "../../client-portal-paths";

/**
 * Portal clients — /client-portal/clients (mockup 07-portal `clients`).
 * @perm portal.users.read | portal.users.manage | portal.settings.manage
 */
export default function PortalClientsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const clients = usePortalClients(params);
    const columns: DataTableColumn<PortalClientRow>[] = [
        { key: "name", header: "Client", cell: (c) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{c.name}</div><div className="truncate text-xs text-muted-foreground">{c.website ?? c.email ?? ""}</div></div> },
        { key: "status", header: "Portal", cell: (c) => <Badge variant={PortalClientStatusTone[c.portal_status]}>{getDropdownOptionLabel(PortalClientStatusOptions, c.portal_status)}</Badge> },
        { key: "users", header: "Users", cell: (c) => <span className="tabular">{c.users}{c.pending_invitations ? <span className="text-xs text-muted-foreground"> +{c.pending_invitations} invited</span> : null}</span>, hideBelow: "sm" },
        { key: "active", header: "Last active", cell: (c) => <span className="text-xs text-muted-foreground">{c.last_active_at ? formatRelative(c.last_active_at) : "Never"}</span>, hideBelow: "md" },
    ];
    return (
        <Page>
            <PageHeader title="Clients" description="Customers from the CRM and whether they can use the portal." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search clients…">
                <Select value={filters.portal ?? "all"} onValueChange={(v) => setFilter("portal", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Portal status"><SelectValue /></SelectTrigger>
                    <SelectContent>{PortalClientStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={clients.data?.data}
                rowKey={(c) => c.id}
                loading={clients.isFetching}
                error={clients.error}
                onRetry={() => clients.refetch()}
                pagination={clients.data?.pagination}
                onPageChange={setPage}
                rowHref={(c) => CLIENT_PORTAL_PATHS.client(c.id)}
                empty={{ icon: Building2, title: search ? "No clients match" : "No customers yet", description: "Companies of type Customer in the CRM appear here." }}
            />
        </Page>
    );
}
