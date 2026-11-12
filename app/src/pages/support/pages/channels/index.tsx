import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Inbox as InboxIcon, Pencil, Plug, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { RoutingStrategyOptions, SupportChannelTypeDescriptionOptions, SupportChannelTypeOptions } from "@/config/constants/dropdowns/support/support.options";
import { useArchiveInbox, useChannels, useCreateChannel, useCreateInbox, useInboxes, useUpdateChannel, useUpdateInbox } from "@/features/support/hooks/use-support";
import { channelFormSchema, inboxFormSchema, type ChannelFormValues, type InboxFormValues } from "@/features/support/validation-schemas/support.schema";
import type { Inbox } from "@/features/support/interfaces/support.interfaces";
import { useSearchParams } from "react-router-dom";
import { WidgetSetup } from "./components/widget-setup";
import { EmailSetup } from "./components/email-setup";

/**
 * Inboxes and channels — /support/channels?tab=inboxes|channels (mockup 13-support `channels`, `channel-create`, `widget`).
 * @perm VIEW support.inboxes.read · create/edit/archive support.inboxes.manage
 */
export default function ChannelsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "inboxes";
    return (
        <Page width="wide">
            <PageHeader title="Inboxes & channels" description="Shared inboxes route conversations to teams; channels are where customers reach you." />
            <Tabs value={tab} onValueChange={(v) => setSp({ tab: v }, { replace: true })}>
                <TabsList>
                    <TabsTrigger value="inboxes">Inboxes</TabsTrigger>
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                </TabsList>
                <TabsContent value="inboxes" className="mt-4"><InboxesTab /></TabsContent>
                <TabsContent value="channels" className="mt-4"><ChannelsTab /></TabsContent>
            </Tabs>
        </Page>
    );
}

