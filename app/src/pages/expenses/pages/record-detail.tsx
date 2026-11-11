import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CreditCard, Pencil, Send, Trash2, XCircle } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useAddSettlement, useDeleteRecord, usePaymentMethods, useRecord, useRecordAction } from "@/features/expenses/hooks/use-expenses";
import { settlementSchema, type SettlementFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { LedgerEventLabelOptions, RecordSourceOptions, SettlementKindOptions, VatTreatmentOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { LedgerPaymentBadge, RecordStatusBadge, TypeBadge } from "../components/ledger-ui";
import { todayIso } from "../utils/ranges";

const NONE = "__none";

/**
 * /expenses/records/:id — record with VAT breakdown, payments, approvals and change history.
 * @perm VIEW finance.income.read / finance.expenses.read · edit/payments/void .update · approve finance.expenses.approve (never your own) · delete draft .delete
 * @api GET /ledger/records/:id · POST /:id/{post|approve|reject|void} · POST /:id/settlements · DELETE /:id
 */
export default function RecordDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const q = useRecord(id);
    const p = usePermissions();
    const act = useRecordAction();
    const remove = useDeleteRecord();
    const [dialog, setDialog] = useState<null | "pay" | "void" | "reject" | "delete">(null);
    const [reason, setReason] = useState("");
    useEffect(() => { setReason(""); }, [dialog]);
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const r = q.data;
    const key = r.type === "INCOME" ? "finance.income" : "finance.expenses";
    const canUpdate = p.can(`${key}.update`);
    const cur = r.currency;
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/expenses/ledger", label: "Ledger" }}
                title={r.description}
                meta={<><TypeBadge type={r.type} /><RecordStatusBadge status={r.status} />{r.status === "POSTED" && <LedgerPaymentBadge status={r.payment_status} />}</>}
                description={`${r.number} · ${getDropdownOptionLabel(RecordSourceOptions, r.source)}`}
                actions={
                    <>
                        {canUpdate && r.status !== "VOIDED" && <Button variant="outline" asChild><Link to={`/expenses/records/${r.id}/edit`}><Pencil /> Edit</Link></Button>}
                        {canUpdate && r.status === "DRAFT" && <Button loading={act.isPending} onClick={() => act.mutate({ id: r.id, action: "post" })}><Send /> Post</Button>}
                        {r.status === "PENDING_REVIEW" && p.can("finance.expenses.approve") && (
                            <>
                                <Button loading={act.isPending} onClick={() => act.mutate({ id: r.id, action: "approve", body: {} })}><CheckCircle2 /> Approve</Button>
                                <Button variant="outline" onClick={() => setDialog("reject")}>Reject</Button>
                            </>
                        )}
                        {canUpdate && r.status === "POSTED" && r.can_edit_amounts && Number(r.amount_remaining) > 0 && <Button variant="outline" onClick={() => setDialog("pay")}><CreditCard /> Record payment</Button>}
                        {canUpdate && r.status !== "VOIDED" && r.source !== "INVOICE_SYNC" && r.status !== "DRAFT" && <Button variant="destructive" onClick={() => setDialog("void")}><XCircle /> Void</Button>}
                        {r.status === "DRAFT" && p.can(`${key}.delete`) && <Button variant="destructive" onClick={() => setDialog("delete")}><Trash2 /> Delete</Button>}
                    </>
                }
            />
            {r.status === "PENDING_REVIEW" && <div className="mb-4 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning">Waiting for approval by a second member before it counts in reports.</div>}
            {r.voided_at && <div className="mb-4 rounded-lg border border-border bg-secondary px-4 py-3 text-[13px] text-muted-foreground">Voided on {formatDate(r.voided_at)}: {r.void_reason}</div>}
            {r.invoice && <div className="mb-4 rounded-lg border border-border bg-info-soft px-4 py-3 text-[13px] text-info">Synced from invoice <Link className="underline" to={`/billing/invoices/${r.invoice.id}`}>{r.invoice.number}</Link>. Amounts and payments follow Billing.</div>}

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[["Net", r.net_amount], [`VAT ${Number(r.vat_percent)}%`, r.vat_amount], ["Gross", r.gross_amount], ["Paid", r.amount_paid], ["Remaining", r.amount_remaining]].map(([label, val]) => (
                    <div key={label as string} className="rounded-lg border border-border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-medium tabular text-foreground">{formatMoney(val as string, cur)}</div></div>
                ))}
            </div>
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList columns={3} items={[
                        { label: "Date", value: formatDate(r.transaction_date) },
                        { label: "Due", value: formatDate(r.due_date) },
                        { label: "Paid on", value: formatDate(r.payment_date) },
                        { label: "Category", value: r.category_path_snapshot ?? r.category?.name ?? "Uncategorized" },
                        { label: r.type === "INCOME" ? "Customer" : "Supplier", value: r.company ? (r.type === "EXPENSE" ? <Link className="hover:underline" to={`/expenses/vendors/${r.company.id}`}>{r.company.name}</Link> : r.company.name) : r.counterparty_name },
                        { label: "Project", value: r.project?.name },
                        { label: "Reference", value: r.reference_number },
                        { label: "VAT treatment", value: `${getDropdownOptionLabel(VatTreatmentOptions, r.vat_treatment)}${r.amounts_overridden ? " (overridden)" : ""}` },
                        { label: "Payment method", value: r.payment_method?.name },
                        { label: "Period", value: r.period ? `${r.period.name} (${r.period.status.toLowerCase()})` : null },
                        { label: "Created by", value: r.created_by ? personName(r.created_by.user) : "System" },
                        { label: "Approved by", value: r.approved_by ? `${personName(r.approved_by.user)} · ${formatDate(r.approved_at)}` : null },
                    ]} />
                    {r.notes && <p className="mt-4 whitespace-pre-wrap text-[13px] text-body">{r.notes}</p>}
                </div>
                {r.line_items && r.line_items.length > 0 && (
                    <Section title="Line items">
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">{r.line_items.map((l, i) => <li key={i} className="flex justify-between gap-2 px-4 py-2 text-[13px]"><span>{l.description}</span><span className="tabular">{l.gross ? formatMoney(l.gross, cur) : ""}</span></li>)}</ul>
                    </Section>
                )}
                <Section title="Payments">
                    {r.settlements.length ? (
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {r.settlements.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-[13px]"><span>{getDropdownOptionLabel(SettlementKindOptions, s.kind)} · {formatDate(s.settled_on)}{s.payment_method ? ` · ${s.payment_method.name}` : ""}{s.reference ? ` · ${s.reference}` : ""}</span><span className="tabular">{s.kind === "REFUND" ? "−" : ""}{formatMoney(s.amount, s.currency)}</span></li>)}
                        </ul>
                    ) : <EmptyState compact title="No payments recorded" />}
                </Section>
                {r.approvals.length > 0 && (
                    <Section title="Approvals">
                        <ul className="space-y-1 text-[13px]">{r.approvals.map((a) => <li key={a.id} className="flex items-center gap-2"><Badge variant={a.decision === "APPROVED" ? "success" : a.decision === "REJECTED" ? "danger" : a.decision === "PENDING" ? "warning" : "neutral"}>{a.decision.toLowerCase()}</Badge>Step {a.step} · {formatDateTime(a.decided_at ?? a.requested_at)}{a.rejection_reason ? ` — ${a.rejection_reason}` : ""}</li>)}</ul>
                    </Section>
                )}
                <Section title="History">
                    {r.history.length ? (
                        <ol className="space-y-2 border-l border-border pl-4">
                            {r.history.map((h) => <li key={h.id} className="text-[13px]"><div className="text-foreground">{getDropdownOptionLabel(LedgerEventLabelOptions, h.event_type)}</div><div className="text-xs text-muted-foreground">{formatDateTime(h.created_at)} · {h.actor_user ? personName(h.actor_user) : "System"}</div></li>)}
                        </ol>
                    ) : <EmptyState compact title="No changes yet" />}
                </Section>
            </div>

            <SettlementDialog open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : null)} recordId={r.id} remaining={String(r.amount_remaining)} currency={cur} />
            <Dialog open={dialog === "void" || dialog === "reject"} onOpenChange={(o) => !act.isPending && !o && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{dialog === "void" ? `Void ${r.number}?` : "Reject record"}</DialogTitle><DialogDescription>{dialog === "void" ? "It stays in the history but no longer counts in reports." : "The record goes back to draft for the creator to fix."}</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="reason">Reason</Label><Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialog(null)} disabled={act.isPending}>Cancel</Button>
                        <Button variant="destructive" disabled={!reason.trim()} loading={act.isPending} onClick={() => act.mutate({ id: r.id, action: dialog === "void" ? "void" : "reject", body: { reason: reason.trim() } }, { onSuccess: () => setDialog(null) })}>{dialog === "void" ? "Void" : "Reject"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog isOpen={dialog === "delete"} onClose={() => setDialog(null)} title="Delete this draft?" description="The draft is removed; its history stays in the audit log." confirmText="Delete" variant="destructive" isLoading={remove.isPending} onConfirm={() => remove.mutate(r.id, { onSuccess: () => navigate("/expenses/ledger") })} />
        </Page>
    );
}

