import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useInvoice } from "@/features/billing/hooks/use-billing";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { InvoiceStatusOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { formatDate, formatMoney } from "@/lib/format";
import { usePageMetadata } from "@/hooks/use-page-metadata";

/**
 * /print/invoices/:id — clean printable invoice outside the app shell (browser "Save as PDF").
 * Uses the signed-in session; the API checks finance.invoices.read and scope. Light paper colors via theme tokens.
 */
export default function InvoicePrintPage() {
    const { id } = useParams();
    const q = useInvoice(id);
    usePageMetadata({ title: q.data ? `Invoice ${q.data.number}` : "Invoice" });
    useEffect(() => {
        document.documentElement.dataset.printView = "1";
        return () => { delete document.documentElement.dataset.printView; };
    }, []);
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <div className="p-6"><ErrorState error={q.error} /></div>;
    const inv = q.data;
    const cur = inv.currency;
    const addr = inv.billing_profile.billing_address;
    const notes = [...new Set(inv.line_items.map((l) => l.tax_rate?.invoice_note).filter(Boolean))];
    return (
        <div className="min-h-screen bg-background py-6 print:py-0">
            <div className="mx-auto mb-4 flex max-w-3xl justify-end px-4 print:hidden">
                <Button onClick={() => window.print()}><Printer /> Print or save as PDF</Button>
            </div>
            <article className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-6 text-[13px] text-foreground sm:p-10 print:border-0 print:p-0">
                <header className="flex flex-col justify-between gap-6 sm:flex-row">
                    <div>
                        {inv.seller?.logo_url && <img src={inv.seller.logo_url} alt="" className="mb-3 h-10 w-auto" />}
                        <div className="text-base font-medium">{inv.seller?.legal_name ?? inv.seller?.display_name}</div>
                        {inv.seller?.country && <div className="text-muted-foreground">{inv.seller.country}</div>}
                    </div>
                    <div className="sm:text-right">
                        <h1 className="text-2xl font-medium">{inv.status === "DRAFT" ? "Draft invoice" : "Invoice"}</h1>
                        {inv.status !== "DRAFT" && <div className="tabular">{inv.number}</div>}
                        <div className="mt-2 text-muted-foreground">Issued {formatDate(inv.issue_date)} · Due {formatDate(inv.due_date)}</div>
                        {["PAID", "VOID", "REFUNDED"].includes(inv.status) && <div className="mt-1 font-medium uppercase tracking-wide">{getDropdownOptionLabel(InvoiceStatusOptions, inv.status)}</div>}
                    </div>
                </header>
                <section className="mt-8">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</div>
                    <div className="mt-1 font-medium">{inv.billing_profile.legal_name}</div>
                    {addr && <div className="text-muted-foreground">{[addr.line1, addr.line2, [addr.postal_code, addr.city].filter(Boolean).join(" "), addr.country].filter(Boolean).join(", ")}</div>}
                    {inv.billing_profile.vat_number && <div className="text-muted-foreground">VAT {inv.billing_profile.vat_number}</div>}
                </section>
                <table className="mt-8 w-full border-collapse">
                    <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="py-2 font-medium">Description</th>
                            <th className="py-2 text-right font-medium">Qty</th>
                            <th className="py-2 text-right font-medium">Price</th>
                            <th className="py-2 text-right font-medium">Tax</th>
                            <th className="py-2 text-right font-medium">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inv.line_items.map((l, i) => (
                            <tr key={l.id ?? i} className="border-b border-border-soft align-top">
                                <td className="py-2 pr-2">{l.description}</td>
                                <td className="py-2 text-right tabular">{Number(l.quantity)}</td>
                                <td className="py-2 text-right tabular">{formatMoney(l.unit_amount, cur)}</td>
                                <td className="py-2 text-right">{Number(l.tax_percent ?? 0)}%</td>
                                <td className="py-2 text-right tabular">{formatMoney(l.net_amount, cur)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="ml-auto mt-4 w-full max-w-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{formatMoney(inv.subtotal, cur)}</span></div>
                    {Number(inv.discount_total) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular">−{formatMoney(inv.discount_total, cur)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular">{formatMoney(inv.tax_total, cur)}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 text-base font-medium"><span>Total</span><span className="tabular">{formatMoney(inv.total, cur)}</span></div>
                    {Number(inv.amount_paid) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular">−{formatMoney(inv.amount_paid, cur)}</span></div>}
                    <div className="flex justify-between font-medium"><span>Amount due</span><span className="tabular">{formatMoney(inv.amount_due, cur)}</span></div>
                </div>
                {notes.length > 0 && <p className="mt-6 text-xs text-muted-foreground">{notes.join(" · ")}</p>}
                {inv.payment_instructions && <section className="mt-6"><div className="text-xs uppercase tracking-wide text-muted-foreground">Payment</div><p className="mt-1 whitespace-pre-wrap">{inv.payment_instructions}</p></section>}
                {inv.hosted_invoice_url && <p className="mt-2 break-all text-xs">Pay online: {inv.hosted_invoice_url}</p>}
                {inv.notes && <p className="mt-6 whitespace-pre-wrap text-muted-foreground">{inv.notes}</p>}
                {inv.footer && <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">{inv.footer}</footer>}
            </article>
        </div>
    );
}
