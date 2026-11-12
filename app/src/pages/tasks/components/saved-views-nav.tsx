import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Bookmark, Star, Users } from "lucide-react";
import { useSavedViews } from "@/features/crm/saved-views/hooks/use-saved-views";
import type { SavedView } from "@/features/crm/saved-views/interfaces/saved-views.interfaces";
import { cn } from "@/lib/utils";

/** URL of the All tasks list with a saved view applied (shareable: the filters are in the URL, `sv` names the view). */
export function taskViewHref(view: SavedView) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(view.filters ?? {})) if (v) sp.set(k, String(v));
    if (view.search) sp.set("q", view.search);
    sp.set("sv", view.id);
    return `/tasks/all?${sp.toString()}`;
}

/**
 * Saved task views in the Tasks context panel (06 §5): personal, team and organization views (SavedView entity TASK).
 * Applying a view never widens access — GET /tasks still applies the caller's scope.
 * @api GET /saved-views?entity_type=TASK
 */
export function TaskSavedViewsNav({ onNavigate }: { onNavigate?: () => void }) {
    const views = useSavedViews("TASK");
    const { pathname } = useLocation();
    const [sp] = useSearchParams();
    const current = pathname === "/tasks/all" ? sp.get("sv") : null;
    if (views.isPending || views.error) return null;
    const rows = [...views.data].sort((a, b) => Number(b.visibility === "PERSONAL") - Number(a.visibility === "PERSONAL") || a.name.localeCompare(b.name));
    return (
        <div className="space-y-0.5">
            <div className="px-2 pb-1 pt-1 text-[11.5px] font-medium tracking-[0.2px] text-ash">Views</div>
            {rows.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">Save filters on All tasks to see them here.</p>
            ) : rows.map((v) => (
                <Link
                    key={v.id}
                    to={taskViewHref(v)}
                    onClick={onNavigate}
                    className={cn(
                        "flex h-[30px] items-center gap-2 rounded-md px-2 text-[13px] text-body transition-colors hover:bg-border-soft hover:text-foreground [&_svg]:size-4 [&_svg]:flex-none",
                        current === v.id && "bg-accent font-medium text-foreground",
                    )}
                >
                    {v.visibility === "PERSONAL" ? <Bookmark className="text-muted-foreground" /> : <Users className="text-muted-foreground" />}
                    <span className="flex-1 truncate">{v.name}</span>
                    {v.is_default && <Star className="!size-3 text-warning" aria-label="Default view" />}
                </Link>
            ))}
        </div>
    );
}
