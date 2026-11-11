import { Link } from "react-router-dom";
import { Check, LogOut, Moon, Plus, Sun, User } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useSessionData, useSwitchOrganization } from "@/features/session/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { initials, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateOrganizationDialog } from "./create-organization-dialog";

/** Avatar menu: profile, organizations, theme, sign out. */
export function UserMenu({ compact }: { compact?: boolean }) {
    const session = useSessionData();
    const logout = useLogout();
    const switchOrg = useSwitchOrganization();
    const { resolved, toggleTheme } = useTheme();
    const [createOpen, setCreateOpen] = useState(false);
    if (!session) return null;
    const name = personName(session.user);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn("flex items-center gap-2 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring", !compact && "px-1 py-0.5 hover:bg-border-soft")}
                    aria-label="Account menu"
                >
                    <Avatar className="size-7">
                        {session.user.profile_photo_url && <AvatarImage src={session.user.profile_photo_url} alt="" />}
                        <AvatarFallback className="bg-violet-soft text-[11px] font-medium text-violet">{initials(name)}</AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={compact ? "right" : "bottom"} align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal">
                        <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link to="/settings/profile">
                            <User /> Profile & security
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={toggleTheme}>
                        {resolved === "dark" ? <Sun /> : <Moon />} {resolved === "dark" ? "Light theme" : "Dark theme"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Organizations</DropdownMenuLabel>
                    {session.organizations.map((org) => (
                        <DropdownMenuItem
                            key={org.id}
                            disabled={switchOrg.isPending}
                            onSelect={() => org.id !== session.active_organization?.id && switchOrg.mutate(org.id)}
                        >
                            <span className="grid size-5 place-items-center rounded bg-secondary text-[10px] font-semibold">{initials(org.display_name)}</span>
                            <span className="truncate">{org.display_name}</span>
                            {org.id === session.active_organization?.id && <Check className="ml-auto" />}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                        <Plus /> New organization
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => logout.mutate()} className="text-danger focus:text-danger">
                        <LogOut /> Sign out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
    );
}
