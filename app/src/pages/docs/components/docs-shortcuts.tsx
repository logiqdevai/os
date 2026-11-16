import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePage } from "@/features/docs/hooks/use-docs";
import { usePermissions } from "@/hooks/use-permission";

/**
 * Notion's page-level shortcuts for /docs (browser-reserved combos use Notion's web alternatives):
 * ⌘/Ctrl+Alt+N new page (in the current space/parent) · ⌘/Ctrl+[ back · ⌘/Ctrl+] forward · ⌘/Ctrl+Shift+U up to the parent page.
 * ⌘/Ctrl+K and ⌘/Ctrl+P (search) live in the global command palette.
 */
export function DocsShortcuts() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const id = pathname.match(/\/docs\/pages\/([0-9a-f-]{36})/)?.[1];
    const page = usePage(id).data;
    const spaceId = page?.space_id ?? pathname.match(/\/docs\/spaces\/([0-9a-f-]{36})/)?.[1];
    const parentId = page?.id;
    const upTo = page?.parent_page_id ? `/docs/pages/${page.parent_page_id}` : page ? `/docs/spaces/${page.space_id}` : undefined;
    const canCreate = usePermissions().can("docs.pages.create");
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const k = e.key.toLowerCase();
            if (e.altKey && k === "n" && canCreate) {
                e.preventDefault();
                navigate(`/docs/pages/new${spaceId ? `?space=${spaceId}${parentId ? `&parent=${parentId}` : ""}` : ""}`);
            } else if (!e.altKey && !e.shiftKey && k === "[") { e.preventDefault(); navigate(-1); }
            else if (!e.altKey && !e.shiftKey && k === "]") { e.preventDefault(); navigate(1); }
            else if (e.shiftKey && k === "u" && upTo) { e.preventDefault(); navigate(upTo); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate, canCreate, spaceId, parentId, upTo, pathname]);
    return null;
}
