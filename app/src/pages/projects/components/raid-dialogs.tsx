import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProjectChild, useUpdateProjectChild } from "@/features/projects/hooks/use-projects";
import {
    decisionFormSchema,
    issueFormSchema,
    riskFormSchema,
    type DecisionFormValues,
    type IssueFormValues,
    type RiskFormValues,
} from "@/features/projects/validation-schemas/projects.schema";
import type { Decision, Issue, Risk } from "@/features/projects/interfaces/projects.interfaces";
import { IssueKindFormOptions, IssueStatusFormOptions, RiskStatusFormOptions, SeverityFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { PersonPicker } from "./project-pickers";

interface DialogProps<T> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    item?: T | null;
}

const SCALE = ["1", "2", "3", "4", "5"];

/** Risk: probability × impact (1–5) derives the severity on the API. @perm projects.risks.manage */
export function RiskDialog({ open, onOpenChange, projectId, item }: DialogProps<Risk>) {
    const create = useCreateProjectChild("Risk");
    const update = useUpdateProjectChild("Risk");
    const form = useForm<RiskFormValues>({ resolver: zodResolver(riskFormSchema) });
    useEffect(() => {
        if (open) form.reset({
            title: item?.title ?? "", description: item?.description ?? "", probability: String(item?.probability ?? 3), impact: String(item?.impact ?? 3),
            status: item?.status ?? "OPEN", owner_membership_id: item?.owner_membership_id ?? "", mitigation: item?.mitigation ?? "", due_date: item?.due_date?.slice(0, 10) ?? "",
        });
    }, [open, item, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = {
            title: v.title, description: v.description || undefined, probability: Number(v.probability), impact: Number(v.impact), status: v.status,
            owner_membership_id: v.owner_membership_id || undefined, mitigation: v.mitigation || undefined, due_date: v.due_date || undefined,
        };
        const done = { onSuccess: () => onOpenChange(false) };
        if (item) update.mutate({ id: projectId, kind: "risks", itemId: item.id, dto }, done);
        else create.mutate({ id: projectId, kind: "risks", dto }, done);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{item ? "Edit risk" : "Log a risk"}</DialogTitle>
                            <DialogDescription>Something that may happen and would hurt delivery.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Risk</FormLabel><FormControl><Input autoFocus placeholder="Content from the customer arrives late" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            {(["probability", "impact"] as const).map((name) => (
                                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{name === "probability" ? "Probability" : "Impact"}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label={name}><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{SCALE.map((s) => <SelectItem key={s} value={s}>{s} / 5</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                            ))}
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem className="col-span-2 sm:col-span-1">
                                    <FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{RiskStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                <FormItem><FormLabel>Owner</FormLabel><PersonPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} noneLabel="No owner" selected={item?.owner} /></FormItem>
                            )} />
                            <FormField control={form.control} name="due_date" render={({ field }) => (
                                <FormItem><FormLabel>Review by</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="mitigation" render={({ field }) => (
                            <FormItem><FormLabel>Mitigation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{item ? "Save" : "Log risk"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Issue or blocker. @perm projects.issues.manage */
export function IssueDialog({ open, onOpenChange, projectId, item }: DialogProps<Issue>) {
    const create = useCreateProjectChild("Issue");
    const update = useUpdateProjectChild("Issue");
    const form = useForm<IssueFormValues>({ resolver: zodResolver(issueFormSchema) });
    useEffect(() => {
        if (open) form.reset({
            title: item?.title ?? "", kind: item?.kind ?? "ISSUE", description: item?.description ?? "", severity: item?.severity ?? "MEDIUM", status: item?.status ?? "OPEN",
            owner_membership_id: item?.owner_membership_id ?? "", target_resolution: item?.target_resolution?.slice(0, 10) ?? "", resolution: item?.resolution ?? "",
        });
    }, [open, item, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { ...v, description: v.description || undefined, owner_membership_id: v.owner_membership_id || undefined, target_resolution: v.target_resolution || undefined, resolution: v.resolution || undefined };
        const done = { onSuccess: () => onOpenChange(false) };
        if (item) update.mutate({ id: projectId, kind: "issues", itemId: item.id, dto }, done);
        else create.mutate({ id: projectId, kind: "issues", dto }, done);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{item ? "Edit issue" : "Log an issue"}</DialogTitle>
                            <DialogDescription>A problem happening now. Blockers stop progress.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Issue</FormLabel><FormControl><Input autoFocus placeholder="Staging server unavailable" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <FormField control={form.control} name="kind" render={({ field }) => (
                                <FormItem><FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{IssueKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="severity" render={({ field }) => (
                                <FormItem><FormLabel>Severity</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Severity"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{SeverityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem className="col-span-2 sm:col-span-1"><FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{IssueStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                <FormItem><FormLabel>Owner</FormLabel><PersonPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} noneLabel="No owner" selected={item?.owner} /></FormItem>
                            )} />
                            <FormField control={form.control} name="target_resolution" render={({ field }) => (
                                <FormItem><FormLabel>Resolve by</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        {item && (
                            <FormField control={form.control} name="resolution" render={({ field }) => (
                                <FormItem><FormLabel>Resolution</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                            )} />
                        )}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{item ? "Save" : "Log issue"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Decision record. @perm projects.issues.manage */
export function DecisionDialog({ open, onOpenChange, projectId, item }: DialogProps<Decision>) {
    const create = useCreateProjectChild("Decision");
    const update = useUpdateProjectChild("Decision");
    const form = useForm<DecisionFormValues>({ resolver: zodResolver(decisionFormSchema) });
    useEffect(() => {
        if (open) form.reset({ title: item?.title ?? "", description: item?.description ?? "", selected_option: item?.selected_option ?? "", reason: item?.reason ?? "", decided_at: item?.decided_at?.slice(0, 10) ?? "" });
    }, [open, item, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { title: v.title, description: v.description || undefined, selected_option: v.selected_option || undefined, reason: v.reason || undefined, decided_at: v.decided_at || undefined };
        const done = { onSuccess: () => onOpenChange(false) };
        if (item) update.mutate({ id: projectId, kind: "decisions", itemId: item.id, dto }, done);
        else create.mutate({ id: projectId, kind: "decisions", dto }, done);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{item ? "Edit decision" : "Record a decision"}</DialogTitle>
                            <DialogDescription>Keep the why next to the what.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Decision</FormLabel><FormControl><Input autoFocus placeholder="Use Next.js for the marketing site" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="selected_option" render={({ field }) => (
                                <FormItem><FormLabel>Chosen option</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="decided_at" render={({ field }) => (
                                <FormItem><FormLabel>Decided on</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormDescription>Defaults to today.</FormDescription></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="reason" render={({ field }) => (
                            <FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{item ? "Save" : "Record decision"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
