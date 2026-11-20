import { useSyncExternalStore } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { cn } from "@/lib/utils";

/**
 * Tiny external store bridging Tiptap's suggestion plugin (which lives outside React) and the React popup:
 * the plugin writes { props, index }, the popup reads it with useSyncExternalStore.
 */
export interface MenuState<T> { props: SuggestionProps<T>; index: number }

export function createMenuStore<T>() {
    let state: MenuState<T> | null = null;
    const listeners = new Set<() => void>();
    const set = (next: MenuState<T> | null) => { state = next; listeners.forEach((l) => l()); };
    return {
        get: () => state,
        set,
        subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
        /** Suggestion `render()` that drives this store (arrow keys move, Enter / Tab picks, Escape closes). */
        render: () => ({
            onStart: (props: SuggestionProps<T>) => set({ props, index: 0 }),
            onUpdate: (props: SuggestionProps<T>) => set({ props, index: 0 }),
            onExit: () => set(null),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                const cur = state;
                if (!cur) return false;
                if (event.key === "Escape") { set(null); return true; }
                const n = cur.props.items.length;
                if (!n) return false;
                if (event.key === "ArrowDown") { set({ ...cur, index: (cur.index + 1) % n }); return true; }
                if (event.key === "ArrowUp") { set({ ...cur, index: (cur.index - 1 + n) % n }); return true; }
                if (event.key === "Enter" || event.key === "Tab") { cur.props.command(cur.props.items[cur.index]); return true; }
                return false;
            },
        }),
    };
}
export type MenuStore<T> = ReturnType<typeof createMenuStore<T>>;

export function useMenuState<T>(store: MenuStore<T>) {
    return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Floating list under the caret, grouped by `group(item)`; shared by "/" (blocks) and "@" (people and pages). */
export function SuggestionPopup<T>({ store, label, empty, group, render, keyOf }: {
    store: MenuStore<T>;
    label: string;
    empty: string;
    group?: (item: T) => string;
    render: (item: T) => React.ReactNode;
    keyOf: (item: T) => string;
}) {
    const state = useMenuState(store);
    const rect = state?.props.clientRect?.();
    if (!state || !rect) return null;
    const below = rect.bottom + 320 < window.innerHeight;
    let lastGroup: string | null = null;
    return (
        <div role="listbox" aria-label={label} style={{ position: "fixed", left: Math.min(rect.left, window.innerWidth - 300), ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) }}
            className="z-50 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {state.props.items.length === 0 && <p className="px-2 py-2 text-[13px] text-muted-foreground">{empty}</p>}
            {state.props.items.map((it, i) => {
                const g = group?.(it) ?? null;
                const header = g && g !== lastGroup ? <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground first:pt-1">{g}</div> : null;
                lastGroup = g;
                return (
                    <div key={keyOf(it)}>
                        {header}
                        <button type="button" role="option" aria-selected={i === state.index} onMouseDown={(e) => e.preventDefault()} onClick={() => state.props.command(it)}
                            onMouseEnter={() => store.set({ ...state, index: i })}
                            className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left", i === state.index && "bg-accent")}>
                            {render(it)}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
