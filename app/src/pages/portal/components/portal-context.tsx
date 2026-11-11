import { createContext, useContext } from "react";
import type { PortalFeature, PortalSession } from "@/features/portal/interfaces/portal.interfaces";

/** The open portal session (company, role, portal.* permissions, features) for every portal page. */
export const PortalSessionContext = createContext<PortalSession | null>(null);

export function usePortal() {
    const session = useContext(PortalSessionContext);
    if (!session) throw new Error("usePortal must be used inside the portal shell");
    const perms = new Set(session.permissions);
    return {
        session,
        can: (key: string) => perms.has(key),
        canAny: (...keys: string[]) => keys.some((k) => perms.has(k)),
        feature: (f: PortalFeature) => session.features[f] !== false,
    };
}
