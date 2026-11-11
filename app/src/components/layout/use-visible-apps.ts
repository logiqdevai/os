import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { APPS, appForPath } from "@/config/apps";
import type { AppDefinition, AppNavSection } from "@/config/apps/app.types";
import { usePermissions } from "@/hooks/use-permission";

/** Apps the caller may open: module enabled AND at least one view permission (mockups apps.js visibility rule). */
export function useVisibleApps() {
    const p = usePermissions();
    return useMemo(() => {
        const canOpen = (app: AppDefinition) =>
            (!app.module || p.moduleEnabled(app.module)) && (app.viewPermissions.length === 0 || p.canAny(...app.viewPermissions));
        const visible = APPS.filter(canOpen);
        const filterNav = (app: AppDefinition): AppNavSection[] =>
            app.nav
                .map((s) => ({ ...s, items: s.items.filter((i) => !i.permissions?.length || p.canAny(...i.permissions)) }))
                .filter((s) => s.items.length > 0);
        return { visible, canOpen, filterNav, loaded: p.loaded };
    }, [p]);
}

export function useActiveApp() {
    const { pathname } = useLocation();
    return appForPath(pathname) ?? null;
}
