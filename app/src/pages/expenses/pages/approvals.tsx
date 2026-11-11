import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useClaimAction, useLedgerApprovals, useRecordAction } from "@/features/expenses/hooks/use-expenses";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { TypeBadge } from "../components/ledger-ui";

/**
 * /expenses/approvals — records above the approval threshold and submitted expense claims. Separation of duties: never your own.
 * @perm finance.expenses.approve (records) · finance.expense_claims.approve (claims)
 * @api GET /ledger/approvals · POST /ledger/records/:id/approve · POST /ledger/claims/:id/approve
 */
export default function LedgerApprovalsPage() {
    const q = useLedgerApprovals();
    const session = useSessionData();
    const record = useRecordAction();
    const claim = useClaimAction();
    const me = session?.active_organization?.membership_id;
    if (q.isPending) return <Page><PageHeader title="Approvals" /><ListSkeleton /></Page>;
    if (q.error || !q.data) return <Page><PageHeader title="Approvals" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const { records, claims } = q.data;
    return (
        <Page width="wide">
            <PageHeader title="Approvals" description="A second member confirms large records and expense claims." />
            {!records.length && !claims.length ? <EmptyState icon={CheckCircle2} title="Nothing waiting for approval" /> : (
                <div className="space-y-6">
                    {records.length > 0 && (
                        <Section title="Records">
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {records.map((r) => {
                                    const mine = r.created_by?.id === me;
                                    return (
                                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                            <Link to={`/expenses/records/${r.id}`} className="min-w-0 hover:underline"><div className="flex items-center gap-2 text-[13px] text-foreground"><TypeBadge type={r.type} />{r.description}</div><div className="text-xs text-muted-foreground">{r.number} · {formatDate(r.transaction_date)} · by {r.created_by ? personName(r.created_by.user) : "system"}</div></Link>
                                            <div className="flex items-center gap-2"><span className="tabular text-[13px]">{formatMoney(r.gross_amount, r.currency)}</span>{mine ? <span className="text-xs text-muted-foreground">Yours</span> : <Button size="sm" loading={record.isPending && record.variables?.id === r.id} onClick={() => record.mutate({ id: r.id, action: "approve", body: {} })}>Approve</Button>}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </Section>
                    )}
                    {claims.length > 0 && (
                        <Section title="Expense claims">
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {claims.map((c) => (
                                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                        <Link to={`/expenses/claims/${c.id}`} className="min-w-0 hover:underline"><div className="text-[13px] text-foreground">{c.title}</div><div className="text-xs text-muted-foreground">{c.number} · {c.employee_name_snapshot} · {formatDate(c.submitted_at)}</div></Link>
                                        <div className="flex items-center gap-2"><span className="tabular text-[13px]">{formatMoney(c.total_amount, c.currency)}</span><Button size="sm" loading={claim.isPending && claim.variables?.id === c.id} onClick={() => claim.mutate({ id: c.id, action: "approve" })}>Approve</Button></div>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                </div>
            )}
        </Page>
    );
}
