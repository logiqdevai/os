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
import { leadFormSchema, type LeadFormValues } from "@/features/crm/leads/validation-schemas/leads.schema";
import { useCreateLead, useUpdateLead } from "@/features/crm/leads/hooks/use-leads";
import type { CreateLeadDto, Lead } from "@/features/crm/leads/interfaces/leads.interfaces";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { CrmPaths } from "../crm-paths";
import { MemberSelect } from "./crm-pickers";
import { DuplicateNotice, getDuplicates, type DuplicateMatch } from "./crm-actions";

const NONE = "__none";
const toLocalInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/**
 * New / edit lead (mockup `lead-new`).
 * @perm crm.leads.create / update · owner crm.leads.assign · estimated value crm.financials.read
 * @api POST /crm/leads · PATCH /crm/leads/:id (409 possible_duplicates on the same email)
 */
export function LeadFormDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead | null }) {
    const navigate = useNavigate();
    const create = useCreateLead();
    const update = useUpdateLead();
    const settings = useCrmSettings(false, open);
    const canMoney = usePermission("crm.financials.read");
    const canAssign = usePermission("crm.leads.assign");
    const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
    const form = useForm<LeadFormValues>({ resolver: zodResolver(leadFormSchema), defaultValues: { name: "" } });
    const statuses = settings.data?.lead_statuses.filter((s) => !s.is_converted && !s.is_lost) ?? [];

    useEffect(() => {
        if (!open) return;
        setDuplicates(null);
        form.reset({
            name: lead?.name ?? "",
            company_name: lead?.company_name ?? "",
            contact_name: lead?.contact_name ?? "",
            email: lead?.email ?? "",
            phone: lead?.phone ?? "",
            website: lead?.website ?? "",
            industry: lead?.industry ?? "",
            estimated_value: lead?.estimated_value != null ? String(Number(lead.estimated_value)) : "",
            status_id: lead?.status_id ?? undefined,
            lead_source_id: lead?.lead_source_id ?? undefined,
            owner_membership_id: lead?.owner_membership_id ?? undefined,
            manual_score: lead?.manual_score != null ? String(lead.manual_score) : "",
            next_follow_up_at: toLocalInput(lead?.next_follow_up_at),
            description: lead?.description ?? "",
        });
    }, [open, lead, form]);

    const pending = create.isPending || update.isPending;
    const editingClosedStatus = !!lead?.status && (lead.status.is_converted || lead.status.is_lost);

    const save = (allow_duplicate: boolean) =>
        form.handleSubmit((v) => {
            const dto: CreateLeadDto = {
                name: v.name,
                company_name: v.company_name || undefined,
                contact_name: v.contact_name || undefined,
                email: v.email || undefined,
                phone: v.phone || undefined,
                website: v.website || undefined,
                industry: v.industry || undefined,
                estimated_value: canMoney && v.estimated_value ? Number(v.estimated_value) : undefined,
                status_id: editingClosedStatus ? undefined : v.status_id || undefined,
                lead_source_id: v.lead_source_id || undefined,
                owner_membership_id: canAssign ? v.owner_membership_id || undefined : undefined,
                manual_score: v.manual_score ? Number(v.manual_score) : undefined,
                next_follow_up_at: v.next_follow_up_at ? new Date(`${v.next_follow_up_at}T09:00:00`).toISOString() : undefined,
                description: v.description || undefined,
            };
            const onError = (e: unknown) => {
                const dups = getDuplicates(e);
                if (dups) setDuplicates(dups);
                else toast({ variant: "destructive", title: "Could not save lead", description: getApiErrorMessage(e) });
            };
            if (lead) update.mutate({ id: lead.id, ...dto }, { onSuccess: () => { toast({ title: "Lead updated" }); onOpenChange(false); }, onError });
            else create.mutate({ ...dto, allow_duplicate }, { onSuccess: (l) => { toast({ title: "Lead created" }); onOpenChange(false); navigate(CrmPaths.lead(l.id)); }, onError });
        })();

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
                            <DialogDescription>Capture the opportunity now; convert it to a company, contact and deal once it qualifies.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Lead</FormLabel><FormControl><Input autoFocus placeholder="Website rebuild for Nova Hotels" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="company_name" render={({ field }) => (
                                <FormItem><FormLabel>Company</FormLabel><FormControl><Input placeholder="Nova Hotels" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="contact_name" render={({ field }) => (
                                <FormItem><FormLabel>Contact person</FormLabel><FormControl><Input placeholder="Eleni Papadopoulou" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="website" render={({ field }) => (
                                <FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="industry" render={({ field }) => (
                                <FormItem><FormLabel>Industry</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {!editingClosedStatus && (
                                <FormField control={form.control} name="status_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                                            <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>Default</SelectItem>
                                                {statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
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
                            {canMoney && (
                                <FormField control={form.control} name="estimated_value" render={({ field }) => (
                                    <FormItem><FormLabel>Estimated value</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="manual_score" render={({ field }) => (
                                <FormItem><FormLabel>Score (0–100)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="next_follow_up_at" render={({ field }) => (
                                <FormItem><FormLabel>Next follow-up</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            {canAssign && (
                                <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                    <FormItem><FormLabel>Owner</FormLabel><MemberSelect value={field.value} onChange={field.onChange} allowNone={!!lead} /></FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        {duplicates && <DuplicateNotice matches={duplicates} hrefOf={CrmPaths.lead} />}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            {duplicates && !lead && <Button type="button" variant="outline" loading={pending} onClick={() => save(true)}>Create anyway</Button>}
                            <Button type="submit" loading={pending}>{lead ? "Save changes" : "Create lead"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
