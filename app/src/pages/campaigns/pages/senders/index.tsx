import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, CheckCircle2, Globe, MoreHorizontal, Plus, RefreshCw, Star, Trash2, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    useCommSettings, useCreateSenderDomain, useCreateSenderIdentity, useDeleteSenderDomain, useDeleteSenderIdentity, useProviderStatus, useSenderDomains,
    useSenderIdentities, useUpdateCommSettings, useUpdateSenderIdentity, useVerifySenderDomain, useVerifySenderIdentity,
} from "@/features/communications/hooks/use-communications";
import type { CommSettings, SenderDomain, SenderIdentity } from "@/features/communications/interfaces/communications.interfaces";
import { senderIdentityFormSchema, type SenderIdentityFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommSenderDomainStatusOptions, CommSenderIdentityStatusOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { ChannelBadge } from "../../components/comm-badges";

const statusVariant = (s: string) => (s === "VERIFIED" ? "success" : s === "FAILED" ? "danger" : "warning") as "success" | "danger" | "warning";

function DomainCard({ domain }: { domain: SenderDomain }) {
    const verify = useVerifySenderDomain();
    const del = useDeleteSenderDomain();
    const [deleting, setDeleting] = useState(false);
    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
                <Globe className="size-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{domain.domain}</span>
                <Badge variant={statusVariant(domain.status)}>{getDropdownOptionLabel(CommSenderDomainStatusOptions, domain.status)}</Badge>
                <span className="flex-1 text-xs text-muted-foreground">{domain.last_checked_at ? `Checked ${formatRelative(domain.last_checked_at)}` : ""}</span>
                <Button variant="outline" size="sm" loading={verify.isPending} onClick={() => verify.mutate(domain.id, { onSuccess: (d) => toast({ title: d.status === "VERIFIED" ? "Domain verified" : "Not verified yet", description: d.failure_reason ?? undefined }), onError: (e) => toast({ variant: "destructive", title: "Could not check", description: getApiErrorMessage(e) }) })}>
                    <RefreshCw /> Check DNS
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${domain.domain}`} onClick={() => setDeleting(true)}><Trash2 /></Button>
            </div>
            {domain.failure_reason && <p className="flex items-start gap-1.5 px-3 pt-2 text-xs text-warning"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{domain.failure_reason}</p>}
            <div className="overflow-x-auto p-3">
                <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="text-muted-foreground"><tr><th className="pb-1.5 font-medium">Type</th><th className="pb-1.5 font-medium">Name</th><th className="pb-1.5 font-medium">Value</th><th className="pb-1.5 font-medium">Status</th></tr></thead>
                    <tbody className="align-top">
                        {(domain.dns_records ?? []).map((r, i) => (
                            <tr key={i} className="border-t border-border-soft">
                                <td className="py-1.5 pr-3 text-foreground">{r.record ? `${r.record} · ` : ""}{r.type}</td>
                                <td className="py-1.5 pr-3 font-mono text-foreground">{r.name}</td>
                                <td className="max-w-[280px] break-all py-1.5 pr-3 font-mono text-muted-foreground">{r.value}</td>
                                <td className="py-1.5 text-muted-foreground">{r.status ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ConfirmationDialog
                isOpen={deleting}
                onClose={() => setDeleting(false)}
                title={`Remove ${domain.domain}?`}
                description="Senders on this domain stop being verified for new sends."
                confirmText="Remove"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => del.mutate(domain.id, { onSuccess: () => { toast({ title: "Domain removed" }); setDeleting(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(e) }) })}
            />
        </div>
    );
}

function DomainsTab() {
    const domains = useSenderDomains();
    const create = useCreateSenderDomain();
    const [domain, setDomain] = useState("");
    const add = () =>
        create.mutate({ domain: domain.trim() }, {
            onSuccess: (d) => { toast({ title: "Domain added", description: d.failure_reason ?? "Publish the DNS records, then check DNS." }); setDomain(""); },
            onError: (e) => toast({ variant: "destructive", title: "Could not add the domain", description: getApiErrorMessage(e) }),
        });
    return (
        <div className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (domain.trim()) add(); }}>
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mail.youragency.com" className="sm:max-w-xs" aria-label="Domain" />
                <Button type="submit" loading={create.isPending} disabled={!domain.trim()}><Plus /> Add domain</Button>
            </form>
            {domains.isPending ? <Skeleton className="h-40 w-full" /> : domains.error ? <ErrorState error={domains.error} onRetry={() => domains.refetch()} /> : domains.data.length === 0 ? (
                <EmptyState icon={Globe} title="No sending domains" description="Verify the domain you send from (SPF and DKIM) so email lands in the inbox." />
            ) : (
                domains.data.map((d) => <DomainCard key={d.id} domain={d} />)
            )}
        </div>
    );
}

function IdentityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateSenderIdentity();
    const form = useForm<SenderIdentityFormValues>({ resolver: zodResolver(senderIdentityFormSchema), defaultValues: { channel: "EMAIL", address: "", display_name: "", reply_to_address: "", is_default: false } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const channel = form.watch("channel");
    const submit = form.handleSubmit((v) =>
        create.mutate({ channel: v.channel, address: v.address, display_name: v.display_name || undefined, reply_to_address: v.reply_to_address || undefined, is_default: v.is_default }, {
            onSuccess: (s) => { toast({ title: "Sender added", description: s.failure_reason ?? undefined }); onOpenChange(false); },
            onError: (e) => toast({ variant: "destructive", title: "Could not add the sender", description: getApiErrorMessage(e) }),
        }),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Add sender</DialogTitle>
                            <DialogDescription>Email senders are verified through their domain. SMS senders use your Twilio number or an alphanumeric id.</DialogDescription>
                        </DialogHeader>
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
                            <FormItem><FormLabel>{channel === "EMAIL" ? "Email address" : "Number or sender id"}</FormLabel><FormControl><Input placeholder={channel === "EMAIL" ? "hello@youragency.com" : "+306912345678 or AGENCY"} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        {channel === "EMAIL" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="display_name" render={({ field }) => (
                                    <FormItem><FormLabel>Display name</FormLabel><FormControl><Input placeholder="Agency team" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="reply_to_address" render={({ field }) => (
                                    <FormItem><FormLabel>Reply-to</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}
                        <FormField control={form.control} name="is_default" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5"><FormLabel>Default sender</FormLabel><FormDescription>Used when a message does not pick one.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Default sender" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Add sender</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function IdentitiesTab() {
    const identities = useSenderIdentities();
    const update = useUpdateSenderIdentity();
    const verify = useVerifySenderIdentity();
    const del = useDeleteSenderIdentity();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState<SenderIdentity | null>(null);
    const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not update the sender", description: getApiErrorMessage(e) });
    return (
        <div className="space-y-3">
            <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus /> Add sender</Button></div>
            {identities.isPending ? <Skeleton className="h-32 w-full" /> : identities.error ? <ErrorState error={identities.error} onRetry={() => identities.refetch()} /> : identities.data.length === 0 ? (
                <EmptyState icon={AtSign} title="No senders yet" description="Add the addresses and numbers your campaigns are sent from." />
            ) : (
                <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {identities.data.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                                    <span className="truncate">{s.display_name ? `${s.display_name} <${s.address}>` : s.address}</span>
                                    {s.is_default && <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Default" />}
                                </div>
                                {s.failure_reason && <div className="text-xs text-muted-foreground">{s.failure_reason}</div>}
                            </div>
                            <ChannelBadge channel={s.channel} />
                            <Badge variant={statusVariant(s.status)}>{getDropdownOptionLabel(CommSenderIdentityStatusOptions, s.status)}</Badge>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.address}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => verify.mutate(s.id, { onSuccess: (r) => toast({ title: r.status === "VERIFIED" ? "Sender verified" : "Not verified yet", description: r.failure_reason ?? undefined }), onError })}><CheckCircle2 /> Re-check</DropdownMenuItem>
                                    {!s.is_default && <DropdownMenuItem onSelect={() => update.mutate({ id: s.id, is_default: true }, { onSuccess: () => toast({ title: "Default sender changed" }), onError })}><Star /> Make default</DropdownMenuItem>}
                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(s)}><Trash2 /> Remove</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    ))}
                </ul>
            )}
            <IdentityDialog open={open} onOpenChange={setOpen} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Remove ${deleting?.address}?`}
                description="Campaigns using this sender will need another one."
                confirmText="Remove"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast({ title: "Sender removed" }); setDeleting(null); }, onError })}
            />
        </div>
    );
}

