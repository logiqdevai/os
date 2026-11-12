import { FileIcon, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedAttachment } from "@/features/messaging/interfaces/messaging.interfaces";

export interface PendingFile {
    key: string;
    name: string;
    size: number;
    progress: number;
    state: "uploading" | "done" | "failed";
    error?: string;
    uploaded?: UploadedAttachment;
}

export const formatBytes = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/** Files being uploaded for the next message (composer). */
export function PendingAttachments({ files, onRemove }: { files: PendingFile[]; onRemove: (key: string) => void }) {
    if (!files.length) return null;
    return (
        <ul className="mb-1.5 flex flex-wrap gap-1.5 px-1 pt-0.5" aria-label="Attachments">
            {files.map((f) => (
                <li key={f.key} className={cn("flex max-w-full items-center gap-2 rounded-md border px-2 py-1 text-xs", f.state === "failed" ? "border-danger/40 bg-danger-soft text-danger" : "border-border bg-secondary text-foreground")}>
                    {f.state === "uploading" ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : f.state === "failed" ? <TriangleAlert className="size-3.5 shrink-0" /> : <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="max-w-40 truncate">{f.name}</span>
                    <span className="text-muted-foreground tabular">{f.state === "uploading" ? `${f.progress}%` : formatBytes(f.size)}</span>
                    <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Remove ${f.name}`} onClick={() => onRemove(f.key)}>
                        <X className="size-3" />
                    </button>
                </li>
            ))}
        </ul>
    );
}
