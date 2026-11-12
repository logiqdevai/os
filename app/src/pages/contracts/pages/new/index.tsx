import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Page, PageHeader } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreateContract, useContractTemplates, useContractTypes } from "@/features/contracts/hooks/use-contracts";
import { contractFormSchema, type ContractFormValues } from "@/features/contracts/validation-schemas/contracts.schema";
import { BillingFrequencyOptions, ContractRenewalTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-terms.options";
import { CurrencyOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { usePermission } from "@/hooks/use-permission";
import { ContractLookupPicker } from "../../components/contract-badges";

const NONE = "__none";
const optNum = (v: string) => (v.trim() === "" ? undefined : Number(v));
const optStr = (v: string) => (v && v !== NONE ? v : undefined);

/**
 * /contracts/new?company=<id> — create a draft contract. Sections come from the template's published version (or the type's default).
 * Parties default to the agency + the customer. @perm contracts.contracts.create · values contracts.confidential_terms.read
 * @api POST /contracts · GET /contract-types · GET /contract-templates
 */
export default function NewContractPage() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    const session = useSessionData();
    const canSeeValue = usePermission("contracts.confidential_terms.read");
    const types = useContractTypes({ limit: 100 });
    const templates = useContractTemplates({ limit: 100, status: "PUBLISHED" });
    const create = useCreateContract();
    const form = useForm<ContractFormValues>({
        resolver: zodResolver(contractFormSchema),
        defaultValues: {
            title: "", type_id: NONE, template_id: NONE, primary_company_id: sp.get("company"), owner_membership_id: session?.active_organization?.membership_id ?? null,
            currency: session?.active_organization?.default_currency ?? "EUR", start_date: "", end_date: "", renewal_type: "NONE", renewal_term_months: "", notice_days: "",
            total_value: "", recurring_value: "", billing_frequency: NONE, payment_terms: "", processes_personal_data: false,
        },
    });
    const typeId = form.watch("type_id");
    const renewal = form.watch("renewal_type");

    const submit = form.handleSubmit((v) =>
        create.mutate(
            {
                title: v.title,
                type_id: optStr(v.type_id),
                template_id: optStr(v.template_id),
                primary_company_id: v.primary_company_id ?? undefined,
                owner_membership_id: v.owner_membership_id ?? undefined,
                currency: v.currency,
                start_date: v.start_date || undefined,
                effective_date: v.start_date || undefined,
                end_date: v.end_date || undefined,
                renewal_type: v.renewal_type,
                renewal_term_months: v.renewal_type === "NONE" ? undefined : optNum(v.renewal_term_months),
                notice_days: optNum(v.notice_days),
                ...(canSeeValue && { total_value: optNum(v.total_value), recurring_value: optNum(v.recurring_value), billing_frequency: optStr(v.billing_frequency), payment_terms: v.payment_terms || undefined }),
                processes_personal_data: v.processes_personal_data,
            },
            { onSuccess: (c) => navigate(`/contracts/${c.id}`) } // the new contract opens; failures toast globally
        )
    );

    const sel = (name: "type_id" | "template_id" | "currency" | "renewal_type" | "billing_frequency", label: string, options: { id: string; label: string }[], none?: string) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <Select value={field.value} onValueChange={(val) => {
                    field.onChange(val);
                    if (name === "type_id") {
                        const t = types.data?.data.find((x) => x.id === val);
                        if (t) {
                            form.setValue("renewal_type", t.default_renewal_type);
                            if (t.default_notice_days != null) form.setValue("notice_days", String(t.default_notice_days));
                            if (t.default_template_id) form.setValue("template_id", t.default_template_id);
                        }
                    }
                }}>
                    <FormControl><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        {none && <SelectItem value={NONE}>{none}</SelectItem>}
                        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
    );
    const text = (name: "start_date" | "end_date" | "renewal_term_months" | "notice_days" | "total_value" | "recurring_value" | "payment_terms", label: string, props: React.ComponentProps<typeof Input> = {}) => (
        <FormField control={form.control} name={name} render={({ field }) => (<FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...props} {...field} /></FormControl><FormMessage /></FormItem>)} />
    );
    const templateOptions = (templates.data?.data ?? []).filter((t) => typeId === NONE || !t.type_id || t.type_id === typeId).map((t) => ({ id: t.id, label: t.name }));

    return (
        <Page width="narrow">
            <PageHeader back={{ to: "/contracts", label: "Contracts" }} title="New contract" description="Create a draft. The number is assigned on save; the document is generated from the template." />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-4 md:p-5">
                    <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input autoFocus placeholder="Master services agreement — Acme" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        {sel("type_id", "Contract type", (types.data?.data ?? []).map((t) => ({ id: t.id, label: t.name })), "No type")}
                        {sel("template_id", "Template", templateOptions, "Standard sections")}
                        <FormField control={form.control} name="primary_company_id" render={({ field }) => (
                            <FormItem><FormLabel>Customer</FormLabel><ContractLookupPicker kind="companies" ariaLabel="Customer" value={field.value} placeholder="Choose a company" onChange={(id, item) => { field.onChange(id); if (item?.currency) form.setValue("currency", item.currency); }} /><FormDescription>Added as the customer party.</FormDescription></FormItem>
                        )} />
                        <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                            <FormItem><FormLabel>Owner</FormLabel><ContractLookupPicker kind="members" ariaLabel="Owner" clearable={false} value={field.value} valueLabel={field.value === session?.active_organization?.membership_id ? "You" : undefined} onChange={(id) => field.onChange(id)} /></FormItem>
                        )} />
                        {text("start_date", "Start date", { type: "date" })}
                        {text("end_date", "End date", { type: "date" })}
                        {sel("renewal_type", "Renewal", ContractRenewalTypeFormOptions)}
                        {renewal !== "NONE" ? text("renewal_term_months", "Renewal term (months)", { inputMode: "numeric", placeholder: "12" }) : <div className="hidden sm:block" />}
                        {text("notice_days", "Notice period (days)", { inputMode: "numeric", placeholder: "30" })}
                        {sel("currency", "Currency", CurrencyOptions)}
                    </div>
                    {canSeeValue ? (
                        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                            {text("total_value", "Total value", { inputMode: "decimal" })}
                            {text("recurring_value", "Recurring value", { inputMode: "decimal" })}
                            {sel("billing_frequency", "Billing frequency", BillingFrequencyOptions, "Not set")}
                            {text("payment_terms", "Payment terms", { placeholder: "Net 14" })}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">Contract value and payment terms are confidential and can be set by people with access to confidential terms.</p>
                    )}
                    <FormField control={form.control} name="processes_personal_data" render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"><FormLabel className="m-0 font-normal">Involves processing personal data (adds DPA clauses when the template has them)</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" onClick={() => navigate("/contracts")} disabled={create.isPending}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Create contract</Button>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