function PolicyTab() {
    const settings = useCommSettings();
    const update = useUpdateCommSettings();
    const providers = useProviderStatus();
    const [footer, setFooter] = useState("");
    const [min, setMin] = useState("");
    useEffect(() => {
        if (settings.data) {
            setFooter(settings.data.footer_address ?? "");
            setMin(settings.data.approval_min_recipients ? String(settings.data.approval_min_recipients) : "");
        }
    }, [settings.data]);
    if (settings.isPending) return <Skeleton className="h-48 w-full" />;
    if (settings.error) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
    const save = (dto: Partial<CommSettings>) => update.mutate(dto, { onSuccess: () => toast({ title: "Settings saved" }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) });
    const s = settings.data;
    return (
        <div className="max-w-2xl space-y-6">
            <Section title="Providers" description="Provider keys are managed in Admin → Integrations; they are never stored here.">
                <div className="grid gap-2 sm:grid-cols-2">
                    {(["email", "sms"] as const).map((k) => {
                        const p = providers.data?.[k];
                        return (
                            <div key={k} className="rounded-lg border border-border bg-card p-3 text-[13px]">
                                <div className="flex items-center gap-2 font-medium text-foreground">{k === "email" ? "Email" : "SMS"} {p?.connected ? <Badge variant="success">Connected</Badge> : <Badge variant="warning">Not connected</Badge>}</div>
                                <p className="mt-1 text-xs text-muted-foreground">{p?.connected ? p.name : p?.reason}</p>
                            </div>
                        );
                    })}
                </div>
            </Section>
            <Section title="Approval">
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="text-[13px] font-medium text-foreground">Campaigns need approval</div>
                            <p className="text-xs text-muted-foreground">Someone with approve permission reviews a campaign before it can be sent.</p>
                        </div>
                        <Switch checked={s.approval_required} onCheckedChange={(v) => save({ approval_required: v })} aria-label="Campaigns need approval" />
                    </div>
                    {s.approval_required && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <span className="text-[13px] text-foreground">Only from</span>
                            <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="w-full sm:w-28" placeholder="any size" aria-label="Minimum recipients" />
                            <span className="text-[13px] text-foreground">recipients</span>
                            <Button variant="outline" size="sm" onClick={() => save({ approval_min_recipients: min ? Number(min) : null })} loading={update.isPending}>Save</Button>
                        </div>
                    )}
                </div>
            </Section>
            <Section title="Email footer" description="Postal address shown in the unsubscribe footer of marketing email (required by anti-spam law in most countries).">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Agency Ltd, 10 Ermou St, Athens 10563, Greece" aria-label="Footer address" />
                    <Button variant="outline" onClick={() => save({ footer_address: footer || null })} loading={update.isPending}>Save</Button>
                </div>
            </Section>
        </div>
    );
}

