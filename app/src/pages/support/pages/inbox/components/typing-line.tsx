import { Lock } from "lucide-react";
import type { SupportTypingEvent } from "@/features/support/interfaces/support.interfaces";

/**
 * "Maria is typing…" line above the composer (13 §1). Sources: the visitor (widget), the AI assistant while it drafts,
 * and colleagues (internal-note typing is marked with a lock — collision detection). Socket `typing` on /support.
 */
export function TypingLine({ typing }: { typing: SupportTypingEvent[] }) {
    if (!typing.length) return <div className="h-5" aria-hidden />;
    const label = (t: SupportTypingEvent) => (t.from === "visitor" ? "Customer" : t.from === "ai" ? "AI assistant" : t.name ?? "A colleague");
    const names = [...new Set(typing.map(label))];
    const internal = typing.some((t) => t.from === "agent" && t.internal);
    return (
        <div className="flex h-5 items-center gap-1.5 px-3 text-xs text-muted-foreground md:px-6" role="status" aria-live="polite">
            {internal && <Lock className="size-3 text-warning" />}
            <span className="truncate">
                {names.join(", ")} {names.length > 1 ? "are" : "is"} typing
                {internal && " a note"}
            </span>
            <span className="inline-flex gap-0.5" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className="size-1 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none" style={{ animationDelay: `${i * 200}ms` }} />)}
            </span>
        </div>
    );
}
