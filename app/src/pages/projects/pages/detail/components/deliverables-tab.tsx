import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MoreHorizontal, Package, Pencil, Plus, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useCreateProjectChild, useDeleteProjectChild, useProjectChildAction, useProjectChildren, useUpdateProjectChild } from "@/features/projects/hooks/use-projects";
import { deliverableFormSchema, type DeliverableFormValues } from "@/features/projects/validation-schemas/projects.schema";
import type { Deliverable, Milestone } from "@/features/projects/interfaces/projects.interfaces";
import { DeliverableEditableStatusOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { formatDate } from "@/lib/format";
import { DeliverableStatusBadge } from "../../../components/project-badges";
import { PersonPicker } from "../../../components/project-pickers";

const NONE = "__none";
type Review = { item: Deliverable; decision: "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED" } | null;

/**
 * Deliverables with customer approval flags (portal approves customer-visible ones, 07 §7).
 * @perm manage projects.deliverables.manage · accept on behalf projects.deliverables.accept_on_behalf
 */
export function DeliverablesTab({ projectId }: { projectId: string }) {
    const items = useProjectChildren<Deliverable>(projectId, "deliverables");
    const milestones = useProjectChildren<Milestone>(projectId, "milestones");
    const p = usePermissions();
    const canManage = p.can("projects.deliverables.manage");
    const submit = useProjectChildAction("Could not submit for review");
    const review = useProjectChildAction("Could not record the decision");
    const remove = useDeleteProjectChild("Deliverable");
    const [editing, setEditing] = useState<Deliverable | null>(null);
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<Deliverable | null>(null);
    const [reviewing, setReviewing] = useState<Review>(null);
    const [comment, setComment] = useState("");

    const columns: DataTableColumn<Deliverable>[] = [
        {
            key: "name",
            header: "Deliverable",
            cell: (d) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{d.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                        {d.customer_visible && <Badge variant="info">Customer approval</Badge>}
                        {d.milestone && <span className="truncate">{d.milestone.name}</span>}
                    </div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (d) => <DeliverableStatusBadge status={d.status} /> },
        { key: "due", header: "Due", hideBelow: "sm", cell: (d) => formatDate(d.due_date) },
        { key: "owner", header: <span className="sr-only">Owner</span>, className: "w-10", cell: (d) => <MemberAvatar person={d.owner?.user} size="xs" emptyLabel="No owner" /> },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (d) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!["SUBMITTED", "ACCEPTED"].includes(d.status) && (
                            <DropdownMenuItem onSelect={() => submit.mutate({ id: projectId, kind: "deliverables", itemId: d.id, action: "submit", optimistic: { status: "SUBMITTED" } })}><Send /> Submit for review</DropdownMenuItem>
                        )}
                        {d.status === "SUBMITTED" && (
                            <>
                                {p.can("projects.deliverables.accept_on_behalf") && <DropdownMenuItem onSelect={() => { setComment(""); setReviewing({ item: d, decision: "ACCEPTED" }); }}><CheckCircle2 /> Record acceptance</DropdownMenuItem>}
                                <DropdownMenuItem onSelect={() => { setComment(""); setReviewing({ item: d, decision: "CHANGES_REQUESTED" }); }}><Undo2 /> Changes requested</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setComment(""); setReviewing({ item: d, decision: "REJECTED" }); }}><XCircle /> Rejected</DropdownMenuItem>
                            </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => { setEditing(d); setOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(d)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const reviewTitle = reviewing?.decision === "ACCEPTED" ? "Record customer acceptance" : reviewing?.decision === "REJECTED" ? "Mark as rejected" : "Changes requested";

    return (
        <Section
            title="Deliverables"
            description="What the customer receives. Customer-visible deliverables are approved in the portal."
            actions={canManage && <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add deliverable</Button>}
        >
            <DataTable
                columns={columns}
                data={items.data}
                rowKey={(d) => d.id}
                loading={items.isFetching}
                error={items.error}
                onRetry={() => items.refetch()}
                empty={{ icon: Package, title: "No deliverables yet", description: "List designs, builds and documents the customer signs off." }}
            />
            <DeliverableDialog open={open} onOpenChange={setOpen} projectId={projectId} item={editing} milestones={milestones.data ?? []} />
            <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{reviewTitle}</DialogTitle>
                        <DialogDescription>
                            {reviewing?.decision === "ACCEPTED" ? "Use this when the customer accepted outside the portal. Your name is kept as the recorder." : "The owner is notified with your comment."}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (reviewing) review.mutate({
                                    id: projectId, kind: "deliverables", itemId: reviewing.item.id, action: "review",
                                    dto: { decision: reviewing.decision, comment: comment || undefined }, optimistic: { status: reviewing.decision },
                                });
                                setReviewing(null);
                            }}
                        >
                            Save decision
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete "${deleting?.name}"?`}
                description="Its review history is deleted too."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) remove.mutate({ id: projectId, kind: "deliverables", itemId: deleting.id }); setDeleting(null); }}
            />
        </Section>
    );
}

function DeliverableDialog({ open, onOpenChange, projectId, item, milestones }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; item: Deliverable | null; milestones: Milestone[] }) {
    const create = useCreateProjectChild("Deliverable");
    const update = useUpdateProjectChild("Deliverable", { inline: true });
    const form = useForm<DeliverableFormValues>({ resolver: zodResolver(deliverableFormSchema) });
    useEffect(() => {
        if (open) form.reset({
            name: item?.name ?? "", description: item?.description ?? "", due_date: item?.due_date?.slice(0, 10) ?? "",
            status: (["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CANCELLED"].includes(item?.status ?? "") ? item?.status : "PLANNED") as DeliverableFormValues["status"],
            milestone_id: item?.milestone_id ?? NONE, owner_membership_id: item?.owner_membership_id ?? "", customer_visible: item?.customer_visible ?? false,
        });
    }, [open, item, form]);
    const pending = create.isPending;
    const toDto = (v: DeliverableFormValues) => {
        const keepStatus = item && !["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CANCELLED"].includes(item.status);
        return {
            name: v.name, description: v.description || undefined, due_date: v.due_date || undefined, ...(keepStatus ? {} : { status: v.status }),
            milestone_id: v.milestone_id && v.milestone_id !== NONE ? v.milestone_id : undefined, owner_membership_id: v.owner_membership_id || undefined, customer_visible: v.customer_visible,
        };
    };
    // Editing autosaves (no Save button; "Done" closes). Creating keeps the explicit "Add deliverable" button.
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: projectId, kind: "deliverables", itemId: item!.id, dto: toDto(v) }), { enabled: open && !!item });
    const close = () => {
        if (item) void form.trigger().then((ok) => ok && autosave.flush());
        onOpenChange(false);
    };
    const submit = form.handleSubmit((v) => {
        if (item) return close();
        create.mutate({ id: projectId, kind: "deliverables", dto: toDto(v) }, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !pending && close())}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{item ? "Edit deliverable" : "New deliverable"}</DialogTitle>
                            <DialogDescription>Files are attached in Documents; this tracks status and approval.</DialogDescription>
                            {item && <SaveStatus state={autosave} />}
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Homepage design" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="milestone_id" render={({ field }) => (
                                <FormItem><FormLabel>Milestone</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Milestone"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>No milestone</SelectItem>
                                            {milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="due_date" render={({ field }) => (
                                <FormItem><FormLabel>Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{DeliverableEditableStatusOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="owner_membership_id" render={({ field }) => (
                                <FormItem><FormLabel>Owner</FormLabel><PersonPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} noneLabel="No owner" selected={item?.owner} /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><RichTextEditor value={field.value} onChange={field.onChange} rows={3} placeholder="What is delivered, in what format, and how it is reviewed…" aria-label="Description" /></FormItem>
                        )} />
                        <FormField control={form.control} name="customer_visible" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-border p-3">
                                <FormLabel className="font-normal">Customer reviews and approves this in the portal</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            {item ? (
                                <Button type="button" onClick={close}>Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>Add deliverable</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
