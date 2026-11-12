import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Handshake, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConvertLead, useConvertPreview } from "@/features/crm/leads/hooks/use-leads";
import { convertLeadSchema, type ConvertLeadValues } from "@/features/crm/leads/validation-schemas/leads.schema";
import type { ConvertLeadDto } from "@/features/crm/leads/interfaces/leads.interfaces";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../../../crm-paths";
import { CompanyPicker, ContactPicker } from "../../../components/crm-pickers";

/**
 * Lead conversion (mockup `lead-convert`, 02 §7): link or create company and contact, optionally create a deal.
 * @perm crm.leads.convert + the create key of each record created (crm.companies.create, crm.contacts.create, crm.deals.create)
 * @api GET /crm/leads/:id/convert-preview · POST /crm/leads/:id/convert
 */
export function LeadConvertDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const preview = useConvertPreview(leadId, open);
    const pipelines = usePipelines(open);
    const convert = useConvertLead();
    const form = useForm<ConvertLeadValues>({ resolver: zodResolver(convertLeadSchema), defaultValues: { company_mode: "none", contact_mode: "none", create_deal: false } });

    const data = preview.data;
    useEffect(() => {
        if (!open || !data) return;
        const cm = data.company_matches[0];
        const pm = data.contact_matches[0];
        form.reset({
            company_mode: cm ? "existing" : data.allowed.company && data.defaults.company.name ? "new" : "none",
            company_existing_id: cm?.id,
            company_label: cm?.name,
            company_name: data.defaults.company.name ?? "",
            company_website: data.defaults.company.website ?? "",
            contact_mode: pm ? "existing" : data.allowed.contact && data.defaults.contact.first_name ? "new" : "none",
            contact_existing_id: pm?.id,
            contact_label: pm ? contactName(pm) : undefined,
            contact_first_name: data.defaults.contact.first_name ?? "",
            contact_last_name: data.defaults.contact.last_name ?? "",
            contact_email: data.defaults.contact.email ?? "",
            create_deal: data.allowed.deal,
            deal_name: data.defaults.deal.name,
            deal_pipeline_id: data.defaults.deal.pipeline_id,
            deal_stage_id: data.defaults.deal.stage_id,
            deal_value: data.defaults.deal.value != null ? String(Number(data.defaults.deal.value)) : "",
            deal_close_date: "",
        });
    }, [open, data, form]);

    const v = form.watch();
    const pipeline = pipelines.data?.find((p) => p.id === v.deal_pipeline_id) ?? pipelines.data?.[0];

    const submit = form.handleSubmit((x) => {
        const dto: ConvertLeadDto = {
            company: x.company_mode === "existing" ? { existing_id: x.company_existing_id } : x.company_mode === "new" ? { new: { name: x.company_name!, website: x.company_website || undefined, allow_duplicate: true } } : undefined,
            contact: x.contact_mode === "existing" ? { existing_id: x.contact_existing_id } : x.contact_mode === "new" ? { new: { first_name: x.contact_first_name!, last_name: x.contact_last_name || undefined, email: x.contact_email || undefined, phone: data?.defaults.contact.phone ?? undefined, allow_duplicate: true } } : undefined,
            deal: x.create_deal ? { name: x.deal_name!, pipeline_id: x.deal_pipeline_id, stage_id: x.deal_stage_id, value: x.deal_value ? Number(x.deal_value) : undefined, expected_close_date: x.deal_close_date || undefined } : undefined,
        };
        convert.mutate({ id: leadId, ...dto }, {
            onSuccess: (r) => {
                onOpenChange(false);
                if (r.deal_id) navigate(CrmPaths.deal(r.deal_id));
                else if (r.company_id) navigate(CrmPaths.company(r.company_id));
                else if (r.contact_id) navigate(CrmPaths.contact(r.contact_id));
            },
        });
    });

    const modeSelect = (name: "company_mode" | "contact_mode", allowNew: boolean, label: string) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-8 w-full sm:w-48" aria-label={label}><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="existing">Link existing</SelectItem>
                    {allowNew && <SelectItem value="new">Create new</SelectItem>}
                    <SelectItem value="none">Skip</SelectItem>
                </SelectContent>
            </Select>
        )} />
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !convert.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Convert lead</DialogTitle>
                    <DialogDescription>Activities and notes of the lead move with it. Existing records are suggested to avoid duplicates.</DialogDescription>
                </DialogHeader>
                {preview.isPending ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
                ) : preview.error ? (
                    <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
                ) : data && (
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-4">
                            <section className="space-y-3 rounded-lg border border-border p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="flex items-center gap-2 text-[13px] font-medium"><Building2 className="size-4 text-muted-foreground" /> Company</h3>
                                    {modeSelect("company_mode", data.allowed.company, "Company")}
                                </div>
                                {v.company_mode === "existing" && (
                                    <FormField control={form.control} name="company_existing_id" render={({ field }) => (
                                        <FormItem>
                                            <CompanyPicker value={field.value} valueLabel={v.company_label} onChange={(id, label) => { field.onChange(id); form.setValue("company_label", label); }} />
                                            {!!data.company_matches.length && <p className="text-xs text-muted-foreground">Suggested: {data.company_matches.map((m) => `${m.name} (same ${m.match})`).join(", ")}</p>}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                                {v.company_mode === "new" && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <FormField control={form.control} name="company_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="company_website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3 rounded-lg border border-border p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="flex items-center gap-2 text-[13px] font-medium"><User className="size-4 text-muted-foreground" /> Contact</h3>
                                    {modeSelect("contact_mode", data.allowed.contact, "Contact")}
                                </div>
                                {v.contact_mode === "existing" && (
                                    <FormField control={form.control} name="contact_existing_id" render={({ field }) => (
                                        <FormItem>
                                            <ContactPicker value={field.value} valueLabel={v.contact_label} onChange={(id, label) => { field.onChange(id); form.setValue("contact_label", label); }} />
                                            {!!data.contact_matches.length && <p className="text-xs text-muted-foreground">Suggested: {data.contact_matches.map((m) => `${contactName(m)} (same ${m.match})`).join(", ")}</p>}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                                {v.contact_mode === "new" && (
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <FormField control={form.control} name="contact_first_name" render={({ field }) => (<FormItem><FormLabel>First name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="contact_last_name" render={({ field }) => (<FormItem><FormLabel>Last name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="contact_email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                )}
                            </section>

                            <section className="space-y-3 rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="flex items-center gap-2 text-[13px] font-medium"><Handshake className="size-4 text-muted-foreground" /> Deal</h3>
                                    <FormField control={form.control} name="create_deal" render={({ field }) => (
                                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!data.allowed.deal} aria-label="Create a deal" />
                                    )} />
                                </div>
                                {!data.allowed.deal && <p className="text-xs text-muted-foreground">You don't have permission to create deals.</p>}
                                {v.create_deal && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <FormField control={form.control} name="deal_name" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Deal name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="deal_pipeline_id" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Pipeline</FormLabel>
                                                <Select value={field.value ?? pipeline?.id ?? ""} onValueChange={(x) => { field.onChange(x); form.setValue("deal_stage_id", undefined); }}>
                                                    <FormControl><SelectTrigger aria-label="Pipeline"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>{pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="deal_stage_id" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Stage</FormLabel>
                                                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                                    <FormControl><SelectTrigger aria-label="Stage"><SelectValue placeholder="First stage" /></SelectTrigger></FormControl>
                                                    <SelectContent>{pipeline?.stages.filter((s) => !s.is_won && !s.is_lost).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        {data.allowed.financials && (
                                            <FormField control={form.control} name="deal_value" render={({ field }) => (<FormItem><FormLabel>Value</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        )}
                                        <FormField control={form.control} name="deal_close_date" render={({ field }) => (<FormItem><FormLabel>Expected close</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                )}
                            </section>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={convert.isPending}>Cancel</Button>
                                <Button type="submit" loading={convert.isPending}>Convert lead</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
