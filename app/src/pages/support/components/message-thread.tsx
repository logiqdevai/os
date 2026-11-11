import { Bot, Lock } from "lucide-react";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { cn } from "@/lib/utils";
import { formatDateTime, personName } from "@/lib/format";
import type { SupportMessage } from "@/features/support/interfaces/support.interfaces";

/**
 * Conversation thread for agents: customer messages left, agent replies right, internal notes highlighted
 * (warning tone + lock) so they are never mistaken for public replies; system events centered.
 */
export function MessageThread({ messages }: { messages: SupportMessage[] }) {
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
                const fromCustomer = m.kind === "CUSTOMER";
                const note = m.kind === "INTERNAL_NOTE";
                const name = fromCustomer ? m.author_name || (m.author_user ? personName(m.author_user) : m.author_email) || "Customer" : m.kind === "AI_AGENT" ? "AI agent" : personName(m.author?.user);
                return (
                    <li key={m.id} className={cn("flex gap-2.5", !fromCustomer && "flex-row-reverse")}>
                        {m.kind === "AI_AGENT" ? (
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-soft text-violet"><Bot className="size-3.5" /></span>
                        ) : (
                            <MemberAvatar person={fromCustomer ? m.author_user ?? { display_name: name } : m.author?.user} size="sm" />
                        )}
                        <div className={cn("min-w-0 max-w-[85%] space-y-1", !fromCustomer && "items-end text-right")}>
                            <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", !fromCustomer && "justify-end")}>
                                <span className="font-medium text-foreground">{name}</span>
                                {note && <span className="inline-flex items-center gap-1 text-warning"><Lock className="size-3" /> Internal note</span>}
                                <span>{formatDateTime(m.created_at)}</span>
                                {m.delivery_status === "FAILED" || m.delivery_status === "BOUNCED" ? <span className="text-danger">Not delivered</span> : null}
                            </div>
                            <div
                                className={cn(
                                    "whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed",
                                    fromCustomer && "border-border bg-card text-foreground",
                                    m.kind === "AGENT" && "border-transparent bg-info-soft text-foreground",
                                    m.kind === "AI_AGENT" && "border-transparent bg-violet-soft text-foreground",
                                    note && "border-warning/40 bg-warning-soft text-foreground",
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
