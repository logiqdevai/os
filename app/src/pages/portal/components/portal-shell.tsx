import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, Building2, ChevronDown, LogOut, Menu, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getApiErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { personName } from "@/lib/format";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import { usePortalStore } from "@/stores/portal";
import { useLogout } from "@/features/session/hooks/use-session";
import { usePortalMemberships, usePortalSession } from "@/features/portal/hooks/use-portal";
import type { PortalFeature, PortalMembershipOption, PortalSession } from "@/features/portal/interfaces/portal.interfaces";
import { PortalSessionContext } from "./portal-context";
import { PORTAL_PATHS } from "../portal-paths";

interface NavEntry {
    label: string;
    to: string;
    perms?: string[];
    feature?: PortalFeature;
    end?: boolean;
}

const NAV: NavEntry[] = [
    { label: "Dashboard", to: PORTAL_PATHS.home, end: true },
    { label: "Projects", to: PORTAL_PATHS.projects, perms: ["portal.projects.read"], feature: "projects" },
    { label: "Approvals", to: PORTAL_PATHS.approvals, perms: ["portal.deliverables.approve"], feature: "projects" },
    { label: "Requests", to: PORTAL_PATHS.requests, perms: ["portal.requests.read", "portal.requests.create"], feature: "requests" },
    { label: "Messages", to: PORTAL_PATHS.messages, perms: ["portal.conversations.participate"], feature: "conversations" },
    { label: "Documents", to: PORTAL_PATHS.documents, perms: ["portal.documents.read"], feature: "documents" },
    { label: "Agreements", to: PORTAL_PATHS.agreements, perms: ["portal.proposals.read", "portal.contracts.read"] },
    { label: "Billing", to: PORTAL_PATHS.billing, perms: ["portal.invoices.read"], feature: "billing" },
    { label: "Help", to: PORTAL_PATHS.help, feature: "knowledge" },
];

const visible = (s: PortalSession, n: NavEntry) => (!n.feature || s.features[n.feature] !== false) && (!n.perms || n.perms.some((p) => s.permissions.includes(p)));

/**
 * Customer portal shell — /portal/* (07). Its own top navigation with the agency's branding, light/dark,
 * phone-friendly. Requires sign-in; lets people with several companies choose one; clear message when the
 * account has no portal access. Only portal.* permissions of the chosen membership apply.
 */
