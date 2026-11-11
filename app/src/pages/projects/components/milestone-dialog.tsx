import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProjectChild, useUpdateProjectChild } from "@/features/projects/hooks/use-projects";
import { milestoneFormSchema, type MilestoneFormValues } from "@/features/projects/validation-schemas/projects.schema";
import type { Milestone } from "@/features/projects/interfaces/projects.interfaces";
import { ProjectItemStatusFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { PersonPicker } from "./project-pickers";

interface MilestoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    milestone?: Milestone | null;
}

/** Create / edit a milestone. @perm projects.milestones.manage · @api POST|PATCH /projects/:id/milestones */
export function MilestoneDialog({ open, onOpenChange, projectId, milestone }: MilestoneDialogProps) {
    const create = useCreateProjectChild("Milestone");
    const update = useUpdateProjectChild("Milestone");
    const form = useForm<MilestoneFormValues>({ resolver: zodResolver(milestoneFormSchema) });
    useEffect(() => {
        if (open) {
            form.reset({
                name: milestone?.name ?? "",
                description: milestone?.description ?? "",
                planned_date: milestone?.planned_date?.slice(0, 10) ?? "",
                status: milestone?.status ?? "PLANNED",
                owner_membership_id: milestone?.owner_membership_id ?? "",
                customer_visible: milestone?.customer_visible ?? false,
                is_billing_milestone: milestone?.is_billing_milestone ?? false,
            });
        }
    }, [open, milestone, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { ...v, description: v.description || undefined, planned_date: v.planned_date || undefined, owner_membership_id: v.owner_membership_id || undefined };
        const done = { onSuccess: () => onOpenChange(false) };
        if (milestone) update.mutate({ id: projectId, kind: "milestones", itemId: milestone.id, dto }, done);
        else create.mutate({ id: projectId, kind: "milestones", dto }, done);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
                            <DialogDescription>Checkpoints the team and, when visible, the customer track.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Design sign-off" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="planned_date" render={({ field }) => (
                                <FormItem><FormLabel>Planned date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ProjectItemStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                            <FormItem><FormLabel>Owner</FormLabel><PersonPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} noneLabel="No owner" selected={milestone?.owner} /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="space-y-3 rounded-md border border-border p-3">
                            <FormField control={form.control} name="customer_visible" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 space-y-0">
                                    <FormLabel className="font-normal">Visible in the customer portal</FormLabel>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="is_billing_milestone" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 space-y-0">
                                    <FormLabel className="font-normal">Billing milestone (notifies Billing when completed)</FormLabel>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{milestone ? "Save" : "Add milestone"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
