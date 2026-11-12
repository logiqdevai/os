import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiPicker } from "@/components/ui/multi-picker";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import type { ModuleKey } from "@/config/apps/app.types";
import { groupMappingFormSchema, type GroupMappingFormValues } from "@/features/admin/sso/validation-schemas/sso.schema";
import { useAddGroupMapping, useUpdateGroupMapping } from "@/features/admin/sso/hooks/use-sso";
import type { SsoGroupMapping } from "@/features/admin/sso/interfaces/sso.interfaces";
import { useAssignableRoles } from "@/features/admin/roles/hooks/use-roles";
import { useTeams } from "@/features/admin/teams/hooks/use-teams";
import { useSessionData } from "@/features/session/hooks/use-session";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

const NONE = "__none";

interface MappingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    configId: string;
    mapping?: SsoGroupMapping | null;
}

/** IdP group → role / team / branch / modules (01 §71). Roles follow the normal assignment rules on the API. */
export function MappingDialog({ open, onOpenChange, configId, mapping }: MappingDialogProps) {
    const session = useSessionData();
    const roles = useAssignableRoles(open);
    const canReadTeams = usePermission("organizations.teams.read");
    const teams = useTeams({ limit: 200 });
    const add = useAddGroupMapping();
    const update = useUpdateGroupMapping();
    const form = useForm<GroupMappingFormValues>({ resolver: zodResolver(groupMappingFormSchema), defaultValues: { external_group: "", role_id: NONE, team_id: NONE, branch_id: NONE, modules: [] } });

    useEffect(() => {
        if (open) {
            form.reset({
                external_group: mapping?.external_group ?? "",
                role_id: mapping?.role_id ?? NONE,
                team_id: mapping?.team_id ?? NONE,
                branch_id: mapping?.branch_id ?? NONE,
                modules: mapping?.modules ?? [],
            });
        }
    }, [open, mapping, form]);

    const pending = add.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = {
            external_group: v.external_group,
            role_id: v.role_id === NONE ? null : v.role_id,
            team_id: v.team_id === NONE ? null : v.team_id,
            branch_id: v.branch_id === NONE ? null : v.branch_id,
            modules: v.modules as ModuleKey[],
        };
        const options = {
            onSuccess: () => { toast({ title: mapping ? "Mapping saved" : "Mapping added" }); onOpenChange(false); },
            onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save the mapping", description: getApiErrorMessage(e) }),
        };
        if (mapping) update.mutate({ configId, mappingId: mapping.id, ...dto }, options);
        else add.mutate({ configId, ...dto }, options);
    });

    const pick = (name: "role_id" | "team_id" | "branch_id", label: string, items: { id: string; name: string }[]) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{mapping ? "Edit group mapping" : "Add group mapping"}</DialogTitle>
                            <DialogDescription>Members provisioned through SSO get this access when they are in the group.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="external_group" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Identity provider group</FormLabel>
                                <FormControl><Input autoFocus placeholder="eng-athens" className="font-mono" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {pick("role_id", "Role", roles.data ?? [])}
                            {pick("team_id", "Team", canReadTeams ? teams.data?.data ?? [] : [])}
                            {pick("branch_id", "Branch", session?.branches ?? [])}
                        </div>
                        <FormField control={form.control} name="modules" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Modules</FormLabel>
                                <MultiPicker ariaLabel="Modules" items={ModuleKeyOptions.map((m) => ({ id: m.id, label: m.label }))} value={field.value} onChange={field.onChange} placeholder="Add module" />
                                <FormDescription>Empty = the role decides.</FormDescription>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{mapping ? "Save" : "Add mapping"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
