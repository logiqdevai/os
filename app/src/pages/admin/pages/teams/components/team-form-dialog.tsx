import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamKindFormOptions } from "@/config/constants/dropdowns/admin/team-kind-form.options";
import { teamFormSchema, type TeamFormValues } from "@/features/admin/teams/validation-schemas/teams.schema";
import { useCreateTeam, useUpdateTeam } from "@/features/admin/teams/hooks/use-teams";
import type { Team } from "@/features/admin/teams/interfaces/teams.interfaces";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";

const ORG_WIDE = "__org";

interface TeamFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team?: Team | null;
}

/** REFERENCE FORM DIALOG — react-hook-form + zod, shadcn Select (never <select>), pending state on the submit button. */
export function TeamFormDialog({ open, onOpenChange, team }: TeamFormDialogProps) {
    const session = useSessionData();
    const create = useCreateTeam();
    // Editing autosaves (optimistic; failures show in the dialog's <SaveStatus />); creating keeps its Create button.
    const update = useUpdateTeam(false);
    const form = useForm<TeamFormValues>({ resolver: zodResolver(teamFormSchema), defaultValues: { name: "", description: "", kind: "TEAM", task_key: "", branch_id: ORG_WIDE } });

    useEffect(() => {
        if (open) {
            form.reset({
                name: team?.name ?? "",
                description: team?.description ?? "",
                kind: team?.kind ?? "TEAM",
                task_key: team?.task_key ?? "",
                branch_id: team?.branch_id ?? ORG_WIDE,
            });
        }
        // Reset when the dialog opens (or another team is edited), not on every optimistic patch of `team`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, team?.id, form]);

    const toDto = (values: TeamFormValues) => ({
        name: values.name,
        description: values.description || undefined,
        kind: values.kind,
        task_key: values.task_key || undefined,
        branch_id: values.branch_id && values.branch_id !== ORG_WIDE ? values.branch_id : undefined,
    });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: team!.id, ...toDto(v) }), { enabled: open && !!team });

    const submit = form.handleSubmit((values) => {
        if (team) return autosave.flush();
        create.mutate(toDto(values), { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-between gap-3">{team ? "Edit team" : "New team"}{team && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>Teams group members for assignment, scope and task keys.</DialogDescription>
                        </DialogHeader>
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input autoFocus placeholder="Web team" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="kind"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kind</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger aria-label="Kind">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {TeamKindFormOptions.map((o) => (
                                                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="task_key"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Task key</FormLabel>
                                        <FormControl>
                                            <Input placeholder="WEB" maxLength={6} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                                        </FormControl>
                                        <FormDescription>Prefix for task ids, e.g. WEB-142.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="branch_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger aria-label="Branch">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value={ORG_WIDE}>Whole organization</SelectItem>
                                            {session?.branches.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            {team ? (
                                <Button type="button" onClick={() => { autosave.flush(); onOpenChange(false); }}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create team</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
