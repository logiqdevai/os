import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import { useCreateServiceAccount, useUpdateServiceAccount } from "@/features/admin/service-accounts/hooks/use-service-accounts";
import type { ServiceAccountDetail } from "@/features/admin/service-accounts/interfaces/service-accounts.interfaces";
import { serviceAccountFormSchema, type ServiceAccountFormValues } from "@/features/admin/service-accounts/validation-schemas/service-accounts.schema";

const NONE = "__none";

/** Create or edit a service account (identity for automation and AI agents). */
export function ServiceAccountFormDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: ServiceAccountDetail | null }) {
    const navigate = useNavigate();
    const canAssign = usePermission("users.roles.assign");
    const roles = useAssignableRoles(open && !account && canAssign);
    const create = useCreateServiceAccount();
    const update = useUpdateServiceAccount();
    const form = useForm<ServiceAccountFormValues>({ resolver: zodResolver(serviceAccountFormSchema), defaultValues: { name: "", purpose: "", expires_at: "", role_id: NONE } });

    useEffect(() => {
        if (open) form.reset({ name: account?.name ?? "", purpose: account?.purpose ?? "", expires_at: account?.expires_at?.slice(0, 10) ?? "", role_id: NONE });
    }, [open, account, form]);

    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const expires_at = v.expires_at ? new Date(`${v.expires_at}T23:59:59`).toISOString() : undefined;
        // Editing is optimistic (the page shows the change at once), so the dialog closes right away.
        if (account) { update.mutate({ id: account.id, name: v.name, purpose: v.purpose, ...(expires_at && { expires_at }) }); onOpenChange(false); }
        else create.mutate({ name: v.name, purpose: v.purpose || undefined, expires_at, ...(v.role_id !== NONE && { role_id: v.role_id }) }, { onSuccess: (sa) => { onOpenChange(false); navigate(`/admin/service-accounts/${sa.id}`); } });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{account ? "Edit service account" : "New service account"}</DialogTitle>
                            <DialogDescription>A non-human identity for an integration, automation or AI agent. You are its owner.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Support triage agent" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="purpose" render={({ field }) => (
                            <FormItem><FormLabel>Purpose</FormLabel><FormControl><Textarea rows={2} placeholder="Classifies new tickets and drafts replies" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {!account && canAssign && (
                                <FormField control={form.control} name="role_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={NONE}>Add later</SelectItem>
                                                {roles.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>Whole organization. Add scoped roles later.</FormDescription>
                                    </FormItem>
                                )} />
                            )}
                            <FormField control={form.control} name="expires_at" render={({ field }) => (
                                <FormItem><FormLabel>Expires on</FormLabel><FormControl><Input type="date" min={new Date().toISOString().slice(0, 10)} {...field} /></FormControl><FormDescription>Optional.</FormDescription></FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{account ? "Save changes" : "Create"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
