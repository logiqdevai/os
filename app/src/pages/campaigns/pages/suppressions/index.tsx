import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, ShieldCheck, Undo2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useAddSuppression, useConsents, useRemoveSuppression, useSuppressions } from "@/features/communications/hooks/use-communications";
import type { Consent, Suppression } from "@/features/communications/interfaces/communications.interfaces";
import { suppressionFormSchema, type SuppressionFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommConsentStatusFilterOptions, CommConsentStatusFormOptions, CommSuppressionReasonFilterOptions, CommSuppressionReasonFormOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import { CommChannelFilterOptions, CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { ChannelBadge } from "../../components/comm-badges";
import { TopicsTab } from "./components/topics-tab";
import { ContactTopicsSheet } from "./components/contact-topics-sheet";

function AddSuppressionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const add = useAddSuppression();
    const form = useForm<SuppressionFormValues>({ resolver: zodResolver(suppressionFormSchema), defaultValues: { channel: "EMAIL", address: "", reason: "MANUAL", notes: "", blocks_transactional: false } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) =>
        add.mutate({ ...v, notes: v.notes || undefined }, {
            onSuccess: () => { toast({ title: "Address suppressed" }); onOpenChange(false); },
            onError: (e) => toast({ variant: "destructive", title: "Could not suppress", description: getApiErrorMessage(e) }),
        }),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !add.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Suppress an address</DialogTitle>
                            <DialogDescription>Campaigns and marketing messages will never be sent to it.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CommChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem><FormLabel>Address</FormLabel><FormControl><Input autoFocus placeholder="someone@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="reason" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Reason"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{CommSuppressionReasonFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="blocks_transactional" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-3">
                                <div className="space-y-0.5"><FormLabel>Block every message</FormLabel><FormDescription>Also stop invoices, contract and other service messages.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Block every message" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={add.isPending}>Cancel</Button>
                            <Button type="submit" loading={add.isPending}>Suppress</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function SuppressionsTab() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...rest } = params as Record<string, string | number>;
    const list = useSuppressions(rest);
    const remove = useRemoveSuppression();
    const [addOpen, setAddOpen] = useState(false);
    const [removing, setRemoving] = useState<Suppression | null>(null);
    const showRemoved = filters.removed === "true";

    const columns: DataTableColumn<Suppression>[] = [
        {
            key: "address",
            header: "Address",
            cell: (s) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{s.address}</div>
                    {s.contact && <div className="truncate text-xs text-muted-foreground">{[s.contact.first_name, s.contact.last_name].filter(Boolean).join(" ")}</div>}
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (s) => <ChannelBadge channel={s.channel} />, hideBelow: "sm" },
        { key: "reason", header: "Reason", cell: (s) => <Badge variant={["HARD_BOUNCE", "COMPLAINT"].includes(s.reason) ? "danger" : "neutral"}>{getDropdownOptionLabel(CommSuppressionReasonFormOptions, s.reason)}</Badge> },
        { key: "scope", header: "Blocks", cell: (s) => <span className="text-muted-foreground">{s.blocks_transactional ? "All messages" : "Marketing"}</span>, hideBelow: "lg" },
        { key: "source", header: "Source", cell: (s) => <span className="text-muted-foreground">{s.campaign?.name ?? s.notes ?? "—"}</span>, hideBelow: "xl" },
        { key: "date", header: showRemoved ? "Removed" : "Since", cell: (s) => <span className="text-muted-foreground">{formatDate(s.removed_at ?? s.created_at)}{s.expires_at && !s.removed_at ? ` · until ${formatDate(s.expires_at)}` : ""}</span>, hideBelow: "md" },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: (s) => !s.removed_at && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.address}`} onClick={() => setRemoving(s)}><Undo2 /></Button> },
    ];

    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search addresses…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.reason ?? "all"} onValueChange={(v) => setFilter("reason", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by reason"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommSuppressionReasonFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={showRemoved ? "true" : "all"} onValueChange={(v) => setFilter("removed", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Active or removed"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Active</SelectItem><SelectItem value="true">Removed</SelectItem></SelectContent>
                </Select>
                <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> Add</Button>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(s) => s.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: Ban, title: showRemoved ? "Nothing removed" : "No suppressed addresses", description: "Unsubscribes, hard bounces and spam complaints are added automatically." }}
            />
            <AddSuppressionDialog open={addOpen} onOpenChange={setAddOpen} />
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title={`Allow ${removing?.address} again?`}
                description={removing && ["COMPLAINT", "UNSUBSCRIBE"].includes(removing.reason) ? "This person unsubscribed or complained. Only remove the entry if they asked to be contacted again." : "Campaigns can be sent to this address again."}
                confirmText="Remove suppression"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => removing && remove.mutate({ id: removing.id }, { onSuccess: () => { toast({ title: "Suppression removed" }); setRemoving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(e) }) })}
            />
        </>
    );
}

function ConsentTab() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...rest } = params as Record<string, string | number>;
    const consents = useConsents(rest);
    const [contactId, setContactId] = useState<string | null>(null);
    const columns: DataTableColumn<Consent>[] = [
        {
            key: "contact",
            header: "Contact",
            cell: (c) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{[c.contact.first_name, c.contact.last_name].filter(Boolean).join(" ")}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.channel === "EMAIL" ? c.contact.email : c.contact.mobile}</div>
                </div>
            ),
        },
        { key: "channel", header: "Channel", cell: (c) => <ChannelBadge channel={c.channel} />, hideBelow: "sm" },
        { key: "status", header: "Consent", cell: (c) => <Badge variant={c.status === "OPTED_IN" ? "success" : c.status === "OPTED_OUT" ? "danger" : "neutral"}>{getDropdownOptionLabel(CommConsentStatusFormOptions, c.status)}</Badge> },
        { key: "company", header: "Company", cell: (c) => <span className="text-muted-foreground">{c.contact.company?.name ?? "—"}</span>, hideBelow: "lg" },
        { key: "updated", header: "Changed", cell: (c) => <span className="text-muted-foreground">{formatDateTime(c.updated_at)}</span>, hideBelow: "md" },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search contacts…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Filter by consent"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommConsentStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={consents.data?.data}
                rowKey={(c) => c.id}
                loading={consents.isFetching}
                error={consents.error}
                onRetry={() => consents.refetch()}
                pagination={consents.data?.pagination}
                onPageChange={setPage}
                onRowClick={(c) => setContactId(c.contact.id)}
                empty={{ icon: ShieldCheck, title: "No consent records", description: "Consent is recorded when contacts opt in through forms, imports or the CRM, and when they unsubscribe." }}
            />
            <ContactTopicsSheet contactId={contactId} onOpenChange={(o) => !o && setContactId(null)} />
        </>
    );
}

/**
 * /campaigns/suppressions?tab=suppressions|consent|topics
 * @perm suppressions tab communications.suppressions.manage (sensitive) · consent + topics tabs communications.consents.read
 * @api GET/POST /communications/suppressions · POST /suppressions/:id/remove · GET /communications/consents
 */
export default function SuppressionsPage() {
    const { can } = usePermissions();
    const canSuppress = can("communications.suppressions.manage");
    const canConsent = can("communications.consents.read");
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? (canSuppress ? "suppressions" : "consent");
    return (
        <Page>
            <PageHeader title="Suppressions & consent" description="Who must not be contacted, who agreed to marketing, and which topics they chose. Checked on every send." />
            <Tabs value={tab} onValueChange={(v) => setSp(new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList>
                    {canSuppress && <TabsTrigger value="suppressions">Suppression list</TabsTrigger>}
                    {canConsent && <TabsTrigger value="consent">Consent</TabsTrigger>}
                    {canConsent && <TabsTrigger value="topics">Topics</TabsTrigger>}
                </TabsList>
                {canSuppress && <TabsContent value="suppressions" className="pt-3">{tab === "suppressions" && <SuppressionsTab />}</TabsContent>}
                {canConsent && <TabsContent value="consent" className="pt-3">{tab === "consent" && <ConsentTab />}</TabsContent>}
                {canConsent && <TabsContent value="topics" className="pt-3">{tab === "topics" && <TopicsTab />}</TabsContent>}
            </Tabs>
        </Page>
    );
}
