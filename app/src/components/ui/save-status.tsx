import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { AutosaveState } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";

/**
 * Quiet autosave indicator (Linear-style): "Saving…" while a change is on its way, a brief "Saved", and a clear
 * "Couldn't save · Retry" when the server refused it. Put it in the page / panel header next to the title.
 */
export function SaveStatus({ state, className }: { state: Pick<AutosaveState, "status" | "error" | "retry">; className?: string }) {
    const { status, error, retry } = state;
    if (status === "idle") return null;
    return (
        <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs", status === "error" ? "text-danger" : "text-muted-foreground", className)}>
            {(status === "saving" || status === "pending") && <><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> Saving…</>}
            {status === "saved" && <><Check className="size-3.5" /> Saved</>}
            {status === "error" && (
                <>
                    <AlertCircle className="size-3.5" />
                    <span className="max-w-64 truncate" title={error ?? undefined}>Couldn't save{error ? `: ${error}` : ""}</span>
                    <button type="button" className="font-medium underline underline-offset-2 hover:text-foreground" onClick={retry}>Retry</button>
                </>
            )}
        </span>
    );
}
