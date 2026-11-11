import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-synced list state (page, search, filters) so list views are shareable. Search is debounced.
 * Usage: `const { params, page, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 25 })`
 * then pass `params` to the list query.
 */
export function useListParams(defaults: { limit?: number; filters?: Record<string, string> } = {}) {
    const [sp, setSp] = useSearchParams();
    const [searchInput, setSearchInput] = useState(sp.get("q") ?? "");

    const page = Number(sp.get("page") ?? 1) || 1;
    const search = sp.get("q") ?? "";

    useEffect(() => {
        const t = setTimeout(() => {
            if (searchInput === search) return;
            setSp((prev) => {
                const next = new URLSearchParams(prev);
                if (searchInput) next.set("q", searchInput);
                else next.delete("q");
                next.delete("page");
                return next;
            }, { replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput, search, setSp]);

    const filters = useMemo(() => {
        const out: Record<string, string> = { ...(defaults.filters ?? {}) };
        sp.forEach((v, k) => {
            if (k !== "page" && k !== "q") out[k] = v;
        });
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sp]);

    const setPage = useCallback((p: number) => setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (p > 1) next.set("page", String(p));
        else next.delete("page");
        return next;
    }), [setSp]);

    const setFilter = useCallback((key: string, value: string | null | undefined) => setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
    }), [setSp]);

    const params = useMemo(() => {
        const p: Record<string, string | number> = { page, limit: defaults.limit ?? 25 };
        if (search) p.search = search;
        for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
        return p;
    }, [page, search, filters, defaults.limit]);

    return { params, page, setPage, search: searchInput, setSearch: setSearchInput, filters, setFilter };
}
