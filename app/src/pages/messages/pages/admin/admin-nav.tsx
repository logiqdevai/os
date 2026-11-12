import { NavLink } from "react-router-dom";
import { usePermissions } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
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

/** Horizontal tab-like navigation between the admin screens (scrolls on phones). */
export function AdminNav() {
    const { can } = usePermissions();
    const links = MESSAGING_ADMIN_LINKS.filter((l) => l.anyOf.some((k) => can(k)));
    return (
        <nav aria-label="Messaging administration" className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex w-max gap-1 border-b border-border">
                {links.map((l) => (
                    <NavLink
                        key={l.to}
                        to={l.to}
                        end={"end" in l ? l.end : false}
                        className={({ isActive }) => cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px]", isActive ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                        {l.label}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
