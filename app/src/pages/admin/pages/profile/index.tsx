import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization, useUpdateOrganization } from "@/features/admin/organization/hooks/use-organization";
import { organizationProfileSchema, type OrganizationProfileFormValues } from "@/features/admin/organization/validation-schemas/organization.schema";
import { CountryOptions } from "@/config/constants/dropdowns/country.options";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { WeekStartOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

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

    useEffect(() => {
        const o = org.data;
        if (!o) return;
        form.reset({
            display_name: o.display_name, legal_name: o.legal_name, short_name: o.short_name ?? "", website: o.website ?? "", contact_email: o.contact_email ?? "",
            contact_phone: o.contact_phone ?? "", country: o.country ?? NONE, default_currency: o.default_currency, default_timezone: o.default_timezone,
            default_language: o.default_language, date_format: o.date_format ?? "", week_start: String(o.week_start) as OrganizationProfileFormValues["week_start"],
        });
    }, [org.data, form]);

    if (org.isPending) return <PageSkeleton />;
    if (org.error) return <Page><PageHeader title="Organization profile" /><ErrorState error={org.error} onRetry={() => org.refetch()} /></Page>;

    const submit = form.handleSubmit((v) =>
        update.mutate(
            { ...v, country: v.country === NONE ? "" : v.country, week_start: Number(v.week_start) },
            { onSuccess: () => { toast({ title: "Organization saved" }); form.reset(form.getValues()); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        )
    );

    const text = (name: keyof OrganizationProfileFormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...props} {...field} value={(field.value as string | undefined) ?? ""} /></FormControl><FormMessage /></FormItem>
        )} />
    );

    return (
        <Page width="narrow">
            <PageHeader title="Organization profile" description="Your agency's identity and defaults. Branches and people can override the defaults." />
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
                            {text("default_currency", "Currency", { maxLength: 3, placeholder: "EUR" })}
                            <FormField control={form.control} name="default_timezone" render={({ field }) => (
                                <FormItem><FormLabel>Timezone</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {!TimezoneOptions.some((t) => t.value === field.value) && field.value && <SelectItem value={field.value}>{field.value}</SelectItem>}
                                            {TimezoneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent></Select>
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
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" disabled={!form.formState.isDirty || update.isPending} onClick={() => form.reset()}>Discard</Button>
                        <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>Save changes</Button>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
