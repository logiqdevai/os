import type { AppTheme, ColorMode } from "@/hooks/use-theme";

/** Color modes (Settings → Appearance). */
export const ColorModeOptions: { id: ColorMode; label: string; description: string }[] = [
    { id: "LIGHT", label: "Light", description: "Bright surfaces, dark text." },
    { id: "DARK", label: "Dark", description: "Near-black surfaces, easy on the eyes at night." },
    { id: "SYSTEM", label: "System", description: "Follow your device setting." },
];

/**
 * App themes (AppTheme enum). `light` / `dark` are the accent per mode and must match the
 * `html[data-theme=…]` blocks in src/index.css — used here only to draw the previews.
 */
export const ThemeOptions: { id: AppTheme; label: string; light: string; dark: string }[] = [
    { id: "DEFAULT", label: "Graphite", light: "#0b0b0c", dark: "#ffffff" },
    { id: "CYAN", label: "Cyan", light: "#0e7490", dark: "#22d3ee" },
    { id: "OCEAN", label: "Ocean", light: "#2563eb", dark: "#60a5fa" },
    { id: "INDIGO", label: "Indigo", light: "#4f46e5", dark: "#818cf8" },
    { id: "AUBERGINE", label: "Aubergine", light: "#6b2174", dark: "#d49be0" },
    { id: "ROSE", label: "Rose", light: "#be185d", dark: "#f472b6" },
    { id: "CRIMSON", label: "Crimson", light: "#dc2626", dark: "#f87171" },
    { id: "SUNSET", label: "Sunset", light: "#c2410c", dark: "#fb923c" },
    { id: "HONEY", label: "Honey", light: "#a16207", dark: "#fbbf24" },
    { id: "FOREST", label: "Forest", light: "#15803d", dark: "#4ade80" },
    { id: "SLATE", label: "Slate", light: "#475569", dark: "#94a3b8" },
    { id: "MOCHA", label: "Mocha", light: "#7c4a2d", dark: "#d6a77a" },
];

/** Quick picks for a custom primary color (any #rrggbb is allowed). */
