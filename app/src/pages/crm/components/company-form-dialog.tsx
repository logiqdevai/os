import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyTypeFormOptions } from "@/config/constants/dropdowns/crm/company-type-form.options";
import { companyFormSchema, type CompanyFormValues } from "@/features/crm/companies/validation-schemas/companies.schema";
import { useCreateCompany, useUpdateCompany } from "@/features/crm/companies/hooks/use-companies";
import type { Company, CompanyType, CreateCompanyDto } from "@/features/crm/companies/interfaces/companies.interfaces";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { CrmPaths } from "../crm-paths";
import { MemberSelect } from "./crm-pickers";
import { DuplicateNotice, getDuplicates, type DuplicateMatch } from "./crm-actions";
import { CustomFieldInputs, useCustomFieldValues } from "./custom-fields";

const NONE = "__none";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company?: Company | null;
    defaultType?: CompanyType;
    /** After create: navigate to the record (default) or hand the id back (pickers). */
    onCreated?: (company: Company) => void;
}

/**
 * New / edit company (app/mockups/modules/02-crm `company-new`).
 * @perm crm.companies.create / update · owner change crm.companies.assign · annual revenue crm.financials.read
 * @api POST /crm/companies · PATCH /crm/companies/:id (409 possible_duplicates → "Create anyway")
 */
export function CompanyFormDialog({ open, onOpenChange, company, defaultType = "PROSPECT", onCreated }: Props) {
    const navigate = useNavigate();
    const create = useCreateCompany();
    const update = useUpdateCompany();
    const settings = useCrmSettings(false, open);
    const canMoney = usePermission("crm.financials.read");
    const canAssign = usePermission("crm.companies.assign");
    const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
    const form = useForm<CompanyFormValues>({ resolver: zodResolver(companyFormSchema), defaultValues: { name: "", type: defaultType } });
    const cf = useCustomFieldValues("CRM_COMPANY", open, company);

    useEffect(() => {
        if (!open) return;
        setDuplicates(null);
        form.reset({
            name: company?.name ?? "",
            type: company?.type ?? defaultType,
            website: company?.website ?? "",
            email: company?.email ?? "",
            phone: company?.phone ?? "",
            industry: company?.industry ?? "",
            company_size: company?.company_size ?? "",
            country: company?.country ?? "",
            vat_number: company?.vat_number ?? "",
            lifecycle_stage_id: company?.lifecycle_stage_id ?? undefined,
            lead_source_id: company?.lead_source_id ?? undefined,
            owner_membership_id: company?.owner_membership_id ?? undefined,
            annual_revenue: company?.annual_revenue != null ? String(Number(company.annual_revenue)) : "",
            description: company?.description ?? "",
        });
    }, [open, company, defaultType, form]);

    const pending = create.isPending || update.isPending;

    const save = (allow_duplicate: boolean) =>
        form.handleSubmit((v) => {
            if (!cf.validate()) return;
            const dto: CreateCompanyDto = {
                name: v.name,
                type: v.type,
                website: v.website || undefined,
                email: v.email || undefined,
                phone: v.phone || undefined,
                industry: v.industry || undefined,
                company_size: v.company_size || undefined,
                country: v.country ? v.country.toUpperCase() : undefined,
                vat_number: v.vat_number || undefined,
                lifecycle_stage_id: v.lifecycle_stage_id || undefined,
                lead_source_id: v.lead_source_id || undefined,
                owner_membership_id: canAssign ? v.owner_membership_id || undefined : undefined,
                annual_revenue: canMoney && v.annual_revenue ? Number(v.annual_revenue) : undefined,
                description: v.description || undefined,
                custom_fields: cf.payload(),
            };
            const onError = (e: unknown) => {
                const dups = getDuplicates(e);
                if (dups) setDuplicates(dups);
                else toast({ variant: "destructive", title: "Could not save company", description: getApiErrorMessage(e) });
            };
            if (company) {
                update.mutate({ id: company.id, ...dto }, { onSuccess: () => { toast({ title: "Company updated" }); onOpenChange(false); }, onError });
            } else {
                create.mutate({ ...dto, allow_duplicate }, {
                    onSuccess: (c) => {
                        toast({ title: "Company created" });
                        onOpenChange(false);
                        if (onCreated) onCreated(c);
                        else navigate(CrmPaths.company(c.id));
                    },
                    onError,
                });
            }
        })();

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{company ? "Edit company" : "New company"}</DialogTitle>
                            <DialogDescription>Prospects, customers, partners and vendors share one company record.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Acme Digital" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CompanyTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="lifecycle_stage_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lifecycle stage</FormLabel>
                                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                                        <FormControl><SelectTrigger aria-label="Lifecycle stage"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Default</SelectItem>
                                            {settings.data?.lifecycle_stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="website" render={({ field }) => (
                                <FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="acme.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="hello@acme.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="industry" render={({ field }) => (
                                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input placeholder="Hospitality" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="company_size" render={({ field }) => (
                                <FormItem><FormLabel>Company size</FormLabel><FormControl><Input placeholder="11-50" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="country" render={({ field }) => (
                                    <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="GR" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="vat_number" render={({ field }) => (
                                    <FormItem><FormLabel>VAT number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="lead_source_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Source</FormLabel>
                                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                                        <FormControl><SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>None</SelectItem>
                                            {settings.data?.lead_sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            {canAssign && (
                                <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                    <FormItem><FormLabel>Owner</FormLabel><MemberSelect value={field.value} onChange={field.onChange} allowNone={!!company} /></FormItem>
                                )} />
                            )}
                            {canMoney && (
                                <FormField control={form.control} name="annual_revenue" render={({ field }) => (
                                    <FormItem><FormLabel>Annual revenue</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <CustomFieldInputs state={cf} disabled={pending} />
                        </div>
                        {duplicates && <DuplicateNotice matches={duplicates} hrefOf={CrmPaths.company} />}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            {duplicates && !company && <Button type="button" variant="outline" loading={pending} onClick={() => save(true)}>Create anyway</Button>}
                            <Button type="submit" loading={pending}>{company ? "Save changes" : "Create company"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
