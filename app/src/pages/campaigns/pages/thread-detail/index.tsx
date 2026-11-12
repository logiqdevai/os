import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, Send } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/access/can";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { formatDateTime, personName } from "@/lib/format";
import { useDiscardThreadOutgoing, useReplyInThread, useThread, useThreadAction, useThreadOutbox } from "@/features/communications/hooks/use-ai-threads";
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
    const outbox = useThreadOutbox(id);
    const discard = useDiscardThreadOutgoing();
    const canSend = usePermission("communications.messages.send");
    const [text, setText] = useState("");

    if (thread.isPending) return <PageSkeleton />;
    if (thread.error) return <Page><PageHeader title="Thread" back={{ to: CampaignPaths.threads, label: "Threads" }} /><ErrorState error={thread.error} onRetry={() => thread.refetch()} /></Page>;
    const t = thread.data;
    const contactName = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : t.messages[t.messages.length - 1]?.to_name ?? t.messages[t.messages.length - 1]?.to_address;
    const email = t.channel === "EMAIL";

    const toAddress = t.messages[t.messages.length - 1]?.to_address;
    // The reply shows in the thread at once; its delivery status (or failure reason) replaces "Sending…" when the server answers.
    const sendText = (body: string, local_id?: string) => {
        if (!id) return;
        reply.mutate(email ? { id, body_html: toHtml(body), body_text: body, local_id, to_address: toAddress } : { id, body_text: body, local_id, to_address: toAddress });
    };
    const send = () => { sendText(text); setText(""); };

    return (
        <Page width="narrow">
            <PageHeader
                title={t.subject ?? `SMS with ${contactName}`}
                description={[contactName, t.company?.name, t.project?.name].filter(Boolean).join(" · ")}
                back={{ to: CampaignPaths.threads, label: "Threads" }}
                actions={
                    <Can permission="communications.messages.archive">
                        <Button variant="outline" size="sm" onClick={() => id && action.mutate({ id, action: t.archived_at ? "restore" : "archive" })}>
                            {t.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
                        </Button>
                    </Can>
                }
            />
            <ol className="space-y-3">
                {[...t.messages, ...outbox].map((m) => {
                    const local = "local_state" in m ? m : null;
                    return (
                    <li key={m.id} className={cn("rounded-lg border border-border bg-card p-3", local?.local_state === "sending" && "opacity-70", local?.local_state === "failed" && "border-danger/50")}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{m.sent_by ? personName(m.sent_by.user) : m.from_name ?? "System"}</span>
                            <span>to {m.to_name ?? m.to_address}</span>
                            {local ? (
                                local.local_state === "sending" ? <span role="status" className="ml-auto">Sending…</span> : (
                                    <span role="alert" className="ml-auto inline-flex items-center gap-1.5 text-danger">
                                        Not sent
                                        <button type="button" className="font-medium underline underline-offset-2 hover:text-foreground" onClick={() => { if (id) discard(id, local.id); sendText(local.body_text ?? "", undefined); }}>Retry</button>
                                        <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => id && discard(id, local.id)}>Discard</button>
                                    </span>
                                )
                            ) : (
                                <>
                                    <span className="ml-auto">{formatDateTime(m.sent_at ?? m.scheduled_at ?? m.created_at)}</span>
                                    <MessageStatusBadge status={m.status} />
                                </>
                            )}
                        </div>
                        {email && m.subject && <p className="mb-1 text-[13px] font-medium text-foreground">{m.subject}</p>}
                        <p className={cn("whitespace-pre-wrap break-words text-[13px] text-foreground", !m.body_text && "text-muted-foreground")}>{m.body_text ?? "(no text version)"}</p>
                        {m.failure_reason && <p className="mt-2 text-xs text-danger">{m.failure_reason}</p>}
                        {!local && <Link to={CampaignPaths.message(m.id)} className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline">Delivery details</Link>}
                    </li>
                    );
                })}
            </ol>
            {canSend && !t.archived_at && (
                <div className="mt-4 space-y-2 rounded-lg border border-border bg-card p-3">
                    <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={email ? "Write a follow-up…" : "Write an SMS…"} aria-label="Reply" maxLength={email ? 50_000 : 1600} />
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Sent to {t.messages[t.messages.length - 1]?.to_address}. Suppressions and consent are checked on send.</p>
                        <Button size="sm" onClick={send} disabled={!text.trim()}><Send /> Send</Button>
                    </div>
                </div>
            )}
        </Page>
    );
}
