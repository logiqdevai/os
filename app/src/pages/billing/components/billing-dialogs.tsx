import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentMethodTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { recordPaymentSchema, type RecordPaymentFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { useCreateCreditNote, useInvoiceAction, useInvoices, useRecordPayment } from "@/features/billing/hooks/use-billing";
import { formatMoney } from "@/lib/format";
import { BillingProfilePicker } from "./billing-pickers";

const today = () => new Date().toISOString().slice(0, 10);

/** Generic "reason" dialog (void, write-off, reject, refund reason …). */
export function ReasonDialog({ open, onOpenChange, title, description, confirmText, destructive, pending, onConfirm, extra }: {
    open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; confirmText: string; destructive?: boolean; pending?: boolean;
    onConfirm: (reason: string) => void; extra?: ReactNode;
}) {
    const [reason, setReason] = useState("");
    useEffect(() => { if (open) setReason(""); }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {extra}
                <div className="space-y-1.5">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button variant={destructive ? "destructive" : "default"} disabled={!reason.trim()} loading={pending} onClick={() => onConfirm(reason.trim())}>{confirmText}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Record a manual payment, for one invoice (amount defaults to the amount due) or for a customer with an optional invoice. */
export function RecordPaymentDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (o: boolean) => void; invoice?: { id: string; number: string; amount_due: string | number; currency: string; billing_profile_id: string } | null }) {
    const record = useRecordPayment();
    const [profileId, setProfileId] = useState<string | null>(null);
    const [invoiceId, setInvoiceId] = useState<string>("__none");
    const open_invoices = useInvoices({ billing_profile_id: profileId ?? undefined, status: "OPEN,PARTIALLY_PAID,OVERDUE,PENDING", limit: 50 });
    const form = useForm<RecordPaymentFormValues>({ resolver: zodResolver(recordPaymentSchema), defaultValues: { amount: "", method_type: "BANK_TRANSFER", received_at: today(), reference: "", fee_amount: "" } });
    useEffect(() => {
        if (!open) return;
        setProfileId(invoice?.billing_profile_id ?? null);
        setInvoiceId(invoice?.id ?? "__none");
        form.reset({ amount: invoice ? String(invoice.amount_due) : "", method_type: "BANK_TRANSFER", received_at: today(), reference: "", fee_amount: "" });
    }, [open, invoice, form]);
    const chosen = invoice ?? open_invoices.data?.data.find((i) => i.id === invoiceId) ?? null;
    const submit = form.handleSubmit((v) => {
        if (!profileId) return;
        record.mutate(
            {
                billing_profile_id: profileId, amount: v.amount, method_type: v.method_type, received_at: v.received_at, reference: v.reference || null, fee_amount: v.fee_amount || undefined,
                ...(chosen && { currency: chosen.currency, allocations: [{ invoice_id: chosen.id, amount: String(Math.min(Number(v.amount), Number(chosen.amount_due))) }] }),
            },
            { onSuccess: () => onOpenChange(false) },
        );
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !record.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Record payment</DialogTitle>
                            <DialogDescription>{invoice ? `For invoice ${invoice.number} (${formatMoney(invoice.amount_due, invoice.currency)} due).` : "A bank transfer, cash or card payment received outside a provider."}</DialogDescription>
                        </DialogHeader>
                        {!invoice && (
                            <div className="grid gap-3">
                                <div className="space-y-1.5"><Label>Customer</Label><BillingProfilePicker value={profileId} onChange={(v) => { setProfileId(v); setInvoiceId("__none"); }} /></div>
                                <div className="space-y-1.5">
                                    <Label>Apply to invoice</Label>
                                    <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); const inv = open_invoices.data?.data.find((i) => i.id === v); if (inv) form.setValue("amount", String(inv.amount_due)); }} disabled={!profileId}>
                                        <SelectTrigger aria-label="Invoice"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none">Not applied (unallocated)</SelectItem>
                                            {open_invoices.data?.data.map((i) => <SelectItem key={i.id} value={i.id}>{i.number} · {formatMoney(i.amount_due, i.currency)} due</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="received_at" render={({ field }) => (<FormItem><FormLabel>Received on</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="method_type" render={({ field }) => (
                                <FormItem><FormLabel>Method</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Method"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{PaymentMethodTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="fee_amount" render={({ field }) => (<FormItem><FormLabel>Bank / processing fee</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="reference" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Reference</FormLabel><FormControl><Input placeholder="Bank reference" {...field} /></FormControl></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={record.isPending}>Cancel</Button>
                            <Button type="submit" loading={record.isPending} disabled={!profileId}>Record payment</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Send an invoice (recipients default to the billing e-mail). */
export function SendInvoiceDialog({ open, onOpenChange, invoiceId, defaultEmail, needsFinalize }: { open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string; defaultEmail: string | null; needsFinalize: boolean }) {
    const action = useInvoiceAction();
    const [to, setTo] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => { if (open) { setTo(defaultEmail ?? ""); setMessage(""); } }, [open, defaultEmail]);
    const emails = to.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    const valid = emails.length > 0 && emails.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    return (
        <Dialog open={open} onOpenChange={(o) => !action.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Send invoice</DialogTitle>
                    <DialogDescription>{needsFinalize ? "The draft gets its invoice number and is locked for editing." : "The customer receives the invoice with a link to pay."}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="to">To</Label><Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="billing@customer.com" />{!valid && to && <p className="text-xs text-danger">Enter valid e-mail addresses separated by commas</p>}</div>
                    <div className="space-y-1.5"><Label htmlFor="msg">Message</Label><Textarea id="msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message" /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={action.isPending}>Cancel</Button>
                    <Button disabled={!valid} loading={action.isPending} onClick={() => action.mutate({ id: invoiceId, action: "send", body: { to: emails, message: message || null } }, { onSuccess: () => onOpenChange(false) })}>Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Credit note: the full invoice or a partial amount. */
export function CreditNoteDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: { id: string; number: string; total: string | number; currency: string } }) {
    const create = useCreateCreditNote();
    const [full, setFull] = useState(true);
    const [amount, setAmount] = useState("");
    const [tax, setTax] = useState("0");
    const [reason, setReason] = useState("");
    const [issue, setIssue] = useState(true);
    useEffect(() => { if (open) { setFull(true); setAmount(""); setTax("0"); setReason(""); setIssue(true); } }, [open]);
    const ok = reason.trim() && (full || (Number(amount) > 0 && !Number.isNaN(Number(tax))));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Credit note for {invoice.number}</DialogTitle>
                    <DialogDescription>Reduces what the customer owes. Apply it to the invoice once issued.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="full">Credit the full invoice ({formatMoney(invoice.total, invoice.currency)})</Label><Switch id="full" checked={full} onCheckedChange={setFull} /></div>
                    {!full && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label htmlFor="cn-amount">Net amount</Label><Input id="cn-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="cn-tax">Tax %</Label><Input id="cn-tax" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
                        </div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="cn-reason">Reason</Label><Textarea id="cn-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="cn-issue">Issue now (assigns a CN number)</Label><Switch id="cn-issue" checked={issue} onCheckedChange={setIssue} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button disabled={!ok} loading={create.isPending} onClick={() => create.mutate({ invoice_id: invoice.id, reason: reason.trim(), issue, ...(!full && { lines: [{ description: reason.trim().slice(0, 200), unit_amount: amount, tax_percent: tax || "0" }] }) }, { onSuccess: () => onOpenChange(false) })}>Create credit note</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
