import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { parseBody } from "../utils/message-body";
import { useMessaging } from "./messaging-context";

/** Renders a message body safely (text nodes only): mentions, @channel, links, `code`, **bold**, _italic_, line breaks. */
export function MessageBody({ body, className }: { body: string; className?: string }) {
    const { myMembershipId } = useMessaging();
    const segments = parseBody(body);
    return (
        <div className={cn("whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground", className)}>
            {segments.map((s, i) => {
                switch (s.type) {
                    case "mention":
                        return (
                            <span key={i} className={cn("rounded-xs px-0.5 font-medium", s.id === myMembershipId ? "bg-warning-soft text-warning" : "bg-info-soft text-info")}>@{s.name}</span>
                        );
                    case "broadcast":
                        return <span key={i} className="rounded-xs bg-warning-soft px-0.5 font-medium text-warning">{s.text}</span>;
                    case "link":
                        return <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{s.href}</a>;
                    case "code":
                        return <code key={i} className="rounded-xs border border-border bg-secondary px-1 font-mono text-[12px]">{s.text}</code>;
                    case "bold":
                        return <strong key={i} className="font-semibold">{s.text}</strong>;
                    case "italic":
                        return <em key={i}>{s.text}</em>;
                    default:
                        return <Fragment key={i}>{s.text}</Fragment>;
                }
            })}
        </div>
    );
}
