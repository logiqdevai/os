import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Copy, MoreHorizontal, Pencil, Play, Plus, Trash2, Upload, Zap } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleKeyFilterOptions, RuleStatusFilterOptions, TriggerKindFilterOptions, TriggerKindShortOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useArchiveRule, useDeleteRule, useDuplicateRule, useImportRule, useRules, useRunRule, useSetRuleEnabled } from "@/features/automation/hooks/use-automation";
import type { RuleListItem } from "@/features/automation/interfaces/automation.interfaces";
import { StatusBadge } from "../../components/automation-ui";

/**
 * /automation/workflows — list (20 §5)
 * @perm VIEW automation.rules.read · enable automation.rules.enable · create/duplicate/import automation.rules.create · run automation.rules.run · archive/delete automation.rules.delete
 * @api GET /automation/rules · POST …/enable|disable|duplicate|archive|run · DELETE /automation/rules/:id · POST /automation/rules/import
 */
export default function WorkflowsPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const rules = useRules(params);
    const p = usePermissions();
    const setEnabled = useSetRuleEnabled();
    const duplicate = useDuplicateRule();
    const archive = useArchiveRule();
    const remove = useDeleteRule();
    const run = useRunRule();
    const importRule = useImportRule();
    const fileRef = useRef<HTMLInputElement>(null);
    const [archiving, setArchiving] = useState<RuleListItem | null>(null);
    const [deleting, setDeleting] = useState<RuleListItem | null>(null);
    const [running, setRunning] = useState<RuleListItem | null>(null);

    const onImport = async (file: File | undefined) => {
        if (!file) return;
        try {
            const json = JSON.parse(await file.text());
            importRule.mutate(json.rule ?? json, { onSuccess: (r) => navigate(`/automation/workflows/${r.id}/edit`) });
        } catch {
            toast({ variant: "destructive", title: "Not a workflow export", description: "Choose a JSON file exported from Logiqdev OS." });
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const columns: DataTableColumn<RuleListItem>[] = [
        {
            key: "name",
            header: "Workflow",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-foreground">{r.name}</span>
                        {r.has_draft && <Badge variant="warning">Unpublished changes</Badge>}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{r.trigger_key}</div>
                </div>
            ),
        },
        { key: "trigger", header: "Trigger", cell: (r) => <Badge variant="outline">{getDropdownOptionLabel(TriggerKindShortOptions, r.trigger_kind)}</Badge>, hideBelow: "md" },
        { key: "status", header: "Status", cell: (r) => <div className="flex items-center gap-1.5"><StatusBadge status={r.status} />{r.status === "PUBLISHED" && <span className="text-xs text-muted-foreground">v{r.current_version}</span>}</div>, hideBelow: "sm" },
        {
            key: "last",
            header: "Last run",
            cell: (r) => (r.last_run_at ? <div className="space-y-0.5"><StatusBadge status={r.last_run_status} /><div className="text-xs text-muted-foreground">{formatRelative(r.last_run_at)}</div></div> : <span className="text-muted-foreground">Never</span>),
            hideBelow: "lg",
        },
        { key: "runs", header: "Runs", cell: (r) => <span className="tabular">{r.run_count}{r.failure_count ? <span className="text-danger"> · {r.failure_count} failed</span> : null}</span>, hideBelow: "lg" },
        { key: "owner", header: "Runs as", cell: (r) => (r.run_as ? <Badge variant="violet">{r.run_as.name}</Badge> : <span className="text-muted-foreground">{r.owner ? personName(r.owner.user) : "—"}</span>), hideBelow: "xl" },
        {
            key: "enabled",
            header: "On",
            cell: (r) => {
                const canEnable = p.can("automation.rules.enable");
                const reason = !canEnable ? "Needs automation.rules.enable" : r.status !== "PUBLISHED" ? "Publish the workflow first" : null;
                const control = (
                    <Switch
                        checked={r.enabled}
                        disabled={!!reason}
                        aria-label={r.enabled ? `Disable ${r.name}` : `Enable ${r.name}`}
                        onCheckedChange={(enabled) => setEnabled.mutate({ id: r.id, enabled })}
                    />
                );
                return reason ? <Tooltip><TooltipTrigger asChild><span>{control}</span></TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip> : control;
            },
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (r) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {p.can("automation.rules.update") && <DropdownMenuItem onSelect={() => navigate(`/automation/workflows/${r.id}/edit`)}><Pencil /> Edit</DropdownMenuItem>}
                        {p.can("automation.rules.run") && r.status === "PUBLISHED" && <DropdownMenuItem onSelect={() => setRunning(r)}><Play /> Run now</DropdownMenuItem>}
                        {p.can("automation.rules.create") && (
                            <DropdownMenuItem onSelect={() => duplicate.mutate(r.id, { onSuccess: (c) => navigate(`/automation/workflows/${c.id}/edit`) })}>
                                <Copy /> Duplicate
                            </DropdownMenuItem>
                        )}
                        {p.can("automation.rules.delete") && (
                            <>
                                <DropdownMenuSeparator />
                                {r.status !== "ARCHIVED" && <DropdownMenuItem onSelect={() => setArchiving(r)}><Archive /> Archive</DropdownMenuItem>}
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 /> Delete</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Workflows"
                description="When something happens, if conditions match, run these steps."
                actions={
                    <Can permission="automation.rules.create">
                        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
                        <Button variant="outline" onClick={() => fileRef.current?.click()} loading={importRule.isPending}><Upload /> Import</Button>
                        <Button asChild><Link to="/automation/workflows/new"><Plus /> New workflow</Link></Button>
                    </Can>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search workflows…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RuleStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.trigger_kind ?? "all"} onValueChange={(v) => setFilter("trigger_kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by trigger"><SelectValue /></SelectTrigger>
                    <SelectContent>{TriggerKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.module ?? "all"} onValueChange={(v) => setFilter("module", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by module"><SelectValue /></SelectTrigger>
                    <SelectContent>{ModuleKeyFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={rules.data?.data}
                rowKey={(r) => r.id}
                loading={rules.isFetching}
                error={rules.error}
                onRetry={() => rules.refetch()}
                pagination={rules.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/automation/workflows/${r.id}`}
                empty={{
                    icon: Zap,
                    title: search || Object.keys(filters).length ? "No workflows match" : "No workflows yet",
                    description: search ? "Try another search or clear the filters." : "Start from a template or build one from scratch.",
                    action: p.can("automation.rules.create") && !search ? <Button size="sm" asChild><Link to="/automation/workflows/new"><Plus /> New workflow</Link></Button> : undefined,
                }}
            />
            <ConfirmationDialog
                isOpen={!!running}
                onClose={() => setRunning(null)}
                title={`Run ${running?.name} now?`}
                description="The published version runs live with an empty sample payload, using the workflow's run-as identity."
                confirmText="Run now"
                isLoading={run.isPending}
                onConfirm={() => running && run.mutate({ id: running.id }, { onSuccess: (r) => { setRunning(null); navigate(`/automation/runs/${r.id}`); } })}
            />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="The workflow is disabled and hidden from the list. Its history is kept."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => {
                    if (archiving) archive.mutate(archiving.id); // optimistic: the row leaves at once
                    setArchiving(null);
                }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete ${deleting?.name}?`}
                description="The workflow, its versions and its run history are deleted permanently. This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => {
                    if (deleting) remove.mutate(deleting.id); // optimistic: the row leaves at once
                    setDeleting(null);
                }}
            />
        </Page>
    );
}

