import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useServiceAccounts } from "@/features/admin/service-accounts/hooks/use-service-accounts";
import type { ServiceAccount } from "@/features/admin/service-accounts/interfaces/service-accounts.interfaces";
import { ServiceAccountStatusFilterOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { formatDate, personName } from "@/lib/format";
import { ServiceAccountStatusBadge } from "../../components/status-badges";
import { ServiceAccountFormDialog } from "./components/service-account-form-dialog";

/**
 * Service accounts — /admin/service-accounts?status=
 * @perm organizations.service_accounts.manage
 * @api GET /service-accounts · POST /service-accounts
 */
export default function ServiceAccountsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const accounts = useServiceAccounts(params);
    const [formOpen, setFormOpen] = useState(false);

    const columns: DataTableColumn<ServiceAccount>[] = [
        {
            key: "name",
            header: "Service account",
            cell: (a) => (
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid size-8 flex-none place-items-center rounded-md border border-border bg-secondary text-muted-foreground"><Bot className="size-4" /></div>
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{a.name}</div>
                        {a.purpose && <div className="truncate text-xs text-muted-foreground">{a.purpose}</div>}
                    </div>
                </div>
            ),
        },
        { key: "roles", header: "Roles", hideBelow: "md", cell: (a) => (a.role_assignments.length ? <div className="flex flex-wrap gap-1">{a.role_assignments.map((r) => <Badge key={r.id} variant="secondary">{r.role.name}</Badge>)}</div> : <span className="text-xs text-warning">No role</span>) },
        { key: "owner", header: "Owner", hideBelow: "lg", cell: (a) => <span className="text-muted-foreground">{a.owner ? personName(a.owner.user) : "—"}</span> },
        { key: "keys", header: "Keys", hideBelow: "sm", className: "text-right tabular", headerClassName: "text-right", cell: (a) => a._count?.api_keys ?? 0 },
        { key: "expires", header: "Expires", hideBelow: "xl", cell: (a) => <span className="text-muted-foreground">{a.expires_at ? formatDate(a.expires_at) : "Never"}</span> },
        { key: "status", header: "Status", cell: (a) => <ServiceAccountStatusBadge status={a.status} /> },
    ];

    return (
        <Page>
            <PageHeader
                title="Service accounts"
                description="Identities for integrations, automations and AI agents. They are not people and never appear in HR data."
                actions={<Button onClick={() => setFormOpen(true)}><Plus /> New service account</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or purpose…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ServiceAccountStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={accounts.data?.data}
                rowKey={(a) => a.id}
                loading={accounts.isFetching}
                error={accounts.error}
                onRetry={() => accounts.refetch()}
                pagination={accounts.data?.pagination}
                onPageChange={setPage}
                rowHref={(a) => `/admin/service-accounts/${a.id}`}
                empty={{ icon: Bot, title: "No service accounts", description: "Create one for each integration or agent so its access can be limited and revoked on its own.", action: <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New service account</Button> }}
            />
            <ServiceAccountFormDialog open={formOpen} onOpenChange={setFormOpen} />
        </Page>
    );
}
