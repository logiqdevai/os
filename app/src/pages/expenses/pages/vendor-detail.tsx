import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useTaxRates } from "@/features/billing/hooks/use-billing";
import { useSaveSupplierProfile, useSupplier } from "@/features/expenses/hooks/use-expenses";
import { supplierProfileSchema, type SupplierProfileFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { formatMoney } from "@/lib/format";
import { ChartCard, MonthlyMoneyChart } from "../components/money-charts";
import { CategoryPicker } from "../components/ledger-ui";

const NONE = "__none";

/**
 * /expenses/vendors/:companyId — supplier ledger defaults, spend by month.
 * @perm VIEW finance.expenses.read · edit finance.expenses.update (bank details shown masked to editors only)
 * @api GET /ledger/suppliers/:companyId · PUT /ledger/suppliers/:companyId/profile
 */
export default function VendorDetailPage() {
    const { id } = useParams();
    const q = useSupplier(id);
    const canEdit = usePermission("finance.expenses.update");
    const rates = useTaxRates().data;
    const save = useSaveSupplierProfile();
    const cur = useSessionData()?.active_organization?.default_currency ?? "EUR";
    const form = useForm<SupplierProfileFormValues>({ resolver: zodResolver(supplierProfileSchema) });
    useEffect(() => {
        const pr = q.data?.ledger_supplier_profile;
        if (!q.data) return;
        form.reset({ default_category_id: pr?.default_category_id ?? undefined, default_tax_rate_id: pr?.default_tax_rate_id ?? NONE, payment_terms_days: pr?.payment_terms_days != null ? String(pr.payment_terms_days) : "", vat_number: pr?.vat_number ?? q.data.vat_number ?? "", iban: "", notes: pr?.notes ?? "" });
    }, [q.data, form]);
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const s = q.data;
    const submit = form.handleSubmit((v) => save.mutate({
        id: s.id, default_category_id: v.default_category_id || null, default_tax_rate_id: v.default_tax_rate_id && v.default_tax_rate_id !== NONE ? v.default_tax_rate_id : null,
        payment_terms_days: v.payment_terms_days ? Number(v.payment_terms_days) : null, vat_number: v.vat_number || null, notes: v.notes || null, ...(v.iban && { bank_details: { iban: v.iban } }),
    }));
    return (
        <Page width="wide">
            <PageHeader back={{ to: "/expenses/vendors", label: "Vendors" }} title={s.name} description={s.legal_name ?? undefined} actions={<Can permission="finance.expenses.create"><Button asChild><Link to={`/expenses/new?company=${s.id}`}><Plus /> New expense</Link></Button></Can>} />
            <StatGrid className="mb-4">
                <StatCard label="Total spend" value={formatMoney(s.totals.spend, cur)} />
                <StatCard label="Unpaid" value={formatMoney(s.totals.outstanding, cur)} tone={Number(s.totals.outstanding) > 0 ? "warning" : "default"} />
                <StatCard label="VAT paid" value={formatMoney(s.totals.vat, cur)} />
                <StatCard label="Records" value={s.totals.records} />
            </StatGrid>
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Spend by month" description="Last 12 months, gross">
                    <MonthlyMoneyChart data={s.spend_by_month} currency={cur} series={[{ key: "amount", label: "Spend", color: 1 }]} height={220} />
                </ChartCard>
                <Section title="Ledger defaults" description="Applied to new expenses from this supplier.">
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-4">
                            <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
                                <FormField control={form.control} name="default_category_id" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Default category</FormLabel><CategoryPicker kind="EXPENSE" value={field.value} onChange={(v) => field.onChange(v ?? undefined)} noneLabel="No default" /></FormItem>)} />
                                <FormField control={form.control} name="default_tax_rate_id" render={({ field }) => (<FormItem><FormLabel>Default VAT</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Default VAT"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>No default</SelectItem>{rates?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                                <FormField control={form.control} name="payment_terms_days" render={({ field }) => (<FormItem><FormLabel>Payment terms (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="vat_number" render={({ field }) => (<FormItem><FormLabel>VAT number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                {canEdit && <FormField control={form.control} name="iban" render={({ field }) => (<FormItem><FormLabel>IBAN</FormLabel><FormControl><Input placeholder={s.ledger_supplier_profile?.bank_details?.iban ?? "Not set"} {...field} /></FormControl></FormItem>)} />}
                                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                            </fieldset>
                            {canEdit && <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save defaults</Button></div>}
                        </form>
                    </Form>
                </Section>
            </div>
            <div className="mt-4"><Button variant="outline" asChild><Link to={`/expenses/ledger?company_id=${s.id}`}>See all records</Link></Button></div>
        </Page>
    );
}
