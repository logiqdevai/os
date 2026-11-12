import { Fragment } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, Settings, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useActiveApp, useVisibleApps } from "./use-visible-apps";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { BrandMark } from "./brand-mark";

function RailButton({ to, label, active, children, badge }: { to: string; label: string; active?: boolean; children: React.ReactNode; badge?: number }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <NavLink
                    to={to}
                    aria-label={label}
                    className={cn(
                        "relative grid h-[38px] w-10 flex-none place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-border-soft hover:text-foreground [&_svg]:size-[18px]",
                        active && "bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] before:absolute before:-left-2.5 before:top-[9px] before:bottom-[9px] before:w-[3px] before:rounded-r before:bg-primary"
                    )}
                >
                    {children}
                    {!!badge && (
                        <span className="absolute right-0.5 top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full border-2 border-background bg-danger px-1 text-[10px] font-semibold leading-none text-on-accent">
                            {badge > 99 ? "99+" : badge}
                        </span>
                    )}
                </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
    );
}

/** 60px icon rail of apps (mockups core/shell.css `.rail`). Hidden below md; the mobile sheet replaces it. */
export function Rail({ unread }: { unread?: number }) {
    const { visible } = useVisibleApps();
    const active = useActiveApp();
    const admin = visible.find((a) => a.id === "admin");
    const apps = visible.filter((a) => !a.hidden && a.id !== "notifications");
    const notifications = visible.find((a) => a.id === "notifications");

    return (
        <nav aria-label="Apps" className="hidden h-full w-[60px] flex-none flex-col items-center border-r border-sidebar-border bg-rail pb-2.5 pt-3 md:flex">
            <Link to="/home" className="mb-2.5 flex-none" aria-label="Home">
                <BrandMark />
            </Link>
            <div className="flex w-full min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto py-0.5 scrollbar-none">
                {apps.map((app) => (
                    <Fragment key={app.id}>
                        {app.separatorBefore && <div className="my-[5px] h-px w-[22px] flex-none bg-border" />}
                        <RailButton to={app.basePath} label={app.label} active={active?.id === app.id}>
                            <app.icon />
                        </RailButton>
                    </Fragment>
                ))}
            </div>
            <div className="mt-1.5 flex w-9 flex-none flex-col items-center gap-0.5 border-t border-border pt-2">
                {notifications && (
                    <RailButton to="/notifications" label="Notifications" active={active?.id === "notifications"} badge={unread}>
                        <Bell />
                    </RailButton>
                )}
                <ThemeToggle variant="rail" />
                {admin ? (
                    <RailButton to="/admin" label="Admin" active={active?.id === "admin"}>
                        <Shield />
                    </RailButton>
                ) : (
                    <RailButton to="/settings/profile" label="Settings">
                        <Settings />
                    </RailButton>
                )}
                <div className="mt-1">
                    <UserMenu compact />
                </div>
            </div>
        </nav>
    );
}