function InboxesTab() {
    const inboxes = useInboxes();
    const archive = useArchiveInbox();
    const canManage = usePermission("support.inboxes.manage");
    const [editing, setEditing] = useState<Inbox | null>(null);
    const [open, setOpen] = useState(false);
    const [archiving, setArchiving] = useState<Inbox | null>(null);
    if (inboxes.isLoading) return <ListSkeleton />;
    if (inboxes.error) return <ErrorState error={inboxes.error} onRetry={() => inboxes.refetch()} />;
    return (
        <>
            <div className="mb-3 flex justify-end">
                <Can permission="support.inboxes.manage"><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New inbox</Button></Can>
            </div>
            {!inboxes.data?.length ? (
                <EmptyState icon={InboxIcon} title="No inboxes" description="Create an inbox for each team that answers customers." />
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {inboxes.data.map((i) => (
                        <div key={i.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-foreground">{i.name}</span>{i.is_default && <Badge variant="info">Default</Badge>}</div>
                                    {i.description && <p className="text-[13px] text-muted-foreground">{i.description}</p>}
                                </div>
                                {canManage && (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${i.name}`} onClick={() => { setEditing(i); setOpen(true); }}><Pencil /></Button>
                                        {!i.is_default && <Button variant="ghost" size="icon-sm" aria-label={`Archive ${i.name}`} onClick={() => setArchiving(i)}><Archive /></Button>}
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                                <Badge variant="neutral">{getDropdownOptionLabel(RoutingStrategyOptions, i.routing_strategy)}</Badge>
                                {i.team && <Badge variant="neutral">{i.team.name}</Badge>}
                                <Badge variant="outline" className="tabular">{i._count?.conversations ?? 0} open conversations</Badge>
                                <Badge variant="outline" className="tabular">{i._count?.tickets ?? 0} open tickets</Badge>
                            </div>
                            {i.channels.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Channels: {i.channels.map((c) => c.name).join(", ")}</p>}
                        </div>
                    ))}
                </div>
            )}
            <InboxDialog open={open} onOpenChange={setOpen} inbox={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Its channels stop receiving conversations. Existing conversations stay."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Inbox archived" }); setArchiving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })}
            />
        </>
    );
}

function InboxDialog({ open, onOpenChange, inbox }: { open: boolean; onOpenChange: (o: boolean) => void; inbox: Inbox | null }) {
    const create = useCreateInbox();
    const update = useUpdateInbox();
    const pending = create.isPending || update.isPending;
    const form = useForm<InboxFormValues>({ resolver: zodResolver(inboxFormSchema), defaultValues: { name: "", description: "", routing_strategy: "MANUAL", signature: "", auto_reply_body: "" } });
    useEffect(() => {
        if (open) form.reset({ name: inbox?.name ?? "", description: inbox?.description ?? "", routing_strategy: inbox?.routing_strategy ?? "MANUAL", signature: inbox?.signature ?? "", auto_reply_body: inbox?.auto_reply_body ?? "" });
    }, [open, inbox, form]);
    const submit = form.handleSubmit((v) => {
        const dto = { name: v.name, description: v.description || undefined, routing_strategy: v.routing_strategy, signature: v.signature || null, auto_reply_body: v.auto_reply_body || null };
        const opts = { onSuccess: () => { toast({ title: inbox ? "Inbox saved" : "Inbox created" }); onOpenChange(false); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save inbox", description: getApiErrorMessage(e) }) };
        if (inbox) update.mutate({ id: inbox.id, ...dto }, opts);
        else create.mutate(dto, opts);
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{inbox ? "Edit inbox" : "New inbox"}</DialogTitle><DialogDescription>Conversations and tickets are routed into inboxes.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="routing_strategy" render={({ field }) => (
                            <FormItem><FormLabel>Assignment</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Assignment"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{RoutingStrategyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name="auto_reply_body" render={({ field }) => (<FormItem><FormLabel>Automatic reply</FormLabel><FormControl><Textarea rows={3} placeholder="Thanks for reaching out — we usually reply within a few hours." {...field} /></FormControl><FormDescription>Sent on the first customer message. Leave empty for none.</FormDescription></FormItem>)} />
                        <FormField control={form.control} name="signature" render={({ field }) => (<FormItem><FormLabel>Signature</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{inbox ? "Save" : "Create inbox"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ChannelsTab() {
    const channels = useChannels();
    const update = useUpdateChannel();
    const canManage = usePermission("support.inboxes.manage");
    const [open, setOpen] = useState(false);
    if (channels.isLoading) return <ListSkeleton />;
    if (channels.error) return <ErrorState error={channels.error} onRetry={() => channels.refetch()} />;
    return (
        <>
            <div className="mb-3 flex justify-end">
                <Can permission="support.inboxes.manage"><Button onClick={() => setOpen(true)}><Plug /> Connect channel</Button></Can>
            </div>
            {!channels.data?.length ? (
                <EmptyState icon={Plug} title="No channels connected" description="Client portal requests always arrive in your default inbox. Connect email or a website widget to receive more." />
            ) : (
                <div className="space-y-3">
                    {channels.data.map((c) => (
                        <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex flex-wrap items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-foreground">{c.name}</span>
                                        <Badge variant="neutral">{getDropdownOptionLabel(SupportChannelTypeOptions, c.type)}</Badge>
                                        {c.verified_at ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Not verified</Badge>}
                                        {!c.is_active && <Badge variant="neutral">Inactive</Badge>}
                                    </div>
                                    <p className="text-[13px] text-muted-foreground">{c.email_address ?? SupportChannelTypeDescriptionOptions[c.type]} · {c.inbox.name}</p>
                                </div>
                                {canManage && (
                                    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                        Active
                                        <Switch checked={c.is_active} onCheckedChange={(v) => update.mutate({ id: c.id, is_active: v }, { onError: (e) => toast({ variant: "destructive", title: "Could not update channel", description: getApiErrorMessage(e) }) })} aria-label={`${c.name} active`} />
                                    </label>
                                )}
                            </div>
                            {c.widget_key && <WidgetSetup channel={c} canManage={canManage} />}
                            {c.type === "EMAIL" && <EmailSetup channel={c} canManage={canManage} />}
                        </div>
                    ))}
                </div>
            )}
            <ChannelDialog open={open} onOpenChange={setOpen} />
        </>
    );
}

function ChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const inboxes = useInboxes(open);
    const create = useCreateChannel();
    const form = useForm<ChannelFormValues>({ resolver: zodResolver(channelFormSchema), defaultValues: { inbox_id: "", type: "EMAIL", name: "", email_address: "", allowed_origins: "" } });
    const type = form.watch("type");
    useEffect(() => {
        if (open) form.reset({ inbox_id: inboxes.data?.find((i) => i.is_default)?.id ?? "", type: "EMAIL", name: "", email_address: "", allowed_origins: "" });
    }, [open, inboxes.data, form]);
    const submit = form.handleSubmit((v) =>
        create.mutate(
            { inbox_id: v.inbox_id, type: v.type, name: v.name, email_address: v.email_address || undefined, allowed_origins: (v.allowed_origins ?? "").split(/[\s,]+/).filter(Boolean) },
            { onSuccess: () => { toast({ title: "Channel connected" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not connect channel", description: getApiErrorMessage(e) }) },
        ),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>Connect a channel</DialogTitle><DialogDescription>{SupportChannelTypeDescriptionOptions[type]}</DialogDescription></DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem><FormLabel>Type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{SupportChannelTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="inbox_id" render={({ field }) => (
                                <FormItem><FormLabel>Inbox</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Inbox"><SelectValue placeholder="Pick an inbox" /></SelectTrigger></FormControl>
                                        <SelectContent>{inboxes.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Support email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {type === "EMAIL" && <FormField control={form.control} name="email_address" render={({ field }) => (<FormItem><FormLabel>Inbound address</FormLabel><FormControl><Input type="email" placeholder="support@youragency.com" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                        {(type === "WIDGET" || type === "LIVE_CHAT" || type === "API") && <FormField control={form.control} name="allowed_origins" render={({ field }) => (<FormItem><FormLabel>Allowed sites</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormDescription>https origins, separated by commas.</FormDescription></FormItem>)} />}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Connect</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
