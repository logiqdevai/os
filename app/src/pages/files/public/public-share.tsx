import { useState } from "react";
import { useParams } from "react-router-dom";
import { Download, ExternalLink, FileQuestion, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { useAccessPublicShare, usePublicShare } from "@/features/files/hooks/use-files";
import { FileIcon, apiUrl, formatBytes } from "../components/files-ui";

/**
 * /share/:token — public file / folder link (17 §9). No sign-in; password-protected links ask first.
 * Every open is counted and audited; file links are short-lived signed URLs.
 * @api GET /files/public/shares/:token · POST /files/public/shares/:token/access
 */
export default function PublicSharePage() {
    const { token = "" } = useParams<{ token: string }>();
    const info = usePublicShare(token);
    const access = useAccessPublicShare();
    const [password, setPassword] = useState("");
    usePageMetadata({ title: info.data?.title });

    const open = () => access.mutate({ token, password: password || undefined });
    const typeOf = (mime: string | null) => (mime?.startsWith("image/") ? "image" : mime?.includes("pdf") ? "pdf" : mime?.includes("sheet") || mime?.includes("excel") ? "spreadsheet" : "document");

    return (
        <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
            <div className="mx-auto w-full max-w-2xl">
                {info.isPending ? <PageSkeleton /> : info.error ? (
                    <div className="rounded-lg border border-border bg-card"><EmptyState icon={FileQuestion} title="This link is not available" description={getApiErrorMessage(info.error, "It may have expired or been revoked.")} /></div>
                ) : (
                    <div className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-8">
                        <div>
                            {info.data.organization && <p className="text-xs text-muted-foreground">{info.data.organization.name} shared</p>}
                            <h1 className="mt-1 break-words text-xl font-semibold text-foreground">{info.data.title}</h1>
                            {info.data.expires_at && <p className="mt-1 text-xs text-muted-foreground">Available until {formatDate(info.data.expires_at)}</p>}
                            {info.data.message && <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary p-3 text-[13px] text-foreground">{info.data.message}</p>}
                        </div>
                        {!access.data ? (
                            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); open(); }}>
                                {info.data.requires_password && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="share-password" className="flex items-center gap-1.5"><Lock className="size-3.5" /> Password</Label>
                                        <Input id="share-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                                    </div>
                                )}
                                {access.error && <p className="text-[13px] text-danger">{getApiErrorMessage(access.error)}</p>}
                                <Button type="submit" loading={access.isPending} disabled={info.data.requires_password && !password}>Open</Button>
                            </form>
                        ) : (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {access.data.files.map((f) => (
                                    <li key={f.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <FileIcon type={typeOf(f.mimetype)} />
                                            <div className="min-w-0"><div className="truncate text-[13px] font-medium text-foreground">{f.title}</div><div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div></div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" asChild><a href={apiUrl(f.preview_path)} target="_blank" rel="noopener noreferrer"><ExternalLink /> View</a></Button>
                                            {f.download_path && <Button size="sm" asChild><a href={apiUrl(f.download_path)}><Download /> Download</a></Button>}
                                        </div>
                                    </li>
                                ))}
                                {!access.data.files.length && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">This folder is empty.</li>}
                            </ul>
                        )}
                    </div>
                )}
                <p className="mt-6 text-center text-xs text-muted-foreground">Shared securely with Logiqdev OS</p>
            </div>
        </div>
    );
}
