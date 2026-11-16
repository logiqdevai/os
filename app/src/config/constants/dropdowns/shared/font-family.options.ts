export interface FontOption {
    id: string;
    label: string;
    stack: string;
    /** Lazily loads the bundled font files; omitted for fonts already bundled or system fonts. */
    load?: () => Promise<unknown>;
}

export const DEFAULT_FONT_FAMILY_ID = "inter";
export const DEFAULT_MONO_FONT_FAMILY_ID = "jetbrains-mono";
export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 18;

const SANS_FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO_FALLBACK = '"SF Mono", "Cascadia Code", ui-monospace, Menlo, Consolas, monospace';

export const FontFamilyOptions: FontOption[] = [
    { id: "inter", label: "Inter", stack: `"Inter", ${SANS_FALLBACK}` },
    { id: "geist", label: "Geist", stack: `"Geist Variable", ${SANS_FALLBACK}`, load: () => import("@fontsource-variable/geist") },
    { id: "dm-sans", label: "DM Sans", stack: `"DM Sans Variable", ${SANS_FALLBACK}`, load: () => import("@fontsource-variable/dm-sans") },
    { id: "system", label: "System UI", stack: `system-ui, ${SANS_FALLBACK}` },
];

export const MonoFontFamilyOptions: FontOption[] = [
    { id: "jetbrains-mono", label: "JetBrains Mono", stack: `"JetBrains Mono", ${MONO_FALLBACK}`, load: () => import("@fontsource/jetbrains-mono/400.css") },
    { id: "fira-code", label: "Fira Code", stack: `"Fira Code", ${MONO_FALLBACK}`, load: () => import("@fontsource/fira-code/400.css") },
    { id: "source-code-pro", label: "Source Code Pro", stack: `"Source Code Pro", ${MONO_FALLBACK}`, load: () => import("@fontsource/source-code-pro/400.css") },
    { id: "system-mono", label: "System monospace", stack: MONO_FALLBACK },
];

export const getFontOption = (options: FontOption[], id: string): FontOption => options.find((o) => o.id === id) ?? options[0];
