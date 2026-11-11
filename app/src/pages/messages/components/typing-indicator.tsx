import type { TypingEvent } from "@/features/messaging/interfaces/messaging.interfaces";

/** "Maria is typing…" line above the composer (always reserves its height to avoid layout jumps). */
export function TypingIndicator({ people }: { people: TypingEvent[] }) {
    const names = people.map((p) => p.name.split(" ")[0]);
    const text = names.length === 0 ? "" : names.length === 1 ? `${names[0]} is typing…` : names.length === 2 ? `${names[0]} and ${names[1]} are typing…` : "Several people are typing…";
    return <div className="h-5 truncate px-1 text-[11px] text-muted-foreground" aria-live="polite">{text}</div>;
}
