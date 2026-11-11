import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, BookOpen, FileStack, GitBranch, MoreHorizontal, Pencil, Plus, ShieldCheck, Tags, Trash2, Upload } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    ApprovalRuleFieldOptions, ApprovalRuleOperatorOptions, ContractClauseCategoryFilterOptions, ContractClauseCategoryOptions, ContractClauseStatusOptions, ContractTemplateStatusFilterOptions, ContractTemplateStatusOptions,
} from "@/config/constants/dropdowns/contracts/contract-library.options";
import { ContractRenewalTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import {
    useApprovalRules, useArchiveContractType, useContractClauses, useContractTemplate, useContractTemplates, useContractTypes, useDeleteApprovalRule, useDeprecateTemplate, usePublishTemplateVersion, useUpdateApprovalRule,
} from "@/features/contracts/hooks/use-contracts";
import type { ApprovalRule, ContractClause, ContractTemplate, ContractType } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractTemplateDialog } from "./components/template-dialog";
import { ClauseDialog, ContractRuleDialog, TypeDialog } from "./components/library-dialogs";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * /contracts/templates?tab=templates|clauses|types|rules — the contract library.
 * @perm templates contracts.templates.manage · clauses contracts.clauses.manage · types contracts.types.manage · rules contracts.approval_rules.manage
 */
export default function ContractLibraryPage() {
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const tabs = [
        p.can("contracts.templates.manage") && "templates",
        p.can("contracts.clauses.manage") && "clauses",
        p.can("contracts.types.manage") && "types",
        p.can("contracts.approval_rules.manage") && "rules",
    ].filter(Boolean) as string[];
    const tab = tabs.includes(sp.get("tab") ?? "") ? (sp.get("tab") as string) : tabs[0];
    return (
        <Page>
            <PageHeader title="Templates & clauses" description="Approved structures and language for new contracts. Changes never alter contracts already generated." />
            <Tabs value={tab} onValueChange={(t) => setSp({ tab: t }, { replace: true })}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList className="w-max">
                        {tabs.includes("templates") && <TabsTrigger value="templates">Templates</TabsTrigger>}
                        {tabs.includes("clauses") && <TabsTrigger value="clauses">Clauses</TabsTrigger>}
                        {tabs.includes("types") && <TabsTrigger value="types">Types</TabsTrigger>}
                        {tabs.includes("rules") && <TabsTrigger value="rules">Approval rules</TabsTrigger>}
                    </TabsList>
                </div>
                <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
                <TabsContent value="clauses" className="mt-4"><ClausesTab /></TabsContent>
                <TabsContent value="types" className="mt-4"><TypesTab /></TabsContent>
                <TabsContent value="rules" className="mt-4"><RulesTab /></TabsContent>
            </Tabs>
        </Page>
    );
}

