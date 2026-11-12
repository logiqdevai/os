import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CircleAlert, Copy, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ProposalLinkAccessModeFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useSendPreview, useSendProposal } from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail, ProposalLinkAccessMode, SendResult } from "@/features/proposals/interfaces/proposals.interfaces";

/**
 * Send: pre-send checklist → channels, recipients, message, validity → locks the version and returns the customer link (shown once).
 * @perm proposals.proposals.send · @api GET /proposals/:id/send-preview · POST /proposals/:id/send
 */
export function SendDialog({ proposal, open, onOpenChange }: { proposal: ProposalDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const preview = useSendPreview(proposal.id, proposal.current_version_id ?? undefined, open);
    const send = useSendProposal();
    const [email, setEmail] = useState(true);
    const [recipients, setRecipients] = useState<string[]>([]);
    const [extra, setExtra] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [access, setAccess] = useState<ProposalLinkAccessMode>(proposal.link_access_mode);
    const [result, setResult] = useState<SendResult | null>(null);

    useEffect(() => {
        if (open && preview.data) {
            setRecipients(preview.data.recipients.filter((r) => r.email).map((r) => r.contact_id));
            setValidUntil(preview.data.default_valid_until);
            setEmail(preview.data.email_enabled && preview.data.recipients.some((r) => r.email));
            setSubject(`Proposal ${proposal.number}: ${proposal.title}`);
        }
        if (!open) setResult(null);
    }, [open, preview.data, proposal.number, proposal.title]);

    const extraEmails = extra.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);
    const badEmail = extraEmails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const noRecipients = email && !recipients.length && !extraEmails.length;

    const submit = () =>
        send.mutate(
            {
                id: proposal.id,
                version_id: preview.data?.version_id,
                channels: email ? ["EMAIL", "LINK"] : ["LINK"],
                recipient_contact_ids: email ? recipients : undefined,
                extra_emails: email && extraEmails.length ? extraEmails : undefined,
                subject: subject || undefined,
                message: message || undefined,
                valid_until: validUntil || undefined,
                link_access_mode: access,
            },
            // The dialog switches to "Proposal sent" with the link; failures toast globally.
            { onSuccess: (r) => setResult(r) }
        );

    const [copied, setCopied] = useState(false);
    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true); // the button says "Copied" instead of a toast
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast({ variant: "destructive", title: "Copy failed", description: "Select the link and copy it manually." });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !send.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{result ? "Proposal sent" : preview.data?.is_resend ? "Send again" : "Send proposal"}</DialogTitle>
                    <DialogDescription>
                        {result ? "Share this link with the customer. It is shown once; create a new link from the proposal if you lose it." : `${proposal.number} v${preview.data?.version_number ?? ""}. Sending locks the version: later edits create a new version.`}
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Input readOnly value={result.public_url} aria-label="Customer link" onFocus={(e) => e.currentTarget.select()} />
                            <Button variant="outline" onClick={() => copy(result.public_url)}>{copied ? <><Check /> Copied</> : <><Copy /> Copy</>}</Button>
                        </div>
                        {result.deliveries.filter((d) => d.channel === "EMAIL").map((d) => (
                            <div key={d.id} className="flex items-center gap-2 text-[13px]">
                                {d.status === "FAILED" ? <CircleAlert className="size-4 text-danger" /> : <CheckCircle2 className="size-4 text-success" />}
                                <span className="text-foreground">{d.recipient_email}</span>
                                <span className="text-muted-foreground">{d.status === "FAILED" ? d.failed_reason : "emailed"}</span>
                            </div>
                        ))}
                    </div>
                ) : preview.isPending ? (
                    <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : preview.error ? (
                    <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
                ) : preview.data ? (
                    <div className="space-y-4">
                        <ul className="space-y-1.5 rounded-md border border-border p-3">
                            {preview.data.checks.map((c) => (
                                <li key={c.key} className="flex items-start gap-2 text-[13px]">
                                    {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : c.blocking ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
                                    <span className="min-w-0"><span className="text-foreground">{c.label}</span> <span className="text-muted-foreground">· {c.detail}</span></span>
                                </li>
                            ))}
                        </ul>
                        {preview.data.ready && (
                            <>
                                <div className="space-y-2">
                                    <label className={cn("flex items-center gap-2 text-[13px] text-foreground", !preview.data.email_enabled && "opacity-60")}>
                                        <Checkbox checked={email} disabled={!preview.data.email_enabled} onCheckedChange={(c) => setEmail(c === true)} /> Email the customer
                                    </label>
                                    {!preview.data.email_enabled && <p className="text-xs text-muted-foreground">Email is not configured in this environment. You get a link to share instead.</p>}
                                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><Link2 className="size-3.5" /> A customer link is always created.</p>
                                </div>
                                {email && (
                                    <div className="space-y-3">
                                        {preview.data.recipients.map((r) => (
                                            <label key={r.contact_id} className="flex items-center gap-2 text-[13px] text-foreground">
                                                <Checkbox checked={recipients.includes(r.contact_id)} disabled={!r.email} onCheckedChange={(c) => setRecipients((all) => (c === true ? [...all, r.contact_id] : all.filter((x) => x !== r.contact_id)))} />
                                                {r.name} <span className="text-muted-foreground">{r.email ?? "no email"}</span>
                                            </label>
                                        ))}
                                        <div className="space-y-1.5">
                                            <Label htmlFor="extra-emails">Other recipients</Label>
                                            <Input id="extra-emails" placeholder="name@company.com, …" value={extra} onChange={(e) => setExtra(e.target.value)} aria-invalid={badEmail} />
                                            {badEmail && <p className="text-xs text-danger">Check the email addresses.</p>}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="send-subject">Subject</Label>
                                            <Input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="send-message">Message</Label>
                                            <Textarea id="send-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi Lena, here is our proposal…" />
                                        </div>
                                    </div>
                                )}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="valid-until">Valid until</Label>
                                        <Input id="valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Who can open the link</Label>
                                        <Select value={access} onValueChange={(v) => setAccess(v as ProposalLinkAccessMode)}>
                                            <SelectTrigger aria-label="Link access"><SelectValue /></SelectTrigger>
                                            <SelectContent>{ProposalLinkAccessModeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                <DialogFooter>
                    {result ? (
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>Cancel</Button>
                            <Button loading={send.isPending} disabled={!preview.data?.ready || noRecipients || badEmail} onClick={submit}>
                                {preview.data?.is_resend ? "Send again" : "Lock and send"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
