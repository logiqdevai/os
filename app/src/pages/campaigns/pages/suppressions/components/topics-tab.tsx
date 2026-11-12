import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCreateTopic, useDeleteTopic, useTopicAction, useTopics, useUpdateTopic } from "@/features/communications/hooks/use-topics";
import type { CommTopic } from "@/features/communications/interfaces/topics.interfaces";
import { topicFormSchema, type TopicFormValues } from "@/features/communications/validation-schemas/topics.schema";
import { CommTopicChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";

function TopicDialog({ topic, open, onOpenChange }: { topic: CommTopic | null; open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateTopic();
    const update = useUpdateTopic();
    const form = useForm<TopicFormValues>({ resolver: zodResolver(topicFormSchema), defaultValues: { name: "", description: "", channel: "ALL", default_opt_in: false } });
    useEffect(() => {
        if (open) form.reset({ name: topic?.name ?? "", description: topic?.description ?? "", channel: topic?.channel ?? "ALL", default_opt_in: topic?.default_opt_in ?? false });
        // Only when the dialog opens or switches topic: a refresh after an autosave must not reset typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, topic?.id, form]);
    const toDto = (v: TopicFormValues) => ({ name: v.name, description: v.description || null, channel: v.channel === "ALL" ? null : v.channel, default_opt_in: v.default_opt_in });
    // Editing an existing topic saves as you type (no Save button); a new topic keeps its Create button.
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (topic as CommTopic).id, ...toDto(v) }), { enabled: open && !!topic });
    const close = () => { autosave.flush(); onOpenChange(false); };
    const submit = form.handleSubmit((v) => {
        if (topic) return close();
        create.mutate(toDto(v), { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : !create.isPending && close())}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2">{topic ? "Edit topic" : "New topic"}{topic && <SaveStatus state={autosave} className="font-normal" />}</DialogTitle>
                            <DialogDescription>Recipients choose topics on the preference page linked in every marketing email.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Product news" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} placeholder="What people get, and how often" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="channel" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Channel</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{CommTopicChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="default_opt_in" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5"><FormLabel>Subscribed by default</FormLabel><FormDescription>Contacts who never chose receive this topic. Channel consent is still required.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Subscribed by default" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            {topic ? (
                                <Button type="submit">Done</Button>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                                    <Button type="submit" loading={create.isPending}>Create topic</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Topics tab of /campaigns/suppressions (preference center, 11 "Customer Communication").
 * @perm view communications.consents.read · create/edit/archive/delete communications.settings.manage
 * @api GET/POST /communications/topics · PATCH/DELETE /topics/:id · POST /topics/:id/archive|restore
 */
export function TopicsTab() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...rest } = params as Record<string, string | number>;
    const list = useTopics(rest);
    const action = useTopicAction();
    const remove = useDeleteTopic();
    const [editing, setEditing] = useState<CommTopic | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState<CommTopic | null>(null);
    const archived = filters.archived === "true";

    const open = (t: CommTopic | null) => { setEditing(t); setDialogOpen(true); };
    const doAction = (t: CommTopic, a: "archive" | "restore") =>
        action.mutate({ id: t.id, action: a });

    const columns: DataTableColumn<CommTopic>[] = [
        {
            key: "name",
            header: "Topic",
            cell: (t) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{t.name}</div>
                    {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (t) => <span className="text-muted-foreground">{getDropdownOptionLabel(CommTopicChannelFormOptions, t.channel ?? "ALL")}</span>, hideBelow: "md" },
        { key: "default", header: "Default", cell: (t) => <Badge variant={t.default_opt_in ? "success" : "neutral"}>{t.default_opt_in ? "Subscribed" : "Not subscribed"}</Badge>, hideBelow: "sm" },
        { key: "subs", header: "Subscribed", cell: (t) => <span className="tabular text-foreground">{t.subscribed_count ?? 0}</span> },
        { key: "unsubs", header: "Opted out", cell: (t) => <span className="tabular text-muted-foreground">{t.unsubscribed_count ?? 0}</span>, hideBelow: "lg" },
        { key: "campaigns", header: "Campaigns", cell: (t) => <span className="tabular text-muted-foreground">{t.campaign_count ?? 0}</span>, hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) => (
                <Can permission="communications.settings.manage">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => open(t)}><Pencil /> Edit</DropdownMenuItem>
                            {t.archived_at ? <DropdownMenuItem onSelect={() => doAction(t, "restore")}><ArchiveRestore /> Restore</DropdownMenuItem> : <DropdownMenuItem onSelect={() => doAction(t, "archive")}><Archive /> Archive</DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(t)}><Trash2 /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Can>
            ),
        },
    ];

    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search topics…">
                <Select value={archived ? "true" : "all"} onValueChange={(v) => setFilter("archived", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Active or archived"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Active</SelectItem><SelectItem value="true">Archived</SelectItem></SelectContent>
                </Select>
                <Can permission="communications.settings.manage"><Button size="sm" onClick={() => open(null)}><Plus /> New topic</Button></Can>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(t) => t.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Tags, title: archived ? "No archived topics" : "No topics yet", description: "Topics let recipients pick what they hear about (newsletter, product news, events) instead of unsubscribing from everything." }}
            />
            <TopicDialog topic={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete "${deleting?.name}"?`}
                description="Subscriptions to this topic are deleted too, and campaigns using it lose their topic. Archive it instead to keep the history."
                confirmText="Delete topic"
                variant="destructive"
                onConfirm={() => { if (!deleting) return; remove.mutate(deleting.id); setDeleting(null); }}
            />
        </>
    );
}