function TemplatesTab() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...query } = params as Record<string, string | number>;
    void _t;
    const list = useContractTemplates(query);
    const deprecate = useDeprecateTemplate();
    const [dialog, setDialog] = useState<{ templateId: string | null } | null>(null);
    const [publishing, setPublishing] = useState<ContractTemplate | null>(null);
    const [deprecating, setDeprecating] = useState<ContractTemplate | null>(null);
    const columns: DataTableColumn<ContractTemplate>[] = [
        { key: "name", header: "Template", cell: (t) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{t.name}</div>{t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}</div> },
        { key: "status", header: "Status", cell: (t) => <Badge variant={t.status === "PUBLISHED" ? "success" : t.status === "DRAFT" ? "warning" : "neutral"}>{getDropdownOptionLabel(ContractTemplateStatusOptions, t.status)}</Badge> },
        { key: "type", header: "Type", hideBelow: "md", cell: (t) => t.type?.name ?? <span className="text-muted-foreground">Any</span> },
        { key: "version", header: "Published", hideBelow: "sm", cell: (t) => (t.current_version ? `v${t.current_version.version_number}` : <span className="text-muted-foreground">—</span>) },
        { key: "used", header: "Contracts", hideBelow: "lg", cell: (t) => <span className="tabular">{t._count?.contracts ?? 0}</span> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (t) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {t.status !== "DEPRECATED" && <DropdownMenuItem onSelect={() => setDialog({ templateId: t.id })}><GitBranch /> New version</DropdownMenuItem>}
                        {t.status !== "DEPRECATED" && <DropdownMenuItem onSelect={() => setPublishing(t)}><Upload /> Publish latest version</DropdownMenuItem>}
                        {t.status !== "DEPRECATED" && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeprecating(t)}><Archive /> Deprecate</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search templates…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}><SelectTrigger className="h-8 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger><SelectContent>{ContractTemplateStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" onClick={() => setDialog({ templateId: null })}><Plus /> New template</Button>
            </TableToolbar>
            <DataTable columns={columns} data={list.data?.data} rowKey={(t) => t.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage}
                empty={{ icon: FileStack, title: "No templates yet", description: "A template is the structure new contracts start from.", action: <Button size="sm" onClick={() => setDialog({ templateId: null })}><Plus /> New template</Button> }} />
            <ContractTemplateDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} templateId={dialog?.templateId ?? null} />
            {publishing && <PublishDialog template={publishing} onClose={() => setPublishing(null)} />}
            <ConfirmationDialog isOpen={!!deprecating} onClose={() => setDeprecating(null)} title={`Deprecate ${deprecating?.name}?`} description="It can no longer be used for new contracts. Existing contracts keep their text." confirmText="Deprecate" variant="destructive" isLoading={deprecate.isPending}
                onConfirm={() => deprecating && deprecate.mutate(deprecating.id, { onSuccess: () => { toast({ title: "Template deprecated" }); setDeprecating(null); }, onError: fail("Could not deprecate") })} />
        </>
    );
}

function PublishDialog({ template, onClose }: { template: ContractTemplate; onClose: () => void }) {
    const detail = useContractTemplate(template.id);
    const publish = usePublishTemplateVersion();
    const latest = detail.data?.versions?.[0];
    const already = latest && latest.id === detail.data?.current_version_id && detail.data?.status === "PUBLISHED";
    return (
        <ConfirmationDialog
            isOpen
            onClose={onClose}
            title={latest ? `Publish v${latest.version_number} of ${template.name}?` : "Loading…"}
            description={already ? "This version is already published." : "New contracts will use this version. Contracts already generated are not changed."}
            confirmText="Publish"
            isLoading={publish.isPending || detail.isPending}
            onConfirm={() => latest && !already ? publish.mutate({ id: template.id, vid: latest.id }, { onSuccess: () => { toast({ title: "Version published" }); onClose(); }, onError: fail("Could not publish") }) : onClose()}
        />
    );
}

function ClausesTab() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...query } = params as Record<string, string | number>;
    void _t;
    const list = useContractClauses(query);
    const [editing, setEditing] = useState<ContractClause | null>(null);
    const [open, setOpen] = useState(false);
    const columns: DataTableColumn<ContractClause>[] = [
        { key: "name", header: "Clause", cell: (c) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{c.name}</div><div className="truncate font-mono text-xs text-muted-foreground">{c.key}</div></div> },
        { key: "category", header: "Category", hideBelow: "sm", cell: (c) => getDropdownOptionLabel(ContractClauseCategoryOptions, c.category) },
        { key: "status", header: "Status", cell: (c) => <Badge variant={c.status === "ACTIVE" ? "success" : c.status === "DRAFT" ? "warning" : "neutral"}>{getDropdownOptionLabel(ContractClauseStatusOptions, c.status)}</Badge> },
        { key: "version", header: "Version", hideBelow: "md", cell: (c) => `v${c.current_version?.version_number ?? 1}` },
        { key: "updated", header: "Updated", hideBelow: "lg", cell: (c) => <span className="text-muted-foreground">{formatDate(c.updated_at)}</span> },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search clauses…">
                <Select value={filters.category ?? "all"} onValueChange={(v) => setFilter("category", v)}><SelectTrigger className="h-8 w-40" aria-label="Filter by category"><SelectValue /></SelectTrigger><SelectContent>{ContractClauseCategoryFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New clause</Button>
            </TableToolbar>
            <DataTable columns={columns} data={list.data?.data} rowKey={(c) => c.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage} onRowClick={(c) => { setEditing(c); setOpen(true); }}
                empty={{ icon: BookOpen, title: "No clauses yet", description: "Store approved language once (liability, IP, confidentiality) and reuse it in templates." }} />
            <ClauseDialog open={open} onOpenChange={setOpen} clause={editing} />
        </>
    );
}

