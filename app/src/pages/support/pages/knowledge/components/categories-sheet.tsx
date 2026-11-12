import { useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { KnowledgeVisibilityOptions } from "@/config/constants/dropdowns/support/support.options";
import { useKnowledgeCategories, useReorderKnowledgeCategories } from "@/features/support/hooks/use-support";
import type { KnowledgeCategory } from "@/features/support/interfaces/support.interfaces";

/**
 * Help-center category order (13 §6). Drag a row (pointer / native drag and drop) or focus it and press Alt+↑ / Alt+↓,
 * or use the arrow buttons (touch). The new order is saved at once; failures roll back.
 * @perm support.knowledge.update · @api POST /support/knowledge/categories/reorder
 */
export function CategoriesSheet({ open, onOpenChange, canEdit }: { open: boolean; onOpenChange: (o: boolean) => void; canEdit: boolean }) {
    const categories = useKnowledgeCategories(open);
    const reorder = useReorderKnowledgeCategories();
    // The cache is re-sorted optimistically by the mutation (rolled back if the API refuses).
    const items: KnowledgeCategory[] = categories.data ?? [];
    const [dragId, setDragId] = useState<string | null>(null);
    const [announce, setAnnounce] = useState("");

    const save = (next: KnowledgeCategory[]) => reorder.mutate(next.map((c) => c.id));
    const move = (index: number, to: number) => {
        if (to < 0 || to >= items.length || to === index) return;
        const next = [...items];
        const [row] = next.splice(index, 1);
        next.splice(to, 0, row);
        setAnnounce(`${row.name} moved to position ${to + 1} of ${next.length}`);
        save(next);
        requestAnimationFrame(() => document.getElementById(`kb-cat-${row.id}`)?.focus());
    };
    const onKey = (e: KeyboardEvent, index: number) => {
        if (!canEdit || !e.altKey) return;
        if (e.key === "ArrowUp") { e.preventDefault(); move(index, index - 1); }
        if (e.key === "ArrowDown") { e.preventDefault(); move(index, index + 1); }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Categories</SheetTitle>
                    <SheetDescription>{canEdit ? "Drag to change the order shown in the help center and the portal. Keyboard: focus a row, then Alt+↑ / Alt+↓." : "The order shown in the help center and the portal."}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 px-4 pb-6 sm:px-0">
                    {categories.isLoading ? (
                        <ListSkeleton rows={5} />
                    ) : categories.error ? (
                        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
                    ) : !items.length ? (
                        <EmptyState compact title="No categories yet" description="Create a category to group articles." />
                    ) : (
                        <ol className="space-y-1.5" aria-label="Categories in display order">
                            {items.map((c, i) => (
                                <li
                                    key={c.id}
                                    id={`kb-cat-${c.id}`}
                                    tabIndex={canEdit ? 0 : -1}
                                    draggable={canEdit}
                                    onKeyDown={(e) => onKey(e, i)}
                                    onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                                    onDragEnd={() => setDragId(null)}
                                    onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const from = items.findIndex((x) => x.id === dragId);
                                        setDragId(null);
                                        if (from >= 0) move(from, i);
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        canEdit && "cursor-grab active:cursor-grabbing",
                                        dragId === c.id && "opacity-50",
                                    )}
                                >
                                    {canEdit && <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                                    <span className="w-5 shrink-0 text-right text-xs tabular text-muted-foreground">{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[13px] font-medium text-foreground">{c.name}</div>
                                        <div className="text-xs text-muted-foreground">{c._count?.articles ?? 0} articles</div>
                                    </div>
                                    <Badge variant="neutral" className="hidden sm:inline-flex">{getDropdownOptionLabel(KnowledgeVisibilityOptions, c.visibility)}</Badge>
                                    {canEdit && (
                                        <div className="flex shrink-0">
                                            <Button size="icon-sm" variant="ghost" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
                                            <Button size="icon-sm" variant="ghost" aria-label={`Move ${c.name} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                    <div className="sr-only" aria-live="polite">{announce}</div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
