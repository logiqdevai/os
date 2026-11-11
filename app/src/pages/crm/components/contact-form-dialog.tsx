import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactRoleFormOptions } from "@/config/constants/dropdowns/crm/contact-role-form.options";
import { contactFormSchema, type ContactFormValues } from "@/features/crm/contacts/validation-schemas/contacts.schema";
import { useCreateContact, useUpdateContact } from "@/features/crm/contacts/hooks/use-contacts";
import type { Contact, CreateContactDto } from "@/features/crm/contacts/interfaces/contacts.interfaces";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { CrmPaths } from "../crm-paths";
import { CompanyPicker, MemberSelect } from "./crm-pickers";
import { DuplicateNotice, getDuplicates, type DuplicateMatch } from "./crm-actions";

const NONE = "__none";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact?: Contact | null;
    /** Pre-select a company (contact created from a company page). */
    company?: { id: string; name: string } | null;
    onCreated?: (contact: Contact) => void;
}

/**
 * New / edit contact (mockup `contact-new`).
 * @perm crm.contacts.create / update · owner change crm.contacts.assign · consent changes are audited
 * @api POST /crm/contacts · PATCH /crm/contacts/:id (409 possible_duplicates on the same email)
 */
export function ContactFormDialog({ open, onOpenChange, contact, company, onCreated }: Props) {
    const navigate = useNavigate();
    const create = useCreateContact();
    const update = useUpdateContact();
    const settings = useCrmSettings(false, open);
    const canAssign = usePermission("crm.contacts.assign");
    const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
    const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: { first_name: "", roles: [], email_consent: false } });

    useEffect(() => {
        if (!open) return;
        setDuplicates(null);
        form.reset({
            first_name: contact?.first_name ?? "",
            last_name: contact?.last_name ?? "",
            email: contact?.email ?? "",
            phone: contact?.phone ?? "",
            mobile: contact?.mobile ?? "",
            job_title: contact?.job_title ?? "",
            company_id: contact?.company_id ?? company?.id ?? undefined,
            company_label: contact?.company?.name ?? company?.name ?? undefined,
            linkedin_url: contact?.linkedin_url ?? "",
            roles: contact?.roles ?? [],
            lifecycle_stage_id: contact?.lifecycle_stage_id ?? undefined,
            owner_membership_id: contact?.owner_membership_id ?? undefined,
            email_consent: !!contact?.consent?.email,
            description: contact?.description ?? "",
        });
    }, [open, contact, company, form]);

    const pending = create.isPending || update.isPending;

    const save = (allow_duplicate: boolean) =>
        form.handleSubmit((v) => {
            const dto: CreateContactDto = {
                first_name: v.first_name,
                last_name: v.last_name || undefined,
                email: v.email || undefined,
                phone: v.phone || undefined,
                mobile: v.mobile || undefined,
                job_title: v.job_title || undefined,
                company_id: v.company_id || undefined,
                linkedin_url: v.linkedin_url || undefined,
                roles: v.roles,
                lifecycle_stage_id: v.lifecycle_stage_id || undefined,
                owner_membership_id: canAssign ? v.owner_membership_id || undefined : undefined,
                consent: { email: v.email_consent },
                description: v.description || undefined,
            };
            const onError = (e: unknown) => {
                const dups = getDuplicates(e);
                if (dups) setDuplicates(dups);
                else toast({ variant: "destructive", title: "Could not save contact", description: getApiErrorMessage(e) });
            };
            if (contact) {
                update.mutate({ id: contact.id, ...dto }, { onSuccess: () => { toast({ title: "Contact updated" }); onOpenChange(false); }, onError });
            } else {
                create.mutate({ ...dto, allow_duplicate }, {
                    onSuccess: (c) => {
                        toast({ title: "Contact created" });
                        onOpenChange(false);
                        if (onCreated) onCreated(c);
                        else navigate(CrmPaths.contact(c.id));
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
                            <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
                            <DialogDescription>A person at a customer, prospect, partner or vendor.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="first_name" render={({ field }) => (
                                <FormItem><FormLabel>First name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="last_name" render={({ field }) => (
                                <FormItem><FormLabel>Last name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="company_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company</FormLabel>
                                    <CompanyPicker value={field.value} valueLabel={form.watch("company_label")} onChange={(id, label) => { field.onChange(id); form.setValue("company_label", label); }} />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="job_title" render={({ field }) => (
                                <FormItem><FormLabel>Job title</FormLabel><FormControl><Input placeholder="Head of Marketing" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="mobile" render={({ field }) => (
                                <FormItem><FormLabel>Mobile</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="linkedin_url" render={({ field }) => (
                                <FormItem><FormLabel>LinkedIn</FormLabel><FormControl><Input placeholder="https://linkedin.com/in/…" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="lifecycle_stage_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lifecycle stage</FormLabel>
                                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}>
                                        <FormControl><SelectTrigger aria-label="Lifecycle stage"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>None</SelectItem>
                                            {settings.data?.lifecycle_stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            {canAssign && (
                                <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                    <FormItem><FormLabel>Owner</FormLabel><MemberSelect value={field.value} onChange={field.onChange} allowNone={!!contact} /></FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="roles" render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel>Roles</FormLabel>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                        {ContactRoleFormOptions.map((o) => (
                                            <label key={o.id} className="flex items-center gap-2 text-[13px]">
                                                <Checkbox
                                                    checked={field.value.includes(o.id)}
                                                    onCheckedChange={(c) => field.onChange(c ? [...field.value, o.id] : field.value.filter((r) => r !== o.id))}
                                                />
                                                {o.label}
                                            </label>
                                        ))}
                                    </div>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="email_consent" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3 sm:col-span-2">
                                    <div>
                                        <FormLabel>Marketing email consent</FormLabel>
                                        <FormDescription>Used by campaigns. Changes are recorded in the audit log.</FormDescription>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Marketing email consent" /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        {duplicates && <DuplicateNotice matches={duplicates} hrefOf={CrmPaths.contact} />}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            {duplicates && !contact && <Button type="button" variant="outline" loading={pending} onClick={() => save(true)}>Create anyway</Button>}
                            <Button type="submit" loading={pending}>{contact ? "Save changes" : "Create contact"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
