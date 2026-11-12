import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bell, CheckCircle2, Copy, CreditCard, Download, ExternalLink, FileMinus, Link2, MoreHorizontal, Pencil, Printer, Send, Trash2, XCircle } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useCreditNoteAction, useDeleteInvoice, useDownloadInvoicePdf, useInvoice, useInvoiceAction, useInvoiceCheckout } from "@/features/billing/hooks/use-billing";
import type { InvoiceDetail } from "@/features/billing/interfaces/billing.interfaces";
import { BillingEventLabelOptions, PaymentMethodTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { CreditNoteStatusBadge, InvoiceStatusBadge, PaymentStatusBadge } from "../components/billing-badges";
import { CopyButton } from "@/components/ui/copy-button";
import { CreditNoteDialog, ReasonDialog, RecordPaymentDialog, SendInvoiceDialog } from "../components/billing-dialogs";

const OPEN = ["OPEN", "PENDING", "PARTIALLY_PAID", "OVERDUE"];

/**
 * /billing/invoices/:id — invoice with status timeline and lifecycle actions.
 * @perm VIEW finance.invoices.read · edit .update · approve .approve · send .send · void .void · payment finance.payments.record ·
 *       credit note finance.credit_notes.manage · write-off finance.adjustments.manage · delete .delete
 * @api GET /finance/invoices/:id · POST /:id/{approve|reject|send|void|write-off|remind|payments|checkout|duplicate}
 */
export default function InvoiceDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const q = useInvoice(id);
    const pdf = useDownloadInvoicePdf();
    const p = usePermissions();
    const action = useInvoiceAction();
    const checkout = useInvoiceCheckout();
    const remove = useDeleteInvoice();
    const cnAction = useCreditNoteAction();
    const [dialog, setDialog] = useState<null | "pay" | "send" | "void" | "writeoff" | "reject" | "credit" | "delete">(null);
    /** The online payment link just created (copied to the clipboard and shown inline, no toast). */
    const [payLink, setPayLink] = useState<{ url: string; via: string } | null>(null);

    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const inv: InvoiceDetail = q.data;
    const cur = inv.currency;
    const draft = inv.status === "DRAFT";
    const open = OPEN.includes(inv.status);
    const needsApproval = draft && inv.approval.required && !inv.approval.approved;

    // No success toast: the status badge, totals and timeline update when the invoice refreshes.
    const run = (act: string, body?: Record<string, unknown>) => action.mutate({ id: inv.id, action: act, body }, { onSuccess: () => setDialog(null) });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/billing/invoices", label: "Invoices" }}
                title={draft ? "Draft invoice" : `Invoice ${inv.number}`}
                meta={<InvoiceStatusBadge status={inv.status} />}
                description={<Link className="hover:underline" to={`/billing/customers/${inv.billing_profile_id}`}>{inv.billing_profile.legal_name}</Link>}
                actions={
                    <>
                        {draft && p.can("finance.invoices.update") && <Button variant="outline" asChild><Link to={`/billing/invoices/${inv.id}/edit`}><Pencil /> Edit</Link></Button>}
                        {draft && p.can("finance.invoices.approve") && (inv.approval.required || !inv.approval.approved) && (
                            <Button variant={needsApproval ? "default" : "outline"} loading={action.isPending && action.variables?.action === "approve"} onClick={() => run("approve", {})}><CheckCircle2 /> Approve</Button>
                        )}
                        {(draft || open) && p.can("finance.invoices.send") && !needsApproval && <Button onClick={() => setDialog("send")}><Send /> {inv.sent_at ? "Send again" : "Send"}</Button>}
                        {open && p.can("finance.payments.record") && <Button variant="outline" onClick={() => setDialog("pay")}><CreditCard /> Record payment</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled={pdf.isPending} onSelect={() => pdf.mutate(inv.id)}><Download /> Download PDF</DropdownMenuItem>
                                <DropdownMenuItem asChild><a href={`/print/invoices/${inv.id}`} target="_blank" rel="noreferrer"><Printer /> Print</a></DropdownMenuItem>
                                {open && p.can("finance.invoices.send") && <DropdownMenuItem onSelect={() => checkout.mutate(inv.id, { onSuccess: (r) => { void navigator.clipboard?.writeText(r.url); setPayLink({ url: r.url, via: r.connection.display_name }); } })}><Link2 /> Online payment link</DropdownMenuItem>}
                                {open && p.can("finance.invoices.send") && <DropdownMenuItem onSelect={() => run("remind", {})}><Bell /> Send reminder</DropdownMenuItem>}
                                {draft && p.can("finance.invoices.approve") && inv.approval.history.some((h) => h.decision === "PENDING") && <DropdownMenuItem onSelect={() => setDialog("reject")}><XCircle /> Reject approval</DropdownMenuItem>}
                                {p.can("finance.invoices.create") && <DropdownMenuItem onSelect={() => action.mutate({ id: inv.id, action: "duplicate" }, { onSuccess: (r) => navigate(`/billing/invoices/${r.id}`) })}><Copy /> Duplicate</DropdownMenuItem>}
                                {!draft && inv.status !== "VOID" && p.can("finance.credit_notes.manage") && <DropdownMenuItem onSelect={() => setDialog("credit")}><FileMinus /> Credit note</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {open && p.can("finance.adjustments.manage") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDialog("writeoff")}>Mark uncollectible</DropdownMenuItem>}
                                {!draft && inv.status !== "VOID" && Number(inv.amount_paid) === 0 && p.can("finance.invoices.void") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDialog("void")}><XCircle /> Void</DropdownMenuItem>}
                                {draft && p.can("finance.invoices.delete") && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDialog("delete")}><Trash2 /> Delete draft</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
            />

            {payLink && (
                <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-[13px]">
                    <span className="text-muted-foreground">Payment link copied · collected through {payLink.via}</span>
                    <code className="min-w-0 flex-1 truncate text-xs text-foreground">{payLink.url}</code>
                    <CopyButton text={payLink.url} size="sm" variant="outline" label="Copy again" />
                    <Button size="sm" variant="ghost" onClick={() => setPayLink(null)}>Dismiss</Button>
                </div>
            )}
            {needsApproval && (
                <div className="mb-4 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning">
                    Needs approval under “{inv.approval.rule?.name}” before it can be sent.{inv.approval.rule?.require_distinct_user ? " The creator cannot approve it." : ""}
                </div>
            )}
            {inv.uncollectible_at && <div className="mb-4 rounded-lg border border-border bg-danger-soft px-4 py-3 text-[13px] text-danger">Marked uncollectible on {formatDate(inv.uncollectible_at)}: {inv.uncollectible_reason} ({formatMoney(inv.written_off_amount, cur)} written off)</div>}

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[["Total", inv.total], ["Paid", inv.amount_paid], ["Credited", inv.credited_amount], ["Amount due", inv.amount_due]].map(([label, v]) => (
                    <div key={label as string} className="rounded-lg border border-border bg-card p-3">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="mt-1 text-lg font-medium tabular text-foreground">{formatMoney(v as string, cur)}</div>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="overview">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="payments">Payments ({inv.allocations.length})</TabsTrigger>
                    <TabsTrigger value="credits">Credit notes ({inv.credit_notes.length})</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList columns={3} items={[
                            { label: "Bill to", value: inv.billing_profile.legal_name },
                            { label: "Billing e-mail", value: inv.billing_profile.billing_email },
                            { label: "VAT number", value: inv.billing_profile.vat_number },
                            { label: "Issued", value: formatDate(inv.issue_date) },
                            { label: "Due", value: formatDate(inv.due_date) },
                            { label: "Project", value: inv.project ? inv.project.name : null },
                            { label: "Sent", value: inv.sent_at ? formatDateTime(inv.sent_at) : "Not sent" },
                            { label: "Collected through", value: inv.provider_connection?.display_name ?? "Manual / bank transfer" },
                            { label: "Ledger record", value: inv.ledger_record ? <Link className="hover:underline" to={`/expenses/records/${inv.ledger_record.id}`}>{inv.ledger_record.number}</Link> : null },
                        ]} />
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-xs">Description</TableHead>
                                    <TableHead className="text-right text-xs">Qty</TableHead>
                                    <TableHead className="hidden text-right text-xs sm:table-cell">Unit price</TableHead>
                                    <TableHead className="hidden text-right text-xs md:table-cell">Tax</TableHead>
                                    <TableHead className="text-right text-xs">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inv.line_items.map((l, i) => (
                                    <TableRow key={l.id ?? i} className="border-border-soft">
                                        <TableCell className="text-[13px]">{l.description}{Number(l.discount_amount) > 0 && <div className="text-xs text-muted-foreground">Discount {formatMoney(l.discount_amount, cur)}</div>}</TableCell>
                                        <TableCell className="text-right tabular text-[13px]">{Number(l.quantity)}</TableCell>
                                        <TableCell className="hidden text-right tabular text-[13px] sm:table-cell">{formatMoney(l.unit_amount, cur)}</TableCell>
                                        <TableCell className="hidden text-right text-[13px] md:table-cell">{l.tax_rate ? l.tax_rate.name : `${Number(l.tax_percent ?? 0)}%`}</TableCell>
                                        <TableCell className="text-right tabular text-[13px]">{formatMoney(l.net_amount, cur)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="ml-auto max-w-xs space-y-1 border-t border-border p-4 text-[13px]">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{formatMoney(inv.subtotal, cur)}</span></div>
                            {Number(inv.discount_total) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount{inv.coupon ? ` (${inv.coupon.name})` : ""}</span><span className="tabular">−{formatMoney(inv.discount_total, cur)}</span></div>}
                            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular">{formatMoney(inv.tax_total, cur)}</span></div>
                            <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground"><span>Total</span><span className="tabular">{formatMoney(inv.total, cur)}</span></div>
                        </div>
                    </div>
                    {(inv.notes || inv.payment_instructions) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {inv.notes && <Section title="Notes"><p className="whitespace-pre-wrap text-[13px] text-body">{inv.notes}</p></Section>}
                            {inv.payment_instructions && <Section title="Payment instructions"><p className="whitespace-pre-wrap text-[13px] text-body">{inv.payment_instructions}</p></Section>}
                        </div>
                    )}
                    {inv.payment_links.length > 0 && (
                        <Section title="Online payment links">
                            {inv.payment_links.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-info hover:underline"><ExternalLink className="size-3.5" /> {l.title} · created {formatDate(l.created_at)}</a>)}
                        </Section>
                    )}
                </TabsContent>

                <TabsContent value="payments">
                    {inv.allocations.length ? (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {inv.allocations.map((a) => (
                                <Link key={a.id} to={`/billing/payments/${a.payment.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-border-soft">
                                    <div>
                                        <div className="text-[13px] text-foreground">{getDropdownOptionLabel(PaymentMethodTypeOptions, a.payment.method_type)} · {formatDate(a.payment.received_at)}</div>
                                        <div className="text-xs text-muted-foreground">{a.payment.reference ?? a.payment.provider}</div>
                                    </div>
                                    <div className="flex items-center gap-2"><span className="tabular text-[13px]">{formatMoney(a.amount, cur)}</span><PaymentStatusBadge status={a.payment.status} /></div>
                                </Link>
                            ))}
                        </div>
                    ) : <EmptyState compact title="No payments yet" description={open ? "Record a bank transfer or share an online payment link." : undefined} />}
                </TabsContent>

                <TabsContent value="credits">
                    {inv.credit_notes.length ? (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {inv.credit_notes.map((c) => (
                                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                    <div><div className="text-[13px] text-foreground">{c.status === "DRAFT" ? "Draft credit note" : c.number}</div><div className="text-xs text-muted-foreground">{c.reason}</div></div>
                                    <div className="flex items-center gap-2">
                                        <span className="tabular text-[13px]">{formatMoney(c.total, cur)}</span>
                                        <CreditNoteStatusBadge status={c.status} />
                                        {p.can("finance.credit_notes.manage") && c.status === "DRAFT" && <Button size="sm" variant="outline" loading={cnAction.isPending} onClick={() => cnAction.mutate({ id: c.id, action: "issue" })}>Issue</Button>}
                                        {p.can("finance.credit_notes.manage") && c.status === "ISSUED" && <Button size="sm" loading={cnAction.isPending} onClick={() => cnAction.mutate({ id: c.id, action: "apply" })}>Apply</Button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <EmptyState compact title="No credit notes" />}
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                    {inv.approval.history.length > 0 && (
                        <Section title="Approvals">
                            <ul className="space-y-1 text-[13px]">
                                {inv.approval.history.map((h) => <li key={h.id} className="flex items-center gap-2"><Badge variant={h.decision === "APPROVED" ? "success" : h.decision === "REJECTED" ? "danger" : h.decision === "PENDING" ? "warning" : "neutral"}>{h.decision.toLowerCase()}</Badge> Step {h.step} · {formatDateTime(h.decided_at ?? h.requested_at)}{h.rejection_reason ? ` — ${h.rejection_reason}` : ""}</li>)}
                            </ul>
                        </Section>
                    )}
                    <Section title="Timeline">
                        {inv.timeline.length ? (
                            <ol className="relative space-y-3 border-l border-border pl-4">
                                {inv.timeline.map((t) => (
                                    <li key={t.id} className="text-[13px]">
                                        <span className="absolute -left-[5px] mt-1.5 size-2 rounded-full bg-border-strong" />
                                        <div className="text-foreground">{getDropdownOptionLabel(BillingEventLabelOptions, t.event_type)}</div>
                                        <div className="text-xs text-muted-foreground">{formatDateTime(t.created_at)} · {t.actor_user ? personName(t.actor_user) : "System"}</div>
                                    </li>
                                ))}
                            </ol>
                        ) : <EmptyState compact title="No activity yet" />}
                    </Section>
                    <p className="text-xs text-muted-foreground">Created by {inv.created_by ? personName(inv.created_by) : "system"}{inv.approved_by ? ` · approved by ${personName(inv.approved_by)}` : ""}</p>
                </TabsContent>
            </Tabs>

            <RecordPaymentDialog open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)} invoice={{ id: inv.id, number: inv.number, amount_due: inv.amount_due, currency: cur, billing_profile_id: inv.billing_profile_id }} />
            <SendInvoiceDialog open={dialog === "send"} onOpenChange={(o) => setDialog(o ? "send" : null)} invoiceId={inv.id} defaultEmail={inv.billing_profile.billing_email} needsFinalize={draft} />
            <CreditNoteDialog open={dialog === "credit"} onOpenChange={(o) => setDialog(o ? "credit" : null)} invoice={inv} />
            <ReasonDialog open={dialog === "void"} onOpenChange={(o) => setDialog(o ? "void" : null)} title={`Void ${inv.number}?`} description="The invoice stays for the audit trail but is no longer owed. Its income record is voided." confirmText="Void invoice" destructive pending={action.isPending} onConfirm={(reason) => run("void", { reason })} />
            <ReasonDialog open={dialog === "writeoff"} onOpenChange={(o) => setDialog(o ? "writeoff" : null)} title="Mark as uncollectible?" description={`${formatMoney(inv.amount_due, cur)} is written off. The invoice stays overdue for reporting.`} confirmText="Write off" destructive pending={action.isPending} onConfirm={(reason) => run("write-off", { reason })} />
            <ReasonDialog open={dialog === "reject"} onOpenChange={(o) => setDialog(o ? "reject" : null)} title="Reject approval" confirmText="Reject" destructive pending={action.isPending} onConfirm={(reason) => run("reject", { reason })} />
            <ConfirmationDialog isOpen={dialog === "delete"} onClose={() => setDialog(null)} title="Delete this draft?" description="Drafts have no number yet, so nothing is lost from the sequence." confirmText="Delete" variant="destructive" isLoading={remove.isPending} onConfirm={() => { remove.mutate(inv.id); navigate("/billing/invoices"); }} />
        </Page>
    );
}