export default function PortalShell() {
    const location = useLocation();
    const auth = useAuthStore();
    const signedIn = isLoggedIn(auth);
    const membershipId = usePortalStore((s) => s.membership_id);
    const setMembership = usePortalStore((s) => s.setMembership);
    const memberships = usePortalMemberships(signedIn);
    const list = memberships.data ?? [];
    const chosen = list.find((m) => m.id === membershipId) ?? (list.length === 1 ? list[0] : null);

    useEffect(() => {
        if (!memberships.data) return;
        if (chosen && chosen.id !== membershipId) setMembership(chosen.id);
        if (!chosen && membershipId) setMembership(null);
    }, [memberships.data, chosen, membershipId, setMembership]);

    const session = usePortalSession(!!chosen && chosen.id === membershipId);

    if (!signedIn) return <Navigate to={`${PORTAL_PATHS.signIn}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    if (memberships.isLoading) return <PageSkeleton />;
    if (memberships.error) return <Centered><ErrorState error={memberships.error} onRetry={() => memberships.refetch()} /></Centered>;
    if (!list.length) return <NoPortalAccess />;
    if (!chosen) return <CompanyPicker memberships={list} onPick={setMembership} />;
    if (session.isLoading || !session.data) {
        if (session.error) {
            const status = getApiErrorStatus(session.error);
            return (
                <Centered>
                    {status === 403 || status === 404 ? (
                        <EmptyState icon={Building2} title="Portal access is switched off" description="The agency has switched off portal access for this company. Contact them if you need access." action={list.length > 1 ? <Button variant="outline" onClick={() => setMembership(null)}>Choose another company</Button> : <SignOutButton />} />
                    ) : (
                        <ErrorState error={session.error} onRetry={() => session.refetch()} />
                    )}
                </Centered>
            );
        }
        return <ShellSkeleton />;
    }

    return (
        <PortalSessionContext.Provider value={session.data}>
            <PortalChrome session={session.data} memberships={list} onSwitch={() => setMembership(null)}>
                <Outlet />
            </PortalChrome>
        </PortalSessionContext.Provider>
    );
}

function PortalChrome({ session, memberships, onSwitch, children }: { session: PortalSession; memberships: PortalMembershipOption[]; onSwitch: () => void; children: ReactNode }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();
    useEffect(() => setMenuOpen(false), [location.pathname]);
    const logout = useLogout();
    const nav = NAV.filter((n) => visible(session, n));
    const portalName = (session.branding.portal_name as string | undefined) || session.organization?.display_name || "Client portal";
    const logo = session.organization?.logo_url;

    const links = (mobile: boolean) =>
        nav.map((n) => (
            <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn(
                    "rounded-md text-[13px] font-medium transition-colors",
                    mobile ? "block px-3 py-2" : "px-2.5 py-1.5",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
            >
                {n.label}
            </NavLink>
        ));

    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
                    <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu /></Button>
                    <Link to={PORTAL_PATHS.home} className="flex min-w-0 items-center gap-2">
                        {logo ? <img src={logo} alt="" className="size-7 rounded-md object-contain" /> : <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{portalName.slice(0, 1)}</span>}
                        <span className="truncate text-[14px] font-medium">{portalName}</span>
                    </Link>
                    <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Portal">{links(false)}</nav>
                    <div className="ml-auto flex items-center gap-1">
                        <ThemeToggle />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1.5 px-1.5" aria-label="Account">
                                    <MemberAvatar person={session.user} size="sm" />
                                    <span className="hidden max-w-32 truncate sm:inline">{session.company?.name}</span>
                                    <ChevronDown className="hidden sm:block" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuLabel>
                                    <div className="truncate text-[13px] font-medium">{personName(session.user)}</div>
                                    <div className="truncate text-xs font-normal text-muted-foreground">{session.company?.name}{session.role ? ` · ${session.role.name}` : ""}</div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild><Link to={PORTAL_PATHS.company}><Building2 /> Company & team</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link to={PORTAL_PATHS.notifications}><Bell /> Notifications</Link></DropdownMenuItem>
                                {memberships.length > 1 && <DropdownMenuItem onSelect={onSwitch}><Repeat /> Switch company</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => logout.mutate()}><LogOut /> Sign out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetContent side="left" className="w-72 p-4">
                    <SheetHeader className="mb-3 text-left"><SheetTitle>{portalName}</SheetTitle></SheetHeader>
                    <nav className="space-y-0.5" aria-label="Portal">{links(true)}</nav>
                </SheetContent>
            </Sheet>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:py-8">{children}</main>
            <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
                {session.organization?.display_name}{session.support_email ? <> · <a className="hover:underline" href={`mailto:${session.support_email}`}>{session.support_email}</a></> : null}
            </footer>
        </div>
    );
}

function Centered({ children }: { children: ReactNode }) {
    return <div className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">{children}</div>;
}

function SignOutButton() {
    const logout = useLogout();
    return <Button variant="outline" onClick={() => logout.mutate()} loading={logout.isPending}><LogOut /> Sign out</Button>;
}

function NoPortalAccess() {
    return (
        <Centered>
            <EmptyState icon={Building2} title="No client portal access" description="Your account is not linked to a company in any client portal. Ask your agency contact to send you an invitation, then open the link from the email." action={<SignOutButton />} />
        </Centered>
    );
}

function CompanyPicker({ memberships, onPick }: { memberships: PortalMembershipOption[]; onPick: (id: string) => void }) {
    return (
        <Centered>
            <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                    <h1 className="text-xl font-medium">Choose a company</h1>
                    <p className="text-[13px] text-muted-foreground">You have portal access for more than one company.</p>
                </div>
                <ul className="space-y-2">
                    {memberships.map((m) => (
                        <li key={m.id}>
                            <button type="button" onClick={() => onPick(m.id)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary">
                                {m.organization.logo_url ? <img src={m.organization.logo_url} alt="" className="size-9 rounded-md object-contain" /> : <span className="grid size-9 place-items-center rounded-md bg-secondary text-sm font-medium">{m.organization.display_name.slice(0, 1)}</span>}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[14px] font-medium">{m.company?.name ?? "Company"}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{m.organization.display_name}{m.role ? ` · ${m.role}` : ""}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-center"><SignOutButton /></div>
            </div>
        </Centered>
    );
}

function ShellSkeleton() {
    return (
        <div className="min-h-dvh bg-background">
            <div className="border-b border-border"><div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4"><Skeleton className="size-7" /><Skeleton className="h-4 w-40" /></div></div>
            <div className="mx-auto max-w-6xl px-4 py-8"><PageSkeleton /></div>
        </div>
    );
}
