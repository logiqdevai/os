import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useDocsHome, useDocsSearch } from "@/features/docs/hooks/use-docs";
import { DocIcon } from "./doc-icons";

/**
 * Notion's search: a command dialog over titles and content (permission-filtered on the server). Empty query shows
 * recently visited pages. Results keep the server order (title matches first).
 * @api GET /docs/search?q= · GET /docs/home
 */
export function DocsSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const [q, setQ] = useState("");
    const [debounced, setDebounced] = useState("");
    useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
    useEffect(() => { if (!open) setQ(""); }, [open]);
    const results = useDocsSearch({ q: debounced, limit: 20 }, open && debounced.length > 0);
    const home = useDocsHome();
    const go = (id: string) => { onOpenChange(false); navigate(`/docs/pages/${id}`); };
    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput value={q} onValueChange={setQ} placeholder="Search pages…" aria-label="Search docs" />
            <CommandList>
                {debounced ? (
                    <>
                        <CommandEmpty>{results.isFetching ? "Searching…" : "No pages found."}</CommandEmpty>
                        {!!results.data?.data.length && (
                            <CommandGroup heading="Pages">
                                {results.data.data.map((p) => (
                                    <CommandItem key={p.id} value={`${p.id} ${p.title}`} onSelect={() => go(p.id)} className="items-start">
                                        <DocIcon icon={p.icon} className="mt-0.5" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13px] text-foreground">{p.title || "Untitled"} <span className="text-muted-foreground">· {p.space.name}</span></span>
                                            {p.snippet && <span className="block truncate text-xs text-muted-foreground">{p.snippet}</span>}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </>
                ) : (
                    <CommandGroup heading="Recently visited">
                        {(home.data?.recent ?? []).map((p) => (
                            <CommandItem key={p.id} value={`${p.id} ${p.title}`} onSelect={() => go(p.id)}>
                                <DocIcon icon={p.icon} /><span className="truncate">{p.title || "Untitled"}</span><span className="ml-auto truncate text-xs text-muted-foreground">{p.space.name}</span>
                            </CommandItem>
                        ))}
                        {!home.data?.recent.length && <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground"><Clock className="size-4" /> Pages you open show up here.</p>}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}

export function DocsSearchButton({ onClick, className }: { onClick: () => void; className?: string }) {
    return (
        <button type="button" onClick={onClick} className={className ?? "flex h-9 w-full items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] text-muted-foreground hover:bg-accent"}>
            <Search className="size-4" /> Search pages…
        </button>
    );
}
