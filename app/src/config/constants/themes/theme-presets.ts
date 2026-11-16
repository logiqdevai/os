/** Surface/ink ladder overridden per preset; every other design token derives from these in index.css. */
export interface ThemePalette {
    canvas: string;
    surface: string;
    elevated: string;
    card: string;
    ink: string;
    body: string;
    muted: string;
    border: string;
    primary: string;
    primaryForeground: string;
    terminal: string;
}

export interface ThemePreset {
    id: string;
    label: string;
    /** `null` keeps the base tokens from index.css untouched. */
    light: ThemePalette | null;
    dark: ThemePalette | null;
}

export const DEFAULT_THEME_PRESET_ID = "default";

export const ThemePresets: ThemePreset[] = [
    { id: DEFAULT_THEME_PRESET_ID, label: "Default", light: null, dark: null },
    {
        id: "cyan",
        label: "Cyan",
        dark: { canvas: "#0a1517", surface: "#0f1f22", elevated: "#14292d", card: "#1a353a", ink: "#e6f7f8", body: "#b8d8db", muted: "#7fa7ab", border: "#1c3a3f", primary: "#22d3ee", primaryForeground: "#03242b", terminal: "#061012" },
        light: { canvas: "#f2fafb", surface: "#ffffff", elevated: "#e6f4f6", card: "#d6ecef", ink: "#082024", body: "#2f4f54", muted: "#5b8085", border: "#d2e8eb", primary: "#0891b2", primaryForeground: "#ffffff", terminal: "#061012" },
    },
    {
        id: "aubergine",
        label: "Aubergine",
        dark: { canvas: "#1f0a21", surface: "#2a1030", elevated: "#351a3b", card: "#412247", ink: "#f5eef6", body: "#d8c8da", muted: "#a58aa9", border: "#4a2b50", primary: "#e8a5eb", primaryForeground: "#2a0a2c", terminal: "#170718" },
        light: { canvas: "#f8f4f8", surface: "#ffffff", elevated: "#f1e8f2", card: "#e8d9ea", ink: "#1d0b1f", body: "#4a3a4c", muted: "#7a6580", border: "#e3d3e5", primary: "#4a154b", primaryForeground: "#ffffff", terminal: "#1a0a1c" },
    },
    {
        id: "ocean",
        label: "Ocean",
        dark: { canvas: "#0b1622", surface: "#102132", elevated: "#152b40", card: "#1b364f", ink: "#e6f1fa", body: "#b9cfe0", muted: "#7f9db5", border: "#1f3a54", primary: "#4cc2ff", primaryForeground: "#04202e", terminal: "#06101a" },
        light: { canvas: "#f3f8fc", surface: "#ffffff", elevated: "#e8f1f8", card: "#dae8f3", ink: "#0a1a28", body: "#34495c", muted: "#5f7c93", border: "#d5e3ee", primary: "#0b6fa8", primaryForeground: "#ffffff", terminal: "#06101a" },
    },
    {
        id: "forest",
        label: "Forest",
        dark: { canvas: "#0f1a14", surface: "#15241c", elevated: "#1b2e24", card: "#22392d", ink: "#e8f4ec", body: "#bcd4c3", muted: "#86a591", border: "#24402f", primary: "#5ed394", primaryForeground: "#05210f", terminal: "#08110c" },
        light: { canvas: "#f4f8f5", surface: "#ffffff", elevated: "#e9f1eb", card: "#dbe8de", ink: "#0c1a12", body: "#37503f", muted: "#628070", border: "#d6e4da", primary: "#1f7a4a", primaryForeground: "#ffffff", terminal: "#08110c" },
    },
    {
        id: "sunset",
        label: "Sunset",
        dark: { canvas: "#1c1210", surface: "#271916", elevated: "#32201c", card: "#3d2822", ink: "#fbeee8", body: "#e0c6bb", muted: "#b08e80", border: "#4a2f28", primary: "#ff8a4c", primaryForeground: "#2a1000", terminal: "#120b09" },
        light: { canvas: "#fdf6f2", surface: "#ffffff", elevated: "#f8ebe3", card: "#f0dccf", ink: "#26130c", body: "#5a3d31", muted: "#8c6a5a", border: "#efd9cc", primary: "#c2410c", primaryForeground: "#ffffff", terminal: "#120b09" },
    },
    {
        id: "monochrome",
        label: "Monochrome",
        dark: { canvas: "#0a0a0a", surface: "#141414", elevated: "#1c1c1c", card: "#262626", ink: "#fafafa", body: "#c8c8c8", muted: "#8a8a8a", border: "#2a2a2a", primary: "#fafafa", primaryForeground: "#0a0a0a", terminal: "#000000" },
        light: { canvas: "#fafafa", surface: "#ffffff", elevated: "#f0f0f0", card: "#e6e6e6", ink: "#0a0a0a", body: "#3a3a3a", muted: "#737373", border: "#e5e5e5", primary: "#0a0a0a", primaryForeground: "#ffffff", terminal: "#0a0a0a" },
    },
    {
        id: "solarized",
        label: "Solarized",
        dark: { canvas: "#002b36", surface: "#073642", elevated: "#0d4250", card: "#14505f", ink: "#eee8d5", body: "#93a1a1", muted: "#839496", border: "#12505e", primary: "#b58900", primaryForeground: "#002b36", terminal: "#001e26" },
        light: { canvas: "#fdf6e3", surface: "#fffdf5", elevated: "#eee8d5", card: "#e4ddc5", ink: "#073642", body: "#586e75", muted: "#839496", border: "#e6dfc8", primary: "#268bd2", primaryForeground: "#ffffff", terminal: "#001e26" },
    },
    {
        id: "nord",
        label: "Nord",
        dark: { canvas: "#242933", surface: "#2e3440", elevated: "#3b4252", card: "#434c5e", ink: "#eceff4", body: "#d8dee9", muted: "#9aa5b8", border: "#3b4252", primary: "#88c0d0", primaryForeground: "#1d2530", terminal: "#1e222a" },
        light: { canvas: "#eceff4", surface: "#ffffff", elevated: "#e5e9f0", card: "#d8dee9", ink: "#2e3440", body: "#4c566a", muted: "#6b7891", border: "#d8dee9", primary: "#5e81ac", primaryForeground: "#ffffff", terminal: "#1e222a" },
    },
    {
        id: "dracula",
        label: "Dracula",
        dark: { canvas: "#1e1f29", surface: "#282a36", elevated: "#303341", card: "#3a3d4f", ink: "#f8f8f2", body: "#d6d6e0", muted: "#9aa0c0", border: "#3a3d4f", primary: "#bd93f9", primaryForeground: "#1e1f29", terminal: "#191a21" },
        light: { canvas: "#f8f8fb", surface: "#ffffff", elevated: "#eeeef4", card: "#e2e2ec", ink: "#282a36", body: "#4b4d63", muted: "#6c6f8c", border: "#e0e0ea", primary: "#7c3aed", primaryForeground: "#ffffff", terminal: "#191a21" },
    },
];

export const ACCENT_SWATCHES = ["#5b8def", "#8b7cf6", "#e01e5a", "#ff8a4c", "#ecb22e", "#2eb67d", "#1fb5b0", "#8a8a8e"];

export const getThemePreset = (id: string): ThemePreset => ThemePresets.find((p) => p.id === id) ?? ThemePresets[0];
