import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MultiPicker } from "@/components/ui/multi-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMembers } from "@/features/admin/members/hooks/use-members";
import { useCreateAccessReview } from "@/features/admin/access-reviews/hooks/use-access-reviews";
import { accessReviewFormSchema, type AccessReviewFormValues } from "@/features/admin/access-reviews/validation-schemas/access-reviews.schema";
import type { ModuleKey } from "@/config/apps/app.types";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { ReviewerStrategyFormOptions, getReviewerStrategyDescription } from "@/config/constants/dropdowns/admin/access-review-form.options";
import { personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ScopeFields } from "../../../components/scope-fields";

const inDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const defaults = (): AccessReviewFormValues => ({ name: "", description: "", scope_type: "ORGANIZATION", scope_id: undefined, modules: [], reviewer_strategy: "BRANCH_MANAGERS", reviewer_membership_ids: [], starts_at: "", due_at: inDays(30) });

/** New access review — mockup 01-admin `reviewNew`. "Create and start" snapshots every in-scope member right away. */
export function ReviewFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const navigate = useNavigate();
    const create = useCreateAccessReview();
    const form = useForm<AccessReviewFormValues>({ resolver: zodResolver(accessReviewFormSchema), defaultValues: defaults() });
    const strategy = form.watch("reviewer_strategy");
    const members = useMembers({ status: "ACTIVE", limit: 200 }, { enabled: open && strategy === "SPECIFIC" });

    useEffect(() => {
        if (open) form.reset(defaults());
    }, [open, form]);

    const save = (start: boolean) =>
        form.handleSubmit((v) =>
            create.mutate(
                {
                    name: v.name,
                    description: v.description || undefined,
                    scope_type: v.scope_type,
                    ...(v.scope_type !== "ORGANIZATION" && v.scope_id && { scope_id: v.scope_id }),
                    modules: v.modules as ModuleKey[],
                    reviewer_strategy: v.reviewer_strategy,
                    reviewer_membership_ids: v.reviewer_strategy === "SPECIFIC" ? v.reviewer_membership_ids : [],
                    ...(v.starts_at && { starts_at: new Date(`${v.starts_at}T00:00:00`).toISOString() }),
                    due_at: new Date(`${v.due_at}T23:59:59`).toISOString(),
                    start,
                },
                {
                    onSuccess: (r) => {
                        toast({ title: start ? `Review started · ${r.stats.total} members` : "Draft saved" });
                        onOpenChange(false);
                        navigate(`/admin/access-reviews/${r.id}`);
                    },
                    onError: (e) => toast({ variant: "destructive", title: "Could not create the review", description: getApiErrorMessage(e) }),
                }
            )
        )();

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={(e) => { e.preventDefault(); save(true); }} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New access review</DialogTitle>
                            <DialogDescription>Define who is reviewed, by whom and by when. Starting freezes each member's current access for the reviewer.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Q1 2027 access review" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description (optional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="scope_id" render={() => (
                            <FormItem>
                                <ScopeFields
                                    label="Who is reviewed"
                                    scopeType={form.watch("scope_type")}
                                    scopeId={form.watch("scope_id")}
                                    onChange={(t, id) => { form.setValue("scope_type", t); form.setValue("scope_id", id, { shouldValidate: form.formState.isSubmitted }); }}
                                />
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="modules" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Only members with access to</FormLabel>
                                <MultiPicker ariaLabel="Modules" items={ModuleKeyOptions.map((m) => ({ id: m.id, label: m.label }))} value={field.value} onChange={field.onChange} placeholder="Any module" />
                                <FormDescription>Empty = everyone in scope.</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="reviewer_strategy" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Who reviews each member</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Reviewer strategy"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{ReviewerStrategyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormDescription>{getReviewerStrategyDescription(field.value)} Nobody reviews themselves; members without one go to you or an owner.</FormDescription>
                            </FormItem>
                        )} />
                        {strategy === "SPECIFIC" && (
                            <FormField control={form.control} name="reviewer_membership_ids" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reviewers</FormLabel>
                                    <MultiPicker
                                        ariaLabel="Reviewers"
                                        loading={members.isFetching}
                                        items={(members.data?.data ?? []).map((m) => ({ id: m.id, label: personName(m.user), hint: m.user.email, keywords: m.user.email }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        placeholder="Add reviewer"
                                    />
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="starts_at" render={({ field }) => (
                                <FormItem><FormLabel>Starts (optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="due_at" render={({ field }) => (
                                <FormItem><FormLabel>Due</FormLabel><FormControl><Input type="date" min={inDays(1)} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="button" variant="outline" onClick={() => save(false)} disabled={create.isPending}>Save as draft</Button>
                            <Button type="submit" loading={create.isPending}>Create and start</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
