import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, personName } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PersonCellProps {
    user: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; profile_photo_url?: string | null } | null | undefined;
    /** Second line under the name (defaults to the email). */
    sub?: string | null;
    className?: string;
    size?: "sm" | "md" | "lg";
}

const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" } as const;

/** Avatar + name + email, used in every admin list. */
export function PersonCell({ user, sub, className, size = "md" }: PersonCellProps) {
    const name = personName(user);
    return (
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
            <Avatar className={cn("flex-none", sizes[size])}>
                {user?.profile_photo_url && <AvatarImage src={user.profile_photo_url} alt="" />}
                <AvatarFallback className="bg-secondary text-muted-foreground">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{name}</div>
                {(sub ?? user?.email) && <div className="truncate text-xs text-muted-foreground">{sub ?? user?.email}</div>}
            </div>
        </div>
    );
}
