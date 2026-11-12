import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Download, Gavel, MoreHorizontal, Play, Plus, Scale, ScanSearch, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { MultiPicker } from "@/components/ui/multi-picker";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { formatDate, formatDateTime, formatNumber, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    useCreateHold, useCreatePolicy, useDeletePolicy, useExportDownload, useExports, useHolds, usePolicies, useReleaseHold, useRequestExport, useRunPolicy, useUpdatePolicy,
} from "@/features/messaging/hooks/use-messaging-admin";
import type { ExportFormat, ExportJob, LegalHold, RetentionAction, RetentionPolicy, RetentionRunResult } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import type { ChannelKind } from "@/features/messaging/interfaces/messaging.interfaces";
import { ExportFormatOptions, RetentionActionOptions, RetentionChannelKindOptions, RetentionScopeOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";
import { useMessaging } from "../../components/messaging-context";
import { apiFileUrl } from "../../components/message-attachments";
import { AdminNav } from "./admin-nav";
import { useChannelOptions } from "./channel-options";


// ------------------------------------------------------------------------------------------- policies

type PolicyScopeUi = "ORGANIZATION" | "CHANNEL_KIND" | "CHANNEL";

function PolicyDialog({ policy, open, onOpenChange }: { policy: RetentionPolicy | null; open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreatePolicy();
    const update = useUpdatePolicy();
    const channels = useChannelOptions(true);
    const [name, setName] = useState("");
    const [scope, setScope] = useState<PolicyScopeUi>("ORGANIZATION");
    const [kind, setKind] = useState<ChannelKind>("PUBLIC");
    const [channelIds, setChannelIds] = useState<string[]>([]);
    const [action, setAction] = useState<RetentionAction>("DELETE");
    const [days, setDays] = useState("365");
    const [attachments, setAttachments] = useState(true);
    const [reactions, setReactions] = useState(true);
    useEffect(() => {
        if (!open) return;
        setName(policy?.name ?? "");
        setScope((policy && ["ORGANIZATION", "CHANNEL_KIND", "CHANNEL"].includes(policy.scope) ? policy.scope : "ORGANIZATION") as PolicyScopeUi);
        setKind(policy?.channel_kind ?? "PUBLIC");
        setChannelIds(policy?.channels.map((c) => c.id) ?? []);
        setAction(policy?.action ?? "DELETE");
        setDays(String(policy?.retention_days ?? 365));
        setAttachments(policy?.applies_to_attachments ?? true);
        setReactions(policy?.applies_to_reactions ?? true);
    }, [open, policy]);
    const pending = create.isPending || update.isPending;
    const valid = name.trim() && (action === "UNLIMITED" || Number(days) > 0) && (scope !== "CHANNEL" || channelIds.length > 0);
    const submit = () => {
        const dto = {
            name: name.trim(), scope, channel_kind: scope === "CHANNEL_KIND" ? kind : null, channel_ids: scope === "CHANNEL" ? channelIds : [], action,
            retention_days: action === "UNLIMITED" ? null : Number(days), applies_to_attachments: attachments, applies_to_reactions: reactions,
        };
        const done = { onSuccess: () => onOpenChange(false) };
        if (policy) update.mutate({ id: policy.id, ...dto }, done);
        else create.mutate(dto, done);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{policy ? "Edit retention policy" : "New retention policy"}</DialogTitle>
                    <DialogDescription>The most specific policy wins: channel, then kind of conversation, then the organization. Messages on legal hold are never removed.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="pol-name">Name</Label><Input id="pol-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Delete DMs after 1 year" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Applies to</Label>
                            <Select value={scope} onValueChange={(v) => setScope(v as PolicyScopeUi)}>
                                <SelectTrigger aria-label="Applies to"><SelectValue /></SelectTrigger>
                                <SelectContent>{RetentionScopeOptions.filter((o) => ["ORGANIZATION", "CHANNEL_KIND", "CHANNEL"].includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {scope === "CHANNEL_KIND" && (
                            <div className="space-y-1.5">
                                <Label>Kind</Label>
                                <Select value={kind} onValueChange={(v) => setKind(v as ChannelKind)}>
                                    <SelectTrigger aria-label="Kind of conversation"><SelectValue /></SelectTrigger>
                                    <SelectContent>{RetentionChannelKindOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {scope === "CHANNEL" && (
                        <div className="space-y-1.5"><Label>Channels</Label><MultiPicker items={channels.items} loading={channels.loading} value={channelIds} onChange={setChannelIds} placeholder="Add channels" ariaLabel="Channels" known={Object.fromEntries((policy?.channels ?? []).map((c) => [c.id, `#${c.name}`]))} /></div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>What happens</Label>
                            <Select value={action} onValueChange={(v) => setAction(v as RetentionAction)}>
                                <SelectTrigger aria-label="What happens"><SelectValue /></SelectTrigger>
                                <SelectContent>{RetentionActionOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {action !== "UNLIMITED" && (
                            <div className="space-y-1.5"><Label htmlFor="pol-days">After (days)</Label><Input id="pol-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 5))} /></div>
                        )}
                    </div>
                    {action === "DELETE" && (
                        <div className="space-y-2 rounded-md border border-border p-3">
                            <label className="flex items-center justify-between gap-3 text-[13px] text-foreground">Also remove file links<Switch checked={attachments} onCheckedChange={setAttachments} aria-label="Also remove file links" /></label>
                            <label className="flex items-center justify-between gap-3 text-[13px] text-foreground">Also remove reactions<Switch checked={reactions} onCheckedChange={setReactions} aria-label="Also remove reactions" /></label>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={submit} loading={pending} disabled={!valid}>{policy ? "Save" : "Create policy"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PoliciesTab() {
    const { can } = usePermissions();
    const canManage = can("messaging.retention.manage");
    const policies = usePolicies();
    const run = useRunPolicy();
    const remove = useDeletePolicy();
    const [editing, setEditing] = useState<RetentionPolicy | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [preview, setPreview] = useState<{ policy: RetentionPolicy; result: RetentionRunResult } | null>(null);
    const [deleting, setDeleting] = useState<RetentionPolicy | null>(null);
    const doPreview = (p: RetentionPolicy) => run.mutate({ id: p.id, dryRun: true }, { onSuccess: (result) => setPreview({ policy: p, result }) });
    const target = (p: RetentionPolicy) =>
        p.scope === "CHANNEL_KIND" ? getDropdownOptionLabel(RetentionChannelKindOptions, p.channel_kind ?? "") : p.scope === "CHANNEL" ? p.channels.map((c) => `#${c.name}`).join(", ") || "No channels" : p.scope === "BRANCH" ? p.branch?.name ?? "Branch" : p.scope === "TEAM" ? p.team?.name ?? "Team" : "Whole organization";
    const columns: DataTableColumn<RetentionPolicy>[] = [
        { key: "name", header: "Policy", cell: (p) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{p.name}</div><div className="truncate text-xs text-muted-foreground">{target(p)}</div></div> },
        { key: "rule", header: "Rule", cell: (p) => <Badge variant={p.action === "DELETE" ? "danger" : p.action === "ARCHIVE" ? "warning" : "neutral"}>{p.action === "UNLIMITED" ? "Keep forever" : `${getDropdownOptionLabel(RetentionActionOptions, p.action)} after ${p.retention_days} d`}</Badge> },
        { key: "last", header: "Last applied", cell: (p) => <span className="text-muted-foreground">{p.last_applied_at ? formatDateTime(p.last_applied_at) : "Never"}</span>, hideBelow: "md" },
        {
            key: "act", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (p) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(p); setDialogOpen(true); }}>Edit</DropdownMenuItem>
                        {p.action !== "UNLIMITED" && <DropdownMenuItem onSelect={() => doPreview(p)}><ScanSearch /> Preview (dry run)</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(p)}><Trash2 /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    const totals = preview?.result.policies[0];
    return (
        <>
            <TableToolbar>
                <p className="flex-1 text-[13px] text-muted-foreground">Applied every night at 02:00. Deleted message content cannot be recovered.</p>
                {canManage && <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus /> New policy</Button>}
            </TableToolbar>
            <DataTable columns={columns} data={policies.data?.data} rowKey={(p) => p.id} loading={policies.isFetching} error={policies.error} onRetry={() => policies.refetch()}
                empty={{ icon: Archive, title: "Messages are kept forever", description: "Add a policy to delete old messages or archive inactive channels." }} />
            <PolicyDialog policy={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
            <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{preview?.policy.name}</DialogTitle>
                        <DialogDescription>What would happen if the policy ran now.</DialogDescription>
                    </DialogHeader>
                    {totals ? (
                        <ul className="space-y-1 text-[13px] text-foreground">
                            {preview?.policy.action === "ARCHIVE" ? <li>{formatNumber(totals.channels_archived)} channel(s) archived</li> : <><li>{formatNumber(totals.messages)} message(s) deleted</li><li>{formatNumber(totals.attachments)} file link(s) removed</li></>}
                            {totals.held_skipped > 0 && <li className="text-muted-foreground">{formatNumber(totals.held_skipped)} message(s) kept because of a legal hold</li>}
                        </ul>
                    ) : <p className="text-[13px] text-muted-foreground">Nothing matches the policy today.</p>}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
                        {totals && (totals.messages > 0 || totals.channels_archived > 0) && (
                            <Button variant="destructive" loading={run.isPending} onClick={() => preview && run.mutate({ id: preview.policy.id, dryRun: false }, { onSuccess: () => setPreview(null) })}>
                                <Play /> Apply now
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete "${deleting?.name}"?`} description="Messages it covers fall back to the next less specific policy." confirmText="Delete" variant="destructive"
                onConfirm={() => { if (!deleting) return; remove.mutate(deleting.id); setDeleting(null); }} />
        </>
    );
}

// ------------------------------------------------------------------------------------------- legal holds

function HoldDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateHold();
    const channels = useChannelOptions(true);
    const { directory } = useMessaging();
    const [name, setName] = useState("");
    const [reason, setReason] = useState("");
    const [channelIds, setChannelIds] = useState<string[]>([]);
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    useEffect(() => { if (open) { setName(""); setReason(""); setChannelIds([]); setMemberIds([]); setFrom(""); setTo(""); } }, [open]);
    const valid = name.trim() && reason.trim() && (channelIds.length || memberIds.length);
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>New legal hold</DialogTitle>
                    <DialogDescription>Held messages are never deleted by retention until the hold is released.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="hold-name">Name</Label><Input id="hold-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Case 2026-14" /></div>
                    <div className="space-y-1.5"><Label htmlFor="hold-reason">Reason</Label><Textarea id="hold-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} /></div>
                    <div className="space-y-1.5"><Label>Channels</Label><MultiPicker items={channels.items} loading={channels.loading} value={channelIds} onChange={setChannelIds} placeholder="Add channels" ariaLabel="Channels" /></div>
                    <div className="space-y-1.5"><Label>People (all their messages)</Label><MultiPicker items={directory.map((m) => ({ id: m.membership_id, label: m.name, hint: m.email }))} value={memberIds} onChange={setMemberIds} placeholder="Add people" ariaLabel="People" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="hold-from">From (optional)</Label><Input id="hold-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="hold-to">To (optional)</Label><Input id="hold-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate({ name: name.trim(), reason: reason.trim(), channel_ids: channelIds, membership_ids: memberIds, date_from: from || null, date_to: to || null }, { onSuccess: () => onOpenChange(false) })}>
                        <Gavel /> Put on hold
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function HoldsTab() {
    const [released, setReleased] = useState(false);
    const holds = useHolds(released);
    const release = useReleaseHold();
    const [open, setOpen] = useState(false);
    const [releasing, setReleasing] = useState<LegalHold | null>(null);
    const columns: DataTableColumn<LegalHold>[] = [
        { key: "name", header: "Hold", cell: (h) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{h.name}</div><div className="truncate text-xs text-muted-foreground">{h.reason}</div></div> },
        { key: "covers", header: "Covers", cell: (h) => <span className="text-muted-foreground">{[...h.channels.map((c) => `#${c.name ?? "dm"}`), ...h.members.map((m) => m.name)].join(", ") || "—"}</span>, hideBelow: "md" },
        { key: "dates", header: "Dates", cell: (h) => <span className="text-muted-foreground">{h.date_from || h.date_to ? `${h.date_from ? formatDate(h.date_from) : "…"} – ${h.date_to ? formatDate(h.date_to) : "…"}` : "All time"}</span>, hideBelow: "lg" },
        { key: "state", header: "State", cell: (h) => <Badge variant={h.released_at ? "neutral" : "violet"}>{h.released_at ? `Released ${formatDate(h.released_at)}` : "Active"}</Badge> },
        { key: "act", header: <span className="sr-only">Actions</span>, className: "w-24", cell: (h) => !h.released_at && <Can permission="messaging.retention.manage"><Button size="sm" variant="outline" onClick={() => setReleasing(h)}>Release</Button></Can> },
    ];
    return (
        <>
            <TableToolbar>
                <Select value={released ? "all" : "active"} onValueChange={(v) => setReleased(v === "all")}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Active or all"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="all">Include released</SelectItem></SelectContent>
                </Select>
                <span className="flex-1" />
                <Can permission="messaging.retention.manage"><Button size="sm" onClick={() => setOpen(true)}><Plus /> New hold</Button></Can>
            </TableToolbar>
            <DataTable columns={columns} data={holds.data?.data} rowKey={(h) => h.id} loading={holds.isFetching} error={holds.error} onRetry={() => holds.refetch()}
                empty={{ icon: Scale, title: "No legal holds", description: "Hold channels or people to keep their messages during an investigation or dispute." }} />
            <HoldDialog open={open} onOpenChange={setOpen} />
            <ConfirmationDialog isOpen={!!releasing} onClose={() => setReleasing(null)} title={`Release "${releasing?.name}"?`} description="Retention policies apply to these messages again from the next run." confirmText="Release"
                onConfirm={() => { if (!releasing) return; release.mutate(releasing.id); setReleasing(null); }} />
        </>
    );
}

// ------------------------------------------------------------------------------------------- exports

function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const request = useRequestExport();
    const channels = useChannelOptions(true);
    const [format, setFormat] = useState<ExportFormat>("JSON");
    const [channelIds, setChannelIds] = useState<string[]>([]);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [threads, setThreads] = useState(true);
    const [reactions, setReactions] = useState(false);
    useEffect(() => { if (open) { setChannelIds([]); setFrom(""); setTo(""); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !request.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Export messages</DialogTitle>
                    <DialogDescription>Exports can include private conversations. The request and every download are logged.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Format</Label>
                        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                            <SelectTrigger aria-label="Format"><SelectValue /></SelectTrigger>
                            <SelectContent>{ExportFormatOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Channels (empty = all)</Label><MultiPicker items={channels.items} loading={channels.loading} value={channelIds} onChange={setChannelIds} placeholder="Add channels" ariaLabel="Channels" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="exp-from">From</Label><Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="exp-to">To</Label><Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                    </div>
                    <label className="flex items-center justify-between gap-3 text-[13px] text-foreground">Include thread replies<Switch checked={threads} onCheckedChange={setThreads} aria-label="Include thread replies" /></label>
                    <label className="flex items-center justify-between gap-3 text-[13px] text-foreground">Include reactions<Switch checked={reactions} onCheckedChange={setReactions} aria-label="Include reactions" /></label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={request.isPending}>Cancel</Button>
                    <Button loading={request.isPending} onClick={() => request.mutate({ format, channel_ids: channelIds, channel_kinds: [], date_from: from || undefined, date_to: to || undefined, include_threads: threads, include_reactions: reactions, include_attachments_metadata: true }, { onSuccess: () => onOpenChange(false) })}>
                        Request export
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExportsTab() {
    const exports = useExports();
    const download = useExportDownload();
    const [open, setOpen] = useState(false);
    const variant = (s: ExportJob["status"]) => (s === "COMPLETED" ? "success" : s === "FAILED" ? "danger" : s === "EXPIRED" ? "neutral" : "info");
    const columns: DataTableColumn<ExportJob>[] = [
        { key: "when", header: "Requested", cell: (e) => <div className="min-w-0"><div className="text-foreground">{formatDateTime(e.created_at)}</div><div className="truncate text-xs text-muted-foreground">{e.requested_by ? personName(e.requested_by.user) : "—"} · {e.format}</div></div> },
        { key: "status", header: "Status", cell: (e) => <Badge variant={variant(e.status)}>{e.status.charAt(0) + e.status.slice(1).toLowerCase()}</Badge> },
        { key: "size", header: "Contents", cell: (e) => <span className="text-muted-foreground">{e.error ?? (e.message_count !== null ? `${formatNumber(e.message_count)} messages · ${e.channel_count} channels` : "—")}</span>, hideBelow: "md" },
        { key: "exp", header: "Available until", cell: (e) => <span className="text-muted-foreground">{e.expires_at ? formatDateTime(e.expires_at) : "—"}</span>, hideBelow: "lg" },
        {
            key: "dl", header: <span className="sr-only">Download</span>, className: "w-28",
            cell: (e) => e.status === "COMPLETED" && <Button size="sm" variant="outline" loading={download.isPending && download.variables === e.id} onClick={() => download.mutate(e.id, { onSuccess: (r) => window.open(apiFileUrl(r.path), "_blank", "noopener") })}><Download /> Download</Button>,
        },
    ];
    return (
        <>
            <TableToolbar>
                <p className="flex-1 text-[13px] text-muted-foreground">Files stay available for 7 days.</p>
                <Button size="sm" onClick={() => setOpen(true)}><Plus /> New export</Button>
            </TableToolbar>
            <DataTable columns={columns} data={exports.data?.data} rowKey={(e) => e.id} loading={exports.isFetching && !exports.data} error={exports.error} onRetry={() => exports.refetch()}
                empty={{ icon: Download, title: "No exports yet", description: "Export messages for audits, legal requests or archiving." }} />
            <ExportDialog open={open} onOpenChange={setOpen} />
        </>
    );
}

/**
 * /messages/admin/retention?tab=policies|holds|exports
 * @perm policies + holds messaging.retention.manage (read also messaging.audit.read) · exports messaging.data.export
 * @api /messaging/retention-policies (+ /:id/preview|run) · /messaging/legal-holds (+ /:id/release) · /messaging/exports (+ /:id/download)
 */
export default function RetentionPage() {
    const { can } = usePermissions();
    const canPolicies = can("messaging.retention.manage") || can("messaging.audit.read");
    const canExport = can("messaging.data.export");
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? (canPolicies ? "policies" : "exports");
    return (
        <Page>
            <PageHeader title="Retention & export" description="How long messages are kept, what is on legal hold, and data exports." />
            <AdminNav />
            <Tabs value={tab} onValueChange={(v) => setSp(new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList>
                    {canPolicies && <TabsTrigger value="policies">Policies</TabsTrigger>}
                    {canPolicies && <TabsTrigger value="holds">Legal holds</TabsTrigger>}
                    {canExport && <TabsTrigger value="exports">Exports</TabsTrigger>}
                </TabsList>
                {canPolicies && <TabsContent value="policies" className="pt-3">{tab === "policies" && <PoliciesTab />}</TabsContent>}
                {canPolicies && <TabsContent value="holds" className="pt-3">{tab === "holds" && <HoldsTab />}</TabsContent>}
                {canExport && <TabsContent value="exports" className="pt-3">{tab === "exports" && <ExportsTab />}</TabsContent>}
            </Tabs>
        </Page>
    );
}
