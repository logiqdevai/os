import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { Download, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { toast } from "@/hooks/use-toast";
import { apiUrl, FileIcon, formatBytes } from "@/pages/files/components/files-ui";
import { getApiErrorMessage } from "@/lib/api-error";
import * as service from "@/features/tasks/services/tasks.services";
import { useAddAttachment, useRemoveAttachment, useUploadingCount } from "@/features/tasks/hooks/use-tasks";
import type { TaskDetail } from "@/features/tasks/interfaces/tasks.interfaces";

type Attachment = TaskDetail["attachments"][number];

const typeGroup = (mime: string | null) => {
    if (!mime) return "other";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "pdf";
    if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "spreadsheet";
    if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
    if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar")) return "archive";
    if (mime.startsWith("text/")) return "text";
    if (mime.includes("word") || mime.includes("document")) return "document";
    return "other";
};

/** Uploads files to the task: shared by the button, drag-and-drop and paste. */
function useUploader(taskId: string, canEdit: boolean) {
    const add = useAddAttachment();
    return (files: File[]) => {
        if (!canEdit) return;
        files.forEach((file) => add.mutate({ id: taskId, file }));
    };
}

/** Drop or paste files anywhere on the task body (like Linear). Spread `bind` on the container and render `overlay` inside it. */
export function useTaskFileDrop(taskId: string, canEdit: boolean) {
    const upload = useUploader(taskId, canEdit);
    const [over, setOver] = useState(false);
    const depth = useRef(0);
    const hasFiles = (e: DragEvent) => canEdit && Array.from(e.dataTransfer?.types ?? []).includes("Files");
    return {
        bind: {
            onDragEnter: (e: DragEvent) => { if (hasFiles(e)) { depth.current += 1; setOver(true); } },
            onDragOver: (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
            onDragLeave: (e: DragEvent) => { if (hasFiles(e) && --depth.current <= 0) { depth.current = 0; setOver(false); } },
            onDrop: (e: DragEvent) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                depth.current = 0;
                setOver(false);
                upload(Array.from(e.dataTransfer.files));
            },
            onPaste: (e: ClipboardEvent) => {
                const files = Array.from(e.clipboardData?.files ?? []);
                if (!canEdit || !files.length) return;
                e.preventDefault();
                upload(files);
            },
        },
        overlay: over ? (
            <div className="pointer-events-none absolute -inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-primary">
                Drop files to attach
            </div>
        ) : null,
    };
}

function Thumb({ taskId, att }: { taskId: string; att: Attachment }) {
    const group = typeGroup(att.document.mimetype);
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        if (group !== "image") return;
        let cancelled = false;
        service.getAttachmentUrl({ id: taskId, attId: att.id, disposition: "inline" }).then((u) => !cancelled && setSrc(apiUrl(u.url))).catch(() => undefined);
        return () => { cancelled = true; };
    }, [group, taskId, att.id]);
    return src ? <img src={src} alt={att.document.filename} loading="lazy" className="size-full object-cover" /> : <FileIcon type={group} className="size-8" />;
}

async function open(taskId: string, attId: string, disposition: "inline" | "attachment") {
    try {
        const u = await service.getAttachmentUrl({ id: taskId, attId, disposition });
        window.open(apiUrl(u.url), disposition === "inline" ? "_blank" : "_self", "noopener");
    } catch (e) {
        toast({ variant: "destructive", title: "Could not open the file", description: getApiErrorMessage(e) });
    }
}

/**
 * Files uploaded to the task, Linear style: thumbnail tiles under the description, an attach button, drag-and-drop and paste.
 * @perm upload / remove tasks.tasks.update · view tasks.tasks.read
 * @api POST /tasks/:key/attachments (multipart "file") · GET /tasks/:key/attachments/:id/url · DELETE /tasks/:key/attachments/:id
 */
export function TaskAttachments({ task: t, canEdit }: { task: TaskDetail; canEdit: boolean }) {
    const upload = useUploader(t.id, canEdit);
    const remove = useRemoveAttachment();
    const uploading = useUploadingCount(t.id);
    const input = useRef<HTMLInputElement>(null);
    const [removing, setRemoving] = useState<Attachment | null>(null);
    if (!t.attachments.length && !uploading && !canEdit) return null;
    return (
        <section aria-label="Files" className="space-y-2">
            {(t.attachments.length > 0 || uploading > 0) && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: uploading }, (_, i) => (
                        <li key={`up-${i}`} className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-card text-muted-foreground">
                            <Loader2 className="size-5 animate-spin" aria-label="Uploading" />
                        </li>
                    ))}
                    {t.attachments.map((a) => (
                        <li key={a.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
                            <button type="button" onClick={() => open(t.id, a.id, "inline")} className="flex h-20 w-full items-center justify-center overflow-hidden bg-muted/40" aria-label={`Open ${a.document.filename}`}>
                                <Thumb taskId={t.id} att={a} />
                            </button>
                            <div className="px-2 py-1.5">
                                <p className="truncate text-xs font-medium text-foreground" title={a.document.filename}>{a.document.filename}</p>
                                <p className="text-[11px] text-muted-foreground">{formatBytes(a.document.size)}</p>
                            </div>
                            <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                <Button variant="secondary" size="icon-sm" aria-label={`Download ${a.document.filename}`} onClick={() => open(t.id, a.id, "attachment")}><Download /></Button>
                                {canEdit && <Button variant="secondary" size="icon-sm" aria-label={`Remove ${a.document.filename}`} onClick={() => setRemoving(a)}><Trash2 /></Button>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {canEdit && (
                <>
                    <input ref={input} type="file" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => input.current?.click()}><Paperclip /> Attach files</Button>
                </>
            )}
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title="Remove file?"
                description={removing ? `${removing.document.filename} will be removed from this task.` : ""}
                confirmText="Remove"
                variant="destructive"
                onConfirm={() => { if (removing) remove.mutate({ id: t.id, attId: removing.id }); setRemoving(null); }}
            />
        </section>
    );
}
