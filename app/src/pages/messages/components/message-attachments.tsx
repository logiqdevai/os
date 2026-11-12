import { Download, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, File as FileIcon, Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { environments } from "@/config/environments";
import { useAttachmentUrl, useOpenAttachment } from "@/features/messaging/hooks/use-messaging-admin";
import type { MessageAttachment } from "@/features/messaging/interfaces/messaging.interfaces";
import { formatBytes } from "./pending-attachments";

/** Signed API paths (`/files/public/download/…`) → absolute URL on the API host. */
export const apiFileUrl = (path: string) => `${environments.API_URL.replace(/\/+$/, "")}${path}`;

const ICONS: Record<string, typeof FileIcon> = { IMAGE: FileImage, PDF: FileText, DOCUMENT: FileText, SPREADSHEET: FileSpreadsheet, VIDEO: FileVideo, AUDIO: Music, VOICE_MESSAGE: Music, ARCHIVE: FileArchive };

function ImagePreview({ a }: { a: MessageAttachment }) {
    const url = useAttachmentUrl(a.id, "inline");
    if (url.isPending) return <Skeleton className="h-40 w-56 rounded-md" />;
    if (url.error || !url.data) return null;
    return (
        <a href={apiFileUrl(url.data.path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border bg-secondary">
            <img src={apiFileUrl(url.data.path)} alt={a.file_name} loading="lazy" className="max-h-64 max-w-full object-contain sm:max-w-sm" />
        </a>
    );
}

/**
 * Files of a message: image previews (signed inline URL) and download chips. Files live in 17 Documents;
 * every link is issued after the channel read check (GET /messaging/attachments/:id/url).
 */
export function MessageAttachments({ attachments, pending }: { attachments: MessageAttachment[]; pending?: boolean }) {
    const open = useOpenAttachment();
    const download = (a: MessageAttachment) =>
        open.mutate({ id: a.id, disposition: "attachment" }, { onSuccess: (r) => window.open(apiFileUrl(r.path), "_blank", "noopener") });
    const images = attachments.filter((a) => a.kind === "IMAGE" && !pending);
    const others = attachments.filter((a) => a.kind !== "IMAGE" || pending);
    return (
        <div className="mt-1 space-y-1.5">
            {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map((a) => <ImagePreview key={a.id} a={a} />)}</div>}
            {others.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                    {others.map((a) => {
                        const Icon = ICONS[a.kind] ?? FileIcon;
                        return (
                            <li key={a.id}>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => download(a)}
                                    className="flex max-w-xs items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs text-foreground hover:border-border-strong disabled:opacity-60"
                                    aria-label={`Download ${a.file_name}`}
                                >
                                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
                                    <span className="shrink-0 text-muted-foreground tabular">{formatBytes(a.size_bytes)}</span>
                                    <Download className="size-3.5 shrink-0 text-muted-foreground" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
