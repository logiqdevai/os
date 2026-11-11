import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, FilePlus, Lock, Pencil, Users } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiSpaceKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useArchiveSpace, usePages, useSpace } from "@/features/docs/hooks/use-docs";
import { DocIcon, DocsStatusBadge, SpaceFormDialog, SpaceLayout } from "../../components/docs-ui";

/**
 * /docs/spaces/:id — space overview with its page tree (15 §2–3)
 * @perm VIEW docs.pages.read (+ space membership for private spaces) · edit/archive docs.spaces.manage · new page docs.pages.create
 * @api GET /docs/spaces/:id · GET /docs/spaces/:id/tree · GET /docs/pages?space_id=&parent_page_id=root
 */
export default function SpaceDetailPage() {
    const { id = "" } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const p = usePermissions();
    const space = useSpace(id);
    const pages = usePages({ space_id: id, parent_page_id: "root", limit: 50, order_by: "updated_at" }, !!space.data);
    const archive = useArchiveSpace();
    const [editOpen, setEditOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);

    if (space.isPending) return <PageSkeleton />;
    if (space.error) return <Page><ErrorState error={space.error} onRetry={() => space.refetch()} /></Page>;
    const s = space.data;
    const canWrite = p.can("docs.pages.create") && ["EDIT", "MANAGE"].includes(s.my_level);
    const canManage = p.can("docs.spaces.manage");

    return (
        <SpaceLayout spaceId={id} canCreate={canWrite}>
            <Page width="wide">
                <PageHeader
                    back={{ to: "/docs/spaces", label: "Spaces" }}
                    title={<span className="flex items-center gap-2"><DocIcon icon={s.icon} className="text-xl" />{s.name}</span>}
                    documentTitle={s.name}
                    description={s.description ?? undefined}
                    meta={<><Badge variant="outline">{getDropdownOptionLabel(WikiSpaceKindFormOptions, s.kind)}</Badge>{s.is_private && <Badge variant="neutral"><Lock className="size-3" /> Private</Badge>}{s.archived_at && <Badge variant="warning">Archived</Badge>}</>}
                    actions={
                        <>
                            {canManage && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>}
                            {canManage && !s.archived_at && <Button variant="outline" onClick={() => setArchiving(true)}><Archive /> Archive</Button>}
                            {canWrite && <Button asChild><Link to={`/docs/pages/new?space=${id}`}><FilePlus /> New page</Link></Button>}
                        </>
                    }
                />
                <div className="mb-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {s.owner && <span>Owner: {personName(s.owner.user)}</span>}
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {s.members.length} member{s.members.length === 1 ? "" : "s"}</span>
                    {s.require_review_before_publish && <span>Pages are reviewed before publishing</span>}
                </div>
                <Section title="Pages">
                    {pages.isPending ? null : pages.error ? <ErrorState error={pages.error} /> : pages.data?.data.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {pages.data.data.map((pg) => (
                                <Link key={pg.id} to={`/docs/pages/${pg.id}`} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary">
                                    <div className="flex items-center gap-2"><DocIcon icon={pg.icon} /><span className="truncate text-[13px] font-medium text-foreground">{pg.title}</span>{pg.status !== "PUBLISHED" && <DocsStatusBadge status={pg.status} />}</div>
                                    {pg.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pg.excerpt}</p>}
                                    <p className="mt-2 text-xs text-muted-foreground">Updated {formatRelative(pg.last_edited_at ?? pg.updated_at)}</p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-border bg-card">
                            <EmptyState icon={FilePlus} title="No pages in this space" description="Start with an overview page, then nest pages under it." action={canWrite && <Button size="sm" asChild><Link to={`/docs/pages/new?space=${id}`}><FilePlus /> New page</Link></Button>} />
                        </div>
                    )}
                </Section>
            </Page>
            <SpaceFormDialog open={editOpen} onOpenChange={setEditOpen} space={s} />
            <ConfirmationDialog
                isOpen={archiving}
                onClose={() => setArchiving(false)}
                title={`Archive ${s.name}?`}
                description="The space and its pages become read-only and are hidden from Docs home."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archive.mutate(s.id, { onSuccess: () => { toast({ title: "Space archived" }); setArchiving(false); navigate("/docs/spaces"); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })}
            />
        </SpaceLayout>
    );
}
