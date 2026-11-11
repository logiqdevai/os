import { Link, useNavigate } from "react-router-dom";
import { AlarmClock, ClipboardCheck, ListChecks, PenLine, Plus, Send } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { formatDate, formatMoney } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractStatusFormOptions } from "@/config/constants/dropdowns/contracts/contract-status.options";
import { useContractDashboard, useMyContractApprovals } from "@/features/contracts/hooks/use-contracts";
import type { ContractListItem } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractStatusBadge } from "../../components/contract-badges";

/**
 * /contracts/dashboard — counts per status, expiring windows, signatures in progress, obligations, approvals waiting on me.
 * @perm contracts.contracts.read (values need contracts.confidential_terms.read) · @api GET /contracts/dashboard · GET /contract-approvals/mine
 */
export default function ContractsDashboardPage() {
    const navigate = useNavigate();
    const q = useContractDashboard();
    const approvals = useMyContractApprovals(usePermission("contracts.contracts.approve"));
    const d = q.data;

    return (
        <Page>
            <PageHeader title="Contracts dashboard" description="What needs attention across your agreements." actions={<Can permission="contracts.contracts.create"><Button onClick={() => navigate("/contracts/new")}><Plus /> New contract</Button></Can>} />
            {q.isPending ? (
                <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}</div><Skeleton className="h-64" /></div>
            ) : q.error ? (
                <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : !d || d.total === 0 ? (
                <EmptyState icon={PenLine} title="No contracts yet" description="Create your first contract or convert an accepted proposal." action={<Can permission="contracts.contracts.create"><Button size="sm" onClick={() => navigate("/contracts/new")}><Plus /> New contract</Button></Can>} />
            ) : (
                <div className="space-y-6">
                    <StatGrid>
                        <StatCard label="Contracts" value={d.total} hint={`${(d.by_status.ACTIVE ?? 0) + (d.by_status.FULLY_SIGNED ?? 0)} active`} />
                        <StatCard label="Expiring in 30 days" value={d.expiring.within_30} hint={`${d.expiring.within_90} within 90 days`} icon={AlarmClock} tone={d.expiring.within_30 ? "warning" : "default"} />
                        <StatCard label="Awaiting signature" value={d.pending_signature} icon={Send} tone="info" />
                        <StatCard label="Obligations" value={d.obligations.open} hint={`${d.obligations.overdue} overdue`} icon={ListChecks} tone={d.obligations.overdue ? "danger" : "default"} />
                    </StatGrid>
                    {d.value && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <StatCard label="Active contract value" value={formatMoney(d.value.active_total, "EUR", { compact: true })} />
                            <StatCard label="Active recurring value" value={formatMoney(d.value.active_recurring, "EUR", { compact: true })} />
                        </div>
                    )}

                    {!!approvals.data?.data.length && (
                        <div className="rounded-lg border border-border bg-card p-3">
                            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-foreground"><ClipboardCheck className="size-4 text-warning" /> Waiting for your approval</div>
                            {approvals.data.data.map((a) => (
                                <Link key={a.id} to={`/contracts/${a.version.contract.id}?tab=document`} className="flex flex-wrap items-center gap-x-3 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                                    <span className="font-mono text-xs text-muted-foreground">{a.version.contract.number}</span>
                                    <span className="min-w-0 flex-1 truncate text-foreground">{a.version.contract.title}</span>
                                    <span className="text-xs text-muted-foreground">{a.version.label} · step {a.step}{a.step_name ? ` (${a.step_name})` : ""}</span>
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="By status">
                            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                                {Object.entries(d.by_status).filter(([, n]) => n).map(([k, n]) => (
                                    <li key={k}>
                                        <Link to={`/contracts?status=${k}`} className="flex justify-between px-3 py-2 text-[13px] hover:bg-accent">
                                            <span className="text-muted-foreground">{getDropdownOptionLabel(ContractStatusFormOptions, k)}</span><span className="tabular text-foreground">{n}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                        <Section title="Notice deadlines" description="Act before these dates to renew or end.">
                            <ContractMiniList items={d.notice_deadlines} date={(c) => c.notice_deadline} empty="No notice deadlines coming up." />
                        </Section>
                    </div>
                    <Section title="Recently updated"><ContractMiniList items={d.recent} date={(c) => c.updated_at} empty="Nothing yet." /></Section>
                </div>
            )}
        </Page>
    );
}

function ContractMiniList({ items, date, empty }: { items: ContractListItem[]; date: (c: ContractListItem) => string | null; empty: string }) {
    if (!items.length) return <p className="rounded-lg border border-border bg-card px-3 py-4 text-[13px] text-muted-foreground">{empty}</p>;
    return (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((c) => (
                <li key={c.id}>
                    <Link to={`/contracts/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px] hover:bg-accent">
                        <span className="font-mono text-xs text-muted-foreground">{c.number}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{c.title}</span>
                        <ContractStatusBadge status={c.status} />
                        <span className="text-xs text-muted-foreground">{formatDate(date(c))}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
