import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permission";
import { NoAccessState } from "@/components/ui/states";

interface CanProps {
    /** Caller must hold this key. */
    permission?: string;
    /** Caller must hold at least one of these keys. */
    anyOf?: string[];
    /** Caller must hold all of these keys. */
    allOf?: string[];
    children: ReactNode;
    fallback?: ReactNode;
}

function allowed(p: ReturnType<typeof usePermissions>, { permission, anyOf, allOf }: Omit<CanProps, "children" | "fallback">) {
    if (permission && !p.can(permission)) return false;
    if (anyOf?.length && !p.canAny(...anyOf)) return false;
    if (allOf?.length && !p.canAll(...allOf)) return false;
    return true;
}

/** Render children only when the caller holds the permission(s). Never compare role names. */
export function Can({ children, fallback = null, ...rule }: CanProps) {
    const p = usePermissions();
    return <>{allowed(p, rule) ? children : fallback}</>;
}

/** Route-level gate: shows the no-access state instead of the page. */
export function RequirePermission({ children, ...rule }: Omit<CanProps, "fallback">) {
    const p = usePermissions();
    if (!p.loaded) return null;
    return <>{allowed(p, rule) ? children : <NoAccessState />}</>;
}
