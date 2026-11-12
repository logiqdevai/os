import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { useCreateList, useUpdateList } from "@/features/communications/hooks/use-communications";
import type { CommChannel, RecipientList } from "@/features/communications/interfaces/communications.interfaces";
import { listFormSchema, type ListFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CampaignPaths } from "../campaign-paths";

/** Create / rename a recipient list. */
export function ListFormDialog({ open, onOpenChange, list }: { open: boolean; onOpenChange: (o: boolean) => void; list?: RecipientList | null }) {
    const navigate = useNavigate();
    const create = useCreateList();
    const update = useUpdateList();
    const form = useForm<ListFormValues>({ resolver: zodResolver(listFormSchema), defaultValues: { name: "", description: "", channel: "EMAIL" } });
    useEffect(() => {
        if (open) form.reset({ name: list?.name ?? "", description: list?.description ?? "", channel: list ? list.channel ?? "ANY" : "EMAIL" });
        // Only when the dialog opens or switches list: a refresh after an autosave must not reset typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, list?.id, form]);

    // Editing an existing list saves as you type (no Save button); a new list keeps its Create button.
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (list as RecipientList).id, name: v.name, description: v.description || undefined }), { enabled: open && !!list });
    const close = () => { autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit((v) => {
        if (list) return close();
        create.mutate({ name: v.name, description: v.description || undefined, channel: v.channel === "ANY" ? undefined : (v.channel as CommChannel) }, {
            onSuccess: (l) => { onOpenChange(false); navigate(CampaignPaths.list(l.id)); },
        });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !create.isPending && close())}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">{list ? "Edit list" : "New recipient list"}{list && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>A fixed group of contacts, members or addresses you add yourself.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Webinar attendees" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        {!list && (
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {CommChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                                            <SelectItem value="ANY">Email and SMS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            {list ? (
                                <Button type="submit">Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create list</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
