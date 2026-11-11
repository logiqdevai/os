import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyValueList, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useUpdateMember } from "@/features/admin/members/hooks/use-members";
import type { MemberDetail } from "@/features/admin/members/interfaces/members.interfaces";
import { memberProfileSchema, type MemberProfileFormValues } from "@/features/admin/members/validation-schemas/members.schema";
import { MembershipTypeFormOptions, ProvisioningSourceOptions } from "@/config/constants/dropdowns/admin/membership-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

const NONE = "__none";

/** Account facts (read-only, global identity) and membership fields an admin may edit. */
export function MemberProfileTab({ member }: { member: MemberDetail }) {
    const canManage = usePermission("users.members.manage");
    const canExternal = usePermission("users.external_collaborators.manage");
    const session = useSessionData();
    const update = useUpdateMember();
    const form = useForm<MemberProfileFormValues>({ resolver: zodResolver(memberProfileSchema), defaultValues: { job_title: "", type: "INTERNAL", default_branch_id: NONE } });

    useEffect(() => {
        form.reset({ job_title: member.job_title ?? "", type: member.type, default_branch_id: member.default_branch_id ?? NONE });
    }, [member, form]);

    const submit = form.handleSubmit((v) =>
        update.mutate(
            { id: member.id, job_title: v.job_title, type: v.type, ...(v.default_branch_id !== NONE && { default_branch_id: v.default_branch_id }) },
            { onSuccess: () => toast({ title: "Member updated" }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        )
    );

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Account">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList
                        items={[
                            { label: "Email", value: member.user.email },
                            { label: "Two-factor sign-in", value: member.user.mfa_enabled ? <Badge variant="success">On</Badge> : <Badge>Off</Badge> },
                            { label: "Last sign-in", value: member.user.last_login_at ? formatRelative(member.user.last_login_at) : "Never" },
                            { label: "Password changed", value: formatDate(member.user.password_changed_at) },
                            { label: "Joined", value: formatDate(member.joined_at) },
                            { label: "Added via", value: getDropdownOptionLabel(ProvisioningSourceOptions, member.provisioning_source) },
                            { label: "Timezone", value: member.user.timezone },
                            { label: "Suspended", value: member.suspended_at ? formatDateTime(member.suspended_at) : null },
                        ]}
                    />
                </div>
            </Section>
            <Section title="Membership" description="Defaults only pre-fill new records; they never limit access.">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <FormField control={form.control} name="job_title" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Job title</FormLabel>
                                <FormControl><Input disabled={!canManage} placeholder="Senior developer" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={!canManage || !canExternal}>
                                    <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{MembershipTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="default_branch_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default branch</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange} disabled={!canManage}>
                                    <FormControl><SelectTrigger aria-label="Default branch"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No default</SelectItem>
                                        {session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {canManage && (
                            <div className="flex justify-end">
                                <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>Save changes</Button>
                            </div>
                        )}
                    </form>
                </Form>
            </Section>
        </div>
    );
}
