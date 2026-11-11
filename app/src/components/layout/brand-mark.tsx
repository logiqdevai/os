import { cn } from "@/lib/utils";
import { useSessionData } from "@/features/session/hooks/use-session";
import { initials } from "@/lib/format";

/** Organization logo tile (falls back to initials). */
export function BrandMark({ className }: { className?: string }) {
    const session = useSessionData();
    const org = session?.active_organization;
    if (org?.logo_url) return <img src={org.logo_url} alt={org.display_name} className={cn("size-8 rounded-lg object-cover", className)} />;
    return (
        <div className={cn("grid size-8 place-items-center rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground", className)}>
            {org ? initials(org.display_name) : "L"}
        </div>
    );
}
