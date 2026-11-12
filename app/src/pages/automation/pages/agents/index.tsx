import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bot, ExternalLink, KeyRound, ShieldAlert, Sparkles, Wrench, Zap } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { McpCallStatusOptions, OverviewPeriodOptions } from "@/config/constants/dropdowns/automation/automation.options";
import { useAgentsOverview } from "@/features/automation/hooks/use-automation";
import { StatusBadge, formatDuration } from "../../components/automation-ui";

/**
 * /automation/agents — AI agents & MCP overview (20 §12). Read-only: management lives in Admin.
 * @perm VIEW automation.rules.read · tool-call statistics organizations.mcp_calls.read · admin links organizations.service_accounts.manage
 * @api GET /automation/agents?days= @mcp automation_agents_overview
 * @states loading · error · no MCP access (stats hidden, notice) · no calls · no service accounts
 */
export default function AgentsOverviewPage() {
    const [days, setDays] = useState("30");
    const overview = useAgentsOverview(Number(days));

    if (overview.isPending) return <PageSkeleton />;
    if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>;
    const o = overview.data;
    const m = o.mcp;
    const failed = m ? (m.by_status.FAILED ?? 0) + (m.by_status.DENIED ?? 0) : 0;

    return (
        <Page>
            <PageHeader
                title="AI agents & MCP"
                description="Which agents, API keys and service accounts call platform tools, and which service accounts your workflows run as."
                actions={
                    <Select value={days} onValueChange={setDays}>
                        <SelectTrigger className="h-8 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{OverviewPeriodOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                }
            />

            {m ? (
                <StatGrid className="mb-6">
                    <StatCard label="Tool calls" value={m.total} hint={`Last ${o.days} days`} icon={Wrench} />
                    <StatCard label="Failed or denied" value={failed} hint={m.total ? `${Math.round((failed / m.total) * 100)}% of calls` : "No calls"} tone={failed ? "danger" : "success"} icon={AlertTriangle} />
                    <StatCard label="Awaiting confirmation" value={m.awaiting_confirmation} hint="Sensitive tools wait for a person" tone={m.awaiting_confirmation ? "warning" : "default"} icon={ShieldAlert} />
                    <StatCard label="From workflows" value={m.from_automation} hint="Calls made by automation steps" icon={Zap} />
                </StatGrid>
            ) : (
                <div className="mb-6 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-[13px] text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0" />
                    Tool-call statistics need the organizations.mcp_calls.read permission. You can still see the service accounts your workflows run as.
                </div>
            )}

            {m && m.awaiting_confirmation > 0 && (
                <div className="mb-6 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-foreground sm:flex-row sm:items-center">
                    <ShieldAlert className="size-4 shrink-0 text-warning" />
                    <span className="flex-1">{m.awaiting_confirmation} sensitive tool call(s) are waiting for a person to confirm or reject.</span>
                    <Button size="sm" variant="outline" asChild><Link to="/admin/mcp-calls">Review in Admin</Link></Button>
                </div>
            )}

            {m && (
                <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    <Section title="Most used tools" actions={<AdminLink to="/admin/mcp-calls" label="All calls" show={o.can.mcp_calls} />}>
                        <RankList empty="No tool calls in this period." rows={m.top_tools.map((t) => ({ key: t.tool_name, label: <span className="font-mono text-xs">{t.tool_name}</span>, count: t.count, hint: t.avg_duration_ms !== null ? `avg ${formatDuration(t.avg_duration_ms)}` : undefined }))} />
                    </Section>
                    <Section title="Callers">
                        <div className="space-y-4">
                            <RankList title="Service accounts" icon={Bot} empty="No service account called a tool." rows={m.by_service_account.map((r) => ({ key: r.id, label: r.name, count: r.count }))} />
                            <RankList title="API keys" icon={KeyRound} empty="No API key called a tool." rows={m.by_api_key.map((r) => ({ key: r.id, label: <>{r.name}{r.key_prefix && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.key_prefix}…</span>}</>, count: r.count }))} />
                            <RankList title="MCP clients" icon={Sparkles} empty="No client name reported." rows={m.by_client.map((r) => ({ key: r.client_name, label: r.client_name, count: r.count }))} />
                        </div>
                    </Section>
                </div>
            )}

            {m && m.recent_issues.length > 0 && (
                <Section title="Recent failed or denied calls" className="mb-6">
                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                        {m.recent_issues.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
                                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{c.tool_name}</span>
                                {c.error_code && <span className="text-xs text-muted-foreground">{c.error_code}</span>}
                                {c.client_name && <span className="hidden text-xs text-muted-foreground sm:inline">{c.client_name}</span>}
                                <Badge variant={c.status === "DENIED" ? "warning" : "danger"}>{getDropdownOptionLabel(McpCallStatusOptions, c.status)}</Badge>
                                <span className="text-xs text-muted-foreground">{formatRelative(c.created_at)}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="Service accounts used by workflows" description="Workflows run with the permissions of these accounts (or of their owner when none is set)." actions={<AdminLink to="/admin/service-accounts" label="Manage" show={o.can.service_accounts} />}>
                {!o.service_accounts.length ? (
                    <div className="rounded-lg border border-border bg-card">
                        <EmptyState icon={Bot} title="No workflow runs as a service account" description="Choose “Run as service account” in a workflow's settings, or set a default in Automation settings." />
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {o.service_accounts.map((a) => (
                            <div key={a.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-[13px] font-medium text-foreground">{a.name}</span>
                                            {a.is_default && <Badge variant="info">Default</Badge>}
                                        </div>
                                        {a.purpose && <div className="line-clamp-2 text-xs text-muted-foreground">{a.purpose}</div>}
                                    </div>
                                    {a.expired ? <Badge variant="danger">Expired</Badge> : <StatusBadge status={a.status} />}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <Metric label="Workflows" value={a.rule_count} />
                                    <Metric label="Runs" value={a.runs} />
                                    <Metric label="Failed" value={a.failed_runs} danger={a.failed_runs > 0} />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Owner: {a.owner ? personName(a.owner.user) : "—"}{a.expires_at && ` · expires ${formatDate(a.expires_at)}`}
                                </div>
                                {a.rules.length > 0 && (
                                    <ul className="space-y-1">
                                        {a.rules.map((r) => (
                                            <li key={r.id} className="flex items-center gap-2 text-[13px]">
                                                <Link to={`/automation/workflows/${r.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">{r.name}</Link>
                                                <Badge variant={r.status === "PUBLISHED" && r.enabled ? "success" : "neutral"}>{r.status === "PUBLISHED" ? (r.enabled ? "Live" : "Disabled") : "Draft"}</Badge>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {o.can.service_accounts && (
                                    <Button size="sm" variant="outline" asChild><Link to={`/admin/service-accounts/${a.id}`}>Permissions & keys <ExternalLink /></Link></Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </Page>
    );
}

function AdminLink({ to, label, show }: { to: string; label: string; show: boolean }) {
    if (!show) return null;
    return <Button variant="ghost" size="sm" asChild><Link to={to}>{label} <ExternalLink /></Link></Button>;
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
    return (
        <div className="rounded-md bg-secondary px-2 py-1.5">
            <div className={danger ? "text-sm font-medium text-danger tabular" : "text-sm font-medium text-foreground tabular"}>{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
        </div>
    );
}

function RankList({ rows, empty, title, icon: Icon }: { rows: { key: string; label: ReactNode; count: number; hint?: string }[]; empty: string; title?: string; icon?: typeof Bot }) {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            {title && <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{Icon && <Icon className="size-3.5" />}{title}</div>}
            {!rows.length ? (
                <p className="text-xs text-muted-foreground">{empty}</p>
            ) : (
                <ul className="space-y-2.5">
                    {rows.map((r) => (
                        <li key={r.key} className="space-y-1">
                            <div className="flex items-center gap-2 text-[13px]">
                                <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
                                {r.hint && <span className="hidden text-xs text-muted-foreground sm:inline">{r.hint}</span>}
                                <span className="tabular text-foreground">{r.count}</span>
                            </div>
                            <ProgressBar value={(r.count / max) * 100} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
