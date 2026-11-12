import { useState } from "react";
import { CheckCircle2, Flag, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Section } from "@/components/ui/page";
import { usePermission } from "@/hooks/use-permission";
import { useDeleteProjectChild, useProjectChildAction, useProjectChildren } from "@/features/projects/hooks/use-projects";
import type { Milestone } from "@/features/projects/interfaces/projects.interfaces";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ItemStatusBadge } from "../../../components/project-badges";
import { MilestoneDialog } from "../../../components/milestone-dialog";

/** @perm VIEW projects.projects.read · manage projects.milestones.manage · @api /projects/:id/milestones */
export function MilestonesTab({ projectId }: { projectId: string }) {
    const milestones = useProjectChildren<Milestone>(projectId, "milestones");
    const canManage = usePermission("projects.milestones.manage");
    const complete = useProjectChildAction("Could not complete the milestone");
    const remove = useDeleteProjectChild("Milestone");
    const [editing, setEditing] = useState<Milestone | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<Milestone | null>(null);
    const [completing, setCompleting] = useState<Milestone | null>(null);

    const columns: DataTableColumn<Milestone>[] = [
        {
            key: "name",
            header: "Milestone",
            cell: (m) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate font-medium text-foreground">{m.name}</div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {m.customer_visible && <Badge variant="info">Customer</Badge>}
                        {m.is_billing_milestone && <Badge variant="violet">Billing</Badge>}
                    </div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (m) => <ItemStatusBadge status={m.status} />, hideBelow: "sm" },
        { key: "date", header: "Planned", cell: (m) => <span className={cn("tabular", m.overdue && "text-danger")}>{formatDate(m.planned_date)}</span> },
        { key: "work", header: "Tasks", hideBelow: "md", className: "tabular", cell: (m) => `${m._count?.tasks ?? 0} tasks · ${m._count?.deliverables ?? 0} deliverables` },
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (m) => <MemberAvatar person={m.owner?.user} size="xs" emptyLabel="No owner" /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (m) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {m.status !== "COMPLETED" && <DropdownMenuItem onSelect={() => setCompleting(m)}><CheckCircle2 /> Complete</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => { setEditing(m); setOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(m)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Section
            title="Milestones"
            description="Checkpoints in planned order. Overdue dates are red."
            actions={canManage && <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add milestone</Button>}
        >
            <DataTable
                columns={columns}
                data={milestones.data}
                rowKey={(m) => m.id}
                loading={milestones.isFetching}
                error={milestones.error}
                onRetry={() => milestones.refetch()}
                onRowClick={canManage ? (m) => { setEditing(m); setOpen(true); } : undefined}
                empty={{ icon: Flag, title: "No milestones yet", description: "Add checkpoints such as design sign-off or launch." }}
            />
            <MilestoneDialog open={open} onOpenChange={setOpen} projectId={projectId} milestone={editing} />
            <ConfirmationDialog
                isOpen={!!completing}
                onClose={() => setCompleting(null)}
                title={`Complete "${completing?.name}"?`}
                description={completing?.is_billing_milestone ? "This is a billing milestone: Billing is notified so the invoice can be raised." : "The milestone is marked completed today."}
                confirmText="Complete"
                onConfirm={() => {
                    if (completing) complete.mutate({ id: projectId, kind: "milestones", itemId: completing.id, action: "complete", optimistic: { status: "COMPLETED", overdue: false } });
                    setCompleting(null);
                }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete "${deleting?.name}"?`}
                description="Tasks and deliverables linked to it are kept without a milestone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, kind: "milestones", itemId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}
