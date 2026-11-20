import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Copy, Link2, MoreHorizontal, Pencil, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permission";
import { useCreateUntitledPage, useDuplicatePage, useMovePage, usePage, usePageAction, usePages, useRenamePage, useSetFavorite, useSpaces, useSpaceTree } from "@/features/docs/hooks/use-docs";
import type { WikiTreeNode } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "./doc-icons";
import { SpaceFormDialog } from "./docs-ui";

const ROW = "group/row relative flex h-[30px] items-center gap-0.5 rounded-md pr-1 text-[13px] text-body transition-colors hover:bg-border-soft hover:text-foreground";
const ICON_BTN = "flex size-5 flex-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground";

// ---------------------------------------------------------------------------------------------------------------------
// Open / closed state per node, remembered in this browser (spaces and pages).
// ---------------------------------------------------------------------------------------------------------------------

const OPEN_KEY = "docs:tree-open";
function readOpen(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function useOpenState() {
    const [open, setOpen] = useState<Set<string>>(readOpen);
    const write = (next: Set<string>) => { setOpen(next); try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next].slice(-400))); } catch { /* storage blocked */ } };
    return {
        isOpen: (id: string) => open.has(id),
        toggle: (id: string) => { const n = new Set(open); if (n.has(id)) n.delete(id); else n.add(id); write(n); },
        openAll: (ids: string[]) => { if (ids.every((i) => open.has(i))) return; const n = new Set(open); ids.forEach((i) => n.add(i)); write(n); },
    };
}
type OpenState = ReturnType<typeof useOpenState>;

// ---------------------------------------------------------------------------------------------------------------------
// Drag and drop (native): drop on the top / bottom quarter of a row = before / after it, in the middle = inside it.
// ---------------------------------------------------------------------------------------------------------------------

type Zone = "before" | "inside" | "after";
interface Dragged { id: string; space_id: string }
let dragged: Dragged | null = null;

function zoneOf(e: React.DragEvent, allowSiblings: boolean): Zone {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (!allowSiblings) return "inside";
    return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
}

interface TreeCtx {
    spaceId: string;
    activeId: string | null;
    byParent: Map<string | null, WikiTreeNode[]>;
    nodes: Map<string, WikiTreeNode>;
    favorites: Set<string>;
    open: OpenState;
    onNavigate?: () => void;
}

