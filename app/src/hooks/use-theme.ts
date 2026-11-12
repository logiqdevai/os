import { useCallback, useEffect, useSyncExternalStore } from "react";

/** 01 §127 — mirrors the API enums `AppColorMode` / `AppTheme` (UserAppearance, per user per organization). */
export type ColorMode = "LIGHT" | "DARK" | "SYSTEM";
export type AppTheme = "DEFAULT" | "CYAN" | "OCEAN" | "INDIGO" | "AUBERGINE" | "ROSE" | "CRIMSON" | "SUNSET" | "HONEY" | "FOREST" | "SLATE" | "MOCHA";

export interface Appearance {
    color_mode: ColorMode;
    theme: AppTheme;
    /** #rrggbb custom primary color; null = the theme's own accent. */
    primary_color: string | null;
}

export const DEFAULT_APPEARANCE: Appearance = { color_mode: "SYSTEM", theme: "DEFAULT", primary_color: null };

/** Last applied appearance on this device, read by the boot script in index.html so the first paint is already themed. */
const STORAGE_KEY = "appearance";
const listeners = new Set<() => void>();
let current: Appearance = load();

function load(): Appearance {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } : DEFAULT_APPEARANCE;
    } catch {
        return DEFAULT_APPEARANCE;
    }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
export const resolveMode = (mode: ColorMode): "light" | "dark" => (mode === "DARK" || (mode === "SYSTEM" && systemDark()) ? "dark" : "light");

function luminance(hex: string) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Text color that stays readable on a custom primary color. */
export const readableOn = (hex: string) => (luminance(hex) > 0.4 ? "#000000" : "#ffffff");

const HEX = /^#[0-9a-f]{6}$/i;

/** Write the appearance onto <html>: `dark` class, `data-theme`, and the custom primary color as inline tokens. */
function apply(a: Appearance) {
    const root = document.documentElement;
    const dark = resolveMode(a.color_mode) === "dark";
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
    if (a.theme === "DEFAULT") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", a.theme.toLowerCase());
    if (a.primary_color && HEX.test(a.primary_color)) {
        root.style.setProperty("--brand", a.primary_color);
        root.style.setProperty("--brand-foreground", readableOn(a.primary_color));
        if (a.theme === "DEFAULT") root.style.setProperty("--tint", dark ? "8%" : "6%");
        else root.style.removeProperty("--tint");
    } else {
        root.style.removeProperty("--brand");
        root.style.removeProperty("--brand-foreground");
        root.style.removeProperty("--tint");
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#07080a" : "#ffffff");
}

/** Apply and remember locally. Does not save to the account — see `useTheme().setAppearance`. */
export function applyAppearance(next: Appearance) {
    current = next;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* storage blocked */
    }
    apply(next);
    listeners.forEach((l) => l());
}

type Saver = (patch: Partial<Appearance>) => void;
let saver: Saver | null = null;
/** The signed-in app registers how to save to the account (PATCH /auth/me/appearance); signed-out pages stay local. */
export function registerAppearanceSaver(fn: Saver | null) {
    saver = fn;
}

/** Appearance of the active organization: color mode, theme and primary color. Changes apply instantly and are saved to the account when signed in. */
export const useTheme = () => {
    const appearance = useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => current,
        () => DEFAULT_APPEARANCE
    );

    useEffect(() => {
        if (appearance.color_mode !== "SYSTEM") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => apply(current);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [appearance.color_mode]);

    const resolved = resolveMode(appearance.color_mode);
    const setAppearance = useCallback((patch: Partial<Appearance>) => {
        applyAppearance({ ...current, ...patch });
        saver?.(patch);
    }, []);
    const toggleTheme = useCallback(() => setAppearance({ color_mode: resolveMode(current.color_mode) === "dark" ? "LIGHT" : "DARK" }), [setAppearance]);

    return { appearance, resolved, setAppearance, toggleTheme };
};
