import { Link } from "react-router-dom";
import { Flag } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useMilestonesAcross } from "@/features/projects/hooks/use-projects";
import type { Milestone } from "@/features/projects/interfaces/projects.interfaces";
import { ProjectItemStatusFilterOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ItemStatusBadge, ProjectDot } from "../../components/project-badges";

/**
 * /projects/milestones — milestones across projects in scope.
 * @perm VIEW projects.projects.read · @api GET /projects/milestones
 * @states loading · empty · empty-filtered · error
 */
export default function MilestonesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const query: Record<string, unknown> = { ...params };
    if (!filters.status) query.status = "PLANNED,IN_PROGRESS,AT_RISK";
    else if (filters.status === "all") delete query.status;
    const milestones = useMilestonesAcross(query);
    const filtered = !!search || !!filters.status || !!filters.overdue || !!filters.billing;

    const columns: DataTableColumn<Milestone>[] = [
        {
            key: "name",
            header: "Milestone",
            cell: (m) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{m.name}</div>
                    <Link to={`/projects/${m.project?.id}?tab=milestones`} className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground">
                        <ProjectDot color={m.project?.color} />{m.project?.name}
                    </Link>
                </div>
            ),
        },
        { key: "customer", header: "Customer", hideBelow: "lg", cell: (m) => m.project?.company?.name ?? <span className="text-ash">Internal</span> },
        { key: "flags", header: "", hideBelow: "md", cell: (m) => <div className="flex gap-1">{m.customer_visible && <Badge variant="info">Customer</Badge>}{m.is_billing_milestone && <Badge variant="violet">Billing</Badge>}</div> },
        { key: "status", header: "Status", hideBelow: "sm", cell: (m) => <ItemStatusBadge status={m.status} /> },
        { key: "date", header: "Planned", cell: (m) => <span className={cn("whitespace-nowrap tabular", m.overdue && "text-danger")}>{formatDate(m.planned_date)}</span> },
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (m) => <MemberAvatar person={m.owner?.user} size="xs" emptyLabel="No owner" /> },
    ];

    return (
        <Page>
            <PageHeader title="Milestones" description="Upcoming and overdue checkpoints across your projects." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search milestones or projects…">
                <Select value={filters.status ?? "open"} onValueChange={(v) => setFilter("status", v === "open" ? null : v)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        {ProjectItemStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button size="sm" variant={filters.overdue ? "secondary" : "ghost"} aria-pressed={!!filters.overdue} onClick={() => setFilter("overdue", filters.overdue ? null : "true")}>Overdue</Button>
                <Button size="sm" variant={filters.billing ? "secondary" : "ghost"} aria-pressed={!!filters.billing} onClick={() => setFilter("billing", filters.billing ? null : "true")}>Billing</Button>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={milestones.data?.data}
                rowKey={(m) => m.id}
                loading={milestones.isFetching}
                error={milestones.error}
                onRetry={() => milestones.refetch()}
                pagination={milestones.data?.pagination}
                onPageChange={setPage}
                rowHref={(m) => `/projects/${m.project_id}?tab=milestones`}
                empty={{ icon: Flag, title: filtered ? "No milestones match" : "No open milestones", description: "Milestones are planned inside each project." }}
            />
        </Page>
    );
}
