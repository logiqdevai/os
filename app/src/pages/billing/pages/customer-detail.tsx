import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useBillingProfile } from "@/features/billing/hooks/use-billing";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { BillingIntervalOptions, PaymentMethodTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { formatDate, formatMoney } from "@/lib/format";
import { InvoiceStatusBadge, PaymentStatusBadge, SubscriptionStatusBadge } from "../components/billing-badges";
import { BillingProfileForm } from "../components/billing-profile-form";

/**
 * /billing/customers/:id — billing profile, balance, invoices, subscriptions and payment history.
 * @perm VIEW finance.invoices.read · edit finance.billing_profiles.manage · payments finance.payments.read
 * @api GET /finance/billing-profiles/:id · PATCH /finance/billing-profiles/:id
 */
export default function CustomerDetailPage() {
    const { id } = useParams();
    const q = useBillingProfile(id);
    const [editing, setEditing] = useState(false);
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const p = q.data;
    const addr = p.billing_address;
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/billing/customers", label: "Customer billing" }}
                title={p.legal_name}
                description={p.company?.name !== p.legal_name ? p.company?.name : undefined}
                actions={
                    <>
                        <Can permission="finance.billing_profiles.manage"><Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button></Can>
                        <Can permission="finance.invoices.create"><Button asChild><Link to={`/billing/invoices/new?customer=${p.id}`}><Plus /> New invoice</Link></Button></Can>
                    </>
                }
            />
            <StatGrid className="mb-4">
                <StatCard label="Outstanding" value={formatMoney(p.balance.outstanding, p.currency)} hint={`${p.balance.open_invoices} open`} tone={Number(p.balance.outstanding) > 0 ? "warning" : "default"} />
                <StatCard label="Invoiced (lifetime)" value={formatMoney(p.balance.invoiced, p.currency)} />
                <StatCard label="Paid (lifetime)" value={p.balance.paid === null ? "—" : formatMoney(p.balance.paid, p.currency)} />
                <StatCard label="Payment terms" value={`${p.payment_terms_days} days`} />
            </StatGrid>
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList columns={3} items={[
                        { label: "Billing e-mail", value: p.billing_email },
                        { label: "VAT number", value: p.vat_number },
                        { label: "Tax ID", value: p.tax_id },
                        { label: "Currency", value: p.currency },
                        { label: "Address", value: addr ? [addr.line1, [addr.postal_code, addr.city].filter(Boolean).join(" "), addr.country].filter(Boolean).join(", ") : null },
                        { label: "Tax", value: p.reverse_charge ? "EU reverse charge" : p.tax_exempt ? "Tax exempt" : "Standard" },
                        { label: "Dunning policy", value: p.dunning_policy?.name ?? "Organization default" },
                        { label: "Preferred provider", value: p.preferred_provider_connection?.display_name ?? "Routing" },
                        { label: "Saved payment methods", value: p.payment_methods.length ? p.payment_methods.map((m) => `${m.brand ?? getDropdownOptionLabel(PaymentMethodTypeOptions, m.type)} ${m.last4 ? `•••• ${m.last4}` : ""}`).join(", ") : "None" },
                    ]} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <Section title="Recent invoices">
                        {p.recent_invoices.length ? (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {p.recent_invoices.map((i) => <li key={i.id}><Link to={`/billing/invoices/${i.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-border-soft"><span>{i.status === "DRAFT" ? "Draft" : i.number} · {formatDate(i.issue_date)}</span><span className="flex items-center gap-2"><span className="tabular">{formatMoney(i.total, i.currency)}</span><InvoiceStatusBadge status={i.status} /></span></Link></li>)}
                            </ul>
                        ) : <EmptyState compact title="No invoices yet" />}
                    </Section>
                    <Section title="Subscriptions">
                        {p.subscriptions.length ? (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {p.subscriptions.map((s) => <li key={s.id}><Link to={`/billing/subscriptions/${s.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-border-soft"><span>{formatMoney(s.period_amount, s.currency)} / {getDropdownOptionLabel(BillingIntervalOptions, s.interval).toLowerCase()}</span><SubscriptionStatusBadge status={s.status} /></Link></li>)}
                            </ul>
                        ) : <EmptyState compact title="No subscriptions" />}
                    </Section>
                </div>
                <Can permission="finance.payments.read">
                    <Section title="Payment history">
                        {p.recent_payments.length ? (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {p.recent_payments.map((x) => <li key={x.id}><Link to={`/billing/payments/${x.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] hover:bg-border-soft"><span>{formatDate(x.received_at)} · {getDropdownOptionLabel(PaymentMethodTypeOptions, x.method_type)}</span><span className="flex items-center gap-2"><span className="tabular">{formatMoney(x.amount, x.currency)}</span><PaymentStatusBadge status={x.status} /></span></Link></li>)}
                            </ul>
                        ) : <EmptyState compact title="No payments yet" />}
                    </Section>
                </Can>
            </div>
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader><DialogTitle>Edit billing profile</DialogTitle><DialogDescription>Changes apply to new invoices.</DialogDescription></DialogHeader>
                    <BillingProfileForm profile={p} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
                </DialogContent>
            </Dialog>
        </Page>
    );
}
