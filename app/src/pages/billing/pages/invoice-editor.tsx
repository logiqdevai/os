import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { useBillingProfile, useCoupons, useCreateInvoice, useInvoice, useProducts, useTaxRates, useUpdateInvoice } from "@/features/billing/hooks/use-billing";
import { invoiceFormSchema, type InvoiceFormValues } from "@/features/billing/validation-schemas/billing.schema";
import type { Coupon, InvoiceInput, TaxRate } from "@/features/billing/interfaces/billing.interfaces";
import { usePermission } from "@/hooks/use-permission";
import { formatMoney } from "@/lib/format";
import { BillingProfilePicker, ProjectPicker } from "../components/billing-pickers";

const NONE = "__none";
const NO_RATES: TaxRate[] = [];
const NO_COUPONS: Coupon[] = [];
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = { product_id: null, price_id: null, description: "", quantity: "1", unit_amount: "0", discount_amount: "", tax_rate_id: null };

/** Client preview of the totals (the API recomputes them with Decimal math and is authoritative). */
function lineTotals(line: InvoiceFormValues["lines"][number], rates: TaxRate[]) {
    const base = Math.round((Number(line.quantity || 0) * Number(line.unit_amount || 0) - Number(line.discount_amount || 0)) * 100) / 100;
    const rate = rates.find((r) => r.id === line.tax_rate_id);
    const pct = rate ? Number(rate.percentage) : 0;
    if (rate?.behavior === "INCLUSIVE") {
        const net = Math.round((base / (1 + pct / 100)) * 100) / 100;
        return { net, tax: Math.round((base - net) * 100) / 100 };
    }
    return { net: base, tax: Math.round(base * pct) / 100 };
}

/**
 * /billing/invoices/new and /billing/invoices/:id/edit — draft editor with line items and live totals.
 * New: explicit "Create draft" (redirects to the invoice). Edit: the draft autosaves every valid change (<SaveStatus /> in
 * the header, no Save button); only DRAFT invoices are editable, issued ones are read-only.
 * @perm finance.invoices.create (new) / finance.invoices.update (edit) · only DRAFT invoices are editable
 * @api POST /finance/invoices · PATCH /finance/invoices/:id
 */
