import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CompanyTypeFilterOptions, CompanyTypeFormOptions } from "@/config/constants/dropdowns/crm/company-type-form.options";
import { ArchivedFilterOptions, OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useCompanies, useExportCompanies } from "@/features/crm/companies/hooks/use-companies";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import type { Company } from "@/features/crm/companies/interfaces/companies.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip, Money, TagList } from "../../components/crm-ui";
import { ExportButton } from "../../components/crm-actions";
import { CompanyFormDialog } from "../../components/company-form-dialog";

/**
 * Companies (mockup `companies`).
 * @route /crm/companies?type=&lifecycle_stage_id=&owner=&archived=&q=
 * @perm VIEW crm.companies.read · create crm.companies.create · export crm.companies.export · open value crm.financials.read
 * @api GET /crm/companies · GET /crm/companies/export
 */
export default function CompaniesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const companies = useCompanies(params);
    const settings = useCrmSettings();
    const exportCompanies = useExportCompanies();
    const canCreate = usePermission("crm.companies.create");
    const [creating, setCreating] = useState(false);

    const columns: DataTableColumn<Company>[] = [
        {
            key: "name",
            header: "Company",
            cell: (c) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{[c.website, c.industry].filter(Boolean).join(" · ") || "—"}</div>
                </div>
            ),
        },
        { key: "type", header: "Type", cell: (c) => <Badge variant={c.type === "CUSTOMER" ? "success" : c.type === "PROSPECT" ? "info" : "neutral"}>{getDropdownOptionLabel(CompanyTypeFormOptions, c.type)}</Badge>, hideBelow: "sm" },
        { key: "lifecycle", header: "Lifecycle", cell: (c) => c.lifecycle_stage?.name ?? <span className="text-ash">—</span>, hideBelow: "lg" },
        { key: "deals", header: "Open deals", cell: (c) => <span className="tabular">{c._count?.deals ?? 0}{c.open_deals_value ? <span className="text-muted-foreground"> · <Money value={c.open_deals_value} currency={c.currency} compact /></span> : null}</span>, hideBelow: "md" },
        { key: "contacts", header: "Contacts", cell: (c) => <span className="tabular">{c._count?.contacts ?? 0}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "owner", header: "Owner", cell: (c) => <MemberChip member={c.owner} />, hideBelow: "md" },
        { key: "activity", header: "Last activity", cell: (c) => (c.last_activity_at ? formatRelative(c.last_activity_at) : <span className="text-ash">—</span>), hideBelow: "xl" },
        { key: "tags", header: "Tags", cell: (c) => <TagList tags={c.tags} />, hideBelow: "xl" },
    ];

    return (
        <Page>
            <PageHeader
                title="Companies"
                description="Prospects, customers, partners and vendors."
                actions={
                    <>
                        <ExportButton permission="crm.companies.export" mutation={exportCompanies} params={params} />
                        <Can permission="crm.companies.create"><Button onClick={() => setCreating(true)}><Plus /> New company</Button></Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, website, email…">
                <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                    <SelectContent>{CompanyTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.lifecycle_stage_id ?? "all"} onValueChange={(v) => setFilter("lifecycle_stage_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by lifecycle stage"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All lifecycle stages</SelectItem>
                        {settings.data?.lifecycle_stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                    <SelectContent>{OwnerFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.archived === "true" ? "archived" : "active"} onValueChange={(v) => setFilter("archived", v === "archived" ? "true" : null)}>
                    <SelectTrigger className="h-8 w-full sm:w-28" aria-label="Archived"><SelectValue /></SelectTrigger>
                    <SelectContent>{ArchivedFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={companies.data?.data}
                rowKey={(c) => c.id}
                loading={companies.isFetching}
                error={companies.error}
                onRetry={() => companies.refetch()}
                pagination={companies.data?.pagination}
                onPageChange={setPage}
                rowHref={(c) => CrmPaths.company(c.id)}
                empty={{
                    icon: Building2,
                    title: search ? "No companies match your search" : "No companies yet",
                    description: "Companies hold contacts, deals and the full customer history.",
                    action: canCreate && !search ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New company</Button> : undefined,
                }}
            />
            <CompanyFormDialog open={creating} onOpenChange={setCreating} />
        </Page>
    );
}
