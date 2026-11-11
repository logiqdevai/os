import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Public auth pages. Signed-in users are sent into the app (except the invitation page, which works both ways). */
export default function AuthLayout() {
    const auth = useAuthStore();
    const location = useLocation();
    const next = new URLSearchParams(location.search).get("next");
    if (isLoggedIn(auth) && !location.pathname.startsWith("/auth/invite")) {
        return <Navigate to={next && next.startsWith("/") ? next : "/home"} replace />;
    }
    return (
        <TooltipProvider>
            <div className="relative flex min-h-dvh flex-col bg-background">
                <div className="flex items-center justify-between px-4 py-4 md:px-8">
                    <div className="flex items-center gap-2">
                        <div className="grid size-8 place-items-center rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground">L</div>
                        <span className="text-[15px] font-semibold text-foreground">Logiqdev OS</span>
                    </div>
                    <ThemeToggle />
                </div>
                <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:items-center md:pt-0">
                    <div className="w-full max-w-[400px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </TooltipProvider>
    );
}