function TypesTab() {
    const list = useContractTypes({ limit: 100 });
    const archive = useArchiveContractType();
    const [editing, setEditing] = useState<ContractType | null>(null);
    const [open, setOpen] = useState(false);
    const [archiving, setArchiving] = useState<ContractType | null>(null);
    const columns: DataTableColumn<ContractType>[] = [
        { key: "name", header: "Type", cell: (t) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{t.name}</div>{t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}</div> },
        { key: "renewal", header: "Renewal", hideBelow: "sm", cell: (t) => getDropdownOptionLabel(ContractRenewalTypeFormOptions, t.default_renewal_type) },
        { key: "notice", header: "Notice", hideBelow: "md", cell: (t) => (t.default_notice_days != null ? `${t.default_notice_days} days` : "—") },
        { key: "template", header: "Default template", hideBelow: "lg", cell: (t) => t.default_template?.name ?? <span className="text-muted-foreground">—</span> },
        { key: "contracts", header: "Contracts", hideBelow: "lg", cell: (t) => <span className="tabular">{t._count?.contracts ?? 0}</span> },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: (t) => <Button variant="ghost" size="icon-sm" aria-label={`Archive ${t.name}`} onClick={() => setArchiving(t)}><Archive /></Button> },
    ];
    return (
        <>
            <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New type</Button></div>
            <DataTable columns={columns} data={list.data?.data} rowKey={(t) => t.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} onRowClick={(t) => { setEditing(t); setOpen(true); }}
                empty={{ icon: Tags, title: "No contract types", description: "Types (MSA, SOW, retainer, NDA…) carry default templates, renewal and notice settings." }} />
            <TypeDialog open={open} onOpenChange={setOpen} type={editing} />
            <ConfirmationDialog isOpen={!!archiving} onClose={() => setArchiving(null)} title={`Archive ${archiving?.name}?`} description="It is hidden from pickers; existing contracts keep it." confirmText="Archive" variant="destructive" isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Type archived" }); setArchiving(null); }, onError: fail("Could not archive") })} />
        </>
    );
}

function RulesTab() {
    const rules = useApprovalRules();
    const update = useUpdateApprovalRule();
    const remove = useDeleteApprovalRule();
    const [editing, setEditing] = useState<ApprovalRule | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<ApprovalRule | null>(null);
    return (
        <>
            <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New rule</Button></div>
            {rules.isPending ? <Skeleton className="h-24" /> : rules.error ? <ErrorState error={rules.error} onRetry={() => rules.refetch()} /> : !rules.data?.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={ShieldCheck} title="No approval rules" description="Without rules, the contract type's approval workflow (if any) applies." /></div>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {rules.data.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-medium text-foreground">{r.name}</div>
                                <div className="text-xs text-muted-foreground">If {r.conditions.map((c) => `${getDropdownOptionLabel(ApprovalRuleFieldOptions, c.field)} ${getDropdownOptionLabel(ApprovalRuleOperatorOptions, c.operator)} ${String(c.value)}`).join(" and ")}</div>
                                <div className="text-xs text-muted-foreground">Then {r.steps.map((s) => `${s.step}. ${s.name ?? "approver"}`).join(" → ")}</div>
                            </div>
                            <Switch aria-label={`Enable ${r.name}`} checked={r.enabled} onCheckedChange={(enabled) => update.mutate({ id: r.id, enabled }, { onError: fail("Could not update") })} />
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setOpen(true); }}><Pencil /></Button>
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
                        </li>
                    ))}
                </ul>
            )}
            <ContractRuleDialog open={open} onOpenChange={setOpen} rule={editing} />
            <ConfirmationDialog isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name}?`} description="Approvals already requested stay as they are." confirmText="Delete" variant="destructive" isLoading={remove.isPending}
                onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => { toast({ title: "Rule deleted" }); setDeleting(null); }, onError: fail("Could not delete") })} />
        </>
    );
}
