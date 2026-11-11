import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { PresenceState } from "@/features/messaging/interfaces/messaging.interfaces";

const dot: Record<PresenceState, string> = {
    ACTIVE: "bg-success",
    AWAY: "bg-warning",
    DO_NOT_DISTURB: "bg-danger",
    OFFLINE: "border border-muted-foreground bg-background",
};

export function PresenceDot({ state, className }: { state: PresenceState; className?: string }) {
    return <span className={cn("inline-block size-2 shrink-0 rounded-full", dot[state], className)} aria-label={state.toLowerCase().replace(/_/g, " ")} />;
}

/** Avatar with an optional presence dot in the corner. */
export function PersonAvatar({ name, src, size = "md", presence }: { name: string; src?: string | null; size?: "sm" | "md"; presence?: PresenceState }) {
    return (
        <span className="relative inline-flex shrink-0">
            <Avatar className={cn("rounded-md", size === "sm" ? "size-5" : "size-8")}>
                {src && <AvatarImage src={src} alt="" />}
                <AvatarFallback className={cn("rounded-md bg-secondary font-medium text-muted-foreground", size === "sm" ? "text-[9px]" : "text-xs")}>{initials(name)}</AvatarFallback>
            </Avatar>
            {presence && <PresenceDot state={presence} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background" />}
        </span>
    );
}
