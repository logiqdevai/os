import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { useRaid } from "@/features/projects/hooks/use-projects";
import type { Decision, Issue, Risk } from "@/features/projects/interfaces/projects.interfaces";
import { IssueStatusFormOptions, RaidKindOptions, RiskStatusFormOptions, SeverityFilterOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProjectDot, SeverityBadge } from "../../components/project-badges";

type Row = (Risk | Issue | Decision) & { project?: { id: string; name: string; color: string | null } };

/**
 * /projects/raid?kind=risks|issues|decisions — RAID log across projects in scope.
 * @perm VIEW projects.projects.read · edit in the project (risks.manage / issues.manage)
 * @api GET /projects/raid
 */
export default function RaidPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 50 });
    const kind = (filters.kind as "risks" | "issues" | "decisions") ?? "risks";
    const query: Record<string, unknown> = { ...params, kind, open: filters.all ? undefined : kind !== "decisions" ? true : undefined };
    delete query.all;
    const raid = useRaid<Row>(query);

    const project = (r: Row) => r.project && (
        <Link to={`/projects/${r.project.id}?tab=raid`} className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"><ProjectDot color={r.project.color} />{r.project.name}</Link>
    );
    const columns: DataTableColumn<Row>[] = [
        { key: "title", header: kind === "risks" ? "Risk" : kind === "issues" ? "Issue" : "Decision", cell: (r) => <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-medium text-foreground">{r.title}</span>{"kind" in r && r.kind === "BLOCKER" && <Badge variant="danger">Blocker</Badge>}</div>{project(r)}</div> },
        ...(kind !== "decisions" ? [
            { key: "severity", header: "Severity", cell: (r: Row) => ("severity" in r ? <SeverityBadge severity={r.severity} /> : null) },
            {
                key: "status",
                header: "Status",
                hideBelow: "sm" as const,
                cell: (r: Row) => ("status" in r ? <Badge>{kind === "risks" ? getDropdownOptionLabel(RiskStatusFormOptions, r.status) : getDropdownOptionLabel(IssueStatusFormOptions, r.status)}</Badge> : null),
            },
            {
                key: "due",
                header: "Due",
                hideBelow: "md" as const,
                cell: (r: Row) => {
                    const due = "due_date" in r ? r.due_date : "target_resolution" in r ? r.target_resolution : null;
                    return <span className={cn(due && new Date(due) < new Date() && "text-danger")}>{formatDate(due)}</span>;
                },
            },
        ] : [
            { key: "decided", header: "Decided", cell: (r: Row) => formatDate("decided_at" in r ? r.decided_at : null) },
            { key: "option", header: "Chosen", hideBelow: "md" as const, cell: (r: Row) => ("selected_option" in r ? r.selected_option ?? "—" : "—") },
        ]),
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (r) => <MemberAvatar person={r.owner?.user} size="xs" emptyLabel="No owner" /> },
    ];

    return (
        <Page>
            <PageHeader title="RAID log" description="Risks, issues and decisions across every project you can see." />
            <div className="mb-3 flex rounded-md border border-border p-0.5 sm:w-max" role="tablist" aria-label="RAID section">
                {RaidKindOptions.map((o) => (
                    <button key={o.id} role="tab" aria-selected={kind === o.id} onClick={() => setFilter("kind", o.id === "risks" ? null : o.id)} className={cn("flex-1 rounded px-3 py-1 text-[13px] transition-colors sm:flex-none", kind === o.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {o.label}
                    </button>
                ))}
            </div>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search…">
                {kind !== "decisions" && (
                    <>
                        <Select value={filters.severity ?? "all"} onValueChange={(v) => setFilter("severity", v)}>
                            <SelectTrigger className="h-8 w-36" aria-label="Filter by severity"><SelectValue /></SelectTrigger>
                            <SelectContent>{SeverityFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant={filters.all ? "secondary" : "ghost"} aria-pressed={!!filters.all} onClick={() => setFilter("all", filters.all ? null : "true")}>Include closed</Button>
                    </>
                )}
                <Button size="sm" variant={filters.owner_id ? "secondary" : "ghost"} aria-pressed={!!filters.owner_id} onClick={() => setFilter("owner_id", filters.owner_id ? null : "me")}>Mine</Button>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={raid.data?.data}
                rowKey={(r) => r.id}
                loading={raid.isFetching}
                error={raid.error}
                onRetry={() => raid.refetch()}
                pagination={raid.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/projects/${r.project_id}?tab=raid`}
                empty={{ icon: ShieldAlert, title: kind === "risks" ? "No open risks" : kind === "issues" ? "No open issues" : "No decisions recorded" }}
            />
        </Page>
    );
}
