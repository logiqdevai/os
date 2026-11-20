import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personName } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFormStatusOptions, FormSubmissionStatusOptions, WikiChecklistItemStatusOptions, WikiChecklistRunStatusOptions, WikiSpaceKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCreateSpace, useDocsDirectory, useUpdateSpace } from "@/features/docs/hooks/use-docs";
import type { WikiSpace } from "@/features/docs/interfaces/docs.interfaces";

const TONE: Record<string, BadgeVariant> = {
    DRAFT: "warning", PUBLISHED: "success", NEEDS_REVIEW: "violet", ARCHIVED: "neutral", CLOSED: "neutral",
    NOT_STARTED: "neutral", IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral", PENDING: "neutral", SKIPPED: "neutral",
    SUBMITTED: "info", UNDER_REVIEW: "violet", REVIEWED: "success", REJECTED: "danger", OVERDUE: "danger",
};
/** Statuses of checklists, runs, forms and responses (pages have no status: every edit is live). */
const LABELS = [...CustomFormStatusOptions, ...WikiChecklistRunStatusOptions, ...WikiChecklistItemStatusOptions, ...FormSubmissionStatusOptions];

export function DocsStatusBadge({ status }: { status: string | null | undefined }) {
    if (!status) return null;
    return <Badge variant={TONE[status] ?? "neutral"} dot>{getDropdownOptionLabel(LABELS, status)}</Badge>;
}

export { DocIcon } from "./doc-icons";
import { DocIconPicker } from "./doc-icons";

const spaceSchema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    icon: z.string().max(8).optional(),
    description: z.string().max(2000).optional(),
    kind: z.enum(["DEPARTMENT", "TEAM", "BRANCH", "PROJECT", "TOPIC"]),
    is_private: z.boolean(),
});
type SpaceValues = z.infer<typeof spaceSchema>;

/** New space: explicit "Create space". Edit: valid changes autosave (optimistic, <SaveStatus />); "Done" closes. */
export function SpaceFormDialog({ open, onOpenChange, space, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; space?: WikiSpace | null; onCreated?: (s: WikiSpace) => void }) {
    const create = useCreateSpace();
    const update = useUpdateSpace();
    const form = useForm<SpaceValues>({ resolver: zodResolver(spaceSchema), defaultValues: { name: "", icon: "", description: "", kind: "TOPIC", is_private: false } });
    // Reset when the dialog opens or another space is opened — not when the (optimistically patched) space changes.
    const spaceId = space?.id ?? null;
    useEffect(() => {
        if (open) form.reset({ name: space?.name ?? "", icon: space?.icon ?? "", description: space?.description ?? "", kind: space?.kind ?? "TOPIC", is_private: space?.is_private ?? false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, spaceId, form]);
    const pending = create.isPending;
    const toDto = (v: SpaceValues) => ({ ...v, icon: v.icon || undefined, description: v.description || undefined });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: spaceId as string, ...toDto(v) }), { enabled: open && !!spaceId });
    const submit = form.handleSubmit((v) => {
        if (space) { autosave.flush(); onOpenChange(false); return; }
        create.mutate(toDto(v), { onSuccess: (s) => { onOpenChange(false); onCreated?.(s); } });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{space ? "Edit space" : "New space"}</DialogTitle>
                            <DialogDescription>Spaces group pages by department, team or topic.{space ? " Changes save automatically." : ""}</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-[72px_1fr] gap-3">
                            <FormField control={form.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><FormControl><DocIconPicker value={field.value} onChange={field.onChange} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Engineering handbook" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField
                            control={form.control}
                            name="kind"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WikiSpaceKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="is_private" render={({ field }) => (<FormItem className="flex items-center justify-between gap-4"><div><FormLabel>Private</FormLabel><FormDescription>Only space members can see its pages.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        {space ? (
                            <DialogFooter className="items-center sm:justify-between">
                                <SaveStatus state={autosave} />
                                <Button type="submit" variant="outline">Done</Button>
                            </DialogFooter>
                        ) : (
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}>Create space</Button>
                            </DialogFooter>
                        )}
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Member picker backed by the docs directory endpoint (no admin permission needed). */
export function DocsMemberPicker({ value, onChange, disabled, placeholder = "Choose a member" }: { value: string | undefined; onChange: (id: string | undefined) => void; disabled?: boolean; placeholder?: string }) {
    const [open, setOpen] = useState(false);
    const directory = useDocsDirectory(open || !!value);
    const members = directory.data?.members ?? [];
    const selected = members.find((m) => m.id === value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
                    <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? personName(selected.user) : value ? "Selected member" : placeholder}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search members…" />
                    <CommandList>
                        <CommandEmpty>{directory.isError ? "Members could not be loaded" : directory.isPending ? "Loading…" : "No member found"}</CommandEmpty>
                        <CommandGroup>
                            {members.map((m) => (
                                <CommandItem key={m.id} value={`${personName(m.user)} ${m.user.email}`} onSelect={() => { onChange(m.id === value ? undefined : m.id); setOpen(false); }}>
                                    <Check className={cn("size-4", m.id === value ? "opacity-100" : "opacity-0")} />
                                    <div className="min-w-0"><div className="truncate text-[13px]">{personName(m.user)}</div><div className="truncate text-xs text-muted-foreground">{m.user.email}</div></div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
