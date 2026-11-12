import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Lock, Plus, Search, X } from "lucide-react";
import { Page, PageHeader, Section, KeyValueList } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState, ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    IncidentSeverityOptions, IncidentSeverityTone, IncidentStatusOptions, IncidentStatusTone, IncidentUpdateStatusOptions,
} from "@/config/constants/dropdowns/support/support.options";
import { useAttachIncidentTickets, useDetachIncidentTicket, useIncident, usePostIncidentUpdate, useTickets, useUpdateIncident } from "@/features/support/hooks/use-support";
import { incidentUpdateFormSchema, type IncidentUpdateFormValues } from "@/features/support/validation-schemas/support.schema";
import type { IncidentDetail, IncidentStatus } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge, TicketStatusBadge } from "../../components/support-badges";
import { SUPPORT_PATHS } from "../../support-paths";

/**
 * Incident — /support/incidents/:id (13 §3, §5; mockup 13-support `incident`).
 * Timeline of status updates (customer-visible ones appear in the client portal), affected tickets, status changes.
 * @perm VIEW support.tickets.read · update / tickets / internal updates support.tickets.update · customer-visible updates support.incidents.publish
 * @api GET/PATCH /support/incidents/:id · POST …/updates · POST/DELETE …/tickets
 */
export default function IncidentPage() {
    const { id } = useParams<{ id: string }>();
    const incident = useIncident(id);
    usePageMetadata({ title: incident.data?.title ?? "Incident" });
    const canUpdate = usePermission("support.tickets.update");
    const update = useUpdateIncident();
    const detach = useDetachIncidentTicket();
    const [attachOpen, setAttachOpen] = useState(false);

    if (incident.isLoading) return <PageSkeleton />;
    if (incident.error) {
        const status = getApiErrorStatus(incident.error);
        if (status === 403) return <NoAccessState />;
        if (status === 404) return <Page><EmptyState title="Incident not found" description="It may have been removed or is outside your scope." action={<Button asChild size="sm" variant="outline"><Link to={SUPPORT_PATHS.incidents}>All incidents</Link></Button>} /></Page>;
        return <Page><ErrorState error={incident.error} onRetry={() => incident.refetch()} /></Page>;
    }
    const inc = incident.data as IncidentDetail;
    const setStatus = (status: IncidentStatus) =>
        update.mutate({ id: inc.id, status }, { onSuccess: () => toast({ title: `Incident ${getDropdownOptionLabel(IncidentStatusOptions, status).toLowerCase()}` }), onError: (e) => toast({ variant: "destructive", title: "Could not update incident", description: getApiErrorMessage(e) }) });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: SUPPORT_PATHS.incidents, label: "Incidents" }}
                title={inc.title}
                meta={
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={IncidentStatusTone[inc.status]}>{getDropdownOptionLabel(IncidentStatusOptions, inc.status)}</Badge>
                        <Badge variant={IncidentSeverityTone[inc.severity]}>{getDropdownOptionLabel(IncidentSeverityOptions, inc.severity)}</Badge>
                        {inc.detected_by_ai && <Badge variant="violet">Detected by AI</Badge>}
                    </div>
                }
                actions={
                    canUpdate ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" loading={update.isPending}>Change status</Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {IncidentStatusOptions.filter((o) => o.id !== inc.status).map((o) => <DropdownMenuItem key={o.id} onSelect={() => setStatus(o.id)}>{o.label}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : undefined
                }
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                    {inc.description && <p className="whitespace-pre-wrap text-[14px] text-foreground">{inc.description}</p>}
                    {canUpdate && inc.status !== "DISMISSED" && <UpdateComposer incidentId={inc.id} />}
                    <Section title="Timeline">
                        {!inc.updates.length ? (
                            <EmptyState compact title="No updates yet" description="Post the first update so your team and customers know what is happening." />
                        ) : (
                            <ol className="space-y-4 border-l border-border pl-4">
                                {inc.updates.map((u) => (
                                    <li key={u.id} className="relative">
                                        <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="neutral">{getDropdownOptionLabel(IncidentUpdateStatusOptions, u.status)}</Badge>
                                            {u.customer_visible ? <span className="inline-flex items-center gap-1 text-info"><Eye className="size-3" /> Shown to customers</span> : <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Internal</span>}
                                            <span>{formatDateTime(u.created_at)}</span>
                                            {u.author && <span>· {personName(u.author.user)}</span>}
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground">{u.body}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Section>
                </div>
                <div className="space-y-6">
                    <Section title="Details">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "Owner", value: inc.owner ? <span className="inline-flex items-center gap-1.5"><MemberAvatar person={inc.owner.user} size="sm" />{personName(inc.owner.user)}</span> : "—" },
                                { label: "Started", value: formatDateTime(inc.first_reported_at ?? inc.created_at) },
                                { label: "Resolved", value: inc.resolved_at ? formatDateTime(inc.resolved_at) : "—" },
                                { label: "Affected services", value: inc.affected_services.length ? inc.affected_services.join(", ") : "—" },
                            ]}
                        />
                    </Section>
                    <Section
                        title={`Affected tickets (${inc.tickets.length})`}
                        actions={canUpdate ? <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}><Plus /> Add</Button> : undefined}
                    >
                        {!inc.tickets.length ? (
                            <p className="text-[13px] text-muted-foreground">No tickets linked yet.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {inc.tickets.map((t) => (
                                    <li key={t.id} className="flex items-start gap-2 p-2.5">
                                        <div className="min-w-0 flex-1">
                                            <Link to={SUPPORT_PATHS.ticket(t.reference)} className="block truncate text-[13px] font-medium text-foreground hover:underline">{t.reference} · {t.subject}</Link>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                <TicketStatusBadge status={t.status ? { id: t.id, ...t.status } : null} />
                                                <PriorityBadge priority={t.priority} />
                                                {t.company && <span className="truncate">{t.company.name}</span>}
                                            </div>
                                        </div>
                                        {canUpdate && (
                                            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${t.reference}`} disabled={detach.isPending} onClick={() => detach.mutate({ id: inc.id, ticket_id: t.id }, { onSuccess: () => toast({ title: "Ticket removed from the incident" }), onError: (e) => toast({ variant: "destructive", title: "Could not remove ticket", description: getApiErrorMessage(e) }) })}>
                                                <X />
                                            </Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>
            </div>
            <AttachTicketsDialog incident={inc} open={attachOpen} onOpenChange={setAttachOpen} />
        </Page>
    );
}

function UpdateComposer({ incidentId }: { incidentId: string }) {
    const post = usePostIncidentUpdate();
    const canPublish = usePermission("support.incidents.publish");
    const form = useForm<IncidentUpdateFormValues>({ resolver: zodResolver(incidentUpdateFormSchema), defaultValues: { status: "INVESTIGATING", body: "", customer_visible: false } });
    const submit = form.handleSubmit((v) =>
        post.mutate(
            { id: incidentId, ...v, customer_visible: canPublish && v.customer_visible },
            { onSuccess: () => { toast({ title: v.customer_visible ? "Update published to customers" : "Update posted" }); form.reset({ status: v.status, body: "", customer_visible: v.customer_visible }); }, onError: (e) => toast({ variant: "destructive", title: "Could not post update", description: getApiErrorMessage(e) }) },
        ),
    );
    return (
        <Form {...form}>
            <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <FormField control={form.control} name="body" render={({ field }) => (<FormItem><FormLabel>Post an update</FormLabel><FormControl><Textarea rows={3} placeholder="We identified the cause and are rolling out a fix." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem className="sm:w-44"><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Update status"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{IncidentUpdateStatusOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="customer_visible" render={({ field }) => (
                        <FormItem className="flex flex-1 items-center gap-2 space-y-0">
                            <FormControl><Switch checked={canPublish && field.value} onCheckedChange={field.onChange} disabled={!canPublish} aria-label="Show to customers" /></FormControl>
                            <div><FormLabel className="font-normal">Show to customers</FormLabel>{!canPublish && <FormDescription className="text-xs">Needs support.incidents.publish</FormDescription>}</div>
                        </FormItem>
                    )} />
                    <Button type="submit" loading={post.isPending}>Post</Button>
                </div>
            </form>
        </Form>
    );
}

function AttachTicketsDialog({ incident, open, onOpenChange }: { incident: IncidentDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const [q, setQ] = useState("");
    const tickets = useTickets({ search: q || undefined, limit: 10, state: "everything" });
    const attach = useAttachIncidentTickets();
    const linked = new Set(incident.tickets.map((t) => t.id));
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Add affected tickets</DialogTitle><DialogDescription>Search by reference, subject or customer.</DialogDescription></DialogHeader>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SUP-1042 or “checkout”" className="pl-8" aria-label="Search tickets" autoFocus />
                </div>
                <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
                    {tickets.isLoading && [0, 1, 2].map((i) => <li key={i} className="p-2.5"><Skeleton className="h-9 w-full rounded-md" /></li>)}
                    {!tickets.isLoading && !tickets.data?.data.length && <li className="p-3 text-[13px] text-muted-foreground">No tickets found.</li>}
                    {tickets.data?.data.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 p-2.5">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium text-foreground">{t.reference} · {t.subject}</div>
                                <div className="text-xs text-muted-foreground">{formatRelative(t.created_at)}</div>
                            </div>
                            {linked.has(t.id) ? (
                                <Badge variant="success">Linked</Badge>
                            ) : (
                                <Button size="sm" variant="outline" disabled={attach.isPending} onClick={() => attach.mutate({ id: incident.id, ticket_ids: [t.id] }, { onSuccess: () => toast({ title: `${t.reference} linked` }), onError: (e) => toast({ variant: "destructive", title: "Could not link ticket", description: getApiErrorMessage(e) }) })}>
                                    Link
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
