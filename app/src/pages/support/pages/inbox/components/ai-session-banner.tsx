import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/use-permission";
import { useAiSessions, useTakeOverFromAi } from "@/features/support/hooks/use-support";

/**
 * AI auto-answer state of the open conversation (13 §3): while the assistant is answering, agents see it and can take over;
 * after a handover or a skipped answer the reason is shown once. Renders nothing when the AI never ran here.
 * @perm support.conversations.read · take over support.conversations.reply
 * @api GET /support/ai/conversations/:id/sessions · POST /support/ai/conversations/:id/take-over
 */
export function AiSessionBanner({ conversationId }: { conversationId: string }) {
    const sessions = useAiSessions(conversationId);
    const takeOver = useTakeOverFromAi();
    const canReply = usePermission("support.conversations.reply");
    const latest = sessions.data?.[0];
    if (!latest) return null;
    if (latest.status === "ACTIVE") {
        return (
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-violet-soft px-3 py-2 text-[13px] text-foreground md:px-6" role="status">
                <Bot className="size-4 text-violet" />
                <span className="min-w-0 flex-1">AI assistant is answering · {latest.turn_count} {latest.turn_count === 1 ? "answer" : "answers"} so far. Replying yourself takes over.</span>
                {canReply && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => takeOver.mutate(conversationId)}
                    >
                        Take over
                    </Button>
                )}
            </div>
        );
    }
    const text =
        latest.status === "FAILED"
            ? `AI assistant did not answer: ${latest.handover_summary ?? latest.handover_reason ?? "unknown reason"}`
            : latest.status === "HANDED_OVER"
              ? `AI assistant handed over${latest.handover_label ? ` — ${latest.handover_label}` : ""} after ${latest.turn_count} ${latest.turn_count === 1 ? "answer" : "answers"}.`
              : null;
    if (!text) return null;
    return (
        <div className="flex items-center gap-2 border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground md:px-6">
            <Bot className="size-3.5 shrink-0" /> <span className="min-w-0 truncate" title={text}>{text}</span>
        </div>
    );
}
