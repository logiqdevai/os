import { useState } from "react";
import { Archive, Copy, LayoutTemplate, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ApprovalConditionFieldOptions, ApprovalConditionOperatorOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import {
    useApprovalRules, useArchiveProposalTemplate, useDeleteApprovalRule, useDuplicateProposalTemplate, useProposalTemplates, useUpdateApprovalRule,
} from "@/features/proposals/hooks/use-proposals";
import type { ApprovalCondition, ApprovalRule, ProposalTemplate } from "@/features/proposals/interfaces/proposals.interfaces";
import { TemplateDialog } from "./components/template-dialog";
import { RuleDialog } from "./components/rule-dialog";

const conditionText = (c: ApprovalCondition) =>
    `${getDropdownOptionLabel(ApprovalConditionFieldOptions, c.field)} ${getDropdownOptionLabel(ApprovalConditionOperatorOptions, c.operator)} ${typeof c.value === "number" && ["gross_total", "net_total", "discount_total", "recurring_monthly"].includes(c.field) ? formatMoney(c.value, "EUR") : String(c.value)}${c.field === "discount_percent" ? "%" : ""}`;

/**
 * /proposals/templates — reusable templates (versioned) and approval rules.
 * @perm proposals.templates.manage · rules proposals.approval_rules.manage
 * @api GET/POST/PATCH /proposal-templates · /proposal-approval-rules
 */
export default function ProposalTemplatesPage() {
    const p = usePermissions();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const templates = useProposalTemplates(params);
    const duplicate = useDuplicateProposalTemplate();
    const archive = useArchiveProposalTemplate();
    const [editing, setEditing] = useState<ProposalTemplate | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [archiving, setArchiving] = useState<ProposalTemplate | null>(null);

    const columns: DataTableColumn<ProposalTemplate>[] = [
        {
            key: "name",
            header: "Template",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate font-medium text-foreground">{t.name}{t.is_default && <Badge variant="info">Default</Badge>}</div>
                    {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                </div>
            ),
        },
        { key: "type", header: "Work type", hideBelow: "md", cell: (t) => t.work_type ?? <span className="text-muted-foreground">—</span> },
        { key: "sections", header: "Sections", hideBelow: "sm", cell: (t) => <span className="tabular">{t.sections.length}</span> },
        { key: "version", header: "Version", hideBelow: "md", cell: (t) => <span className="tabular">v{t.version}</span> },
        { key: "used", header: "Used by", hideBelow: "lg", cell: (t) => <span className="tabular">{t._count?.proposals ?? 0}</span> },
        { key: "updated", header: "Updated", hideBelow: "lg", cell: (t) => <span className="text-muted-foreground">{formatDate(t.updated_at)}</span> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) =>
                p.can("proposals.templates.manage") && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(t); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => duplicate.mutate(t.id)}><Copy /> Duplicate</DropdownMenuItem>
                            {t.archived_at ? (
                                <DropdownMenuItem onSelect={() => archive.mutate({ id: t.id, restore: true })}><Archive /> Restore</DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(t)}><Archive /> Archive</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Templates & approval rules"
                description="Templates give new proposals their sections and terms. Rules decide who approves before a proposal is sent."
                actions={<Can permission="proposals.templates.manage"><Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New template</Button></Can>}
            />
            <Section title="Templates">
                <TableToolbar search={search} onSearch={setSearch} placeholder="Search templates…" className="mb-0">
                    <Select value={filters.archived === "true" ? "archived" : "active"} onValueChange={(v) => setFilter("archived", v === "archived" ? "true" : null)}>
                        <SelectTrigger className="h-8 w-36" aria-label="Archived"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
                    </Select>
                </TableToolbar>
                <DataTable
                    columns={columns}
                    data={templates.data?.data}
                    rowKey={(t) => t.id}
                    loading={templates.isFetching}
                    error={templates.error}
                    onRetry={() => templates.refetch()}
                    pagination={templates.data?.pagination}
                    onPageChange={setPage}
                    onRowClick={p.can("proposals.templates.manage") ? (t) => { setEditing(t); setFormOpen(true); } : undefined}
                    empty={{
                        icon: LayoutTemplate,
                        title: search ? "No templates match" : "No templates yet",
                        description: "Create a template per type of work: website, app, retainer…",
                        action: p.can("proposals.templates.manage") && !search ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New template</Button> : undefined,
                    }}
                />
            </Section>

            <Can permission="proposals.approval_rules.manage">
                <RulesSection />
            </Can>

            <TemplateDialog open={formOpen} onOpenChange={setFormOpen} template={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="It is no longer offered for new proposals. Existing proposals are not affected."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (archiving) archive.mutate({ id: archiving.id }); setArchiving(null); }}
            />
        </Page>
    );
}

function RulesSection() {
    const rules = useApprovalRules();
    const update = useUpdateApprovalRule();
    const remove = useDeleteApprovalRule();
    const [editing, setEditing] = useState<ApprovalRule | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<ApprovalRule | null>(null);

    return (
        <Section className="mt-8" title="Approval rules" description="When a version is submitted, every enabled rule whose conditions all match adds its approval steps." actions={<Button size="sm" variant="outline" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New rule</Button>}>
            {rules.isPending ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : rules.error ? (
                <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
            ) : !rules.data?.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ShieldCheck} title="No approval rules" description="Without rules, proposals can be sent without approval." /></div>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {rules.data.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">{r.name}<span className="text-xs font-normal text-muted-foreground">priority {r.priority}</span></div>
                                <div className="text-xs text-muted-foreground">If {r.conditions.map(conditionText).join(" and ")}</div>
                                <div className="text-xs text-muted-foreground">
                                    Then {r.steps.map((s) => `${s.step}. ${s.name} (${(() => { const m = r.approvers.find((a) => a.id === s.approver_membership_id); return m ? personName(m.user) : "removed member"; })()})`).join(" → ")}
                                </div>
                            </div>
                            <Switch aria-label={`Enable ${r.name}`} checked={r.enabled} onCheckedChange={(enabled) => update.mutate({ id: r.id, enabled })} />
                            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setOpen(true); }}><Pencil /></Button>
                            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
                        </li>
                    ))}
                </ul>
            )}
            <RuleDialog open={open} onOpenChange={setOpen} rule={editing} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete rule ${deleting?.name}?`}
                description="Approvals already requested by this rule stay as they are."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); setDeleting(null); }}
            />
        </Section>
    );
}
