import { useEffect, useMemo, useRef } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useTaxRates } from "@/features/billing/hooks/use-billing";
import type { TaxRate } from "@/features/billing/interfaces/billing.interfaces";
import { useAutosaveRecord, useCreateRecord, usePaymentMethods, useRecord, useUpdateRecord } from "@/features/expenses/hooks/use-expenses";
import type { LedgerRecordInput, LedgerVatTreatment } from "@/features/expenses/interfaces/expenses.interfaces";
import { recordFormSchema, type RecordFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { PricingModeOptions, RecordTypeOptions, VatTreatmentOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { formatMoney } from "@/lib/format";
import { CategoryPicker, CompanyPicker, ProjectPicker } from "../components/ledger-ui";
import { todayIso } from "../utils/ranges";

const NONE = "__none";
const NO_RATES: TaxRate[] = [];

/**
 * /expenses/new (?type=INCOME|EXPENSE) and /expenses/records/:id/edit — manual income / expense entry with automatic VAT.
 * New: explicit "Save as draft" / "Save and post". Edit: drafts autosave (<SaveStatus />, no Save button); posted records
 * keep "Save changes" because every change to them is an audited amendment.
 * @perm finance.expenses.create / finance.income.create (new) · .update (edit) · amounts above the approval threshold go to review
 * @api POST /ledger/records · PATCH /ledger/records/:id
 */
export default function RecordFormPage() {
    const { id } = useParams();
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const p = usePermissions();
    const session = useSessionData();
    const existing = useRecord(id);
    const rates = useTaxRates().data ?? NO_RATES;
    const methods = usePaymentMethods();
    const create = useCreateRecord();
    const update = useUpdateRecord();
    const autosaveRecord = useAutosaveRecord();
    const initialType = (sp.get("type") === "INCOME" ? "INCOME" : "EXPENSE") as "INCOME" | "EXPENSE";
    const form = useForm<RecordFormValues>({
        resolver: zodResolver(recordFormSchema),
        defaultValues: {
            type: initialType, description: "", category_id: undefined, reference_number: "", transaction_date: todayIso(), due_date: "", amount: "", pricing_mode: "INCLUSIVE",
            tax_rate_id: NONE, vat_percent: "", vat_treatment: "STANDARD", override_vat: false, vat_amount: "", currency: session?.active_organization?.default_currency ?? "EUR",
            company_id: sp.get("company"), project_id: sp.get("project"), payment_method_id: NONE, mark_paid: false, payment_date: "", notes: "",
        },
    });
    const v = useWatch({ control: form.control });

    // Load the record once per id: refetches after an autosave must not overwrite what is being typed.
    const loadedId = useRef<string | null>(null);
    useEffect(() => {
        const r = existing.data;
        if (!r || loadedId.current === r.id) return;
        loadedId.current = r.id;
        form.reset({
            type: r.type, description: r.description, category_id: r.subcategory_id ?? r.category_id ?? undefined, reference_number: r.reference_number ?? "", transaction_date: r.transaction_date.slice(0, 10),
            due_date: r.due_date?.slice(0, 10) ?? "", amount: String(r.pricing_mode === "INCLUSIVE" ? r.gross_amount : r.net_amount), pricing_mode: r.pricing_mode, tax_rate_id: r.tax_rate_id ?? NONE,
            vat_percent: String(Number(r.vat_percent)), vat_treatment: r.vat_treatment, override_vat: r.amounts_overridden, vat_amount: String(r.vat_amount), currency: r.currency,
            company_id: r.company_id, project_id: r.project_id, payment_method_id: r.payment_method_id ?? NONE, mark_paid: false, payment_date: "", notes: r.notes ?? "",
        });
    }, [existing.data, form]);

    // Picking a tax rate fills the VAT %.
    useEffect(() => {
        const rate = rates.find((r) => r.id === v.tax_rate_id);
        if (rate) form.setValue("vat_percent", String(Number(rate.percentage)));
    }, [v.tax_rate_id, rates, form]);

    const preview = useMemo(() => {
        const amt = Number(v.amount || 0);
        const zero = ["EXEMPT", "REVERSE_CHARGE", "OUT_OF_SCOPE", "ZERO_RATED"].includes(v.vat_treatment ?? "");
        const pct = zero ? 0 : Number(v.vat_percent || 0);
        if (v.override_vat) {
            const vat = Number(v.vat_amount || 0);
            return v.pricing_mode === "INCLUSIVE" ? { net: amt - vat, vat, gross: amt } : { net: amt, vat, gross: amt + vat };
        }
        if (v.pricing_mode === "INCLUSIVE") {
            const net = Math.round((amt / (1 + pct / 100)) * 100) / 100;
            return { net, vat: Math.round((amt - net) * 100) / 100, gross: amt };
        }
        const vat = Math.round(amt * pct) / 100;
        return { net: amt, vat, gross: amt + vat };
    }, [v.amount, v.vat_percent, v.pricing_mode, v.override_vat, v.vat_amount, v.vat_treatment]);

    const synced = existing.data && !existing.data.can_edit_amounts;
    const type = v.type ?? "EXPENSE";
    const key = type === "INCOME" ? "finance.income" : "finance.expenses";
    const pending = create.isPending || update.isPending;
    const toDto = (vals: RecordFormValues, status: "DRAFT" | "POSTED"): LedgerRecordInput => {
        const amountField = vals.pricing_mode === "INCLUSIVE" && !vals.override_vat ? { gross_amount: vals.amount } : { net_amount: vals.override_vat && vals.pricing_mode === "INCLUSIVE" ? String(Math.round((Number(vals.amount) - Number(vals.vat_amount || 0)) * 100) / 100) : vals.amount };
        return {
            type: vals.type, description: vals.description, category_id: vals.category_id || null, subcategory_id: null, reference_number: vals.reference_number || null, transaction_date: vals.transaction_date, due_date: vals.due_date || null,
            currency: vals.currency.toUpperCase(), pricing_mode: vals.pricing_mode, ...amountField, vat_percent: vals.vat_percent || "0", tax_rate_id: vals.tax_rate_id && vals.tax_rate_id !== NONE ? vals.tax_rate_id : null,
            vat_treatment: vals.vat_treatment as LedgerVatTreatment, ...(vals.override_vat && { amounts_overridden: true, vat_amount: vals.vat_amount || "0" }),
            payment_method_id: vals.payment_method_id && vals.payment_method_id !== NONE ? vals.payment_method_id : null, company_id: vals.company_id || null, project_id: vals.project_id || null,
            notes: vals.notes || null, status, mark_paid: vals.mark_paid, payment_date: vals.mark_paid ? vals.payment_date || vals.transaction_date : null,
        };
    };
    /** PATCH body of an existing record (synced records only change their descriptive fields). */
    const toPatch = (vals: RecordFormValues) => {
        const { type: _t, status: _s, mark_paid: _m, ...rest } = toDto(vals, "DRAFT");
        return synced ? { description: rest.description, category_id: rest.category_id, subcategory_id: null, project_id: rest.project_id, notes: rest.notes, payment_method_id: rest.payment_method_id, reference_number: rest.reference_number } : rest;
    };
    // Drafts autosave (no Save button); posted records keep an explicit "Save changes" (an audited amendment).
    const isDraft = existing.data?.status === "DRAFT";
    const autosave = useFormAutosave(form, (vals) => autosaveRecord.mutateAsync({ id: id as string, ...toPatch(vals) }), { enabled: !!id && isDraft });
    const save = (status: "DRAFT" | "POSTED") =>
        form.handleSubmit((vals) => {
            if (id) {
                if (isDraft) { autosave.flush(); navigate(`/expenses/records/${id}`); return; }
                update.mutate({ id, ...toPatch(vals) }, { onSuccess: () => navigate(`/expenses/records/${id}`) });
            } else create.mutate(toDto(vals, status), { onSuccess: (r) => navigate(`/expenses/records/${r.id}`) });
        })();

    if (id && existing.isPending) return <PageSkeleton />;
    if (id && existing.error) return <Page><ErrorState error={existing.error} onRetry={() => existing.refetch()} /></Page>;
    if (!p.can(`${key}.${id ? "update" : "create"}`) && p.loaded) return <Page><NoAccessState /></Page>;

    return (
        <Page width="wide">
            <PageHeader title={id ? `Edit ${existing.data?.number}` : type === "INCOME" ? "New income" : "New expense"} back={{ to: id ? `/expenses/records/${id}` : "/expenses/ledger", label: id ? "Record" : "Ledger" }} description={synced ? "This record comes from Billing: amounts and dates are changed on the invoice." : "VAT is calculated from the amount and the rate."} meta={id && isDraft ? <SaveStatus state={autosave} /> : undefined} />
            <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); save("POSTED"); }} className="space-y-6">
                    <Section title="Record">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                            {!id && (
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem><FormLabel>Type</FormLabel>
                                        <Select value={field.value} onValueChange={(val) => { field.onChange(val); form.setValue("category_id", undefined); }}>
                                            <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{RecordTypeOptions.filter((o) => p.can(`${o.id === "INCOME" ? "finance.income" : "finance.expenses"}.create`)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem className={id ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-1 lg:col-span-3"}><FormLabel>Description</FormLabel><FormControl><Input placeholder={type === "INCOME" ? "Consulting session" : "Office rent October"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Category</FormLabel><CategoryPicker kind={type} value={field.value} onChange={(val) => field.onChange(val ?? undefined)} /></FormItem>)} />
                            <FormField control={form.control} name="company_id" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>{type === "INCOME" ? "Customer" : "Supplier"}</FormLabel><CompanyPicker value={field.value} onChange={field.onChange} /><FormDescription className="text-xs">{type === "EXPENSE" ? "Known suppliers fill in their default category and VAT." : undefined}</FormDescription></FormItem>)} />
                            <FormField control={form.control} name="transaction_date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" disabled={!!synced} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="due_date" render={({ field }) => (<FormItem><FormLabel>Due date</FormLabel><FormControl><Input type="date" disabled={!!synced} {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="reference_number" render={({ field }) => (<FormItem><FormLabel>Reference</FormLabel><FormControl><Input placeholder="Supplier invoice no." {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="project_id" render={({ field }) => (<FormItem><FormLabel>Project</FormLabel><ProjectPicker value={field.value} onChange={field.onChange} /></FormItem>)} />
                        </div>
                    </Section>

                    <Section title="Amount & VAT">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input inputMode="decimal" disabled={!!synced} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="pricing_mode" render={({ field }) => (<FormItem><FormLabel>The amount</FormLabel><Select value={field.value} onValueChange={field.onChange} disabled={!!synced}><FormControl><SelectTrigger aria-label="Pricing"><SelectValue /></SelectTrigger></FormControl><SelectContent>{PricingModeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} disabled={!!synced} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="tax_rate_id" render={({ field }) => (<FormItem><FormLabel>VAT rate</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange} disabled={!!synced}><FormControl><SelectTrigger aria-label="VAT rate"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Custom %</SelectItem>{rates.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({Number(r.percentage)}%)</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="vat_percent" render={({ field }) => (<FormItem><FormLabel>VAT %</FormLabel><FormControl><Input inputMode="decimal" disabled={!!synced || (v.tax_rate_id ?? NONE) !== NONE} placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="vat_treatment" render={({ field }) => (<FormItem><FormLabel>VAT treatment</FormLabel><Select value={field.value} onValueChange={field.onChange} disabled={!!synced}><FormControl><SelectTrigger aria-label="VAT treatment"><SelectValue /></SelectTrigger></FormControl><SelectContent>{VatTreatmentOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            {p.can(`${key}.update`) && !synced && (
                                <FormField control={form.control} name="override_vat" render={({ field }) => (<FormItem className="flex items-center justify-between gap-2 rounded-md border border-border p-3 sm:col-span-2"><div><FormLabel>Override VAT amount</FormLabel><FormDescription className="text-xs">When the document shows a different rounding.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            )}
                            {v.override_vat && <FormField control={form.control} name="vat_amount" render={({ field }) => (<FormItem><FormLabel>VAT amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                            <div className="rounded-md bg-secondary p-3 text-[13px] sm:col-span-2 lg:col-span-4">
                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                    <span>Net <span className="tabular font-medium text-foreground">{formatMoney(preview.net, v.currency || "EUR")}</span></span>
                                    <span>VAT <span className="tabular font-medium text-foreground">{formatMoney(preview.vat, v.currency || "EUR")}</span></span>
                                    <span>Gross <span className="tabular font-medium text-foreground">{formatMoney(preview.gross, v.currency || "EUR")}</span></span>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Payment">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                            <FormField control={form.control} name="payment_method_id" render={({ field }) => (<FormItem><FormLabel>Paid from / into</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{methods.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            {!id && <FormField control={form.control} name="mark_paid" render={({ field }) => (<FormItem className="flex items-center justify-between gap-2 rounded-md border border-border p-3"><FormLabel>Already paid</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />}
                            {!id && v.mark_paid && <FormField control={form.control} name="payment_date" render={({ field }) => (<FormItem><FormLabel>Paid on</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />}
                            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem className="sm:col-span-2 lg:col-span-4"><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        </div>
                    </Section>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        {id && isDraft ? (
                            <Button type="submit" variant="outline">Done</Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={pending}>Cancel</Button>
                                {!id && <Button type="button" variant="outline" disabled={pending} onClick={() => save("DRAFT")}>Save as draft</Button>}
                                <Button type="submit" loading={pending}>{id ? "Save changes" : "Save and post"}</Button>
                            </>
                        )}
                    </div>
                </form>
            </Form>
        </Page>
    );
}
