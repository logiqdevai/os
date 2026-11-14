import { useCallback, useRef } from "react";

const BY_TYPE: Record<string, string> = { email: "name@example.com", url: "https://example.com", tel: "+1 555 000 0000", number: "0", search: "Search…", password: "••••••••" };
// Types where a text placeholder makes no sense (the browser draws its own format hint or control).
const SKIP = new Set(["checkbox", "radio", "hidden", "file", "date", "time", "datetime-local", "month", "week", "color", "range", "button", "submit", "reset", "image"]);

function labelText(el: HTMLElement): string | null {
    const byFor = el.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`) : null;
    const label = byFor ?? el.closest("label");
    const raw = label?.childNodes.length ? Array.from(label.childNodes).filter((n) => !(n instanceof HTMLElement && n.contains(el)) && n !== el).map((n) => n.textContent ?? "").join(" ") : "";
    return raw || el.getAttribute("aria-label");
}

/**
 * Every text field gets a placeholder. An explicit `placeholder` always wins; otherwise one is derived from the input type
 * (email, url, …) or from its label ("Project name" → "Enter project name"). Returns a ref callback to merge with the field's ref.
 */
export function useAutoPlaceholder(explicit: string | undefined, type?: string) {
    const explicitRef = useRef(explicit);
    explicitRef.current = explicit;
    return useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (!el || explicitRef.current !== undefined) return;
        const t = (type ?? "text").toLowerCase();
        if (SKIP.has(t) || el.getAttribute("placeholder")) return;
        // Labels render in the same commit; wait one frame so `label[for]` exists.
        requestAnimationFrame(() => {
            if (!el.isConnected || explicitRef.current !== undefined || el.getAttribute("placeholder")) return;
            const byType = BY_TYPE[t];
            if (byType) { el.setAttribute("placeholder", byType); return; }
            const text = labelText(el)?.replace(/\([^)]*\)/g, "").replace(/[*:]/g, "").replace(/\s+/g, " ").trim();
            if (text && text.length <= 40) el.setAttribute("placeholder", `Enter ${text.charAt(0).toLowerCase()}${text.slice(1)}`);
        });
    }, [type]);
}
