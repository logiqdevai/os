import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useSessionData } from "@/features/session/hooks/use-session";
import { billingProfileFormSchema, type BillingProfileFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { useCreateBillingProfile, useUpdateBillingProfile } from "@/features/billing/hooks/use-billing";
import type { BillingProfile } from "@/features/billing/interfaces/billing.interfaces";
import { CompanyPicker } from "./billing-pickers";

/** Create / edit a customer billing profile (company from CRM 02). */
export function BillingProfileForm({ profile, onDone, onCancel }: { profile?: BillingProfile | null; onDone: (p: BillingProfile) => void; onCancel?: () => void }) {
    const session = useSessionData();
    const create = useCreateBillingProfile();
    const update = useUpdateBillingProfile();
    const form = useForm<BillingProfileFormValues>({ resolver: zodResolver(billingProfileFormSchema) });
    useEffect(() => {
        form.reset({
            company_id: profile?.company_id ?? "", legal_name: profile?.legal_name ?? "", billing_email: profile?.billing_email ?? "", vat_number: profile?.vat_number ?? "", tax_id: profile?.tax_id ?? "",
            currency: profile?.currency ?? session?.active_organization?.default_currency ?? "EUR", payment_terms_days: String(profile?.payment_terms_days ?? 14), tax_exempt: profile?.tax_exempt ?? false,
            reverse_charge: profile?.reverse_charge ?? false, line1: profile?.billing_address?.line1 ?? "", city: profile?.billing_address?.city ?? "", postal_code: profile?.billing_address?.postal_code ?? "",
            country: profile?.billing_address?.country ?? "", notes: profile?.notes ?? "",
        });
    }, [profile, form, session?.active_organization?.default_currency]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = {
            legal_name: v.legal_name, billing_email: v.billing_email || null, vat_number: v.vat_number || null, tax_id: v.tax_id || null, currency: v.currency.toUpperCase(),
            payment_terms_days: Number(v.payment_terms_days), tax_exempt: v.tax_exempt, reverse_charge: v.reverse_charge, notes: v.notes || null,
            billing_address: v.line1 || v.city || v.country ? { line1: v.line1 || undefined, city: v.city || undefined, postal_code: v.postal_code || undefined, country: v.country ? v.country.toUpperCase() : undefined } : null,
        };
        if (profile) update.mutate({ id: profile.id, ...dto }, { onSuccess: onDone });
        else create.mutate({ company_id: v.company_id, ...dto }, { onSuccess: onDone });
    });
    return (
        <Form {...form}>
            <form onSubmit={submit} className="space-y-4">
                {!profile && (
                    <FormField control={form.control} name="company_id" render={({ field }) => (
                        <FormItem><FormLabel>Company (CRM)</FormLabel><CompanyPicker value={field.value} onChange={(v) => field.onChange(v ?? "")} /><FormMessage /></FormItem>
                    )} />
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                    <FormField control={form.control} name="legal_name" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Legal name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="billing_email" render={({ field }) => (<FormItem><FormLabel>Billing e-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="vat_number" render={({ field }) => (<FormItem><FormLabel>VAT number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><Input maxLength={3} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="payment_terms_days" render={({ field }) => (<FormItem><FormLabel>Payment terms (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="line1" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="postal_code" render={({ field }) => (<FormItem><FormLabel>Postal code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country (ISO)</FormLabel><FormControl><Input maxLength={2} placeholder="GR" {...field} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="tax_id" render={({ field }) => (<FormItem><FormLabel>Tax ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    <FormField control={form.control} name="tax_exempt" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Tax exempt</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="reverse_charge" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>EU reverse charge</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Internal notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                <div className="flex justify-end gap-2">
                    {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>}
                    <Button type="submit" loading={pending}>{profile ? "Save" : "Create profile"}</Button>
                </div>
            </form>
        </Form>
    );
}
