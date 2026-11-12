import { useEffect } from "react";
import { useSessionData, useUpdateAppearance } from "@/features/session/hooks/use-session";
import { applyAppearance, registerAppearanceSaver } from "@/hooks/use-theme";

/**
 * Keeps <html> in step with the signed-in person's appearance for the active organization (01 §127):
 * applies `session.appearance` whenever the session or the organization changes, and lets `useTheme().setAppearance`
 * save changes to the account (PATCH /auth/me/appearance). Renders nothing.
 */
export function AppearanceSync() {
    const session = useSessionData();
    const save = useUpdateAppearance();
    const appearance = session?.appearance;
    const orgId = session?.active_organization?.id ?? null;

    useEffect(() => {
        if (appearance) applyAppearance({ color_mode: appearance.color_mode, theme: appearance.theme, primary_color: appearance.primary_color });
    }, [appearance]);

    const { mutate } = save;
    useEffect(() => {
        if (!orgId) return registerAppearanceSaver(null);
        // The theme is already applied locally; a failed save is toasted once by the global MutationCache.
        registerAppearanceSaver((patch) => mutate(patch));
        return () => registerAppearanceSaver(null);
    }, [orgId, mutate]);

    return null;
}
