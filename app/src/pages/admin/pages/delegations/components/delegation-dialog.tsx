import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MultiPicker } from "@/components/ui/multi-picker";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCatalog } from "@/features/admin/permissions/hooks/use-permissions-admin";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import { useCreateDelegation } from "@/features/admin/delegations/hooks/use-delegations";
import { delegationFormSchema, type DelegationFormValues } from "@/features/admin/delegations/validation-schemas/delegations.schema";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { MemberPicker } from "../../../components/member-picker";
import { ScopeFields } from "../../../components/scope-fields";

/** Keys a delegation can never pass on (mirrors NON_DELEGABLE_PERMISSIONS in the API). */
const NON_DELEGABLE = ["users.members.transfer_ownership", "organizations.organization.delete", "organizations.billing.manage", "users.delegations.manage"];

const today = () => new Date().toISOString().slice(0, 10);

/** New delegation — mockup 01-admin `delegationNew`. The API re-checks that the delegator holds every key in that scope. */
export function DelegationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const session = useSessionData();
    const me = session?.active_organization?.membership_id ?? "";
    const create = useCreateDelegation();
    const catalog = useCatalog({}, open);
    const roles = useAssignableRoles(open);
    const form = useForm<DelegationFormValues>({
        resolver: zodResolver(delegationFormSchema),
        defaultValues: { delegate_membership_id: "", delegator_membership_id: me, permission_keys: [], role_ids: [], scope_type: "ORGANIZATION", scope_id: undefined, starts_at: today(), ends_at: "", reason: "" },
    });

    useEffect(() => {
        if (open) form.reset({ delegate_membership_id: "", delegator_membership_id: me, permission_keys: [], role_ids: [], scope_type: "ORGANIZATION", scope_id: undefined, starts_at: today(), ends_at: "", reason: "" });
    }, [open, me, form]);

    const onBehalf = form.watch("delegator_membership_id") !== me;
    // Offer keys the signed-in admin holds; on behalf of someone else the API checks the delegator too.
    const permissionItems = useMemo(
        () =>
            (catalog.data?.data ?? [])
                .filter((p) => p.held && !NON_DELEGABLE.includes(p.key))
                .map((p) => ({ id: p.key, label: p.key, hint: getDropdownOptionLabel(ModuleKeyOptions, p.module), keywords: p.description ?? undefined })),
        [catalog.data]
    );

    const submit = form.handleSubmit((v) =>
        create.mutate(
            {
                delegate_membership_id: v.delegate_membership_id,
                ...(v.delegator_membership_id && v.delegator_membership_id !== me && { delegator_membership_id: v.delegator_membership_id }),
                permission_keys: v.permission_keys,
                role_ids: v.role_ids,
                scope_type: v.scope_type,
                ...(v.scope_type !== "ORGANIZATION" && v.scope_id && { scope_id: v.scope_id }),
                starts_at: new Date(`${v.starts_at}T00:00:00`).toISOString(),
                ends_at: new Date(`${v.ends_at}T23:59:59`).toISOString(),
                reason: v.reason,
            },
            {
                onSuccess: () => onOpenChange(false),
            }
        )
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New delegation</DialogTitle>
                            <DialogDescription>Temporarily hand selected responsibilities to someone else. Every change is audited.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="delegate_membership_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Delegate</FormLabel>
                                    <MemberPicker value={field.value || undefined} exclude={[form.getValues("delegator_membership_id")]} onChange={(id) => field.onChange(id)} placeholder="Who takes over" />
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="delegator_membership_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>On behalf of</FormLabel>
                                    <MemberPicker value={field.value || undefined} valueLabel={field.value === me ? "You" : undefined} onChange={(id) => field.onChange(id)} />
                                    <FormDescription>{onBehalf ? "Needs organization-wide delegation rights." : "You, by default."}</FormDescription>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="permission_keys" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Permissions</FormLabel>
                                <MultiPicker ariaLabel="Permissions" items={permissionItems} value={field.value} onChange={field.onChange} loading={catalog.isFetching} placeholder="Add permission" searchPlaceholder="Search keys, e.g. tasks.tasks…" />
                                <FormDescription>Only keys you hold. Owner-only actions cannot be delegated.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="role_ids" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Roles (optional)</FormLabel>
                                <MultiPicker ariaLabel="Roles" items={(roles.data ?? []).map((r) => ({ id: r.id, label: r.name }))} value={field.value} onChange={field.onChange} loading={roles.isFetching} placeholder="Add role" />
                                <FormDescription>Every permission of the role that the delegator holds.</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="scope_id" render={() => (
                            <FormItem>
                                <ScopeFields
                                    label="Where"
                                    scopeType={form.watch("scope_type")}
                                    scopeId={form.watch("scope_id")}
                                    onChange={(t, id) => { form.setValue("scope_type", t); form.setValue("scope_id", id, { shouldValidate: form.formState.isSubmitted }); }}
                                />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="starts_at" render={({ field }) => (
                                <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="date" min={today()} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="ends_at" render={({ field }) => (
                                <FormItem><FormLabel>Ends (inclusive)</FormLabel><FormControl><Input type="date" min={form.watch("starts_at") || today()} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="reason" render={({ field }) => (
                            <FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea rows={2} placeholder="Holiday cover" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Lock className="mt-0.5 size-3.5 flex-none" /> The delegate gets only these keys, only in this scope, only during the period, and cannot delegate them further.
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create delegation</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
