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
import { useCreateRole, useRoles } from "@/features/admin/roles/hooks/use-roles";
import { roleFormSchema, type RoleFormValues } from "@/features/admin/roles/validation-schemas/roles.schema";
import { CustomRoleTypeOptions } from "@/config/constants/dropdowns/admin/access-form.options";

const BLANK = "__blank";

/** New custom role: blank or cloned from a template / existing role. Opens the editor afterwards. */
export function CreateRoleDialog({ open, onOpenChange, templateId }: { open: boolean; onOpenChange: (o: boolean) => void; templateId?: string }) {
    const navigate = useNavigate();
    const create = useCreateRole();
    const roles = useRoles({ limit: 200, order_by: "name", order_direction: "asc" }, { enabled: open });
    const form = useForm<RoleFormValues>({ resolver: zodResolver(roleFormSchema), defaultValues: { name: "", description: "", type: "ORGANIZATION", template_role_id: BLANK } });

    useEffect(() => {
        if (open) {
            const tpl = roles.data?.data.find((r) => r.id === templateId);
            form.reset({ name: tpl ? `${tpl.name} (copy)` : "", description: tpl?.description ?? "", type: tpl && ["ORGANIZATION", "BRANCH", "TEAM", "PROJECT"].includes(tpl.type) ? (tpl.type as RoleFormValues["type"]) : "ORGANIZATION", template_role_id: templateId ?? BLANK });
        }
    }, [open, templateId, roles.data, form]);

    const submit = form.handleSubmit((v) =>
        create.mutate(
            { name: v.name, description: v.description || undefined, type: v.type, ...(v.template_role_id !== BLANK && { template_role_id: v.template_role_id }) },
            {
                onSuccess: (role) => { onOpenChange(false); navigate(`/admin/roles/${role.id}`); },
            }
        )
    );

    const sources = (roles.data?.data ?? []).filter((r) => r.type !== "CUSTOMER_PORTAL");

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New role</DialogTitle>
                            <DialogDescription>Start from a template to save time. New roles are drafts until you publish them.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="template_role_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Start from</FormLabel>
                                <Select value={field.value} onValueChange={(v) => { field.onChange(v); const r = sources.find((x) => x.id === v); if (r && !form.getValues("name")) form.setValue("name", `${r.name} (copy)`); }}>
                                    <FormControl><SelectTrigger aria-label="Start from"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={BLANK}>Blank role</SelectItem>
                                        {sources.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}{r.is_template ? " (template)" : ""}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Permissions are copied; you can change them before publishing.</FormDescription>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Senior designer" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Intended for</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Role type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{CustomRoleTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create draft</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
