import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

const read = (): Theme => {
    try {
        return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    } catch {
        return "system";
    }
};

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(theme: Theme) {
    const dark = theme === "dark" || (theme === "system" && systemDark());
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#07080a" : "#ffffff");
}

function setStoredTheme(theme: Theme) {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* storage blocked */
    }
    apply(theme);
    listeners.forEach((l) => l());
}

/** Light / dark / system theme shared across the app (class `dark` on <html>). */
export const useTheme = () => {
    const theme = useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        read,
        () => "system" as Theme
    );

    useEffect(() => {
        apply(theme);
        if (theme !== "system") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => apply("system");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [theme]);

    const resolved: "light" | "dark" = theme === "system" ? (systemDark() ? "dark" : "light") : theme;
    const setTheme = useCallback((t: Theme) => setStoredTheme(t), []);
    const toggleTheme = useCallback(() => setStoredTheme(resolved === "dark" ? "light" : "dark"), [resolved]);

    return { theme, resolved, setTheme, toggleTheme };
};
