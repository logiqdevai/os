import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquareText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useSessionData } from "@/features/session/hooks/use-session";
import { CannedScopeFilterOptions, CannedScopeOptions } from "@/config/constants/dropdowns/support/support.options";
import { useCannedResponses, useCreateCannedResponse, useDeleteCannedResponse, useUpdateCannedResponse } from "@/features/support/hooks/use-support";
import { cannedFormSchema, type CannedFormValues } from "@/features/support/validation-schemas/support.schema";
import type { CannedResponse } from "@/features/support/interfaces/support.interfaces";

/**
 * Saved replies — /support/macros (mockup 13-support `macros`).
 * @perm VIEW + personal support.conversations.reply · shared (organization/team) support.canned_responses.manage
 */
export default function MacrosPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useCannedResponses(params);
    const remove = useDeleteCannedResponse();
    const session = useSessionData();
    const canManageShared = usePermission("support.canned_responses.manage");
    const canReply = usePermission("support.conversations.reply");
    const [editing, setEditing] = useState<CannedResponse | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<CannedResponse | null>(null);
    const me = session?.active_organization?.membership_id;
    const canEdit = (c: CannedResponse) => (c.scope === "PERSONAL" ? c.owner_membership_id === me : canManageShared);

    const columns: DataTableColumn<CannedResponse>[] = [
        {
            key: "name",
            header: "Reply",
            cell: (c) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate font-medium text-foreground">{c.name}</span>{c.shortcut && <code className="text-xs text-muted-foreground">{c.shortcut}</code>}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.body}</div>
                </div>
            ),
        },
        { key: "scope", header: "Shared with", cell: (c) => <Badge variant={c.scope === "PERSONAL" ? "neutral" : "info"}>{c.scope === "TEAM" && c.team ? c.team.name : getDropdownOptionLabel(CannedScopeOptions, c.scope)}</Badge>, hideBelow: "sm" },
        { key: "category", header: "Category", cell: (c) => c.category ?? <span className="text-ash">—</span>, hideBelow: "md" },
        { key: "used", header: "Used", cell: (c) => <span className="tabular">{c.usage_count}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (c) =>
                canEdit(c) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(c); setOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(c)}><Trash2 /> Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Saved replies"
                description="Reusable answers with placeholders like {{customer.first_name}} and {{ticket.reference}}."
                actions={canReply && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New reply</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search saved replies…">
                <Select value={filters.scope ?? "all"} onValueChange={(v) => setFilter("scope", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Scope"><SelectValue /></SelectTrigger>
                    <SelectContent>{CannedScopeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(c) => c.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                onRowClick={(c) => { if (canEdit(c)) { setEditing(c); setOpen(true); } }}
                empty={{ icon: MessageSquareText, title: search ? "No saved replies match" : "No saved replies yet", description: "Save answers you send often and insert them from the composer." }}
            />
            <CannedDialog open={open} onOpenChange={setOpen} canned={editing} canShare={canManageShared} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Remove "${deleting?.name}"?`}
                description="It disappears from the composer for everyone it was shared with."
                confirmText="Remove"
                variant="destructive"
                onConfirm={() => { if (!deleting) return; remove.mutate(deleting.id); setDeleting(null); }}
            />
        </Page>
    );
}

const toCannedDto = (v: CannedFormValues) => ({ name: v.name, shortcut: v.shortcut || undefined, category: v.category || undefined, body: v.body, scope: v.scope });

/** New reply: explicit Create. Existing reply: valid changes are saved as you edit (no Save button). */
function CannedDialog({ open, onOpenChange, canned, canShare }: { open: boolean; onOpenChange: (o: boolean) => void; canned: CannedResponse | null; canShare: boolean }) {
    const create = useCreateCannedResponse();
    const update = useUpdateCannedResponse();
    const form = useForm<CannedFormValues>({ resolver: zodResolver(cannedFormSchema), defaultValues: { name: "", shortcut: "", category: "", body: "", scope: "PERSONAL" } });

    useEffect(() => {
        if (open) form.reset({ name: canned?.name ?? "", shortcut: canned?.shortcut ?? "", category: canned?.category ?? "", body: canned?.body ?? "", scope: canned?.scope === "TEAM" ? "ORGANIZATION" : canned?.scope ?? (canShare ? "ORGANIZATION" : "PERSONAL") });
        // Only when the dialog opens or switches reply: a background refresh after an autosave must not reset typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, canned?.id, canShare, form]);

    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (canned as CannedResponse).id, ...toCannedDto(v) }), { enabled: open && !!canned });
    const close = () => { autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit((v) => {
        if (canned) return close();
        create.mutate(toCannedDto(v), { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !create.isPending && close())}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">{canned ? "Edit saved reply" : "New saved reply"}{canned && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>Insert it from the reply composer or type its shortcut.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="shortcut" render={({ field }) => (<FormItem><FormLabel>Shortcut</FormLabel><FormControl><Input placeholder="/refund" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="Billing" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="scope" render={({ field }) => (
                                <FormItem><FormLabel>Shared with</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Shared with"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CannedScopeOptions.filter((o) => o.id !== "TEAM" && (canShare || o.id === "PERSONAL")).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                    {!canShare && <FormDescription>Sharing with everyone needs the saved replies permission.</FormDescription>}</FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="body" render={({ field }) => (<FormItem><FormLabel>Reply</FormLabel><FormControl><Textarea rows={7} placeholder="Hi {{customer.first_name}}, …" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            {canned ? (
                                <Button type="button" onClick={close}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
