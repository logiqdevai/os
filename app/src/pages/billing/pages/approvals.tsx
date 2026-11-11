import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useBillingApprovals, useInvoiceAction, useRefundDecision } from "@/features/billing/hooks/use-billing";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * /billing/approvals — invoices and refunds waiting for approval (separation of duties: never your own).
 * @perm finance.invoices.approve or finance.refunds.approve or finance.adjustments.approve
 * @api GET /finance/approvals · POST /finance/invoices/:id/approve · POST /finance/refunds/:id/{approve|reject}
 */
export default function BillingApprovalsPage() {
    const q = useBillingApprovals();
    const p = usePermissions();
    const invoiceAction = useInvoiceAction();
    const refund = useRefundDecision();
    const invoices = [
        ...(q.data?.items.filter((i) => i.invoice).map((i) => ({ id: i.invoice!.id, number: i.invoice!.number, total: i.invoice!.total, currency: i.invoice!.currency, company: i.invoice!.company?.name, since: i.requested_at, rule: i.rule?.name, mine: false })) ?? []),
        ...(q.data?.invoices_awaiting.map((i) => ({ id: i.id, number: "Draft", total: i.total, currency: i.currency, company: i.company?.name, since: i.created_at, rule: undefined, mine: i.mine })) ?? []),
    ];
    const refunds = q.data?.items.filter((i) => i.refund) ?? [];
    return (
        <Page width="wide">
            <PageHeader title="Approvals" description="Invoices and refunds above your approval rules. You cannot approve items you created." />
            {q.isPending ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !invoices.length && !refunds.length ? (
                <EmptyState icon={CheckCircle2} title="Nothing waiting for approval" />
            ) : (
                <div className="space-y-6">
                    {invoices.length > 0 && (
                        <Section title="Invoices">
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {invoices.map((i) => (
                                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                        <Link to={`/billing/invoices/${i.id}`} className="min-w-0 hover:underline"><div className="text-[13px] text-foreground">{i.company ?? "Customer"} · {i.number}</div><div className="text-xs text-muted-foreground">Since {formatDate(i.since)}{i.rule ? ` · ${i.rule}` : ""}</div></Link>
                                        <div className="flex items-center gap-2">
                                            <span className="tabular text-[13px]">{formatMoney(i.total, i.currency)}</span>
                                            {i.mine ? <Badge>Created by you</Badge> : p.can("finance.invoices.approve") && <Button size="sm" loading={invoiceAction.isPending && invoiceAction.variables?.id === i.id} onClick={() => invoiceAction.mutate({ id: i.id, action: "approve" })}>Approve</Button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                    {refunds.length > 0 && (
                        <Section title="Refunds">
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {refunds.map((r) => (
                                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                        <Link to={`/billing/payments/${r.refund!.payment.id}`} className="min-w-0 hover:underline"><div className="text-[13px] text-foreground">{r.refund!.payment.billing_profile?.legal_name ?? "Payment"}</div><div className="text-xs text-muted-foreground">{r.refund!.reason}</div></Link>
                                        <div className="flex items-center gap-2">
                                            <span className="tabular text-[13px]">{formatMoney(r.refund!.amount, r.refund!.payment.currency)}</span>
                                            {p.can("finance.refunds.approve") && <><Button size="sm" loading={refund.isPending} onClick={() => refund.mutate({ id: r.entity_id, action: "approve" })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => refund.mutate({ id: r.entity_id, action: "reject", reason: "Rejected by approver" })}>Reject</Button></>}
                                        </div>
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
