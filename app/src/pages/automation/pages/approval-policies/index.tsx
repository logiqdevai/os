import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { personName } from "@/lib/format";
import { useApprovalPolicies, useSetApprovalPolicyArchived } from "@/features/automation/hooks/use-automation";
import type { ApprovalPolicy } from "@/features/automation/interfaces/automation.interfaces";
import { ArchivedFilterOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { ApprovalPolicyDialog } from "./components/approval-policy-dialog";

/**
 * /automation/approval-policies — reusable approver policies for "Require approval" steps (20 §4, §6)
 * @perm VIEW automation.rules.read · ACTION automation.approval_policies.manage
 * @api GET /automation/approval-policies · POST · PATCH /:id · POST /:id/archive|restore
 * @mcp automation_approval_policies_list|create|update
 * @audit automation.approval_policy.created|updated|archived|restored
 * @states loading · empty · error/403 · archived filter
 */
export default function ApprovalPoliciesPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const archived = filters.archived === "true";
    const policies = useApprovalPolicies({ ...params, archived: archived ? "true" : undefined });
    const canManage = usePermission("automation.approval_policies.manage");
    const setArchived = useSetApprovalPolicyArchived();
    const [editing, setEditing] = useState<ApprovalPolicy | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [archiving, setArchiving] = useState<ApprovalPolicy | null>(null);

    const openNew = () => { setEditing(null); setFormOpen(true); };
    const restore = (p: ApprovalPolicy) =>
        setArchived.mutate({ id: p.id, archived: false });

    const columns: DataTableColumn<ApprovalPolicy>[] = [
        {
            key: "name",
            header: "Policy",
            cell: (p) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{p.name}</div>
                    {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                </div>
            ),
        },
        {
            key: "who",
            header: "Approvers",
            cell: (p) => (
                <div className="flex flex-wrap gap-1">
                    {p.approvers.slice(0, 2).map((a) => <Badge key={a.id} variant="neutral">{personName(a.user)}</Badge>)}
                    {p.approvers.length > 2 && <Badge variant="neutral">+{p.approvers.length - 2}</Badge>}
                    {p.teams.map((t) => <Badge key={t.id} variant="info">Team: {t.name}</Badge>)}
                    {p.roles.map((r) => <Badge key={r.id} variant="violet">Role: {r.name}</Badge>)}
                </div>
            ),
            hideBelow: "sm",
        },
        {
            key: "timing",
            header: "Expiry / escalation",
            cell: (p) => (
                <div className="text-xs text-muted-foreground">
                    <div>{p.expires_after_hours ? `Expires after ${p.expires_after_hours} h` : "Never expires"}</div>
                    {p.escalate_after_hours && p.escalate_to && <div>Escalates to {personName(p.escalate_to.user)} after {p.escalate_after_hours} h</div>}
                </div>
            ),
            hideBelow: "md",
        },
        { key: "used", header: "Requests", cell: (p) => <span className="tabular">{p.approval_count}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (p) =>
                canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {!p.archived_at && <DropdownMenuItem onSelect={() => { setEditing(p); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>}
                            {p.archived_at
                                ? <DropdownMenuItem onSelect={() => restore(p)}><ArchiveRestore /> Restore</DropdownMenuItem>
                                : <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(p)}><Archive /> Archive</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Approval policies"
                description="Reusable approver groups for “Require approval” steps: several approvers (first decision wins), expiry, escalation and out-of-office hand-over."
                actions={<Can permission="automation.approval_policies.manage"><Button onClick={openNew}><Plus /> New policy</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search policies…">
                <Select value={archived ? "true" : "false"} onValueChange={(v) => setFilter("archived", v === "true" ? "true" : undefined)}>
                    <SelectTrigger className="h-8 w-36" aria-label="Show"><SelectValue /></SelectTrigger>
                    <SelectContent>{ArchivedFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={policies.data?.data}
                rowKey={(p) => p.id}
                loading={policies.isFetching}
                error={policies.error}
                onRetry={() => policies.refetch()}
                pagination={policies.data?.pagination}
                onPageChange={setPage}
                onRowClick={canManage ? (p) => { if (!p.archived_at) { setEditing(p); setFormOpen(true); } } : undefined}
                empty={{
                    icon: ShieldCheck,
                    title: search ? "No policies match your search" : archived ? "No archived policies" : "No approval policies yet",
                    description: "A policy lists who may approve, when a request expires and who it escalates to.",
                    action: canManage && !search && !archived ? <Button size="sm" onClick={openNew}><Plus /> New policy</Button> : undefined,
                }}
            />
            <ApprovalPolicyDialog open={formOpen} onOpenChange={setFormOpen} policy={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Workflows that use this policy fail their approval step until you choose another policy. Pending requests stay open."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => {
                    if (archiving) setArchived.mutate({ id: archiving.id, archived: true }); // optimistic: the row leaves at once
                    setArchiving(null);
                }}
            />
        </Page>
    );
}
