import { useEffect, useRef } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization, useUpdateOrganization } from "@/features/admin/organization/hooks/use-organization";
import { organizationProfileSchema, type OrganizationProfileFormValues } from "@/features/admin/organization/validation-schemas/organization.schema";
import { CountryOptions } from "@/config/constants/dropdowns/country.options";
import { WeekStartOptions } from "@/config/constants/dropdowns/admin/access-form.options";

const NONE = "__none";

/**
 * Organization profile — /admin/profile
 * @perm organizations.settings.manage
 * @api GET /organization · PATCH /organization
 */
export default function OrganizationProfilePage() {
    const org = useOrganization();
    const update = useUpdateOrganization();
    const form = useForm<OrganizationProfileFormValues>({ resolver: zodResolver(organizationProfileSchema) });

    // Loaded once; afterwards the form is the source of truth (a refresh after an autosave never overwrites typing).
    const loaded = useRef(false);
    useEffect(() => {
        const o = org.data;
        if (!o || loaded.current) return;
        loaded.current = true;
        form.reset({
            display_name: o.display_name, legal_name: o.legal_name, short_name: o.short_name ?? "", website: o.website ?? "", contact_email: o.contact_email ?? "",
            contact_phone: o.contact_phone ?? "", country: o.country ?? NONE, default_currency: o.default_currency, default_timezone: o.default_timezone,
            default_language: o.default_language, date_format: o.date_format ?? "", week_start: String(o.week_start) as OrganizationProfileFormValues["week_start"],
        });
    }, [org.data, form]);

    /** Autosave (no Save button): valid changes are saved after a short pause; failures show in <SaveStatus />. */
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ ...v, country: v.country === NONE ? "" : v.country, week_start: Number(v.week_start) }), { enabled: !!org.data });

    if (org.isPending) return <PageSkeleton />;
    if (org.error) return <Page><PageHeader title="Organization profile" /><ErrorState error={org.error} onRetry={() => org.refetch()} /></Page>;

    const submit = (e: React.FormEvent) => { e.preventDefault(); autosave.flush(); };

    const text = (name: keyof OrganizationProfileFormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...props} {...field} value={(field.value as string | undefined) ?? ""} /></FormControl><FormMessage /></FormItem>
        )} />
    );

    return (
        <Page width="narrow">
            <PageHeader title="Organization profile" description="Your agency's identity and defaults. Branches and people can override the defaults." actions={<SaveStatus state={autosave} />} />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-6">
                    <Section title="Identity">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                            {text("display_name", "Display name")}
                            {text("legal_name", "Legal name")}
                            {text("short_name", "Short name", { placeholder: "LQD" })}
                            {text("website", "Website", { placeholder: "https://agency.com", type: "url" })}
                            {text("contact_email", "Contact email", { type: "email" })}
                            {text("contact_phone", "Contact phone", { type: "tel" })}
                            <FormField control={form.control} name="country" render={({ field }) => (
                                <FormItem><FormLabel>Country</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Country"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value={NONE}>Not set</SelectItem>{CountryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}</SelectContent></Select>
                                </FormItem>
                            )} />
                        </div>
                    </Section>
                    <Section title="Defaults">
                        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                            <FormField control={form.control} name="default_currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="default_timezone" render={({ field }) => (
                                <FormItem><FormLabel>Timezone</FormLabel>
                                    <FormControl><TimezoneSelect value={field.value} onChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />
                            {text("default_language", "Language", { placeholder: "en" })}
                            {text("date_format", "Date format", { placeholder: "dd/MM/yyyy" })}
                            <FormField control={form.control} name="week_start" render={({ field }) => (
                                <FormItem><FormLabel>Week starts on</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Week start"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WeekStartOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                </FormItem>
                            )} />
                        </div>
                    </Section>
                </form>
            </Form>
        </Page>
    );
}
