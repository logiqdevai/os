import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BranchKindFormOptions, BranchStatusFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { CountryOptions } from "@/config/constants/dropdowns/country.options";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { useCreateBranch, useUpdateBranch } from "@/features/admin/branches/hooks/use-branches";
import type { Branch } from "@/features/admin/branches/interfaces/branches.interfaces";
import { branchFormSchema, type BranchFormValues } from "@/features/admin/branches/validation-schemas/branches.schema";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";

const NONE = "__none";

interface BranchFormDialogProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    branch?: Branch | null;
    /** All branches, to pick a parent (the branch itself and its descendants are excluded). */
    branches: Branch[];
    defaultParentId?: string;
}

export function BranchFormDialog({ open, onOpenChange, branch, branches, defaultParentId }: BranchFormDialogProps) {
    const navigate = useNavigate();
    const create = useCreateBranch();
    // Editing autosaves (failures show in the dialog's <SaveStatus />); creating keeps its Create button.
    const update = useUpdateBranch(false);
    const form = useForm<BranchFormValues>({ resolver: zodResolver(branchFormSchema) });

    useEffect(() => {
        if (!open) return;
        form.reset({
            name: branch?.name ?? "",
            code: branch?.code ?? "",
            kind: branch?.kind ?? "OFFICE",
            status: branch && branch.status !== "ARCHIVED" ? branch.status : "ACTIVE",
            parent_branch_id: branch ? branch.parent_branch_id ?? NONE : defaultParentId ?? NONE,
            is_headquarters: branch?.is_headquarters ?? false,
            country: branch?.country ?? NONE,
            city: branch?.city ?? "",
            email: branch?.email ?? "",
            phone: branch?.phone ?? "",
            timezone: branch?.timezone ?? NONE,
            currency: branch?.currency ?? "",
        });
        // Reset when the dialog opens (or another branch is edited), not on every optimistic patch of `branch`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, branch?.id, defaultParentId, form]);

    const parentOptions = branches.filter((b) => !branch || (b.id !== branch.id && !b.path.split("/").includes(branch.id)));

    const toDto = (v: BranchFormValues) => ({
        name: v.name,
        code: v.code || undefined,
        kind: v.kind,
        status: v.status,
        parent_branch_id: v.parent_branch_id === NONE ? (branch ? null : undefined) : v.parent_branch_id,
        is_headquarters: v.is_headquarters,
        country: v.country === NONE ? undefined : v.country,
        city: v.city || undefined,
        email: v.email,
        phone: v.phone || undefined,
        timezone: v.timezone === NONE ? undefined : v.timezone,
        currency: v.currency || undefined,
    });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: branch!.id, ...toDto(v) }), { enabled: open && !!branch });
    const submit = form.handleSubmit((v) => {
        if (branch) return autosave.flush();
        create.mutate(toDto(v), { onSuccess: (b) => { onOpenChange(false); navigate(`/admin/branches/${b.id}`); } });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between gap-3">{branch ? "Edit branch" : "New branch"}{branch && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>Branches are offices, regions or units inside your organization. Roles can be limited to a branch.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Athens office" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="code" render={({ field }) => (
                                <FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="ATH" maxLength={20} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="kind" render={({ field }) => (
                                <FormItem><FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{BranchKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{BranchStatusFormOptions.filter((o) => o.id !== "ARCHIVED").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="parent_branch_id" render={({ field }) => (
                                <FormItem><FormLabel>Parent branch</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Parent branch"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>None (top level)</SelectItem>
                                            {parentOptions.map((b) => <SelectItem key={b.id} value={b.id}>{" ".repeat(b.depth)}{b.name}</SelectItem>)}
                                        </SelectContent></Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="country" render={({ field }) => (
                                <FormItem><FormLabel>Country</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Country"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Not set</SelectItem>
                                            {CountryOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                                        </SelectContent></Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="city" render={({ field }) => (
                                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="timezone" render={({ field }) => (
                                <FormItem><FormLabel>Timezone</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Organization default</SelectItem>
                                            {TimezoneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent></Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="currency" render={({ field }) => (
                                <FormItem><FormLabel>Currency</FormLabel><FormControl><Input placeholder="Organization default" maxLength={3} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="is_headquarters" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                <div>
                                    <FormLabel>Headquarters</FormLabel>
                                    <FormDescription>Only one branch can be the headquarters.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!!branch?.is_headquarters} aria-label="Headquarters" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            {branch ? (
                                <Button type="button" onClick={() => { autosave.flush(); onOpenChange(false); }}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create branch</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
