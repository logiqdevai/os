import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSession } from "@/features/session/hooks/use-session";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { getApiErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { Rail } from "./rail";
import { ContextPanel } from "./context-panel";
import { AppBar } from "./app-bar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { useActiveApp, useVisibleApps } from "./use-visible-apps";
import { NoOrganization } from "./no-organization";

const PANEL_KEY = "lq.panel-collapsed";

/**
 * Production shell (mockups core/shell.css): 60px rail | 236px context panel | main (app bar + routed content).
 * Below lg the panel moves into a sheet; below md the rail does too.
 */
export default function AppShell() {
    const auth = useAuthStore();
    const location = useLocation();
    const session = useSession();
    const app = useActiveApp();
    const { canOpen, loaded } = useVisibleApps();
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(PANEL_KEY) === "1";
        } catch {
            return false;
        }
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(PANEL_KEY, collapsed ? "1" : "0");
        } catch {
            /* ignore */
        }
    }, [collapsed]);

    useEffect(() => setMobileOpen(false), [location.pathname]);

    if (!isLoggedIn(auth)) {
        return <Navigate to={`/auth/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }

    if (session.isLoading) {
        return (
            <div className="flex h-full">
                <div className="hidden w-[60px] border-r border-border md:block" />
                <div className="flex-1">
                    <PageSkeleton />
                </div>
            </div>
        );
    }

    if (session.error) {
        if (getApiErrorStatus(session.error) === 403) return <NoOrganization />;
        return <ErrorState error={session.error} onRetry={() => session.refetch()} className="h-full" />;
    }

    if (session.data && !session.data.active_organization) return <NoOrganization />;

    const showPanel = !!app && !collapsed && app.nav.length > 0;
    const allowed = !app || !loaded || canOpen(app);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex h-dvh overflow-hidden bg-background">
                <Rail />
                {showPanel && <ContextPanel app={app} onCollapse={() => setCollapsed(true)} />}
                <div className="flex min-w-0 flex-1 flex-col">
                    <AppBar
                        app={app}
                        panelCollapsed={!showPanel}
                        onExpandPanel={() => setCollapsed(false)}
                        onOpenMobileNav={() => setMobileOpen(true)}
                        onOpenSearch={() => setSearchOpen(true)}
                    />
                    <main className={cn("min-h-0 flex-1", app?.fill ? "overflow-hidden" : "overflow-y-auto")}>
                        {allowed ? <Outlet /> : <NoAccessState />}
                    </main>
                </div>
                <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} app={app} />
                <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
            </div>
        </TooltipProvider>
    );
}
