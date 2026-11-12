import { Download, LayoutGrid, List, Mail, Phone, Plus, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useDirectory, useDownloadEmployeesCsv, useEmployees } from "@/features/people/employees/hooks/use-employees";
import type { Employee } from "@/features/people/employees/interfaces/employees.interfaces";
import { AvailabilityFilterOptions, EmploymentStatusFilterOptions, EmploymentTypeFilterOptions, EmploymentTypeFormOptions } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { useSessionData } from "@/features/session/hooks/use-session";
import { AvailabilityBadge, EmploymentStatusBadge, PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

/**
 * /people — HR employee table (employees.employees.read, scoped) or the company directory cards (employees.directory.read).
 * @api GET /people/employees · GET /people/directory · GET /people/employees/export (employees.employees.export)
 * @states loading · empty · error / 403 · filters in the URL
 */
export default function EmployeesPage() {
    const p = usePermissions();
    const canTable = p.can("employees.employees.read");
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const view = canTable ? filters.view ?? "table" : "cards";
    const session = useSessionData();
    const navigate = useNavigate();
    const listParams = { ...params, view: undefined, order_by: "employee_number", order_direction: "asc" };
    const employees = useEmployees(listParams, view === "table");
    const directory = useDirectory({ ...params, view: undefined }, view === "cards");
    const download = useDownloadEmployeesCsv();

    const columns: DataTableColumn<Employee>[] = [
        { key: "name", header: "Employee", cell: (e) => <PersonCell name={e.name} photoUrl={e.photo_url} subtitle={e.job_title ?? e.employee_number} /> },
        { key: "number", header: "ID", cell: (e) => <code className="text-xs text-muted-foreground">{e.employee_number}</code>, hideBelow: "lg" },
        { key: "dept", header: "Department", cell: (e) => e.department?.name ?? <span className="text-muted-foreground">—</span>, hideBelow: "md" },
        { key: "manager", header: "Manager", cell: (e) => e.manager?.name ?? <span className="text-muted-foreground">—</span>, hideBelow: "xl" },
        { key: "type", header: "Type", cell: (e) => getDropdownOptionLabel(EmploymentTypeFormOptions, e.employment_type), hideBelow: "lg" },
        { key: "hire", header: "Hired", cell: (e) => <span className="tabular">{formatDate(e.hire_date)}</span>, hideBelow: "xl" },
        { key: "availability", header: "Availability", cell: (e) => <AvailabilityBadge status={e.availability_status} />, hideBelow: "md" },
        { key: "status", header: "Status", cell: (e) => <EmploymentStatusBadge status={e.employment_status} /> },
    ];

    const filterBar = (
        <>
            {view === "table" && (
                <>
                    <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                        <SelectContent>{EmploymentStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filters.employment_type ?? "all"} onValueChange={(v) => setFilter("employment_type", v)}>
                        <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Filter by employment type"><SelectValue /></SelectTrigger>
                        <SelectContent>{EmploymentTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </>
            )}
            <Select value={filters.availability ?? "all"} onValueChange={(v) => setFilter("availability", v)}>
                <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by availability"><SelectValue /></SelectTrigger>
                <SelectContent>{AvailabilityFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            {!!session?.branches.length && session.branches.length > 1 && (
                <Select value={filters.branch_id ?? "all"} onValueChange={(v) => setFilter("branch_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by branch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {session.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
        </>
    );

    return (
        <Page>
            <PageHeader
                title="Employees"
                description={canTable ? "HR records of everyone you can manage." : "Find colleagues across the company."}
                actions={
                    <>
                        {canTable && (
                            <Tabs value={view} onValueChange={(v) => setFilter("view", v === "table" ? null : v)}>
                                <TabsList className="h-8">
                                    <TabsTrigger value="table" aria-label="Table view"><List className="size-4" /></TabsTrigger>
                                    <TabsTrigger value="cards" aria-label="Directory view"><LayoutGrid className="size-4" /></TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                        <Can permission="employees.employees.export">
                            {view === "table" && (
                                <Button variant="outline" loading={download.isPending} onClick={() => download.mutate(listParams)}>
                                    <Download /> Export
                                </Button>
                            )}
                        </Can>
                        <Can permission="employees.employees.create">
                            <Button asChild><Link to={PeoplePaths.create}><Plus /> Add employee</Link></Button>
                        </Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, title, email…">{filterBar}</TableToolbar>
            {view === "table" ? (
                <DataTable
                    columns={columns}
                    data={employees.data?.data}
                    rowKey={(e) => e.id}
                    loading={employees.isFetching}
                    error={employees.error}
                    onRetry={() => employees.refetch()}
                    pagination={employees.data?.pagination}
                    onPageChange={setPage}
                    onRowClick={(e) => navigate(PeoplePaths.employee(e.id))}
                    empty={{ icon: Users, title: search ? "No employees match these filters" : "No employees yet", description: "Create HR records for your members to track leave, attendance and capacity." }}
                />
            ) : (
                <DirectoryGrid query={directory} onPage={setPage} canOpen={canTable} />
            )}
        </Page>
    );
}

function DirectoryGrid({ query, onPage, canOpen }: { query: ReturnType<typeof useDirectory>; onPage: (p: number) => void; canOpen: boolean }) {
    if (query.isLoading) return <ListSkeleton rows={6} />;
    if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
    const rows = query.data?.data ?? [];
    if (!rows.length) return <EmptyState icon={Users} title="Nobody found" description="Try another search or filter." />;
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((c) => {
                    const card = (
                        <div className="h-full rounded-lg border border-border bg-card p-4 transition-colors hover:border-ring/40">
                            <div className="flex items-start justify-between gap-2">
                                <PersonCell name={c.name} photoUrl={c.photo_url} subtitle={c.job_title} size="md" />
                                {c.availability_status && <AvailabilityBadge status={c.availability_status} />}
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                {c.department && <div className="truncate">{c.department.name}{c.primary_branch ? ` · ${c.primary_branch.name}` : ""}</div>}
                                {c.work_email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3.5 shrink-0" />{c.work_email}</div>}
                                {c.work_phone && <div className="flex items-center gap-1.5 truncate"><Phone className="size-3.5 shrink-0" />{c.work_phone}</div>}
                            </div>
                            {!!c.skills.length && (
                                <div className="mt-3 flex flex-wrap gap-1">{c.skills.map((s) => <span key={s.id} className="rounded-xs border border-border px-1.5 text-[11px] text-muted-foreground">{s.name}</span>)}</div>
                            )}
                        </div>
                    );
                    return canOpen || c.is_me ? <Link key={c.id} to={c.is_me ? PeoplePaths.me : PeoplePaths.employee(c.id)}>{card}</Link> : <div key={c.id}>{card}</div>;
                })}
            </div>
            {query.data && query.data.pagination.total_pages > 1 && <Pagination currentPage={query.data.pagination.page} totalPages={query.data.pagination.total_pages} onPageChange={onPage} />}
        </div>
    );
}
