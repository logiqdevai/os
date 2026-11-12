import { Bot, Lock } from "lucide-react";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { cn } from "@/lib/utils";
import { formatDateTime, personName } from "@/lib/format";
import type { SupportMessage } from "@/features/support/interfaces/support.interfaces";
import type { OutgoingMessage } from "@/features/support/hooks/use-support";

/**
 * Conversation thread for agents: customer messages left, agent replies right, internal notes highlighted
 * (warning tone + lock) so they are never mistaken for public replies; system events centered.
 * Messages the agent just sent show at once ("Sending…"); a refused one stays with "Not sent · Retry · Discard".
 */
export function MessageThread({ messages, onRetry, onDiscard }: { messages: (SupportMessage | OutgoingMessage)[]; onRetry?: (m: OutgoingMessage) => void; onDiscard?: (m: OutgoingMessage) => void }) {
    if (!messages.length) return <p className="py-10 text-center text-[13px] text-muted-foreground">No messages yet. Write the first reply below.</p>;
    return (
        <ol className="space-y-4">
            {messages.map((m) => {
                if (m.kind === "SYSTEM") {
                    return (
                        <li key={m.id} className="text-center text-xs text-muted-foreground">
                            {m.body} · {formatDateTime(m.created_at)}
                        </li>
                    );
                }
                const local = "local_state" in m ? m : null;
                const fromCustomer = m.kind === "CUSTOMER";
                const note = m.kind === "INTERNAL_NOTE";
                const name = fromCustomer ? m.author_name || (m.author_user ? personName(m.author_user) : m.author_email) || "Customer" : m.kind === "AI_AGENT" ? "AI agent" : personName(m.author?.user);
                return (
                    <li key={m.id} className={cn("flex gap-2.5", !fromCustomer && "flex-row-reverse", local?.local_state === "sending" && "opacity-70")}>
                        {m.kind === "AI_AGENT" ? (
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-soft text-violet"><Bot className="size-3.5" /></span>
                        ) : (
                            <MemberAvatar person={fromCustomer ? m.author_user ?? { display_name: name } : m.author?.user} size="sm" />
                        )}
                        <div className={cn("min-w-0 max-w-[85%] space-y-1", !fromCustomer && "items-end text-right")}>
                            <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", !fromCustomer && "justify-end")}>
                                <span className="font-medium text-foreground">{name}</span>
                                {note && <span className="inline-flex items-center gap-1 text-warning"><Lock className="size-3" /> Internal note</span>}
                                {local?.local_state === "sending" ? <span role="status">Sending…</span> : local?.local_state === "failed" ? null : <span>{formatDateTime(m.created_at)}</span>}
                                {local?.local_state === "failed" && (
                                    <span role="alert" className="inline-flex items-center gap-1.5 text-danger">
                                        Not sent
                                        {onRetry && <button type="button" className="font-medium underline underline-offset-2 hover:text-foreground" onClick={() => onRetry(local)}>Retry</button>}
                                        {onDiscard && <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onDiscard(local)}>Discard</button>}
                                    </span>
                                )}
                                {m.delivery_status === "FAILED" || m.delivery_status === "BOUNCED" ? <span className="text-danger" title={m.delivery_error ?? undefined}>Not delivered{m.delivery_error ? `: ${m.delivery_error}` : ""}</span> : null}
                                {m.delivery_status === "PENDING" && m.channel_type === "EMAIL" ? <span>Sending email…</span> : null}
                            </div>
                            <div
                                className={cn(
                                    "whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed",
                                    fromCustomer && "border-border bg-card text-foreground",
                                    m.kind === "AGENT" && "border-transparent bg-info-soft text-foreground",
                                    m.kind === "AI_AGENT" && "border-transparent bg-violet-soft text-foreground",
                                    note && "border-warning/40 bg-warning-soft text-foreground",
                                    local?.local_state === "failed" && "border-danger/50",
                                )}
                            >
                                {m.body}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
