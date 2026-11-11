import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pause, Play, Receipt, XCircle } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useSubscription, useSubscriptionAction } from "@/features/billing/hooks/use-billing";
import { BillingEventLabelOptions, BillingIntervalOptions, CancelAtOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { InvoiceStatusBadge, SubscriptionStatusBadge } from "../components/billing-badges";
import { ReasonDialog } from "../components/billing-dialogs";

/**
 * /billing/subscriptions/:id — plan, periods, invoices and history.
 * @perm VIEW finance.subscriptions.read · pause/resume/cancel/invoice now finance.subscriptions.manage
 * @api GET /finance/subscriptions/:id · POST /:id/{pause|resume|cancel|reactivate|invoice-now}
 */
export default function SubscriptionDetailPage() {
    const { id } = useParams();
    const q = useSubscription(id);
    const p = usePermissions();
    const act = useSubscriptionAction();
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelAt, setCancelAt] = useState<"period_end" | "now">("period_end");
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const s = q.data;
    const manage = p.can("finance.subscriptions.manage");
    const live = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(s.status);
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/billing/subscriptions", label: "Subscriptions" }}
                title={s.company?.name ?? s.billing_profile.legal_name}
                meta={<SubscriptionStatusBadge status={s.status} />}
                description={`${formatMoney(s.period_amount, s.currency)} per ${s.interval_count > 1 ? `${s.interval_count} ` : ""}${getDropdownOptionLabel(BillingIntervalOptions, s.interval).toLowerCase()} · MRR ${formatMoney(s.mrr, s.currency)}`}
                actions={manage && (
                    <>
                        {live && p.can("finance.invoices.create") && <Button variant="outline" loading={act.isPending && act.variables?.action === "invoice-now"} onClick={() => act.mutate({ id: s.id, action: "invoice-now" })}><Receipt /> Invoice this period</Button>}
                        {live && <Button variant="outline" onClick={() => act.mutate({ id: s.id, action: "pause", body: {} })}><Pause /> Pause</Button>}
                        {s.status === "PAUSED" && <Button onClick={() => act.mutate({ id: s.id, action: "resume" })}><Play /> Resume</Button>}
                        {s.cancel_at && live && <Button variant="outline" onClick={() => act.mutate({ id: s.id, action: "reactivate" })}>Keep subscription</Button>}
                        {(live || s.status === "PAUSED") && !s.cancel_at && <Button variant="destructive" onClick={() => setCancelOpen(true)}><XCircle /> Cancel</Button>}
                    </>
                )}
            />
            {s.cancel_at && <div className="mb-4 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning">Ends on {formatDate(s.cancel_at)}{s.cancellation_reason ? ` — ${s.cancellation_reason}` : ""}</div>}
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList columns={3} items={[
                        { label: "Customer", value: <Link className="hover:underline" to={`/billing/customers/${s.billing_profile.id}`}>{s.billing_profile.legal_name}</Link> },
                        { label: "Current period", value: `${formatDate(s.current_period_start)} – ${formatDate(s.current_period_end)}` },
                        { label: "Next invoice", value: formatDate(s.next_invoice_date) },
                        { label: "Started", value: formatDate(s.started_at) },
                        { label: "Trial ends", value: s.trial_end ? formatDate(s.trial_end) : null },
                        { label: "Setup fee", value: s.setup_fee ? formatMoney(s.setup_fee, s.currency) : null },
                    ]} />
                </div>
                <Section title="Plan">
                    <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {s.items.map((i) => <li key={i.id} className="flex justify-between gap-2 px-4 py-3 text-[13px]"><span>{i.product?.name ?? i.description} × {Number(i.quantity)}</span><span className="tabular">{formatMoney(Number(i.quantity) * Number(i.unit_amount), s.currency)}</span></li>)}
                    </ul>
                </Section>
                <Section title="Invoices">
                    {s.invoices.length ? (
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {s.invoices.map((i) => <li key={i.id}><Link to={`/billing/invoices/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] hover:bg-border-soft"><span>{i.number} · {formatDate(i.period_start)} – {formatDate(i.period_end)}</span><span className="flex items-center gap-2"><span className="tabular">{formatMoney(i.total, i.currency)}</span><InvoiceStatusBadge status={i.status} /></span></Link></li>)}
                        </ul>
                    ) : <EmptyState compact title="No invoices yet" />}
                </Section>
                <Section title="History">
                    <ul className="space-y-1 text-[13px]">{s.history.map((h) => <li key={h.id}>{getDropdownOptionLabel(BillingEventLabelOptions, h.event_type)} <span className="text-muted-foreground">· {formatDateTime(h.created_at)} · {h.actor_user ? personName(h.actor_user) : "System"}</span></li>)}</ul>
                </Section>
            </div>
            <ReasonDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                title="Cancel subscription"
                confirmText="Cancel subscription"
                destructive
                pending={act.isPending}
                extra={<div className="space-y-1.5"><Label>When</Label><Select value={cancelAt} onValueChange={(v) => setCancelAt(v as "period_end" | "now")}><SelectTrigger aria-label="When"><SelectValue /></SelectTrigger><SelectContent>{CancelAtOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>}
                onConfirm={(reason) => act.mutate({ id: s.id, action: "cancel", body: { at: cancelAt, reason } }, { onSuccess: () => setCancelOpen(false) })}
            />
        </Page>
    );
}
