import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { KeyRound, MonitorSmartphone, Palette, UserRound } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const NAV = [
    { to: "/settings/profile", label: "Profile", icon: UserRound },
    { to: "/settings/password", label: "Password", icon: KeyRound },
    { to: "/settings/appearance", label: "Appearance", icon: Palette },
    { to: "/settings/sessions", label: "Sessions", icon: MonitorSmartphone },
];

/** Personal settings shell: horizontal tabs on phones, a side list on desktop. */
export function SettingsLayout() {
    return (
        <Page width="wide">
            <PageHeader title="Settings" description="Your own account. These settings follow you across organizations." />
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
                <nav aria-label="Settings" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
                    {NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex h-8 flex-none items-center gap-2 rounded-md px-2.5 text-[13px] text-body transition-colors hover:bg-border-soft hover:text-foreground [&_svg]:size-4",
                                    isActive && "bg-accent font-medium text-foreground"
                                )
                            }
                        >
                            <item.icon className="text-muted-foreground" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="min-w-0">
                    <Suspense fallback={<PageSkeleton />}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </Page>
    );
}
