import { Link } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFormKindFormOptions, CustomFormStatusFilterOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useAssignedForms, useForms } from "@/features/docs/hooks/use-docs";
import type { CustomForm } from "@/features/docs/interfaces/docs.interfaces";
import { DocsStatusBadge } from "../../components/docs-ui";

/**
 * /docs/forms — custom forms (15 §8) + forms assigned to me
 * @perm list docs.forms.read · create docs.forms.create · assigned to me: any member
 * @api GET /docs/forms · GET /docs/forms/assigned
 */
export default function FormsPage() {
    const canRead = usePermission("docs.forms.read");
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const forms = useForms(canRead ? params : { limit: 1 });
    const assigned = useAssignedForms();

    const columns: DataTableColumn<CustomForm>[] = [
        { key: "name", header: "Form", cell: (f) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{f.name}</div><div className="truncate text-xs text-muted-foreground">{getDropdownOptionLabel(CustomFormKindFormOptions, f.kind)}{f.is_anonymous ? " · anonymous / public" : ""}</div></div> },
        { key: "status", header: "Status", cell: (f) => <DocsStatusBadge status={f.status} /> },
        { key: "responses", header: "Responses", cell: (f) => <span className="tabular">{f._count?.submissions ?? 0}</span>, hideBelow: "sm" },
        { key: "closes", header: "Closes", cell: (f) => (f.closes_at ? formatDate(f.closes_at) : "—"), hideBelow: "md" },
        { key: "updated", header: "Updated", cell: (f) => formatRelative(f.updated_at), hideBelow: "lg" },
    ];

    return (
        <Page>
            <PageHeader title="Forms" description="Surveys, check-ins, requests and incident reports — with versions, assignments and reviewed responses." actions={<Can permission="docs.forms.create"><Button asChild><Link to="/docs/forms/new"><Plus /> New form</Link></Button></Can>} />
            {!!assigned.data?.length && (
                <Section title="Waiting for you" className="mb-6">
                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                        {assigned.data.map((a) => (
                            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-foreground">{a.assignment.form.name}</div><div className="text-xs text-muted-foreground">{a.assignment.due_at ? `Due ${formatDate(a.assignment.due_at)}` : "No due date"}</div></div>
                                {a.status === "OVERDUE" && <Badge variant="danger">Overdue</Badge>}
                                <Button size="sm" asChild><Link to={`/docs/forms/${a.assignment.form.id}/fill`}>Fill in</Link></Button>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
            {canRead && (
                <>
                    <TableToolbar search={search} onSearch={setSearch} placeholder="Search forms…">
                        <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                            <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                            <SelectContent>{CustomFormStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={columns} data={forms.data?.data} rowKey={(f) => f.id} loading={forms.isFetching} error={forms.error} onRetry={() => forms.refetch()} pagination={forms.data?.pagination} onPageChange={setPage} rowHref={(f) => `/docs/forms/${f.id}`} empty={{ icon: ClipboardList, title: "No forms yet", description: "Build a form, publish it, then assign it or share its public link." }} />
                </>
            )}
        </Page>
    );
}
