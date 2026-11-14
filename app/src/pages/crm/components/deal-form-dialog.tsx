import { useEffect } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dealFormSchema, type DealFormValues } from "@/features/crm/deals/validation-schemas/deals.schema";
import { useCreateDeal, useUpdateDeal } from "@/features/crm/deals/hooks/use-deals";
import type { CreateDealDto, Deal } from "@/features/crm/deals/interfaces/deals.interfaces";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { usePermission } from "@/hooks/use-permission";
import { CrmPaths } from "../crm-paths";
import { CustomFieldInputs, useCustomFieldValues } from "./custom-fields";
import { CompanyPicker, ContactPicker, MemberSelect } from "./crm-pickers";

const NONE = "__none";

export interface DealFormDefaults {
    pipeline_id?: string;
    stage_id?: string;
    company?: { id: string; name: string } | null;
    contact?: { id: string; first_name: string; last_name: string | null } | null;
    name?: string;
}

/**
 * New / edit deal (mockup `deal-new`).
 * @perm crm.deals.create / update · owner crm.deals.assign · value crm.financials.read
 * @api POST /crm/deals · PATCH /crm/deals/:id · GET /crm/pipelines
 */
export function DealFormDialog({ open, onOpenChange, deal, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; deal?: (Deal & { line_items?: unknown[] }) | null; defaults?: DealFormDefaults }) {
    const navigate = useNavigate();
    const create = useCreateDeal();
    const update = useUpdateDeal();
    const pipelines = usePipelines(open);
    const settings = useCrmSettings(false, open);
    const canMoney = usePermission("crm.financials.read");
    const canAssign = usePermission("crm.deals.assign");
    const form = useForm<DealFormValues>({ resolver: zodResolver(dealFormSchema), defaultValues: { name: "" } });
    const cf = useCustomFieldValues("CRM_DEAL", open, deal);

    const pipelineId = form.watch("pipeline_id");
    const pipeline = pipelines.data?.find((p) => p.id === pipelineId) ?? pipelines.data?.[0];
    const openStages = pipeline?.stages.filter((s) => !s.is_won && !s.is_lost) ?? [];

    useEffect(() => {
        if (!open) return;
        form.reset({
            name: deal?.name ?? defaults?.name ?? "",
            pipeline_id: deal?.pipeline_id ?? defaults?.pipeline_id,
            stage_id: deal?.stage_id ?? defaults?.stage_id,
            company_id: deal?.company_id ?? defaults?.company?.id,
            company_label: deal?.company?.name ?? defaults?.company?.name,
            primary_contact_id: deal?.primary_contact_id ?? defaults?.contact?.id,
            contact_label: contactName(deal?.primary_contact ?? defaults?.contact) || undefined,
            owner_membership_id: deal?.owner_membership_id ?? undefined,
            value: deal?.value != null ? String(Number(deal.value)) : "",
            currency: deal?.currency ?? "",
            expected_close_date: deal?.expected_close_date?.slice(0, 10) ?? "",
            deal_type: deal?.deal_type ?? "",
            lead_source_id: deal?.lead_source_id ?? undefined,
            next_step: deal?.next_step ?? "",
            description: deal?.description ?? "",
        });
    }, [open, deal, defaults, form]);

    // Default pipeline once loaded.
    useEffect(() => {
        if (open && !deal && !form.getValues("pipeline_id") && pipelines.data?.length) form.setValue("pipeline_id", pipelines.data[0].id);
    }, [open, deal, pipelines.data, form]);

    const pending = create.isPending || update.isPending;
    // Totals derive from line items once they exist (02 §10).
    const hasLineItems = !!deal && 'line_items' in deal && Array.isArray(deal.line_items) && deal.line_items.length > 0;

    const submit = form.handleSubmit((v) => {
        if (!cf.validate()) return;
        const base = {
            name: v.name,
            company_id: v.company_id || undefined,
            primary_contact_id: v.primary_contact_id || undefined,
            owner_membership_id: canAssign ? v.owner_membership_id || undefined : undefined,
            value: canMoney && v.value ? Number(v.value) : undefined,
            currency: v.currency ? v.currency.toUpperCase() : undefined,
            expected_close_date: v.expected_close_date || undefined,
            deal_type: v.deal_type || undefined,
            lead_source_id: v.lead_source_id || undefined,
            next_step: v.next_step || undefined,
            description: v.description || undefined,
            custom_fields: cf.payload(),
        };
        if (deal) {
            // Optimistic: the page shows the edit at once; a refusal rolls back and toasts.
            update.mutate({ id: deal.id, ...base });
            onOpenChange(false);
        } else {
            const dto: CreateDealDto = { ...base, pipeline_id: v.pipeline_id || undefined, stage_id: v.stage_id || undefined };
            create.mutate(dto, { onSuccess: (d) => { onOpenChange(false); navigate(CrmPaths.deal(d.id)); } });
        }
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{deal ? "Edit deal" : "New deal"}</DialogTitle>
                            <DialogDescription>{deal ? "Stage changes happen on the board or the deal page." : "Deals start in the first stage of the pipeline unless you pick another."}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Deal name</FormLabel><FormControl><Input autoFocus placeholder="Acme — website redesign" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {!deal && (
                                <>
                                    <FormField control={form.control} name="pipeline_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pipeline</FormLabel>
                                            <Select value={field.value ?? pipeline?.id ?? ""} onValueChange={(v) => { field.onChange(v); form.setValue("stage_id", undefined); }}>
                                                <FormControl><SelectTrigger aria-label="Pipeline"><SelectValue placeholder="Loading…" /></SelectTrigger></FormControl>
                                                <SelectContent>{pipelines.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="stage_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Stage</FormLabel>
                                            <Select value={field.value ?? openStages[0]?.id ?? ""} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger aria-label="Stage"><SelectValue placeholder="First stage" /></SelectTrigger></FormControl>
                                                <SelectContent>{openStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.probability}%</SelectItem>)}</SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </>
                            )}
                            <FormField control={form.control} name="company_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company</FormLabel>
                                    <CompanyPicker value={field.value} valueLabel={form.watch("company_label")} onChange={(id, label) => { field.onChange(id); form.setValue("company_label", label); }} />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="primary_contact_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Primary contact</FormLabel>
                                    <ContactPicker companyId={form.watch("company_id")} value={field.value} valueLabel={form.watch("contact_label")} onChange={(id, label) => { field.onChange(id); form.setValue("contact_label", label); }} />
                                </FormItem>
                            )} />
                            {canMoney && (
                                <div className="grid grid-cols-[1fr_6rem] gap-2">
                                    <FormField control={form.control} name="value" render={({ field }) => (
                                        <FormItem><FormLabel>Value</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" disabled={hasLineItems} {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="currency" render={({ field }) => (
                                        <FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} emptyLabel="Pipeline default" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            )}
                            <FormField control={form.control} name="expected_close_date" render={({ field }) => (
                                <FormItem><FormLabel>Expected close</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {canAssign && (
                                <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                    <FormItem><FormLabel>Owner</FormLabel><MemberSelect value={field.value} onChange={field.onChange} allowNone={!!deal} /></FormItem>
                                )} />
                            )}
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
                            <FormField control={form.control} name="deal_type" render={({ field }) => (
                                <FormItem><FormLabel>Deal type</FormLabel><FormControl><Input placeholder="New business" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="next_step" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Next step</FormLabel><FormControl><Input placeholder="Send proposal by Friday" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <CustomFieldInputs state={cf} disabled={pending} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{deal ? "Save changes" : "Create deal"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
