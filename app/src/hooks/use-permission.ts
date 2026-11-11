import { useMemo } from "react";
import { useSession } from "@/features/session/hooks/use-session";

/**
 * The one permission helper for the UI (roles-and-permissions rule §4). Check permission keys, never role names.
 * Hiding is not security: the API is the authority and every screen must still handle 403/404.
 */
export function usePermissions() {
    const { data } = useSession();
    return useMemo(() => {
        const set = new Set(data?.permissions ?? []);
        const modules = new Set(data?.modules ?? []);
        return {
            loaded: !!data,
            can: (key: string) => set.has(key),
            canAny: (...keys: string[]) => keys.some((k) => set.has(k)),
            canAll: (...keys: string[]) => keys.every((k) => set.has(k)),
            moduleEnabled: (module: string) => modules.has(module),
        };
    }, [data]);
}

export function usePermission(key: string): boolean {
    return usePermissions().can(key);
}
