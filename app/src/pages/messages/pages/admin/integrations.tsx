import { useEffect, useState } from "react";
import { KeyRound, MoreHorizontal, Plug, Plus, Power, Send, Unplug } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { formatRelative } from "@/lib/format";
import { environments } from "@/config/environments";
import {
    useCreateIntegration, useDisconnectIntegration, useIntegrations, useRotateIntegrationToken, useTestIntegration, useUpdateIntegration,
} from "@/features/messaging/hooks/use-messaging-admin";
import type { MessagingIntegration } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { AdminNav } from "./admin-nav";
import { CopyButton } from "@/components/ui/copy-button";
import { useChannelOptions } from "./channel-options";

const hookUrl = (path: string) => `${environments.API_URL.replace(/\/+$/, "")}${path}`;

function SecretDialog({ secret, onClose }: { secret: { name: string; path: string } | null; onClose: () => void }) {
    const url = secret ? hookUrl(secret.path) : "";
    return (
        <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Webhook URL for {secret?.name}</DialogTitle>
                    <DialogDescription>Copy it now — it is shown only once. Anyone with the URL can post into the channel.</DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                    <Input readOnly value={url} className="font-mono text-xs" aria-label="Webhook URL" onFocus={(e) => e.target.select()} />
                    <CopyButton text={url} iconOnly variant="outline" size="icon" />
                </div>
                <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-xs text-foreground">{`curl -X POST ${url} \\\n  -H 'content-type: application/json' \\\n  -d '{"text":"Deploy finished ✅"}'`}</pre>
                <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (s: { name: string; path: string }) => void }) {
    const create = useCreateIntegration();
    const channels = useChannelOptions(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [channelId, setChannelId] = useState("");
    useEffect(() => { if (open) { setName(""); setDescription(""); setChannelId(""); } }, [open]);
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>New incoming webhook</DialogTitle>
                    <DialogDescription>Tools like CI, monitoring or forms post messages into a channel. Messages are marked as coming from an app.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5"><Label htmlFor="int-name">Name</Label><Input id="int-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Deploy bot" /></div>
                    <div className="space-y-1.5">
                        <Label>Posts to</Label>
                        <Select value={channelId} onValueChange={setChannelId}>
                            <SelectTrigger aria-label="Channel"><SelectValue placeholder={channels.loading ? "Loading…" : "Choose a channel"} /></SelectTrigger>
                            <SelectContent>{channels.items.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="int-desc">Description</Label><Textarea id="int-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button disabled={!name.trim() || !channelId} loading={create.isPending} onClick={() => create.mutate({ kind: "INBOUND_WEBHOOK", name: name.trim(), description: description.trim() || null, default_channel_id: channelId, allowed_channel_ids: [] }, { onSuccess: (r) => { onOpenChange(false); onCreated({ name: r.name, path: r.webhook_path }); } })}>
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * /messages/admin/integrations — incoming webhooks / bots that post into channels (not the 5 BYOK providers of Admin → Integrations).
 * @perm messaging.integrations.manage (sensitive)
 * @api GET/POST /messaging/integrations · PATCH/DELETE /:id · POST /:id/rotate-token · POST /:id/test · public POST /messaging/hooks/:token
 */
export default function IntegrationsPage() {
    const list = useIntegrations();
    const update = useUpdateIntegration();
    const rotate = useRotateIntegrationToken();
    const test = useTestIntegration();
    const disconnect = useDisconnectIntegration();
    const [creating, setCreating] = useState(false);
    const [secret, setSecret] = useState<{ name: string; path: string } | null>(null);
    const [removing, setRemoving] = useState<MessagingIntegration | null>(null);
    const columns: DataTableColumn<MessagingIntegration>[] = [
        { key: "name", header: "Integration", cell: (i) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{i.name}</div><div className="truncate text-xs text-muted-foreground">{i.description ?? "Incoming webhook"}</div></div> },
        { key: "channel", header: "Channel", cell: (i) => <span className="text-muted-foreground">{i.default_channel ? `#${i.default_channel.name}` : "—"}</span>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (i) => <Badge variant={i.status === "ACTIVE" ? "success" : i.status === "ERROR" ? "danger" : "neutral"}>{i.status === "ACTIVE" ? "Active" : i.status === "ERROR" ? "Error" : "Disabled"}</Badge> },
        { key: "last", header: "Last message", cell: (i) => <span className="text-muted-foreground" title={i.last_error ?? undefined}>{i.last_error ? `Error: ${i.last_error}` : i.last_event_at ? formatRelative(i.last_event_at) : "Never"}</span>, hideBelow: "md" },
        {
            key: "act", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (i) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${i.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={i.status !== "ACTIVE"} onSelect={() => test.mutate(i.id)}><Send /> Send a test message</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => rotate.mutate(i.id, { onSuccess: (r) => setSecret({ name: i.name, path: r.webhook_path }) })}><KeyRound /> New webhook URL</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => update.mutate({ id: i.id, status: i.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                            <Power /> {i.status === "ACTIVE" ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => setRemoving(i)}><Unplug /> Disconnect</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Integrations" description="Apps and webhooks that post into channels." />
            <AdminNav />
            <TableToolbar>
                <p className="flex-1 text-[13px] text-muted-foreground">Provider keys (OpenAI, Resend, Twilio, Stripe, Viva Wallet) are managed in Admin → Integrations.</p>
                <Button size="sm" onClick={() => setCreating(true)}><Plus /> New webhook</Button>
            </TableToolbar>
            <DataTable columns={columns} data={list.data?.data} rowKey={(i) => i.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()}
                empty={{ icon: Plug, title: "No integrations", description: "Create an incoming webhook to post deploys, alerts or form submissions into a channel." }} />
            <CreateDialog open={creating} onOpenChange={setCreating} onCreated={setSecret} />
            <SecretDialog secret={secret} onClose={() => setSecret(null)} />
            <ConfirmationDialog isOpen={!!removing} onClose={() => setRemoving(null)} title={`Disconnect ${removing?.name}?`} description="The webhook URL stops working at once. Messages it posted stay." confirmText="Disconnect" variant="destructive"
                onConfirm={() => { if (!removing) return; disconnect.mutate(removing.id); setRemoving(null); }} />
        </Page>
    );
}
