import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Handshake, LayoutGrid, List, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/format";
import { DealStatusFilterOptions } from "@/config/constants/dropdowns/crm/deal-status-form.options";
import { OwnerFilterOptions } from "@/config/constants/dropdowns/crm/crm-filter.options";
import { useDealBoard, useDeals, useExportDeals } from "@/features/crm/deals/hooks/use-deals";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import type { Deal } from "@/features/crm/deals/interfaces/deals.interfaces";
import { CrmPaths } from "../../crm-paths";
import { DealStatusBadge, MemberChip, Money, RecordLink, TagList, ToneBadge } from "../../components/crm-ui";
import { ExportButton } from "../../components/crm-actions";
import { DealFormDialog, type DealFormDefaults } from "../../components/deal-form-dialog";
import { DealBoard } from "./components/deal-board";

/**
 * Deals — board and list (mockup `deals`, `deals-list`).
 * @route /crm/deals?view=board|list&pipeline_id=&owner=&status=&q= · /crm/deals/new opens the create dialog
 * @perm VIEW crm.deals.read · create crm.deals.create · drag crm.deals.change_stage · export crm.deals.export · money crm.financials.read
 * @api GET /crm/pipelines · GET /crm/deals/board · GET /crm/deals · GET /crm/deals/export
 */
export default function DealsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const view = filters.view === "list" ? "list" : "board";
    const pipelines = usePipelines();
    const pipelineId = filters.pipeline_id ?? pipelines.data?.find((p) => p.is_default)?.id ?? pipelines.data?.[0]?.id;
    const pipeline = pipelines.data?.find((p) => p.id === pipelineId);
    const boardParams = { pipeline_id: pipelineId, owner: filters.owner, search: params.search };
    const board = useDealBoard(boardParams, view === "board" && !!pipelineId);
    const { view: _v, ...listFilters } = params;
    const list = useDeals({ ...listFilters, pipeline_id: pipelineId }, view === "list" && !!pipelineId);
    const exportDeals = useExportDeals();
    const canCreate = usePermission("crm.deals.create");

    const [createOpen, setCreateOpen] = useState(false);
    const [defaults, setDefaults] = useState<DealFormDefaults | undefined>();
    const isNewRoute = location.pathname === CrmPaths.deal_new;
    useEffect(() => {
        if (isNewRoute && canCreate) { setDefaults(undefined); setCreateOpen(true); }
    }, [isNewRoute, canCreate]);
    const closeCreate = (o: boolean) => {
        setCreateOpen(o);
        if (!o && isNewRoute) navigate(CrmPaths.deals, { replace: true });
    };
    const openCreate = (stage_id?: string) => { setDefaults({ pipeline_id: pipelineId, stage_id }); setCreateOpen(true); };

    const columns: DataTableColumn<Deal>[] = [
        {
            key: "name",
            header: "Deal",
            cell: (d) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{d.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.company ? <RecordLink to={CrmPaths.company(d.company.id)} className="text-muted-foreground">{d.company.name}</RecordLink> : "No company"}</div>
                </div>
            ),
        },
        { key: "stage", header: "Stage", cell: (d) => <ToneBadge tone={d.stage.color}>{d.stage.name}</ToneBadge>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (d) => <DealStatusBadge status={d.status} />, hideBelow: "lg" },
        { key: "value", header: "Value", cell: (d) => <Money value={d.value} currency={d.currency} />, className: "text-right", headerClassName: "text-right" },
        { key: "close", header: "Close date", cell: (d) => formatDate(d.expected_close_date), hideBelow: "md" },
        { key: "owner", header: "Owner", cell: (d) => <MemberChip member={d.owner} />, hideBelow: "lg" },
        { key: "tags", header: "Tags", cell: (d) => <TagList tags={d.tags} />, hideBelow: "xl" },
    ];

    return (
        <Page>
            <PageHeader
                title="Deals"
                description={pipeline ? `${pipeline.name} pipeline` : "Your sales pipeline"}
                actions={
                    <>
                        <ExportButton permission="crm.deals.export" mutation={exportDeals} params={{ ...listFilters, pipeline_id: pipelineId }} />
                        <Can permission="crm.deals.create">
                            <Button onClick={() => openCreate()}><Plus /> New deal</Button>
                        </Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search deals or companies…">
                {(pipelines.data?.length ?? 0) > 1 && (
                    <Select value={pipelineId ?? ""} onValueChange={(v) => setFilter("pipeline_id", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Pipeline"><SelectValue placeholder="Pipeline" /></SelectTrigger>
                        <SelectContent>{pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}
                <Select value={filters.owner ?? "all"} onValueChange={(v) => setFilter("owner", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
                    <SelectContent>{OwnerFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                {view === "list" && (
                    <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                        <SelectContent>{DealStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                )}
                <Tabs value={view} onValueChange={(v) => setFilter("view", v === "board" ? null : v)}>
                    <TabsList className="h-8">
                        <TabsTrigger value="board" className="h-6 px-2" aria-label="Board view"><LayoutGrid className="size-4" /></TabsTrigger>
                        <TabsTrigger value="list" className="h-6 px-2" aria-label="List view"><List className="size-4" /></TabsTrigger>
                    </TabsList>
                </Tabs>
            </TableToolbar>

            {view === "board" ? (
                <>
                    {board.data && (
                        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                            <span><span className="font-medium text-foreground tabular">{board.data.totals.open_count}</span> open deals</span>
                            <span>Pipeline <Money value={board.data.totals.open_value} currency={board.data.pipeline.currency} className="font-medium text-foreground" /></span>
                            <span>Weighted <Money value={board.data.totals.weighted_value} currency={board.data.pipeline.currency} className="font-medium text-foreground" /></span>
                        </div>
                    )}
                    <DealBoard board={board.data} loading={board.isFetching || pipelines.isPending} error={board.error ?? pipelines.error} onRetry={() => { pipelines.refetch(); board.refetch(); }} onCreate={openCreate} />
                </>
            ) : (
                <>
                    {list.data && (
                        <div className="mb-2 text-[13px] text-muted-foreground">
                            {list.data.summary.count} deals · total <Money value={list.data.summary.total_value} currency={pipeline?.currency} className="font-medium text-foreground" />
                        </div>
                    )}
                    <DataTable
                        columns={columns}
                        data={list.data?.data}
                        rowKey={(d) => d.id}
                        loading={list.isFetching || pipelines.isPending}
                        error={list.error ?? pipelines.error}
                        onRetry={() => list.refetch()}
                        pagination={list.data?.pagination}
                        onPageChange={setPage}
                        rowHref={(d) => CrmPaths.deal(d.id)}
                        empty={{
                            icon: Handshake,
                            title: search ? "No deals match your search" : "No deals yet",
                            description: "Deals track opportunities from first contact to signature.",
                            action: canCreate && !search ? <Button size="sm" onClick={() => openCreate()}><Plus /> New deal</Button> : undefined,
                        }}
                    />
                </>
            )}
            <DealFormDialog open={createOpen} onOpenChange={closeCreate} defaults={defaults} />
        </Page>
    );
}
