import type { Theme } from "@/hooks/use-theme";

/** Theme choices (Settings → Appearance). */
export const ThemeOptions: { id: Theme; label: string; description: string }[] = [
    { id: "light", label: "Light", description: "Bright surfaces, dark text." },
    { id: "dark", label: "Dark", description: "Near-black surfaces, easy on the eyes at night." },
    { id: "system", label: "System", description: "Follow your device setting." },
];
