import { Link } from "react-router-dom";
import { Menu, PanelLeftOpen, Plus, Search } from "lucide-react";
import type { AppDefinition } from "@/config/apps/app.types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "./theme-toggle";

interface AppBarProps {
    app: AppDefinition | null;
    panelCollapsed: boolean;
    onExpandPanel: () => void;
    onOpenMobileNav: () => void;
    onOpenSearch: () => void;
}

/** 52px top bar: navigation toggle, breadcrumb, search, primary action (gated), account. */
export function AppBar({ app, panelCollapsed, onExpandPanel, onOpenMobileNav, onOpenSearch }: AppBarProps) {
    const p = usePermissions();
    const session = useSessionData();
    const action = app?.newAction && (!app.newAction.permission || p.can(app.newAction.permission)) ? app.newAction : null;

    return (
        <header className="flex h-16 flex-none items-center gap-2.5 border-b border-border bg-[var(--shell-bar)] px-4 md:px-7">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
                <Menu />
            </Button>
            {panelCollapsed && app && !app.ownSidebar && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onExpandPanel} aria-label="Show panel">
                            <PanelLeftOpen />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show panel</TooltipContent>
                </Tooltip>
            )}
            <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-ash">
                <span className="hidden truncate sm:inline">{session?.active_organization?.display_name}</span>
                {app && (
                    <>
                        <span className="hidden sm:inline">/</span>
                        <Link to={app.basePath} className="truncate font-medium text-foreground">
                            {app.label}
                        </Link>
                    </>
                )}
            </div>
            <div className="flex-1" />
            <button
                type="button"
                onClick={onOpenSearch}
                className="hidden h-10 w-64 items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] text-ash transition-colors hover:border-border-strong md:flex"
            >
                <Search className="size-4" />
                <span className="flex-1 text-left">Search…</span>
                <kbd className="rounded-xs border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground">⌘K</kbd>
            </button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenSearch} aria-label="Search">
                <Search />
            </Button>
            {action && (
                <Button asChild size="sm" className="h-10 rounded-full px-4">
                    <Link to={action.to}>
                        <Plus />
                        <span className="hidden sm:inline">{action.label}</span>
                    </Link>
                </Button>
            )}
            <div className="flex items-center gap-1 md:hidden">
                <ThemeToggle />
                <UserMenu />
            </div>
        </header>
    );
}