/** True when `id` is `ancestor` or below it (a page cannot be dropped into its own subtree). */
function isInside(nodes: Map<string, WikiTreeNode>, id: string, ancestor: string) {
    for (let cur: string | null = id; cur; cur = nodes.get(cur)?.parent_page_id ?? null) if (cur === ancestor) return true;
    return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Page row
// ---------------------------------------------------------------------------------------------------------------------

function PageRow({ node, depth, ctx }: { node: WikiTreeNode; depth: number; ctx: TreeCtx }) {
    const navigate = useNavigate();
    const perms = usePermissions();
    const kids = ctx.byParent.get(node.id) ?? [];
    const open = ctx.open.isOpen(node.id);
    const [zone, setZone] = useState<Zone | null>(null);
    const [renaming, setRenaming] = useState(false);
    const create = useCreateUntitledPage();
    const move = useMovePage();
    const rename = useRenamePage();
    const duplicate = useDuplicatePage();
    const action = usePageAction();
    const favorite = useSetFavorite();
    const isFav = ctx.favorites.has(node.id);
    const canEdit = perms.can("docs.pages.update");

    const drop = (e: React.DragEvent) => {
        e.preventDefault();
        const z = zone;
        setZone(null);
        const d = dragged;
        dragged = null;
        if (!d || !z || d.id === node.id) return;
        if (d.space_id === ctx.spaceId && isInside(ctx.nodes, node.id, d.id)) return;
        if (z === "inside") {
            ctx.open.openAll([node.id]);
            move.mutate({ id: d.id, parent_page_id: node.id, space_id: ctx.spaceId });
            return;
        }
        const siblings = (ctx.byParent.get(node.parent_page_id) ?? []).filter((n) => n.id !== d.id);
        const at = siblings.findIndex((n) => n.id === node.id) + (z === "after" ? 1 : 0);
        move.mutate({ id: d.id, parent_page_id: node.parent_page_id, space_id: ctx.spaceId, sort_order: Math.max(0, at) });
    };

    return (
        <>
            <div
                className={cn(ROW, ctx.activeId === node.id && "bg-accent font-medium text-foreground", zone === "inside" && "bg-info-soft ring-1 ring-info/40")}
                style={{ paddingLeft: 4 + depth * 14 }}
                draggable={canEdit && !renaming}
                onDragStart={(e) => { dragged = { id: node.id, space_id: ctx.spaceId }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", node.title || "Untitled"); }}
                onDragEnd={() => { dragged = null; setZone(null); }}
                onDragOver={(e) => { if (!dragged || dragged.id === node.id) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setZone(zoneOf(e, true)); }}
                onDragLeave={() => setZone(null)}
                onDrop={drop}
            >
                {zone === "before" && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-info" />}
                {zone === "after" && <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded bg-info" />}
                <button type="button" aria-label={open ? "Collapse" : "Expand"} aria-expanded={open} onClick={() => ctx.open.toggle(node.id)} className={ICON_BTN}>
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                </button>
                {renaming ? (
                    <input
                        autoFocus
                        defaultValue={node.title}
                        aria-label="Page title"
                        maxLength={200}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => { const t = e.currentTarget.value.trim(); if (t !== node.title) rename.mutate({ id: node.id, title: t }); setRenaming(false); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }}
                        className="h-6 min-w-0 flex-1 rounded border border-border bg-background px-1.5 text-[13px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                ) : (
                    <Link to={`/docs/pages/${node.id}`} onClick={ctx.onNavigate} onDoubleClick={(e) => { if (canEdit) { e.preventDefault(); setRenaming(true); } }} className="flex min-w-0 flex-1 items-center gap-1.5" draggable={false}>
                        <DocIcon icon={node.icon} className="size-4" />
                        <span className="truncate">{node.title || "Untitled"}</span>
                    </Link>
                )}
                {!renaming && (
                    <span className="flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><button type="button" aria-label={`Actions for ${node.title || "Untitled"}`} className={ICON_BTN}><MoreHorizontal className="size-3.5" /></button></DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                                <DropdownMenuItem onSelect={() => favorite.mutate({ id: node.id, on: !isFav })}>{isFav ? <StarOff /> : <Star />} {isFav ? "Remove from favorites" : "Add to favorites"}</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(`${window.location.origin}/docs/pages/${node.id}`)}><Link2 /> Copy link</DropdownMenuItem>
                                {canEdit && <DropdownMenuItem onSelect={() => setTimeout(() => setRenaming(true))}><Pencil /> Rename</DropdownMenuItem>}
                                {perms.can("docs.pages.create") && <DropdownMenuItem onSelect={() => duplicate.mutate({ id: node.id }, { onSuccess: (c) => navigate(`/docs/pages/${c.id}`) })}><Copy /> Duplicate</DropdownMenuItem>}
                                {perms.can("docs.pages.archive") && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => { action.mutate({ id: node.id, action: "trash" }); if (ctx.activeId === node.id) navigate(node.parent_page_id ? `/docs/pages/${node.parent_page_id}` : `/docs/spaces/${ctx.spaceId}`); }}><Trash2 /> Move to trash</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {perms.can("docs.pages.create") && (
                            <button type="button" aria-label={`Add a page inside ${node.title || "Untitled"}`} disabled={create.isPending} className={ICON_BTN}
                                onClick={() => { ctx.open.openAll([node.id]); create.create({ space_id: ctx.spaceId, parent_page_id: node.id }, ctx.onNavigate); }}>
                                <Plus className="size-3.5" />
                            </button>
                        )}
                    </span>
                )}
            </div>
            {open && (kids.length
                ? kids.map((k) => <PageRow key={k.id} node={k} depth={depth + 1} ctx={ctx} />)
                : <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: 30 + depth * 14 }}>No pages inside</p>)}
        </>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Space branch
// ---------------------------------------------------------------------------------------------------------------------

function SpaceBranch({ space, activeId, activeSpaceId, ancestors, favorites, open, onNavigate }: {
    space: { id: string; name: string; icon: string | null }; activeId: string | null; activeSpaceId: string | null; ancestors: string[];
    favorites: Set<string>; open: OpenState; onNavigate?: () => void;
}) {
    const isOpen = open.isOpen(space.id);
    const tree = useSpaceTree(isOpen ? space.id : undefined);
    const create = useCreateUntitledPage();
    const move = useMovePage();
    const can = usePermissions().can("docs.pages.create");
    const [over, setOver] = useState(false);
    const { byParent, nodes } = useMemo(() => {
        const bp = new Map<string | null, WikiTreeNode[]>();
        const all = new Map<string, WikiTreeNode>();
        for (const n of [...(tree.data ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))) {
            all.set(n.id, n);
            bp.set(n.parent_page_id, [...(bp.get(n.parent_page_id) ?? []), n]);
        }
        return { byParent: bp, nodes: all };
    }, [tree.data]);
    // Auto-expand the space and the parents of the page being viewed.
    const ancestorKey = ancestors.join(",");
    useEffect(() => { if (activeSpaceId === space.id) open.openAll([space.id, ...ancestors]); }, [activeSpaceId, space.id, ancestorKey]); // eslint-disable-line react-hooks/exhaustive-deps
    const roots = byParent.get(null) ?? [];
    const ctx: TreeCtx = { spaceId: space.id, activeId, byParent, nodes, favorites, open, onNavigate };
    return (
        <>
            <div
                className={cn(ROW, over && "bg-info-soft ring-1 ring-info/40")}
                style={{ paddingLeft: 4 }}
                onDragOver={(e) => { if (!dragged) return; e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); const d = dragged; dragged = null; if (d) { open.openAll([space.id]); move.mutate({ id: d.id, parent_page_id: null, space_id: space.id }); } }}
            >
                <button type="button" aria-label={isOpen ? "Collapse" : "Expand"} aria-expanded={isOpen} onClick={() => open.toggle(space.id)} className={ICON_BTN}>
                    <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                </button>
                <Link to={`/docs/spaces/${space.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
                    <DocIcon icon={space.icon ?? "folder-open"} className="size-4" />
                    <span className="truncate">{space.name}</span>
                </Link>
                {can && (
                    <button type="button" aria-label={`Add a page in ${space.name}`} disabled={create.isPending} className={cn(ICON_BTN, "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}
                        onClick={() => { open.openAll([space.id]); create.create({ space_id: space.id }, onNavigate); }}>
                        <Plus className="size-3.5" />
                    </button>
                )}
            </div>
            {isOpen && tree.isPending && <p className="py-1 pl-9 text-xs text-muted-foreground">Loading…</p>}
            {isOpen && tree.data && roots.length === 0 && <p className="py-1 pl-9 text-xs text-muted-foreground">No pages inside</p>}
            {isOpen && roots.map((n) => <PageRow key={n.id} node={n} depth={1} ctx={ctx} />)}
        </>
    );
}

/**
 * Notion-style sidebar (the only page tree): Favorites + Spaces with nested pages. Drag a page onto another to nest it,
 * between two to reorder, onto a space to move it to the top level there. Each row has ⋯ (favorite, copy link, rename,
 * duplicate, trash) and + (new "Untitled" page inside). The tree opens to the page being viewed.
 */
export function DocsPageTreeNav({ onNavigate }: { onNavigate?: () => void }) {
    const { pathname } = useLocation();
    const activeId = pathname.match(/\/docs\/pages\/([0-9a-f-]{36})/)?.[1] ?? null;
    const active = usePage(activeId ?? undefined).data;
    const favorites = usePages({ favorites: true, limit: 50 });
    const spaces = useSpaces({ limit: 100 });
    const canManageSpaces = usePermissions().can("docs.spaces.manage");
    const open = useOpenState();
    const [spaceOpen, setSpaceOpen] = useState(false);
    const navigate = useNavigate();
    const favs = favorites.data?.data ?? [];
    const favIds = useMemo(() => new Set(favs.map((f) => f.id)), [favs]);
    const ancestors = useRef<string[]>([]);
    ancestors.current = active ? active.breadcrumbs.map((b) => b.id) : [];
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
                <div className="group/row flex items-center px-2 pb-1 pt-1">
                    <span className="flex-1 text-[11.5px] font-medium tracking-[0.2px] text-ash">Spaces</span>
                    {canManageSpaces && <button type="button" aria-label="New space" onClick={() => setSpaceOpen(true)} className={cn(ICON_BTN, "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}><Plus className="size-3.5" /></button>}
                </div>
                {(spaces.data?.data ?? []).map((s) => (
                    <SpaceBranch key={s.id} space={s} activeId={activeId} activeSpaceId={active?.space_id ?? null} ancestors={ancestors.current} favorites={favIds} open={open} onNavigate={onNavigate} />
                ))}
            </div>
            <SpaceFormDialog open={spaceOpen} onOpenChange={setSpaceOpen} onCreated={(s) => { navigate(`/docs/spaces/${s.id}`); onNavigate?.(); }} />
        </div>
    );
}
