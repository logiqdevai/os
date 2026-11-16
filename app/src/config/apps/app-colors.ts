/**
 * Accent color of each app: the active rail tile, the side-panel highlight and the page glow take it while the app is open.
 * Mid-tone on purpose: white icons keep ≥4.5:1 contrast in light and dark mode. Apps not listed use the theme brand color.
 */
export const APP_COLORS: Record<string, string> = {
    home: "#4f46e5",
    projects: "#2563eb",
    tasks: "#6d4fd6",
    time: "#0e7490",
    calendar: "#c2410c",
    crm: "#be185d",
    proposals: "#a16207",
    contracts: "#475569",
    "client-portal": "#0369a1",
    messages: "#0f8a6d",
    support: "#dc2626",
    campaigns: "#a21caf",
    billing: "#15803d",
    expenses: "#b45309",
    people: "#0d9488",
    docs: "#4338ca",
    files: "#0891b2",
    notifications: "#d97706",
    automation: "#7c3aed",
    admin: "#52525b",
};

export const appColor = (id: string | undefined | null): string | undefined => (id ? APP_COLORS[id] : undefined);
