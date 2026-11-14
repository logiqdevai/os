import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permission";
import { MessagesPaths } from "../../messages-paths";

/** Admin areas of Messages and the keys that open them (same keys as the API). */
export const MESSAGING_ADMIN_LINKS = [
    { to: MessagesPaths.admin, label: "Overview", anyOf: ["messaging.analytics.read", "messaging.settings.manage"], end: true },
    { to: MessagesPaths.adminModeration, label: "Moderation", anyOf: ["messaging.moderation.manage"] },
    { to: MessagesPaths.adminGuests, label: "Guests & external", anyOf: ["messaging.external_users.manage"] },
    { to: MessagesPaths.adminRetention, label: "Retention & export", anyOf: ["messaging.retention.manage", "messaging.data.export", "messaging.audit.read"] },
    { to: MessagesPaths.adminSettings, label: "Settings", anyOf: ["messaging.settings.manage", "messaging.audit.read"] },
    { to: MessagesPaths.adminIntegrations, label: "Integrations", anyOf: ["messaging.integrations.manage"] },
] as const;

/** Tabs between the admin screens (the route is the tab; scrolls sideways on phones). Same shared Tabs as the other pages. */
export function AdminNav() {
    const { can } = usePermissions();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const links = MESSAGING_ADMIN_LINKS.filter((l) => l.anyOf.some((k) => can(k)));
    const path = pathname.replace(/\/+$/, "");
    const active = [...links].sort((a, b) => b.to.length - a.to.length).find((l) => path === l.to || path.startsWith(l.to + "/"));
    return (
        <Tabs value={active?.to ?? ""} onValueChange={(to) => navigate(to)} className="mb-4">
            <nav aria-label="Messaging administration" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                <TabsList>
                    {links.map((l) => <TabsTrigger key={l.to} value={l.to}>{l.label}</TabsTrigger>)}
                </TabsList>
            </nav>
        </Tabs>
    );
}