export default function InvoiceEditorPage() {
    const { id } = useParams();
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const existing = useInvoice(id);
    const rates = useTaxRates().data ?? NO_RATES;
    const coupons = useCoupons().data ?? NO_COUPONS;
    const products = useProducts({ limit: 200, active: true }, usePermission("finance.catalog.read"));
    const create = useCreateInvoice();
    const update = useUpdateInvoice();
    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: { billing_profile_id: sp.get("customer") ?? "", project_id: sp.get("project"), issue_date: today(), due_date: "", coupon_id: NONE, notes: "", payment_instructions: "", lines: [{ ...emptyLine, tax_rate_id: null }] },
    });
    const lines = useFieldArray({ control: form.control, name: "lines" });
    const watched = useWatch({ control: form.control });
    const profileId = watched.billing_profile_id;
    const profile = useBillingProfile(profileId || undefined);
    const currency = existing.data?.currency ?? profile.data?.currency ?? "EUR";

    // Default tax rate on the first empty line once rates load.
    useEffect(() => {
        const def = rates.find((r) => r.is_default);
        if (!id && def && form.getValues("lines.0.tax_rate_id") === null) form.setValue("lines.0.tax_rate_id", def.id);
    }, [rates, id, form]);

    // Load the draft into the form once per invoice: refetches after an autosave must not overwrite what is being typed.
    const loadedId = useRef<string | null>(null);
    useEffect(() => {
        const inv = existing.data;
        if (!inv || loadedId.current === inv.id) return;
        loadedId.current = inv.id;
        form.reset({
            billing_profile_id: inv.billing_profile_id, project_id: inv.project_id, issue_date: inv.issue_date?.slice(0, 10) ?? "", due_date: inv.due_date?.slice(0, 10) ?? "",
            coupon_id: inv.coupon_id ?? NONE, notes: inv.notes ?? "", payment_instructions: inv.payment_instructions ?? "",
            lines: inv.line_items.map((l) => ({ product_id: l.product_id, price_id: l.price_id, description: l.description, quantity: String(Number(l.quantity)), unit_amount: String(l.unit_amount), discount_amount: Number(l.discount_amount) ? String(l.discount_amount) : "", tax_rate_id: l.tax_rate_id })),
        });
    }, [existing.data, form]);

    const totals = useMemo(() => {
        const per = (watched.lines ?? []).map((l) => lineTotals(l as InvoiceFormValues["lines"][number], rates));
        const subtotal = per.reduce((a, x) => a + x.net, 0);
        const coupon = coupons.find((c) => c.id === watched.coupon_id);
        const discount = coupon ? (coupon.type === "PERCENTAGE" ? (subtotal * Number(coupon.value)) / 100 : Math.min(Number(coupon.value), subtotal)) : 0;
        const factor = subtotal ? 1 - discount / subtotal : 1;
        const tax = per.reduce((a, x) => a + x.tax * factor, 0);
        return { per, subtotal, discount, tax, total: subtotal - discount + tax };
    }, [watched.lines, watched.coupon_id, rates, coupons]);

    const productItems = (products.data?.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.prices[0] ? formatMoney(p.prices[0].unit_amount, p.prices[0].currency) : undefined }));
    const pickProduct = (index: number, productId: string | null) => {
        const p = products.data?.data.find((x) => x.id === productId);
        form.setValue(`lines.${index}.product_id`, productId);
        if (!p) return;
        const price = p.prices.find((x) => x.currency === currency) ?? p.prices[0];
        form.setValue(`lines.${index}.description`, p.name);
        if (price) {
            form.setValue(`lines.${index}.price_id`, price.id);
            form.setValue(`lines.${index}.unit_amount`, String(price.unit_amount));
        }
        if (p.default_tax_rate_id) form.setValue(`lines.${index}.tax_rate_id`, p.default_tax_rate_id);
    };

    const toDto = (v: InvoiceFormValues): InvoiceInput => ({
            billing_profile_id: v.billing_profile_id, project_id: v.project_id || null, issue_date: v.issue_date || null, due_date: v.due_date || null,
            coupon_id: v.coupon_id && v.coupon_id !== NONE ? v.coupon_id : null, notes: v.notes || null, payment_instructions: v.payment_instructions || null,
            lines: v.lines.map((l) => ({ product_id: l.product_id || null, price_id: l.price_id || null, description: l.description, quantity: l.quantity, unit_amount: l.unit_amount, discount_amount: l.discount_amount || "0", tax_rate_id: l.tax_rate_id || null, tax_percent: l.tax_rate_id ? null : "0" })),
    });
    // Edit mode: autosave the draft (the customer cannot change once the draft exists).
    const editable = !!id && existing.data?.status === "DRAFT";
    const autosave = useFormAutosave(form, (v) => {
        const { billing_profile_id: _b, ...rest } = toDto(v);
        return update.mutateAsync({ id: id as string, ...rest });
    }, { enabled: editable });
    const submit = form.handleSubmit((v) => {
        if (id) { autosave.flush(); navigate(`/billing/invoices/${id}`); return; }
        create.mutate(toDto(v), { onSuccess: (inv) => navigate(`/billing/invoices/${inv.id}`) });
    });

    if (id && existing.isPending) return <PageSkeleton />;
    if (id && existing.error) return <Page><ErrorState error={existing.error} onRetry={() => existing.refetch()} /></Page>;
    if (existing.data && existing.data.status !== "DRAFT") {
        return <Page><ErrorState error={new Error("Only draft invoices can be edited. Issue a credit note or duplicate the invoice instead.")} /></Page>;
    }

    return (
        <Page width="wide">
            <PageHeader title={id ? "Edit draft invoice" : "New invoice"} back={{ to: id ? `/billing/invoices/${id}` : "/billing/invoices", label: id ? "Invoice" : "Invoices" }} description={id ? "Changes save automatically. Drafts get their number when they are approved or sent." : "Drafts get their number when they are approved or sent."} meta={id ? <SaveStatus state={autosave} /> : undefined} />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-6">
                    <Section title="Customer">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <FormField control={form.control} name="billing_profile_id" render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Customer</FormLabel>
                                    <BillingProfilePicker value={field.value} onChange={(v) => field.onChange(v ?? "")} disabled={!!id} />
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="project_id" render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Project</FormLabel>
                                    <ProjectPicker value={field.value} onChange={field.onChange} />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="issue_date" render={({ field }) => (
                                <FormItem><FormLabel>Issue date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="due_date" render={({ field }) => (
                                <FormItem><FormLabel>Due date</FormLabel><FormControl><Input type="date" {...field} placeholder="From payment terms" /></FormControl>
                                    <p className="text-xs text-muted-foreground">Empty = issue date + {profile.data?.payment_terms_days ?? 14} days</p><FormMessage /></FormItem>
                            )} />
                            <div>
                                <div className="text-xs text-muted-foreground">Currency</div>
                                <div className="mt-2 text-[13px] text-foreground">{currency}</div>
                            </div>
                            <FormField control={form.control} name="coupon_id" render={({ field }) => (
                                <FormItem><FormLabel>Discount</FormLabel>
                                    <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Discount"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>No discount</SelectItem>
                                            {coupons.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.type === "PERCENTAGE" ? `${Number(c.value)}%` : formatMoney(c.value, c.currency ?? currency)})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            {profile.data?.reverse_charge && <p className="text-xs text-warning sm:col-span-4">Reverse charge customer: lines are invoiced without VAT.</p>}
                        </div>
                    </Section>

                    <Section title="Line items" actions={<Button type="button" variant="outline" size="sm" onClick={() => lines.append({ ...emptyLine, tax_rate_id: rates.find((r) => r.is_default)?.id ?? null })}><Plus /> Add line</Button>}>
                        <div className="space-y-3">
                            {lines.fields.map((f, i) => (
                                <div key={f.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-12">
                                    <div className="sm:col-span-4">
                                        <div className="mb-1 text-xs text-muted-foreground">Product</div>
                                        <EntityPicker items={productItems} value={watched.lines?.[i]?.product_id ?? null} onChange={(v) => pickProduct(i, v)} placeholder="Custom line" noneLabel="Custom line" ariaLabel={`Product of line ${i + 1}`} />
                                    </div>
                                    <FormField control={form.control} name={`lines.${i}.description`} render={({ field }) => (
                                        <FormItem className="sm:col-span-8"><FormLabel className="text-xs">Description</FormLabel><FormControl><Input {...field} placeholder="What is billed" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`lines.${i}.quantity`} render={({ field }) => (
                                        <FormItem className="sm:col-span-2"><FormLabel className="text-xs">Qty</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`lines.${i}.unit_amount`} render={({ field }) => (
                                        <FormItem className="sm:col-span-3"><FormLabel className="text-xs">Unit price</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`lines.${i}.discount_amount`} render={({ field }) => (
                                        <FormItem className="sm:col-span-2"><FormLabel className="text-xs">Discount</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`lines.${i}.tax_rate_id`} render={({ field }) => (
                                        <FormItem className="sm:col-span-3"><FormLabel className="text-xs">Tax</FormLabel>
                                            <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                                                <FormControl><SelectTrigger aria-label={`Tax of line ${i + 1}`}><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>No tax</SelectItem>
                                                    {rates.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({Number(r.percentage)}%)</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <div className="flex items-end justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Net</div>
                                            <div className="tabular text-[13px] text-foreground">{formatMoney(totals.per[i]?.net ?? 0, currency)}</div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} disabled={lines.fields.length === 1} onClick={() => lines.remove(i)}><Trash2 /></Button>
                                    </div>
                                </div>
                            ))}
                            {form.formState.errors.lines?.root && <p className="text-xs text-danger">{form.formState.errors.lines.root.message}</p>}
                        </div>
                        <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-border bg-card p-4 text-[13px]">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{formatMoney(totals.subtotal, currency)}</span></div>
                            {totals.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular">−{formatMoney(totals.discount, currency)}</span></div>}
                            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular">{formatMoney(totals.tax, currency)}</span></div>
                            <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground"><span>Total</span><span className="tabular">{formatMoney(totals.total, currency)}</span></div>
                        </div>
                    </Section>

                    <Section title="Notes">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem><FormLabel>Notes to the customer</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="payment_instructions" render={({ field }) => (
                                <FormItem><FormLabel>Payment instructions</FormLabel><FormControl><Textarea rows={3} placeholder="IBAN, reference to quote…" {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                    </Section>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {id ? (
                            <Button type="submit" variant="outline">Done</Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={create.isPending}>Cancel</Button>
                                <Button type="submit" loading={create.isPending}>Create draft</Button>
                            </>
                        )}
                    </div>
                </form>
            </Form>
        </Page>
    );
}
