import { useState } from "react";
import { Inbox, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/format";
import { LeadStateFilterOptions, OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useExportLeads, useLeads } from "@/features/crm/leads/hooks/use-leads";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import type { Lead } from "@/features/crm/leads/interfaces/leads.interfaces";
import { CrmPaths } from "../../crm-paths";
import { MemberChip, Money, TagList, ToneBadge } from "../../components/crm-ui";
import { ExportButton } from "../../components/crm-actions";
import { LeadFormDialog } from "../../components/lead-form-dialog";
import { SavedViewsMenu, useHiddenColumns } from "../../components/saved-views-menu";
import { BulkActionBar, selectionColumn, useCanBulk, useRowSelection } from "../../components/bulk-actions";

/**
 * Leads (mockup `leads`).
 * @route /crm/leads?state=open|converted|lost|all&status_id=&lead_source_id=&owner=&q=
 * @perm VIEW crm.leads.read · create crm.leads.create · export crm.leads.export · value crm.financials.read
 * @api GET /crm/leads · GET /crm/settings · GET /crm/leads/export
 */
export default function LeadsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 });
    const hidden = useHiddenColumns();
    const sel = useRowSelection(JSON.stringify(params));
    const canBulk = useCanBulk("CRM_LEAD");
    const leads = useLeads(params);
    const settings = useCrmSettings();
    const exportLeads = useExportLeads();
    const canCreate = usePermission("crm.leads.create");
    const [creating, setCreating] = useState(false);
    const state = filters.state ?? "open";

    const columns: DataTableColumn<Lead>[] = [
        {
            key: "name",
            header: "Lead",
            cell: (l) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{l.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{[l.company?.name ?? l.company_name, l.contact_name, l.email].filter(Boolean).join(" · ") || "—"}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (l) => (l.status ? <ToneBadge tone={l.status.color}>{l.status.name}</ToneBadge> : "—") },
        { key: "source", header: "Source", cell: (l) => l.lead_source?.name ?? <span className="text-ash">—</span>, hideBelow: "md" },
        { key: "score", header: "Score", cell: (l) => <span className="tabular">{l.manual_score ?? l.lead_score ?? "—"}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "value", header: "Est. value", cell: (l) => (l.estimated_value === null && !l.financials_hidden ? <span className="text-ash">—</span> : <Money value={l.estimated_value} currency={l.currency} />), hideBelow: "sm", className: "text-right", headerClassName: "text-right" },
        { key: "follow", header: "Follow-up", cell: (l) => formatDate(l.next_follow_up_at), hideBelow: "lg" },
        { key: "owner", header: "Owner", cell: (l) => <MemberChip member={l.owner} />, hideBelow: "md" },
        { key: "tags", header: "Tags", cell: (l) => <TagList tags={l.tags} />, hideBelow: "xl" },
    ];

    const visibleColumns = columns.filter((c) => !hidden.has(c.key));
    const tableColumns = canBulk ? [selectionColumn(sel, leads.data?.data), ...visibleColumns] : visibleColumns;

    return (
        <Page>
            <PageHeader
                title="Leads"
                description="Prospects before qualification. Convert them to a company, contact and deal."
                actions={
                    <>
                        <ExportButton permission="crm.leads.export" mutation={exportLeads} params={params} />
                        <Can permission="crm.leads.create"><Button onClick={() => setCreating(true)}><Plus /> New lead</Button></Can>
                    </>
                }
            />
            <Tabs value={state} onValueChange={(v) => setFilter("state", v === "open" ? null : v)} className="mb-3">
                <TabsList>{LeadStateFilterOptions.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}</TabsList>
            </Tabs>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search leads…">
                <SavedViewsMenu entityType="CRM_LEAD" columns={columns.filter((c) => c.key !== "name").map((c) => ({ key: c.key, label: String(c.header) }))} onSearch={setSearch} />
                <Select value={filters.status_id ?? "all"} onValueChange={(v) => setFilter("status_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {settings.data?.lead_statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.lead_source_id ?? "all"} onValueChange={(v) => setFilter("lead_source_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by source"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        {settings.data?.lead_sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                    <SelectContent>{OwnerFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <BulkActionBar entity="CRM_LEAD" sel={sel} archived={filters.archived === "true"} />
            <DataTable
                columns={tableColumns}
                data={leads.data?.data}
                rowKey={(l) => l.id}
                loading={leads.isFetching}
                error={leads.error}
                onRetry={() => leads.refetch()}
                pagination={leads.data?.pagination}
                onPageChange={setPage}
                rowHref={(l) => CrmPaths.lead(l.id)}
                empty={{
                    icon: Inbox,
                    title: search ? "No leads match your search" : state === "open" ? "No open leads" : "Nothing here",
                    description: "Leads come from your website, referrals, events and outreach.",
                    action: canCreate && !search && state === "open" ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New lead</Button> : undefined,
                }}
            />
            <LeadFormDialog open={creating} onOpenChange={setCreating} />
        </Page>
    );
}
