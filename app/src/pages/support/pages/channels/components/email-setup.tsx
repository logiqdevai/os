import { useState } from "react";
import { CheckCircle2, KeyRound, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { useEmailChannelSetup, useSetEmailInboundSecret } from "@/features/support/hooks/use-support";
import type { SupportChannel } from "@/features/support/interfaces/support.interfaces";
import { CopyButton } from "../../../components/copy-button";

/**
 * Email in/out of an EMAIL channel (13 §1, §10): outbound replies go through the organization's Resend connection (11, BYOK);
 * inbound mail arrives on a signed webhook (Resend inbound or any forwarder) and threads into conversations.
 * @perm VIEW support.inboxes.read · secret support.inboxes.manage
 */
export function EmailSetup({ channel, canManage }: { channel: SupportChannel; canManage: boolean }) {
    const setup = useEmailChannelSetup(channel.id);
    const [open, setOpen] = useState(false);
    if (setup.isLoading) return <Skeleton className="mt-3 h-20 w-full rounded-md" />;
    if (setup.error || !setup.data) return <p className="mt-3 text-xs text-destructive">{getApiErrorMessage(setup.error) || "Could not load the email setup."}</p>;
    const s = setup.data;
    return (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-secondary/40 p-3 text-[13px]">
            <div className="flex items-start gap-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">Sending replies</div>
                    {s.outbound.connected ? (
                        <p className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="size-3.5 text-success" /> Through {s.outbound.connection_name}, from {s.email_address}</p>
                    ) : (
                        <p className="flex items-center gap-1 text-warning"><TriangleAlert className="size-3.5" /> {s.outbound.reason}</p>
                    )}
                </div>
            </div>
            <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-medium text-foreground">Receiving email</div>
                    <p className="text-muted-foreground">Point a Resend inbound webhook (or your mail forwarder) at this URL. Requests must be signed with the channel secret.</p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs text-foreground">{s.inbound_url}</code>
                        <CopyButton size="icon-sm" variant="ghost" iconOnly text={s.inbound_url} aria-label="Copy inbound URL" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {s.has_inbound_secret ? `Signing secret set${s.inbound_secret_set_at ? ` ${formatDateTime(s.inbound_secret_set_at)}` : ""}.` : "No signing secret yet — inbound email is rejected until you set one."}
                        {s.last_inbound_at && ` Last email received ${formatDateTime(s.last_inbound_at)}.`}
                    </p>
                    {canManage && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{s.has_inbound_secret ? "Change secret" : "Set secret"}</Button>}
                </div>
            </div>
            <SecretDialog channelId={channel.id} open={open} onOpenChange={setOpen} />
        </div>
    );
}

function SecretDialog({ channelId, open, onOpenChange }: { channelId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const save = useSetEmailInboundSecret();
    const [value, setValue] = useState("");
    const [generated, setGenerated] = useState<string | null>(null);
    const close = (o: boolean) => {
        if (save.isPending) return;
        onOpenChange(o);
        if (!o) { setValue(""); setGenerated(null); }
    };
    const submit = (secret?: string) =>
        save.mutate(
            { id: channelId, secret },
            {
                // A generated secret is shown once here; a pasted one closes the dialog and the card shows "Signing secret set".
                onSuccess: (r) => {
                    if (r.secret) setGenerated(r.secret);
                    else close(false);
                },
            },
        );
    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Inbound signing secret</DialogTitle>
                    <DialogDescription>Paste the signing secret of your Resend inbound webhook (whsec_…), or generate one for another forwarder. The old secret stops working.</DialogDescription>
                </DialogHeader>
                {generated ? (
                    <div className="space-y-2">
                        <Label>Your new secret — shown once</Label>
                        <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 break-all rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground">{generated}</code>
                            <CopyButton size="icon-sm" variant="ghost" iconOnly text={generated} aria-label="Copy secret" />
                        </div>
                        <p className="text-xs text-muted-foreground">Sign each request with header <code>X-Logiq-Signature: t=&lt;unix&gt;,v1=&lt;hex HMAC-SHA256(secret, "t.body")&gt;</code>.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="inbound-secret">Resend signing secret</Label>
                        <Input id="inbound-secret" value={value} onChange={(e) => setValue(e.target.value)} placeholder="whsec_…" autoComplete="off" />
                    </div>
                )}
                <DialogFooter className="gap-2">
                    {generated ? (
                        <Button onClick={() => close(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => submit(undefined)} loading={save.isPending && !value}>Generate secret</Button>
                            <Button onClick={() => submit(value.trim())} disabled={value.trim().length < 16} loading={save.isPending && !!value}>Save</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
