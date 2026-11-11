import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, personName } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AvatarPerson {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    profile_photo_url?: string | null;
}

interface MemberAvatarProps {
    person: AvatarPerson | null | undefined;
    size?: "xs" | "sm" | "md";
    /** Show the name next to the avatar. */
    showName?: boolean;
    /** Text when nobody is set. */
    emptyLabel?: string;
    className?: string;
}

const sizeClass = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs" } as const;

/** Small avatar (photo or initials) with an optional name; a tooltip shows the name when it is hidden. */
export function MemberAvatar({ person, size = "sm", showName, emptyLabel = "Unassigned", className }: MemberAvatarProps) {
    const name = person ? personName(person) : emptyLabel;
    const avatar = (
        <Avatar className={cn(sizeClass[size], !person && "border border-dashed border-border-strong bg-transparent")}>
            {person?.profile_photo_url && <AvatarImage src={person.profile_photo_url} alt="" />}
            <AvatarFallback className={cn("bg-secondary font-medium text-muted-foreground", !person && "bg-transparent")}>{person ? initials(name) : ""}</AvatarFallback>
        </Avatar>
    );
    if (showName) {
        return (
            <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
                {avatar}
                <span className={cn("truncate text-[13px]", person ? "text-foreground" : "text-muted-foreground")}>{name}</span>
            </span>
        );
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={cn("inline-flex", className)} aria-label={name}>
                    {avatar}
                </span>
            </TooltipTrigger>
            <TooltipContent>{name}</TooltipContent>
        </Tooltip>
    );
}
