import { Link } from "react-router-dom";
import { Clock, Folder, Star } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { useFavoriteFiles, useRecentFiles } from "@/features/files/hooks/use-files";
import type { DocumentRow } from "@/features/files/interfaces/files.interfaces";
import { FileIcon, formatBytes } from "../../components/files-ui";

/**
 * /files/recent — recently opened files and favorites (17 §11)
 * @perm documents.documents.read
 * @api GET /files/recent · GET /files/favorites
 */
export default function RecentFilesPage() {
    const recent = useRecentFiles();
    const favorites = useFavoriteFiles();
    return (
        <Page width="wide">
            <PageHeader title="Recent & favorites" description="Files you opened lately and the ones you starred." />
            <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Favorites">
                    {favorites.isPending ? <ListSkeleton rows={4} /> : favorites.error ? <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} /> : !favorites.data.documents.length && !favorites.data.folders.length ? (
                        <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={Star} title="No favorites" description="Star files and folders to keep them here." /></div>
                    ) : (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                            {favorites.data.folders.map((f) => <li key={f.id}><Link to={`/files?folder=${f.id}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-secondary"><Folder className="size-4 text-muted-foreground" /><span className="truncate">{f.name}</span></Link></li>)}
                            {favorites.data.documents.map((d) => <Row key={d.id} d={d} />)}
                        </ul>
                    )}
                </Section>
                <Section title="Recently opened">
                    {recent.isPending ? <ListSkeleton rows={4} /> : recent.error ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} /> : !recent.data.length ? (
                        <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={Clock} title="Nothing yet" description="Files you open show up here." /></div>
                    ) : (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                            {recent.data.map((r) => <Row key={r.document.id} d={r.document} when={r.last_accessed_at} />)}
                        </ul>
                    )}
                </Section>
            </div>
        </Page>
    );
}

function Row({ d, when }: { d: DocumentRow; when?: string }) {
    return (
        <li>
            <Link to={`/files/documents/${d.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary">
                <FileIcon type={d.type_group} />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">{d.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.folder?.name ?? "No folder"} · {formatBytes(d.size)}</div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">{formatRelative(when ?? d.updated_at)}</span>
            </Link>
        </li>
    );
}
