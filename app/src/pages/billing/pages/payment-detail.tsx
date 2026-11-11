import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Undo2 } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { usePayment, useRefundPayment } from "@/features/billing/hooks/use-billing";
import { BillingEventLabelOptions, PaymentMethodTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { InvoiceStatusBadge, PaymentStatusBadge } from "../components/billing-badges";
import { ReasonDialog } from "../components/billing-dialogs";

/**
 * /billing/payments/:id — payment with allocations and refunds.
 * @perm VIEW finance.payments.read · refund finance.payments.refund (approval via finance.refunds.approve when a rule applies)
 * @api GET /finance/payments/:id · POST /finance/payments/:id/refunds
 */
export default function PaymentDetailPage() {
    const { id } = useParams();
    const q = usePayment(id);
    const canRefund = usePermission("finance.payments.refund");
    const refund = useRefundPayment();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState("");
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const p = q.data;
    const refundable = Number(p.refundable_amount);
    const validAmount = Number(amount) > 0 && Number(amount) <= refundable;
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/billing/payments", label: "Payments" }}
                title={formatMoney(p.amount, p.currency)}
                meta={<PaymentStatusBadge status={p.status} />}
                description={p.billing_profile ? <Link className="hover:underline" to={`/billing/customers/${p.billing_profile.id}`}>{p.billing_profile.legal_name}</Link> : "Not linked to a customer"}
                actions={canRefund && refundable > 0 && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status) && <Button variant="outline" onClick={() => { setAmount(String(refundable)); setOpen(true); }}><Undo2 /> Refund</Button>}
            />
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList columns={3} items={[
                        { label: "Received", value: formatDate(p.received_at) },
                        { label: "Method", value: getDropdownOptionLabel(PaymentMethodTypeOptions, p.method_type) },
                        { label: "Provider", value: p.provider_connection?.display_name ?? p.provider },
                        { label: "Reference", value: p.reference ?? p.provider_payment_id },
                        { label: "Fee", value: formatMoney(p.fee_amount, p.currency) },
                        { label: "Tax portion", value: formatMoney(p.tax_amount, p.currency) },
                        { label: "Allocated", value: formatMoney(p.allocated_amount, p.currency) },
                        { label: "Unallocated", value: formatMoney(p.unallocated_amount, p.currency) },
                        { label: "Refunded", value: formatMoney(p.refunded_amount, p.currency) },
                    ]} />
                </div>
                <Section title="Applied to invoices">
                    {p.allocations.length ? (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {p.allocations.map((a) => (
                                <Link key={a.id} to={`/billing/invoices/${a.invoice.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-border-soft">
                                    <span className="text-[13px] text-foreground">{a.invoice.number}</span>
                                    <span className="flex items-center gap-2"><span className="tabular text-[13px]">{formatMoney(a.amount, p.currency)}</span>{a.invoice.status && <InvoiceStatusBadge status={a.invoice.status} />}</span>
                                </Link>
                            ))}
                        </div>
                    ) : <EmptyState compact title="Not applied to an invoice" description={p.origin_ledger_record ? `Booked as income ${p.origin_ledger_record.number}.` : undefined} />}
                </Section>
                <Section title="Refunds">
                    {p.refunds.length ? (
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {p.refunds.map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3 text-[13px]">
                                    <span>{r.reason ?? "Refund"} · {formatDate(r.processed_at ?? r.created_at)}</span>
                                    <span className="flex items-center gap-2"><span className="tabular">{formatMoney(r.amount, p.currency)}</span><Badge variant={r.status === "SUCCEEDED" ? "success" : r.status === "PENDING" ? "warning" : "danger"}>{r.status.toLowerCase()}</Badge></span>
                                </li>
                            ))}
                        </ul>
                    ) : <EmptyState compact title="No refunds" />}
                </Section>
                <Section title="Activity">
                    <ul className="space-y-1 text-[13px]">
                        {p.timeline.map((t) => <li key={t.id}>{getDropdownOptionLabel(BillingEventLabelOptions, t.event_type)} <span className="text-muted-foreground">· {formatDateTime(t.created_at)} · {t.actor_user ? personName(t.actor_user) : "System"}</span></li>)}
                    </ul>
                </Section>
            </div>
            <ReasonDialog
                open={open}
                onOpenChange={setOpen}
                title="Refund payment"
                description={p.provider_connection ? `The refund is sent to ${p.provider_connection.display_name}.` : "Record a refund you paid back outside a provider."}
                confirmText="Refund"
                destructive
                pending={refund.isPending}
                extra={<div className="space-y-1.5"><Label htmlFor="refund-amount">Amount (max {formatMoney(refundable, p.currency)})</Label><Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />{!validAmount && <p className="text-xs text-danger">Enter an amount up to {refundable}</p>}</div>}
                onConfirm={(reason) => validAmount && refund.mutate({ id: p.id, amount, reason }, { onSuccess: () => setOpen(false) })}
            />
        </Page>
    );
}
