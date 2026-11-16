import type { AppTheme, ColorMode } from "@/hooks/use-theme";

/** Color modes (Settings → Appearance). */
export const ColorModeOptions: { id: ColorMode; label: string; description: string }[] = [
    { id: "LIGHT", label: "Light", description: "Bright surfaces, dark text." },
    { id: "DARK", label: "Dark", description: "Near-black surfaces, easy on the eyes at night." },
    { id: "SYSTEM", label: "System", description: "Follow your device setting." },
];

/** The API stores the upper-case AppTheme enum; the preset id (theme-presets.ts, `html[data-theme]` in index.css) is its lower-case form. */
export const presetIdOf = (theme: AppTheme) => (theme === "DEFAULT" ? "default" : theme.toLowerCase());
export const themeOf = (presetId: string) => presetId.toUpperCase() as AppTheme;
