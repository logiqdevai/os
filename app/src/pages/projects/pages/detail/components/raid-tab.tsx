import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useDeleteProjectChild, useProjectChildren } from "@/features/projects/hooks/use-projects";
import type { Decision, Issue, Risk } from "@/features/projects/interfaces/projects.interfaces";
import { IssueKindFormOptions, IssueStatusFormOptions, RaidKindOptions, RiskStatusFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "../../../components/project-badges";
import { DecisionDialog, IssueDialog, RiskDialog } from "../../../components/raid-dialogs";

type Kind = "risks" | "issues" | "decisions";
type Row = Risk | Issue | Decision;

/** RAID of one project. @perm risks projects.risks.manage · issues & decisions projects.issues.manage */
export function RaidTab({ projectId }: { projectId: string }) {
    const [kind, setKind] = useState<Kind>("risks");
    const p = usePermissions();
    const canManage = kind === "risks" ? p.can("projects.risks.manage") : p.can("projects.issues.manage");
    const risks = useProjectChildren<Risk>(projectId, "risks");
    const issues = useProjectChildren<Issue>(projectId, "issues");
    const decisions = useProjectChildren<Decision>(projectId, "decisions");
    const remove = useDeleteProjectChild(kind === "risks" ? "Risk" : kind === "issues" ? "Issue" : "Decision");
    const [editing, setEditing] = useState<Row | null>(null);
    const [open, setOpen] = useState<Kind | null>(null);
    /** Which dialog the edited row belongs to; kept after closing so an autosaving edit can flush its last change. */
    const [editingKind, setEditingKind] = useState<Kind | null>(null);
    const edit = (row: Row | null) => { setEditing(row); setEditingKind(kind); setOpen(kind); };
    const [deleting, setDeleting] = useState<Row | null>(null);
    const query = kind === "risks" ? risks : kind === "issues" ? issues : decisions;

    const actions = (row: Row) => canManage && (
        <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => edit(row)}><Pencil /> Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(row)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const riskColumns: DataTableColumn<Risk>[] = [
        { key: "title", header: "Risk", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.title}</div>{r.mitigation && <div className="truncate text-xs text-muted-foreground">{r.mitigation}</div>}</div> },
        { key: "severity", header: "Severity", cell: (r) => <SeverityBadge severity={r.severity} /> },
        { key: "score", header: "P × I", hideBelow: "md", className: "tabular", cell: (r) => (r.probability && r.impact ? `${r.probability} × ${r.impact}` : "—") },
        { key: "status", header: "Status", hideBelow: "sm", cell: (r) => <Badge>{getDropdownOptionLabel(RiskStatusFormOptions, r.status)}</Badge> },
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (r) => <MemberAvatar person={r.owner?.user} size="xs" emptyLabel="No owner" /> },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: actions },
    ];
    const issueColumns: DataTableColumn<Issue>[] = [
        { key: "title", header: "Issue", cell: (i) => <div className="flex min-w-0 items-center gap-2">{i.kind === "BLOCKER" && <Badge variant="danger">{getDropdownOptionLabel(IssueKindFormOptions, i.kind)}</Badge>}<span className="truncate font-medium text-foreground">{i.title}</span></div> },
        { key: "severity", header: "Severity", cell: (i) => <SeverityBadge severity={i.severity} /> },
        { key: "status", header: "Status", hideBelow: "sm", cell: (i) => <Badge variant={["RESOLVED", "CLOSED"].includes(i.status) ? "success" : "neutral"}>{getDropdownOptionLabel(IssueStatusFormOptions, i.status)}</Badge> },
        { key: "due", header: "Resolve by", hideBelow: "md", cell: (i) => <span className={cn(i.target_resolution && new Date(i.target_resolution) < new Date() && ["OPEN", "IN_PROGRESS"].includes(i.status) && "text-danger")}>{formatDate(i.target_resolution)}</span> },
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (i) => <MemberAvatar person={i.owner?.user} size="xs" emptyLabel="No owner" /> },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: actions },
    ];
    const decisionColumns: DataTableColumn<Decision>[] = [
        { key: "title", header: "Decision", cell: (d) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{d.title}</div>{d.reason && <div className="line-clamp-1 text-xs text-muted-foreground">{d.reason}</div>}</div> },
        { key: "option", header: "Chosen", hideBelow: "md", cell: (d) => <span className="truncate">{d.selected_option ?? "—"}</span> },
        { key: "date", header: "Decided", hideBelow: "sm", cell: (d) => formatDate(d.decided_at) },
        { key: "owner", header: <span className="sr-only">Decision maker</span>, className: "w-10", cell: (d) => <MemberAvatar person={d.owner?.user} size="xs" emptyLabel="Unknown" /> },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: actions },
    ];

    const counts = { risks: risks.data?.length, issues: issues.data?.length, decisions: decisions.data?.length };
    const addLabel = kind === "risks" ? "Log risk" : kind === "issues" ? "Log issue" : "Record decision";
    const empty = { icon: ShieldAlert, title: kind === "risks" ? "No risks logged" : kind === "issues" ? "No issues or blockers" : "No decisions recorded" };
    const common = { loading: query.isFetching, error: query.error, onRetry: () => query.refetch(), onRowClick: canManage ? (r: Row) => edit(r) : undefined, empty };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                    <TabsList>
                        {RaidKindOptions.map((o) => (
                            <TabsTrigger key={o.id} value={o.id}>
                                {o.label}{counts[o.id] !== undefined && <span className="ml-1.5 text-xs text-muted-foreground tabular">{counts[o.id]}</span>}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                {canManage && <Button size="sm" onClick={() => edit(null)}><Plus /> {addLabel}</Button>}
            </div>
            {kind === "risks" && <DataTable columns={riskColumns} data={risks.data} rowKey={(r) => r.id} {...common} />}
            {kind === "issues" && <DataTable columns={issueColumns} data={issues.data} rowKey={(r) => r.id} {...common} />}
            {kind === "decisions" && <DataTable columns={decisionColumns} data={decisions.data} rowKey={(r) => r.id} {...common} />}

            <RiskDialog open={open === "risks"} onOpenChange={(o) => setOpen(o ? "risks" : null)} projectId={projectId} item={editingKind === "risks" ? (editing as Risk | null) : null} />
            <IssueDialog open={open === "issues"} onOpenChange={(o) => setOpen(o ? "issues" : null)} projectId={projectId} item={editingKind === "issues" ? (editing as Issue | null) : null} />
            <DecisionDialog open={open === "decisions"} onOpenChange={(o) => setOpen(o ? "decisions" : null)} projectId={projectId} item={editingKind === "decisions" ? (editing as Decision | null) : null} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this entry?"
                description="It is removed from the RAID log. The audit trail keeps a record."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, kind, itemId: deleting.id }); setDeleting(null); }}
            />
        </div>
    );
}
