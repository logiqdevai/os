import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, ListChecks, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn, type PaginationMeta } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { ObligationTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-obligation.options";
import { useDeleteObligation, useFulfilObligation, useWaiveObligation } from "@/features/contracts/hooks/use-contracts";
import type { Obligation } from "@/features/contracts/interfaces/contracts.interfaces";
import { Member, ObligationStatusBadge } from "./contract-badges";
import { ObligationDialog } from "./obligation-dialog";

interface Props {
    data: Obligation[] | undefined;
    loading: boolean;
    error: unknown;
    onRetry: () => void;
    pagination?: PaginationMeta;
    onPageChange?: (p: number) => void;
    showContract?: boolean;
    empty?: { title: string; description?: string; action?: React.ReactNode };
}

/** Obligations table with fulfil / waive / edit / delete row actions (contracts.obligations.manage). */
export function ObligationsTable({ data, loading, error, onRetry, pagination, onPageChange, showContract, empty }: Props) {
    const canManage = usePermission("contracts.obligations.manage");
    const fulfil = useFulfilObligation();
    const waive = useWaiveObligation();
    const remove = useDeleteObligation();
    const [editing, setEditing] = useState<Obligation | null>(null);
    const [deleting, setDeleting] = useState<Obligation | null>(null);
    const open = (o: Obligation) => !["FULFILLED", "WAIVED", "CANCELLED"].includes(o.status);

    const columns: DataTableColumn<Obligation>[] = [
        {
            key: "title",
            header: "Obligation",
            cell: (o) => (
                <div className="min-w-0 max-w-[320px]">
                    <div className="truncate font-medium text-foreground">{o.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                        {getDropdownOptionLabel(ObligationTypeFormOptions, o.type)}{o.frequency && o.frequency !== "none" ? ` · ${o.frequency}` : ""}
                        {showContract && <> · <Link className="hover:underline" to={`/contracts/${o.contract.id}?tab=obligations`}>{o.contract.number}</Link></>}
                    </div>
                </div>
            ),
        },
        { key: "due", header: "Due", cell: (o) => <span className={cn("whitespace-nowrap", o.is_overdue && "text-danger")}>{o.due_date ? formatDate(o.due_date) : "—"}</span> },
        { key: "status", header: "Status", cell: (o) => <ObligationStatusBadge status={o.status} overdue={o.is_overdue} /> },
        { key: "owner", header: "Responsible", hideBelow: "md", cell: (o) => <Member member={o.responsible} /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (o) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${o.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {open(o) && <DropdownMenuItem onSelect={() => fulfil.mutate(o.id)}><CheckCircle2 /> Mark fulfilled</DropdownMenuItem>}
                        {open(o) && <DropdownMenuItem onSelect={() => waive.mutate(o.id)}><Ban /> Waive</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => setEditing(o)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(o)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <>
            <DataTable
                columns={columns}
                data={data}
                rowKey={(o) => o.id}
                loading={loading}
                error={error}
                onRetry={onRetry}
                pagination={pagination}
                onPageChange={onPageChange}
                onRowClick={canManage ? (o) => setEditing(o) : undefined}
                empty={{ icon: ListChecks, title: empty?.title ?? "No obligations", description: empty?.description, action: empty?.action }}
            />
            {editing && <ObligationDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} contractId={editing.contract_id} obligation={editing} />}
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete “${deleting?.title}”?`}
                description="Use Waive to keep the record but stop tracking it."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}
            />
        </>
    );
}
