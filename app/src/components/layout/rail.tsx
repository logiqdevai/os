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
                        "relative grid h-9 w-9 flex-none place-items-center rounded-[10px] text-rail-foreground transition-colors hover:bg-rail-hover hover:text-white [&_svg]:size-[18px] [&_svg]:stroke-[1.6]",
                        active &&
                            "bg-[var(--app,var(--brand))] text-white shadow-[0_0_0_4px_color-mix(in_oklab,var(--app,var(--brand))_22%,transparent)] hover:bg-[var(--app,var(--brand))] hover:text-white before:absolute before:-left-[18px] before:top-[7px] before:bottom-[8px] before:w-[3px] before:rounded-r before:bg-white"
                    )}
                >
                    {children}
                    {!!badge && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-rail bg-danger px-1 text-[10px] font-semibold leading-none text-white">
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
        <nav aria-label="Apps" className="hidden h-full w-[72px] flex-none flex-col items-center bg-rail pb-3 pt-3.5 md:flex">
            <Link to="/home" className="mb-4 flex-none" aria-label="Home">
                <BrandMark className="size-10 rounded-xl text-[15px]" />
            </Link>
            <div className="flex w-full min-h-0 flex-1 flex-col items-center gap-2.5 overflow-y-auto py-1.5 scrollbar-none">
                {apps.map((app) => (
                    <Fragment key={app.id}>
                        {app.separatorBefore && <div className="my-1.5 h-px w-6 flex-none bg-white/10" />}
                        <RailButton to={app.basePath} label={app.label} active={active?.id === app.id}>
                            <app.icon />
                        </RailButton>
                    </Fragment>
                ))}
            </div>
            <div className="mt-2 flex w-10 flex-none flex-col items-center gap-1.5 border-t border-white/10 pt-3">
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
