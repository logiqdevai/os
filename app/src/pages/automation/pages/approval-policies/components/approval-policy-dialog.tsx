import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { useCreateApprovalPolicy, useScopeOptions, useUpdateApprovalPolicy } from "@/features/automation/hooks/use-automation";
import type { ApprovalPolicy } from "@/features/automation/interfaces/automation.interfaces";
import { approvalPolicySchema, type ApprovalPolicyFormValues } from "@/features/automation/validation-schemas/approval-policy.schema";
import { MemberPicker, OptionMultiPicker } from "../../../components/automation-ui";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    policy: ApprovalPolicy | null;
}

const empty: ApprovalPolicyFormValues = {
    name: "", description: "", approver_membership_ids: [], approver_team_ids: [], approver_role_ids: [], allow_rule_owner: false,
    expires_after_hours: "48", escalate_after_hours: "", escalate_to_membership_id: null, delegate_when_out_of_office: true,
};

/**
 * Create (explicit "Create policy") / edit (autosaves valid changes; <SaveStatus /> + "Done") an approval policy.
 * @perm automation.approval_policies.manage @api POST|PATCH /automation/approval-policies */
export function ApprovalPolicyDialog({ open, onOpenChange, policy }: Props) {
    const create = useCreateApprovalPolicy();
    const update = useUpdateApprovalPolicy();
    const options = useScopeOptions("", open);
    const form = useForm<ApprovalPolicyFormValues>({ resolver: zodResolver(approvalPolicySchema), defaultValues: empty });
    const pending = create.isPending;

    useEffect(() => {
        if (!open) return;
        form.reset(policy ? {
            name: policy.name,
            description: policy.description ?? "",
            approver_membership_ids: policy.approver_membership_ids,
            approver_team_ids: policy.approver_team_ids,
            approver_role_ids: policy.approver_role_ids,
            allow_rule_owner: policy.allow_rule_owner,
            expires_after_hours: policy.expires_after_hours ? String(policy.expires_after_hours) : "",
            escalate_after_hours: policy.escalate_after_hours ? String(policy.escalate_after_hours) : "",
            escalate_to_membership_id: policy.escalate_to_membership_id,
            delegate_when_out_of_office: policy.delegate_when_out_of_office,
        } : empty);
    }, [open, policy, form]);

    const toDto = (v: ApprovalPolicyFormValues) => ({
        ...v,
        description: v.description || null,
        expires_after_hours: v.expires_after_hours ? Number(v.expires_after_hours) : null,
        escalate_after_hours: v.escalate_after_hours ? Number(v.escalate_after_hours) : null,
        escalate_to_membership_id: v.escalate_after_hours ? v.escalate_to_membership_id : null,
    });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (policy as ApprovalPolicy).id, ...toDto(v) }), { enabled: !!policy });
    const close = () => { if (policy) autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit((v) => {
        if (policy) return close();
        create.mutate(toDto(v), { onSuccess: () => onOpenChange(false) });
    });

    const teams = (options.data?.teams ?? []).map((t) => ({ id: t.id, name: t.name }));
    const roles = (options.data?.roles ?? []).map((r) => ({ id: r.id, name: r.name, hint: r.is_template ? "template" : undefined }));

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !pending && close())}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{policy ? "Edit approval policy" : "New approval policy"}</DialogTitle>
                            <DialogDescription>Everyone listed may decide; the first decision wins.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Finance leads" maxLength={120} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="approver_membership_ids" render={({ field }) => (
                            <FormItem><FormLabel>Approvers</FormLabel><MemberPicker multiple value={field.value} onChange={field.onChange} placeholder="Choose members" /><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="approver_team_ids" render={({ field }) => (
                                <FormItem><FormLabel>Teams</FormLabel><OptionMultiPicker options={teams} value={field.value} onChange={field.onChange} placeholder="Any member of…" loading={options.isPending} emptyText="No team found" /><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="approver_role_ids" render={({ field }) => (
                                <FormItem><FormLabel>Roles</FormLabel><OptionMultiPicker options={roles} value={field.value} onChange={field.onChange} placeholder="Holders of…" loading={options.isPending} emptyText="No role found" /><FormMessage /></FormItem>
                            )} />
                        </div>
                        {options.isError && <p className="text-xs text-danger">Teams and roles could not be loaded.</p>}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="expires_after_hours" render={({ field }) => (
                                <FormItem><FormLabel>Expires after (hours)</FormLabel><FormControl><Input inputMode="numeric" placeholder="Never" {...field} /></FormControl><FormDescription>Expired requests follow the step's “if this step fails”.</FormDescription><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="escalate_after_hours" render={({ field }) => (
                                <FormItem><FormLabel>Escalate after (hours)</FormLabel><FormControl><Input inputMode="numeric" placeholder="No escalation" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        {form.watch("escalate_after_hours") && (
                            <FormField control={form.control} name="escalate_to_membership_id" render={({ field }) => (
                                <FormItem><FormLabel>Escalate to</FormLabel><MemberPicker value={field.value ? [field.value] : []} onChange={(ids) => field.onChange(ids[0] ?? null)} /><FormMessage /></FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="delegate_when_out_of_office" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-4">
                                <div><FormLabel>Skip approvers on leave</FormLabel><FormDescription>People with approved leave today are skipped while someone else can decide.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Skip approvers on leave" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="allow_rule_owner" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-4">
                                <div><FormLabel>Workflow owner may approve</FormLabel><FormDescription>Off = separation of duties: the owner of the workflow is never asked.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Workflow owner may approve" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter className="sm:items-center">
                            {policy ? (
                                <>
                                    <SaveStatus state={autosave} className="mr-auto" />
                                    <Button type="button" variant="outline" onClick={close}>Done</Button>
                                </>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>Create policy</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