/**
 * /campaigns/senders?tab=domains|identities|policy
 * @perm domains & senders communications.sender_identities.manage (sensitive) · policy communications.settings.manage (sensitive)
 * @api GET/POST /communications/sender-domains · POST /:id/verify · GET/POST/PATCH /communications/sender-identities · GET/PATCH /communications/settings
 */
export default function SendersPage() {
    const { can } = usePermissions();
    const canSenders = can("communications.sender_identities.manage");
    const canSettings = can("communications.settings.manage");
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? (canSenders ? "identities" : "policy");
    return (
        <Page>
            <PageHeader title="Senders & settings" description="Where your email and SMS come from, and the rules every campaign follows." />
            <Tabs value={tab} onValueChange={(v) => setSp(new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList>
                    {canSenders && <TabsTrigger value="identities">Senders</TabsTrigger>}
                    {canSenders && <TabsTrigger value="domains">Domains</TabsTrigger>}
                    {canSettings && <TabsTrigger value="policy">Policy</TabsTrigger>}
                </TabsList>
                {canSenders && <TabsContent value="identities" className="pt-3">{tab === "identities" && <IdentitiesTab />}</TabsContent>}
                {canSenders && <TabsContent value="domains" className="pt-3">{tab === "domains" && <DomainsTab />}</TabsContent>}
                {canSettings && <TabsContent value="policy" className="pt-3">{tab === "policy" && <PolicyTab />}</TabsContent>}
            </Tabs>
        </Page>
    );
}
