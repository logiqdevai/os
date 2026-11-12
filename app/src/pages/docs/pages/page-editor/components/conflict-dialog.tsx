import { useMemo } from "react";
import { GitMerge } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative, personName } from "@/lib/format";
import type { WikiPageConflict } from "@/features/docs/interfaces/docs.interfaces";
import { diffLines } from "../../../utils/line-diff";

interface Props {
    conflict: WikiPageConflict | null;
    mine: { title: string; content_markdown: string };
    pending?: boolean;
    onClose: () => void;
    /** Replace the editor with the newer version (your changes are dropped). */
    onUseTheirs: () => void;
    /** Save your version on top of the newer one (overwrites their changes; both stay in the history). */
    onKeepMine: () => void;
    /** Put both versions into the editor with conflict markers to resolve by hand. */
    onMerge: () => void;
}

/**
 * "Page changed" merge prompt (15 §2, optimistic version check). Shown when PATCH /docs/pages/:id returns 409
 * wiki_page_version_conflict. The diff shows what is different between the newer saved version and your draft.
 */
export function ConflictDialog({ conflict, mine, pending, onClose, onUseTheirs, onKeepMine, onMerge }: Props) {
    const latest = conflict?.latest;
    const ops = useMemo(() => (latest ? diffLines(latest.content_markdown ?? "", mine.content_markdown) : []), [latest, mine.content_markdown]);
    const changed = ops.filter((o) => o.type !== "equal").length;
    const who = latest?.edited_by ? personName(latest.edited_by.user) : "Someone";

    return (
        <Dialog open={!!conflict} onOpenChange={(o) => !o && !pending && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><GitMerge className="size-5 text-warning" /> This page changed while you were editing</DialogTitle>
                    <DialogDescription>
                        {who} saved version {conflict?.current_version_number}{latest?.edited_at ? ` ${formatRelative(latest.edited_at)}` : ""}. You started from version {conflict?.base_version_number}. Nothing was overwritten.
                    </DialogDescription>
                </DialogHeader>
                {latest && latest.title !== mine.title && (
                    <div className="rounded-md border border-border bg-secondary p-2 text-[13px]">
                        Title: <span className="text-danger line-through">{latest.title}</span> → <span className="text-success">{mine.title}</span>
                    </div>
                )}
                <div className="text-xs text-muted-foreground">
                    <span className="mr-3"><span className="mr-1 inline-block size-2 rounded-sm bg-danger" />Only in the newer version</span>
                    <span><span className="mr-1 inline-block size-2 rounded-sm bg-success" />Only in your draft</span>
                    <span className="ml-3">{changed} line(s) differ</span>
                </div>
                <pre className="max-h-[45dvh] overflow-auto rounded-md border border-border bg-card p-2 font-mono text-xs leading-relaxed">
                    {ops.map((o, i) => (
                        <div key={i} className={cn("whitespace-pre-wrap break-words px-1", o.type === "remove" && "bg-danger-soft text-danger", o.type === "add" && "bg-success-soft text-success")}>
                            {o.type === "remove" ? "− " : o.type === "add" ? "+ " : "  "}{o.line || " "}
                        </div>
                    ))}
                </pre>
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button type="button" variant="ghost" onClick={onUseTheirs} disabled={pending}>Discard mine, use theirs</Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button type="button" variant="outline" onClick={onKeepMine} loading={pending}>Save mine anyway</Button>
                        <Button type="button" onClick={onMerge} disabled={pending}><GitMerge /> Merge in editor</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
