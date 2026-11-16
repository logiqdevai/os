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
            <Avatar className={cn(size === "sm" ? "size-5 rounded-[5px]" : "size-9 rounded-lg")}>
                {src && <AvatarImage src={src} alt="" className="rounded-[inherit]" />}
                <AvatarFallback className={cn("bg-secondary font-medium text-muted-foreground", size === "sm" ? "rounded-[5px] text-[9px]" : "rounded-lg text-xs")}>{initials(name)}</AvatarFallback>
            </Avatar>
            {presence && <PresenceDot state={presence} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background" />}
        </span>
    );
}
