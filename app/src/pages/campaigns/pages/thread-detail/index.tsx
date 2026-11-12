import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, Send } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/access/can";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { formatDateTime, personName } from "@/lib/format";
import { useReplyInThread, useThread, useThreadAction } from "@/features/communications/hooks/use-ai-threads";
import { MessageStatusBadge } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Plain text reply → simple HTML paragraphs. */
const toHtml = (text: string) => text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");

/**
 * /campaigns/threads/:id — one conversation, oldest first, with a reply box.
 * @perm VIEW communications.messages.read · reply communications.messages.send (consent + suppression checked on send) · archive communications.messages.archive
 * @api GET /communications/threads/:id · POST /communications/threads/:id/reply · POST /communications/threads/:id/archive|restore
 */
export default function ThreadDetailPage() {
    const { id } = useParams();
    const thread = useThread(id);
    const reply = useReplyInThread();
    const action = useThreadAction();
    const canSend = usePermission("communications.messages.send");
    const [text, setText] = useState("");

    if (thread.isPending) return <PageSkeleton />;
    if (thread.error) return <Page><PageHeader title="Thread" back={{ to: CampaignPaths.threads, label: "Threads" }} /><ErrorState error={thread.error} onRetry={() => thread.refetch()} /></Page>;
    const t = thread.data;
    const contactName = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : t.messages[t.messages.length - 1]?.to_name ?? t.messages[t.messages.length - 1]?.to_address;
    const email = t.channel === "EMAIL";

    const send = () =>
        id &&
        reply.mutate(email ? { id, body_html: toHtml(text), body_text: text } : { id, body_text: text }, {
            onSuccess: (m) => {
                setText("");
                toast({ title: m.status === "FAILED" || m.status === "CANCELLED" ? "Reply not sent" : "Reply sent", description: m.failure_reason ?? undefined, variant: m.status === "FAILED" || m.status === "CANCELLED" ? "destructive" : "default" });
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not send the reply", description: getApiErrorMessage(e) }),
        });

    return (
        <Page width="narrow">
            <PageHeader
                title={t.subject ?? `SMS with ${contactName}`}
                description={[contactName, t.company?.name, t.project?.name].filter(Boolean).join(" · ")}
                back={{ to: CampaignPaths.threads, label: "Threads" }}
                actions={
                    <Can permission="communications.messages.archive">
                        <Button variant="outline" size="sm" loading={action.isPending} onClick={() => id && action.mutate({ id, action: t.archived_at ? "restore" : "archive" }, { onSuccess: () => toast({ title: t.archived_at ? "Thread restored" : "Thread archived" }), onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) })}>
                            {t.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
                        </Button>
                    </Can>
                }
            />
            <ol className="space-y-3">
                {t.messages.map((m) => (
                    <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{m.sent_by ? personName(m.sent_by.user) : m.from_name ?? "System"}</span>
                            <span>to {m.to_name ?? m.to_address}</span>
                            <span className="ml-auto">{formatDateTime(m.sent_at ?? m.scheduled_at ?? m.created_at)}</span>
                            <MessageStatusBadge status={m.status} />
                        </div>
                        {email && m.subject && <p className="mb-1 text-[13px] font-medium text-foreground">{m.subject}</p>}
                        <p className={cn("whitespace-pre-wrap break-words text-[13px] text-foreground", !m.body_text && "text-muted-foreground")}>{m.body_text ?? "(no text version)"}</p>
                        {m.failure_reason && <p className="mt-2 text-xs text-danger">{m.failure_reason}</p>}
                        <Link to={CampaignPaths.message(m.id)} className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline">Delivery details</Link>
                    </li>
                ))}
            </ol>
            {canSend && !t.archived_at && (
                <div className="mt-4 space-y-2 rounded-lg border border-border bg-card p-3">
                    <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={email ? "Write a follow-up…" : "Write an SMS…"} aria-label="Reply" maxLength={email ? 50_000 : 1600} />
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Sent to {t.messages[t.messages.length - 1]?.to_address}. Suppressions and consent are checked on send.</p>
                        <Button size="sm" onClick={send} loading={reply.isPending} disabled={!text.trim()}><Send /> Send</Button>
                    </div>
                </div>
            )}
        </Page>
    );
}
