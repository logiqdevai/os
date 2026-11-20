import { useEffect, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Page } from "@/components/ui/page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { BookOpen } from "lucide-react";
import { useCreatePage, useSpaces } from "@/features/docs/hooks/use-docs";

/** Space for a new page without context: the last one used, else the first space the member can see. */
export function lastSpaceId(): string | null {
    try { return localStorage.getItem("docs:last-space"); } catch { return null; }
}

/**
 * /docs/pages/new?space=&parent=&template= — Notion's "New page": creates an empty "Untitled" page (from the template
 * when given) and opens it with the title focused. No form.
 * @perm docs.pages.create (+ EDIT on the space) @api POST /docs/pages
 */
export default function NewPageRedirect() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const create = useCreatePage();
    const spaces = useSpaces({ limit: 100 });
    const started = useRef(false);
    const explicit = sp.get("space");
    const fallback = spaces.data?.data.find((s) => s.id === lastSpaceId())?.id ?? spaces.data?.data[0]?.id;
    const spaceId = explicit ?? fallback;

    useEffect(() => {
        if (started.current || !spaceId) return;
        started.current = true;
        create.mutate(
            { space_id: spaceId, parent_page_id: sp.get("parent") ?? undefined, template_id: sp.get("template") ?? undefined, title: "" },
            {
                onSuccess: (pg) => {
                    try { localStorage.setItem("docs:last-space", spaceId); } catch { /* storage blocked */ }
                    navigate(`/docs/pages/${pg.id}?new=1`, { replace: true });
                },
            },
        );
    }, [spaceId, sp, create, navigate]);

    if (create.error) return <Page><ErrorState error={create.error} /></Page>;
    if (!explicit && spaces.data && !spaces.data.data.length) {
        return <Page><EmptyState icon={BookOpen} title="Create a space first" description="Pages live in spaces. Ask a docs manager to create one." /></Page>;
    }
    if (spaces.error) return <Navigate to="/docs" replace />;
    return <PageSkeleton />;
}
