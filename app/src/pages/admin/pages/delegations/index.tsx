import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Forward, MoreHorizontal, Plus, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { useDelegations, useRevokeDelegation } from "@/features/admin/delegations/hooks/use-delegations";
import type { Delegation } from "@/features/admin/delegations/interfaces/delegations.interfaces";
import { DelegationStatusFilterOptions, DelegationStatusFormOptions } from "@/config/constants/dropdowns/admin/delegation-form.options";
import { ScopeTypeFormOptions } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../components/person-cell";
import { useScopeLabel } from "../../components/use-scope-label";
import { DelegationDialog } from "./components/delegation-dialog";

const tone: Record<string, BadgeVariant> = { ACTIVE: "success", SCHEDULED: "info", EXPIRED: "neutral", REVOKED: "neutral" };

/**
 * Delegations — /admin/delegations?status=   (+ /admin/delegations/new opens the form)   mockup 01-admin `delegations`, spec §94
 * @perm VIEW + create/revoke users.delegations.manage (organization-wide holders see all; others their own)
 * @api GET /delegations · POST /delegations · POST /delegations/:id/revoke
 * @states loading · empty · error · no-access
 */
export default function DelegationsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const delegations = useDelegations(params);
    const revoke = useRevokeDelegation();
    const scopeLabel = useScopeLabel();
    const [formOpen, setFormOpen] = useState(location.pathname.endsWith("/new"));
    const [revoking, setRevoking] = useState<Delegation | null>(null);
    useEffect(() => setFormOpen(location.pathname.endsWith("/new")), [location.pathname]);
    const closeForm = (o: boolean) => {
        setFormOpen(o);
        if (!o && location.pathname.endsWith("/new")) navigate("/admin/delegations", { replace: true });
    };

    const columns: DataTableColumn<Delegation>[] = [
        { key: "delegator", header: "Delegator", cell: (d) => <PersonCell user={d.delegator.user} sub={d.delegator.job_title} />, hideBelow: "md" },
        {
            key: "delegate",
            header: "Delegate",
            cell: (d) => (
                <div className="min-w-0">
                    <PersonCell user={d.delegate.user} sub={d.delegate.job_title} />
                    <div className="mt-1 truncate text-xs text-muted-foreground md:hidden">from {personName(d.delegator.user)}</div>
                </div>
            ),
        },
        {
            key: "what",
            header: "Permissions / roles",
            cell: (d) => (
                <div className="flex max-w-xs flex-wrap gap-1">
                    {d.roles.map((r) => <Badge key={r.id} variant="violet">{r.name}</Badge>)}
                    {d.permission_keys.slice(0, 3).map((k) => <Badge key={k} variant="neutral" className="font-mono">{k}</Badge>)}
                    {d.permission_keys.length > 3 && <Badge variant="neutral" title={d.permission_keys.slice(3).join("\n")}>+{d.permission_keys.length - 3}</Badge>}
                </div>
            ),
            hideBelow: "sm",
        },
        { key: "scope", header: "Scope", cell: (d) => (d.scope_type === "ORGANIZATION" ? getDropdownOptionLabel(ScopeTypeFormOptions, d.scope_type) : scopeLabel(d.scope_type, d.scope_id)), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (d) => <Badge variant={tone[d.status] ?? "neutral"} dot>{getDropdownOptionLabel(DelegationStatusFormOptions, d.status)}</Badge> },
        { key: "period", header: "Period", cell: (d) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(d.starts_at, "d MMM")} → {formatDate(d.ends_at)}</span>, hideBelow: "md" },
        { key: "reason", header: "Reason", cell: (d) => <span className="line-clamp-2 text-xs text-muted-foreground">{d.reason ?? "—"}</span>, hideBelow: "xl" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (d) =>
                (d.status === "ACTIVE" || d.status === "SCHEDULED") && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for delegation to ${personName(d.delegate.user)}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setRevoking(d)}><X /> Revoke now</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Delegations"
                description="Temporary hand-over of selected permissions, for a period and a scope. Full audit history."
                actions={<Button onClick={() => setFormOpen(true)}><Plus /> New delegation</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search people, reason, key…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{DelegationStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={delegations.data?.data}
                rowKey={(d) => d.id}
                loading={delegations.isFetching}
                error={delegations.error}
                onRetry={() => delegations.refetch()}
                pagination={delegations.data?.pagination}
                onPageChange={setPage}
                empty={{
                    icon: Forward,
                    title: search || filters.status ? "No delegations match" : "No delegations yet",
                    description: "Cover a holiday or leave: delegate approvals or other responsibilities for a period.",
                    action: !search && !filters.status ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New delegation</Button> : undefined,
                }}
            />
            <DelegationDialog open={formOpen} onOpenChange={closeForm} />
            <ConfirmationDialog
                isOpen={!!revoking}
                onClose={() => setRevoking(null)}
                title={`Revoke the delegation to ${personName(revoking?.delegate.user)}?`}
                description="The delegated permissions stop working right away."
                confirmText="Revoke"
                variant="destructive"
                isLoading={revoke.isPending}
                onConfirm={() => revoking && revoke.mutate({ id: revoking.id }, { onSuccess: () => { toast({ title: "Delegation revoked" }); setRevoking(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not revoke", description: getApiErrorMessage(e) }) })}
            />
        </Page>
    );
}
