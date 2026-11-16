import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Star } from "lucide-react";
import { DocIcon } from "./doc-icons";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permission";
import { usePages, useSpaces, useSpaceTree } from "@/features/docs/hooks/use-docs";
import type { WikiTreeNode } from "@/features/docs/interfaces/docs.interfaces";

const ROW = "group flex h-[30px] items-center gap-1 rounded-md pr-1 text-[13px] text-body transition-colors hover:bg-border-soft hover:text-foreground";

function Row({ depth, active, expandable, open, onToggle, icon, label, to, onNavigate, onAdd }: {
    depth: number; active?: boolean; expandable: boolean; open: boolean; onToggle: () => void; icon: React.ReactNode; label: string; to: string; onNavigate?: () => void; onAdd?: () => void;
}) {
    return (
        <div className={cn(ROW, active && "bg-accent font-medium text-foreground")} style={{ paddingLeft: 4 + depth * 14 }}>
            <button type="button" aria-label={open ? "Collapse" : "Expand"} onClick={onToggle} className={cn("flex size-5 flex-none items-center justify-center rounded hover:bg-accent", !expandable && "invisible")}>
                <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
            </button>
            <Link to={to} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="flex size-4 flex-none items-center justify-center text-[13px] text-muted-foreground">{icon}</span>
                <span className="truncate">{label || "Untitled"}</span>
            </Link>
            {onAdd && (
                <button type="button" aria-label={`Add a page inside ${label || "Untitled"}`} onClick={onAdd} className="flex size-5 flex-none items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100">
                    <Plus className="size-3.5" />
                </button>
            )}
        </div>
    );
}

function Branch({ node, byParent, depth, spaceId, activeId, onNavigate }: { node: WikiTreeNode; byParent: Map<string | null, WikiTreeNode[]>; depth: number; spaceId: string; activeId: string | null; onNavigate?: () => void }) {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const can = usePermissions().can("docs.pages.create");
    const kids = byParent.get(node.id) ?? [];
    return (
        <>
            <Row depth={depth} active={activeId === node.id} expandable={kids.length > 0} open={open} onToggle={() => setOpen((o) => !o)} icon={<DocIcon icon={node.icon} className="size-4" />} label={node.title} to={`/docs/pages/${node.id}`} onNavigate={onNavigate}
                onAdd={can ? () => { setOpen(true); navigate(`/docs/pages/new?space=${spaceId}&parent=${node.id}`); onNavigate?.(); } : undefined} />
            {open && kids.map((k) => <Branch key={k.id} node={k} byParent={byParent} depth={depth + 1} spaceId={spaceId} activeId={activeId} onNavigate={onNavigate} />)}
        </>
    );
}

function SpaceBranch({ space, activeId, onNavigate }: { space: { id: string; name: string; icon: string | null }; activeId: string | null; onNavigate?: () => void }) {
    const [open, setOpen] = useState(false);
    const tree = useSpaceTree(open ? space.id : undefined);
    const navigate = useNavigate();
    const can = usePermissions().can("docs.pages.create");
    const byParent = new Map<string | null, WikiTreeNode[]>();
    for (const n of [...(tree.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))) byParent.set(n.parent_page_id, [...(byParent.get(n.parent_page_id) ?? []), n]);
    const roots = byParent.get(null) ?? [];
    return (
        <>
            <Row depth={0} expandable open={open} onToggle={() => setOpen((o) => !o)} icon={<DocIcon icon={space.icon ?? "folder-open"} className="size-4" />} label={space.name} to={`/docs/spaces/${space.id}`} onNavigate={onNavigate}
                onAdd={can ? () => { setOpen(true); navigate(`/docs/pages/new?space=${space.id}`); onNavigate?.(); } : undefined} />
            {open && tree.isPending && <p className="py-1 pl-9 text-xs text-muted-foreground">Loading…</p>}
            {open && tree.data && roots.length === 0 && <p className="py-1 pl-9 text-xs text-muted-foreground">No pages inside</p>}
            {open && roots.map((n) => <Branch key={n.id} node={n} byParent={byParent} depth={1} spaceId={space.id} activeId={activeId} onNavigate={onNavigate} />)}
        </>
    );
}

/** Notion-style sidebar: Favorites + Spaces with nested, expandable page trees and a "+" to add a page inside any page. */
export function DocsPageTreeNav({ onNavigate }: { onNavigate?: () => void }) {
    const { pathname } = useLocation();
    const activeId = pathname.match(/\/docs\/pages\/([0-9a-f-]{36})/)?.[1] ?? null;
    const favorites = usePages({ favorites: true, limit: 20 });
    const spaces = useSpaces({ limit: 100 });
    const favs = favorites.data?.data ?? [];
    return (
        <div className="space-y-4">
            {favs.length > 0 && (
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[11.5px] font-medium tracking-[0.2px] text-ash"><Star className="size-3" /> Favorites</div>
                    {favs.map((p) => (
                        <Link key={p.id} to={`/docs/pages/${p.id}`} onClick={onNavigate} className={cn(ROW, "gap-1.5 pl-2", activeId === p.id && "bg-accent font-medium text-foreground")}>
                            <DocIcon icon={p.icon} className="size-4" />
                            <span className="truncate">{p.title || "Untitled"}</span>
                        </Link>
                    ))}
                </div>
            )}
            <div className="space-y-0.5">
                <div className="px-2 pb-1 pt-1 text-[11.5px] font-medium tracking-[0.2px] text-ash">Spaces</div>
                {(spaces.data?.data ?? []).map((s) => <SpaceBranch key={s.id} space={s} activeId={activeId} onNavigate={onNavigate} />)}
            </div>
        </div>
    );
}
