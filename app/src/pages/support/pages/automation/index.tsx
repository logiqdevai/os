import { Link } from "react-router-dom";
import { ExternalLink, Plus, Workflow } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermission } from "@/hooks/use-permission";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { RuleStatusFormOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useRules, useSetRuleEnabled } from "@/features/automation/hooks/use-automation";
import type { RuleListItem } from "@/features/automation/interfaces/automation.interfaces";

/** Automation app routes (module 20 owns the builder, runs and versions; Support only lists its rules). */
const AUTOMATION = { workflows: "/automation/workflows", newWorkflow: "/automation/workflows/new", workflow: (id: string) => `/automation/workflows/${id}` };

/**
 * Support automation — /support/automation (13 §2, §7 via 20; mockup 13-support `automation`).
 * The rules of module 20 whose module is SUPPORT (ticket created, status changed, SLA at risk, conversation events …).
 * Building and editing happens in the Automation app; here agents see what runs on their inbox and can switch rules on/off.
 * @perm VIEW automation.rules.read · on/off automation.rules.enable · new automation.rules.create
 * @api GET /automation/rules?module=SUPPORT · POST /automation/rules/:id/enable|disable
 */
export default function SupportAutomationPage() {
    usePageMetadata({ title: "Support automation" });
    const { params, setPage, search, setSearch } = useListParams();
    const rules = useRules({ ...params, module: "SUPPORT" });
    const setEnabled = useSetRuleEnabled();
    const canEnable = usePermission("automation.rules.enable");
    const canCreate = usePermission("automation.rules.create");

    const columns: DataTableColumn<RuleListItem>[] = [
        {
            key: "name",
            header: "Rule",
            cell: (r) => (
                <div className="min-w-0">
                    <Link to={AUTOMATION.workflow(r.id)} className="block truncate font-medium text-foreground hover:underline">{r.name}</Link>
                    <div className="truncate font-mono text-xs text-muted-foreground">{r.trigger_key}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (r) => <Badge variant={r.status === "PUBLISHED" ? "success" : "neutral"}>{getDropdownOptionLabel(RuleStatusFormOptions, r.status)}</Badge>, hideBelow: "sm" },
        { key: "runs", header: "Runs", cell: (r) => <span className="tabular">{r.run_count}{r.failure_count ? <span className="text-danger"> · {r.failure_count} failed</span> : null}</span>, hideBelow: "md" },
        { key: "last", header: "Last run", cell: (r) => <span className="text-xs text-muted-foreground">{r.last_run_at ? formatRelative(r.last_run_at) : "Never"}</span>, hideBelow: "lg" },
        {
            key: "enabled",
            header: "On",
            cell: (r) => (
                <Switch
                    checked={r.enabled}
                    disabled={!canEnable || r.status !== "PUBLISHED" || setEnabled.isPending}
                    aria-label={`${r.enabled ? "Turn off" : "Turn on"} ${r.name}`}
                    onCheckedChange={(v) => setEnabled.mutate({ id: r.id, enabled: v })}
                />
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Automation"
                description="Rules from the Automation app that run on support events: routing, auto-replies, escalations and SLA alerts."
                actions={
                    <>
                        <Button variant="outline" asChild><Link to={AUTOMATION.workflows}><ExternalLink /> All workflows</Link></Button>
                        <Can permission="automation.rules.create"><Button asChild><Link to={AUTOMATION.newWorkflow}><Plus /> New rule</Link></Button></Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search rules…" />
            <DataTable
                columns={columns}
                data={rules.data?.data}
                rowKey={(r) => r.id}
                loading={rules.isFetching}
                error={rules.error}
                onRetry={() => rules.refetch()}
                pagination={rules.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => AUTOMATION.workflow(r.id)}
                empty={{
                    icon: Workflow,
                    title: search ? "No rules match" : "No support rules yet",
                    description: "Create a workflow with a Support trigger (ticket created, SLA at risk, …) in the Automation app.",
                    action: canCreate && !search ? <Button size="sm" asChild><Link to={AUTOMATION.newWorkflow}><Plus /> New rule</Link></Button> : undefined,
                }}
            />
        </Page>
    );
}