function SettlementDialog({ open, onOpenChange, recordId, remaining, currency }: { open: boolean; onOpenChange: (o: boolean) => void; recordId: string; remaining: string; currency: string }) {
    const add = useAddSettlement();
    const methods = usePaymentMethods(open);
    const form = useForm<SettlementFormValues>({ resolver: zodResolver(settlementSchema), defaultValues: { kind: "PAYMENT", amount: remaining, settled_on: todayIso(), payment_method_id: NONE, reference: "" } });
    useEffect(() => { if (open) form.reset({ kind: "PAYMENT", amount: String(Number(remaining)), settled_on: todayIso(), payment_method_id: NONE, reference: "" }); }, [open, remaining, form]);
    const submit = form.handleSubmit((v) => add.mutate({ id: recordId, kind: v.kind, amount: v.amount, settled_on: v.settled_on, payment_method_id: v.payment_method_id && v.payment_method_id !== NONE ? v.payment_method_id : null, reference: v.reference || null }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>{formatMoney(remaining, currency)} remaining. Several partial payments are allowed.</DialogDescription></DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="kind" render={({ field }) => (<FormItem><FormLabel>Kind</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl><SelectContent>{SettlementKindOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="settled_on" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="payment_method_id" render={({ field }) => (<FormItem><FormLabel>Account</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Account"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>As on the record</SelectItem>{methods.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="reference" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Reference</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={add.isPending}>Cancel</Button><Button type="submit" loading={add.isPending}>Record</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
