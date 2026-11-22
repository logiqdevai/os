import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { Editor } from "@tiptap/react";
import {
    Archive, ArchiveRestore, CheckCircle2, Copy, Download, FileText, FileUp, History, ImagePlus, Link2, Lock, MessageSquare, MessageSquarePlus, MoreHorizontal, Star, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { SaveStatus } from "@/components/ui/save-status";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermissions } from "@/hooks/use-permission";
import { useAutosave } from "@/hooks/use-autosave";
import { formatDate, formatRelative } from "@/lib/format";
import { patchEntity } from "@/lib/query/optimistic";
import { cn } from "@/lib/utils";
import * as service from "@/features/docs/services/docs.services";
import { useCreatePage, useDocTemplates, useDuplicatePage, usePage, usePageAction, useRenamePage, useSetFavorite, useUpdatePage, useUploadPageImage } from "@/features/docs/hooks/use-docs";
import type { WikiPageConflict, WikiPageDetail } from "@/features/docs/interfaces/docs.interfaces";
import { BlockEditor } from "../../components/editor/block-editor";
import type { EditorEnv, MentionCandidate } from "../../components/editor/editor-env";
import { ConflictDialog } from "../../components/conflict-dialog";
import { PermissionsPanel } from "../../components/permissions-panel";
import { CommentsPanel, HistoryPanel, LinksPanel } from "../../components/page-panels";
import { ExportDocsDialog, ImportDocsDialog } from "../../components/transfer-dialogs";
import { AddIconButton, apiUrl, PageBreadcrumbs, PageCover, PageIconPicker, PageProperties, pickImageFile } from "../../components/page-chrome";
import { DocIcon } from "../../components/doc-icons";
import { mergeWithMarkers } from "../../utils/line-diff";

type Panel = null | "history" | "comments" | "links" | "permissions";
interface Draft { title: string; content_markdown: string }

/**
 * /docs/pages/:id — the page, Notion-style: always editable in place for editors (read-only for viewers), no draft /
 * publish step. Cover, icon and title on top, a properties row, the block editor, and sub-pages. Title and content
 * autosave together with `base_version_number`; a 409 "page changed" pauses saving and opens the merge prompt.
 * @perm VIEW docs.pages.read + page level · edit docs.pages.update + EDIT level · archive docs.pages.archive · re-acknowledge MANAGE level
 * @api GET/PATCH /docs/pages/:id · POST view|favorite|acknowledge|reacknowledge|archive|trash|duplicate · POST attachments · GET versions|comments|links
 */
export default function DocsPage() {
    const { id = "" } = useParams<{ id: string }>();
    const page = usePage(id);
    if (page.isPending) return <PageSkeleton />;
    if (page.error) return <div className="p-6"><ErrorState error={page.error} onRetry={() => page.refetch()} /></div>;
    return <PageScreen key={page.data.id} pg={page.data} />;
}

function PageScreen({ pg }: { pg: WikiPageDetail }) {
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const qc = useQueryClient();
    const perms = usePermissions();
    const update = useUpdatePage();
    const meta = useRenamePage();
    const action = usePageAction();
    const favorite = useSetFavorite();
    const duplicate = useDuplicatePage();
    const createPage = useCreatePage();
    const upload = useUploadPageImage();
    const editable = pg.can.edit && !pg.archived_at && perms.can("docs.pages.update");

    // ---- Draft + autosave (title + content), optimistic concurrency on the base version ---------------------------------
    const [draft, setDraft] = useState<Draft>({ title: pg.title, content_markdown: pg.content_markdown ?? "" });
    const base = useRef(pg.current_version_number);
    const [conflict, setConflict] = useState<WikiPageConflict | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const hasMarkers = /^<<<<<<< |^>>>>>>> Your changes$/m.test(draft.content_markdown);
    const save = useCallback(async (d: Draft) => {
        try {
            const saved = await update.mutateAsync({ id: pg.id, title: d.title, content_markdown: d.content_markdown, base_version_number: base.current });
            if (typeof saved?.current_version_number === "number") base.current = saved.current_version_number;
            setConflict(null);
        } catch (e) {
            const body = isAxiosError(e) ? (e.response?.data as WikiPageConflict | undefined) : undefined;
            if (isAxiosError(e) && e.response?.status === 409 && body?.code === "wiki_page_version_conflict") setConflict(body);
            throw e;
        }
    }, [pg.id, update]);
    const autosave = useAutosave({ value: draft, save, enabled: editable && !conflict && !hasMarkers, delay: 1200 });
    usePageMetadata({ title: draft.title || "Untitled" });

    // The sidebar, breadcrumbs and lists show the new title while typing (saved with the content).
    const setTitle = (title: string) => {
        setDraft((d) => ({ ...d, title }));
        patchEntity(qc, ["docs"], pg.id, { title });
    };

    // Reader analytics: one view per open (the API de-duplicates).
    useEffect(() => { service.recordView(pg.id).catch(() => undefined); }, [pg.id]);

    // ---- Title ↔ body focus -------------------------------------------------------------------------------------------
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const editorRef = useRef<Editor | null>(null);
    useEffect(() => {
        if (sp.get("new") && editable) {
            titleRef.current?.focus();
            setSp((p) => { p.delete("new"); return p; }, { replace: true });
        }
    }, [sp, setSp, editable]);
    useEffect(() => {
        const t = titleRef.current;
        if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }
    }, [draft.title]);
    const focusBody = () => editorRef.current?.chain().focus("start").run();
    const focusTitle = () => { const t = titleRef.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } };

    // ---- Editor environment: images, mentions, page links, sub-pages ----------------------------------------------------
    const imageUrls = useRef(new Map<string, string>());
    const env = useMemo<EditorEnv>(() => ({
        pageId: pg.id,
        editable,
        resolveAttachment: async (src) => {
            if (/^https?:\/\//.test(src)) return src;
            const m = /^attachment:([0-9a-f-]{36})$/i.exec(src);
            if (!m) return null;
            const cached = imageUrls.current.get(m[1]);
            if (cached) return cached;
            const { url } = await service.getPageImageUrl(pg.id, m[1]);
            imageUrls.current.set(m[1], apiUrl(url));
            return apiUrl(url);
        },
        uploadFile: editable ? async (file) => {
            const res = await upload.mutateAsync({ id: pg.id, file });
            imageUrls.current.set(res.document_id, apiUrl(res.url));
            return res.src;
        } : undefined,
        openPage: ({ id, title }) => {
            if (id) { navigate(`/docs/pages/${id}`); return; }
            void service.searchPages({ q: title, limit: 1 }).then((r) => { const hit = r.data.find((x) => x.title.toLowerCase() === title.toLowerCase()) ?? r.data[0]; if (hit) navigate(`/docs/pages/${hit.id}`); });
        },
        searchMentions: async (query) => {
            const [dir, pages] = await Promise.all([
                service.getDirectory(query || undefined).catch(() => null),
                service.getPages({ search: query || undefined, limit: 6, order_by: "updated_at", order_direction: "desc" }).catch(() => null),
            ]);
            const people: MentionCandidate[] = (dir?.members ?? []).slice(0, 5).map((m) => ({
                kind: "member", id: m.id, label: m.user.display_name || [m.user.first_name, m.user.last_name].filter(Boolean).join(" ") || m.user.email, hint: m.job_title ?? m.user.email,
            }));
            const linked: MentionCandidate[] = (pages?.data ?? []).filter((p) => p.id !== pg.id).map((p) => ({ kind: "page", id: p.id, label: p.title || "Untitled", hint: p.space.name, icon: p.icon }));
            return [...people, ...linked];
        },
        createSubpage: editable && perms.can("docs.pages.create")
            ? () => createPage.mutateAsync({ space_id: pg.space_id, parent_page_id: pg.id, title: "" }).then((c) => ({ id: c.id, title: c.title }))
            : undefined,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [pg.id, pg.space_id, editable]);

    // ---- Cover + icon -------------------------------------------------------------------------------------------------
    // Local preview so a new / removed cover shows at once (the page query refreshes the signed URL later).
    const [coverPreview, setCoverPreview] = useState<string | null | undefined>(undefined);
    const coverUrl = coverPreview !== undefined ? coverPreview : pg.cover_url ? apiUrl(pg.cover_url) : null;
    const setCover = (file: File) => upload.mutate({ id: pg.id, file }, {
        onSuccess: (res) => { setCoverPreview(apiUrl(res.url)); meta.mutate({ id: pg.id, cover_document_id: res.document_id, cover_position: 50 }); },
    });
    const removeCover = () => { setCoverPreview(null); meta.mutate({ id: pg.id, cover_document_id: null }); };

    // ---- Panels, dialogs ---------------------------------------------------------------------------------------------
    const [panel, setPanel] = useState<Panel>(null);
    const [confirm, setConfirm] = useState<null | "trash" | "archive">(null);
    const [transfer, setTransfer] = useState<null | "import" | "export">(null);
    const act = (a: "archive" | "unarchive" | "trash" | "acknowledge" | "reacknowledge") => action.mutate({ id: pg.id, action: a });
    const copyLink = () => void navigator.clipboard?.writeText(`${window.location.origin}/docs/pages/${pg.id}`);

    // ---- Conflict resolution (the newer version becomes the base in every path) -----------------------------------------
    const resolvedBase = conflict?.current_version_number ?? base.current;
    const useTheirs = () => {
        if (!conflict?.latest) return;
        base.current = resolvedBase;
        setDraft({ title: conflict.latest.title, content_markdown: conflict.latest.content_markdown ?? "" });
        setConflict(null);
        setNotice("Loaded the newer version — your unsaved changes were discarded.");
    };
    const keepMine = () => { base.current = resolvedBase; void save(draft).then(() => autosave.retry(), () => undefined); };
    const mergeInEditor = () => {
        if (!conflict?.latest) return;
        const merged = mergeWithMarkers(conflict.latest.content_markdown ?? "", draft.content_markdown, `Version ${conflict.current_version_number}`);
        base.current = resolvedBase;
        setDraft((d) => ({ ...d, content_markdown: merged.text }));
        setConflict(null);
        setNotice(merged.conflicts ? `${merged.conflicts} block(s) to resolve: keep the right lines between <<<<<<< and >>>>>>> and remove the markers — saving resumes then.` : "No differences in the content.");
    };

    // Sub-pages that the content does not link yet show under the content as page rows (Notion's page blocks).
    const linkedIds = useMemo(() => new Set([...draft.content_markdown.matchAll(/\/docs\/pages\/([0-9a-f-]{36})/gi)].map((m) => m[1])), [draft.content_markdown]);
    const subpages = pg.children.filter((c) => !linkedIds.has(c.id));
    const isEmpty = !draft.content_markdown.trim();

    const savingState = conflict
        ? <span role="status" className="text-xs text-warning">Paused — the page changed</span>
        : hasMarkers ? <span role="status" className="text-xs text-warning">Paused — resolve the merge markers</span>
        : autosave.status !== "idle" && autosave.status !== "saved" ? <SaveStatus state={autosave} />
        : <span className="hidden text-xs text-muted-foreground sm:inline">Edited {formatRelative(pg.last_edited_at ?? pg.updated_at)}</span>;

    return (
        <div className="min-h-full bg-background">
            {/* Top bar */}
            <header className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b border-transparent bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4">
                <div className="min-w-0 flex-1"><PageBreadcrumbs page={pg} title={draft.title} /></div>
                {savingState}
                {pg.can.manage && <Button variant="ghost" size="sm" onClick={() => setPanel("permissions")}><Lock /> Share</Button>}
                <Button variant="ghost" size="icon-sm" aria-label={`Comments (${pg.comment_count})`} onClick={() => setPanel("comments")}><MessageSquare /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={pg.is_favorite ? "Remove from favorites" : "Add to favorites"} aria-pressed={pg.is_favorite} onClick={() => favorite.mutate({ id: pg.id, on: !pg.is_favorite })}>
                    <Star className={pg.is_favorite ? "fill-warning text-warning" : ""} />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={copyLink}><Link2 /> Copy link</DropdownMenuItem>
                        {perms.can("docs.pages.create") && <DropdownMenuItem onSelect={() => duplicate.mutate({ id: pg.id }, { onSuccess: (c) => navigate(`/docs/pages/${c.id}`) })}><Copy /> Duplicate</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setPanel("history")}><History /> Version history</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPanel("links")}><Link2 /> Backlinks ({pg.backlink_count})</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPanel("permissions")}><Lock /> Permissions</DropdownMenuItem>
                        {perms.can("docs.pages.export") && <DropdownMenuItem onSelect={() => setTransfer("export")}><Download /> Export as Markdown</DropdownMenuItem>}
                        {editable && perms.can("docs.pages.import") && <DropdownMenuItem onSelect={() => setTransfer("import")}><FileUp /> Import sub-pages</DropdownMenuItem>}
                        {pg.can.archive && (
                            <>
                                <DropdownMenuSeparator />
                                {pg.archived_at ? <DropdownMenuItem onSelect={() => act("unarchive")}><ArchiveRestore /> Unarchive</DropdownMenuItem> : <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>}
                                <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("trash")}><Trash2 /> Move to trash</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>

            {coverUrl && (
                <PageCover url={coverUrl} position={pg.cover_position} editable={editable} uploading={upload.isPending}
                    onChange={setCover} onReposition={(p) => meta.mutate({ id: pg.id, cover_position: p })} onRemove={removeCover} />
            )}

            <div className="mx-auto w-full max-w-[760px] px-6 pb-40 sm:px-14 lg:px-16">
                {/* Icon + hover controls + title */}
                <div className={cn("group/head relative", coverUrl ? (pg.icon ? "-mt-10" : "pt-6") : "pt-16")}>
                    {pg.icon && <PageIconPicker value={pg.icon} editable={editable} onChange={(icon) => meta.mutate({ id: pg.id, icon })} />}
                    {editable && (
                        <div className="flex h-8 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/head:opacity-100">
                            {!pg.icon && <PageIconPicker value={null} editable onChange={(icon) => meta.mutate({ id: pg.id, icon })}><AddIconButton /></PageIconPicker>}
                            {!coverUrl && <button type="button" onClick={() => pickImageFile(setCover)} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><ImagePlus className="size-4" /> Add cover</button>}
                            {pg.can.comment && <button type="button" onClick={() => setPanel("comments")} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><MessageSquarePlus className="size-4" /> Add comment</button>}
                        </div>
                    )}
                    {editable ? (
                        <textarea
                            ref={titleRef}
                            rows={1}
                            value={draft.title}
                            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || (e.key === "ArrowDown" && e.currentTarget.selectionStart === e.currentTarget.value.length)) { e.preventDefault(); focusBody(); }
                                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); autosave.flush(); }
                            }}
                            placeholder="Untitled"
                            aria-label="Page title"
                            maxLength={200}
                            className="mt-1 block w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
                        />
                    ) : <h1 className="mt-1 break-words text-[40px] font-bold leading-tight tracking-tight text-foreground">{draft.title || "Untitled"}</h1>}
                </div>

                <div className="mt-4"><PageProperties page={pg} editable={editable} canManage={pg.can.manage} onPatch={(p) => meta.mutate({ id: pg.id, ...p })} onReacknowledge={() => act("reacknowledge")} /></div>

                {pg.archived_at && <div className="mt-4 rounded-md border border-border bg-secondary px-3 py-2 text-[13px] text-muted-foreground">Archived {formatDate(pg.archived_at)} — read only.{pg.can.archive && <Button variant="link" size="sm" className="h-auto px-1" onClick={() => act("unarchive")}>Unarchive</Button>}</div>}
                <AckBanner page={pg} onAck={() => act("acknowledge")} />
                {notice && (
                    <div role="status" className="mt-4 flex items-start justify-between gap-2 rounded-md border border-border bg-secondary p-3 text-[13px] text-foreground">
                        <span>{notice}</span><Button type="button" variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
                    </div>
                )}

                <div className="mt-6">
                    <BlockEditor
                        value={draft.content_markdown}
                        onChange={(content_markdown) => setDraft((d) => ({ ...d, content_markdown }))}
                        env={env}
                        onSave={() => autosave.flush()}
                        onExitTop={focusTitle}
                        onReady={(e) => { editorRef.current = e; }}
                        placeholder={isEmpty ? "Press Enter to start writing, or pick a template below…" : undefined}
                    />
                </div>

                {editable && isEmpty && <EmptyPageStarter onPick={(md, type) => { setDraft((d) => ({ ...d, content_markdown: md })); if (type && type !== pg.page_type) meta.mutate({ id: pg.id, page_type: type }); }} onImport={perms.can("docs.pages.import") ? () => setTransfer("import") : undefined} />}

                {subpages.length > 0 && (
                    <div className="mt-6 space-y-0.5">
                        {subpages.map((c) => (
                            <Link key={c.id} to={`/docs/pages/${c.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[15px] text-foreground hover:bg-accent">
                                <DocIcon icon={c.icon} className="size-4.5" />
                                <span className="truncate font-medium underline decoration-border underline-offset-4">{c.title || "Untitled"}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <ImportDocsDialog open={transfer === "import"} onOpenChange={(o) => setTransfer(o ? "import" : null)} spaceId={pg.space_id} parentPageId={pg.id} parentTitle={draft.title || "Untitled"} />
            <ExportDocsDialog open={transfer === "export"} onOpenChange={(o) => setTransfer(o ? "export" : null)} spaceId={pg.space_id} pageId={pg.id} />
            <Sheet open={!!panel} onOpenChange={(o) => !o && setPanel(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {panel === "comments" && <CommentsPanel page={pg} />}
                    {panel === "history" && <HistoryPanel page={pg} />}
                    {panel === "links" && <LinksPanel pageId={pg.id} />}
                    {panel === "permissions" && <PermissionsPanel page={pg} />}
                </SheetContent>
            </Sheet>
            <ConflictDialog conflict={conflict} mine={draft} pending={update.isPending} onClose={() => setConflict(null)} onUseTheirs={useTheirs} onKeepMine={keepMine} onMerge={mergeInEditor} />
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm === "trash" ? `Move “${draft.title || "Untitled"}” to trash?` : `Archive “${draft.title || "Untitled"}”?`}
                description={confirm === "trash" ? "The page and its sub-pages go to the trash. You can restore them from Trash." : "Archived pages are read-only and hidden from the sidebar."}
                confirmText={confirm === "trash" ? "Move to trash" : "Archive"}
                variant="destructive"
                onConfirm={() => { if (confirm === "trash") { act("trash"); navigate(pg.parent_page_id ? `/docs/pages/${pg.parent_page_id}` : `/docs/spaces/${pg.space_id}`); } else { act("archive"); setConfirm(null); } }}
            />
        </div>
    );
}

function AckBanner({ page, onAck }: { page: WikiPageDetail; onAck: () => void }) {
    const ack = page.my_acknowledgement;
    if (!page.requires_acknowledgement || !ack) return null;
    if (ack.is_current) return <div className="mt-4 flex items-center gap-2 rounded-md border border-success/40 bg-success-soft px-3 py-2 text-[13px] text-foreground"><CheckCircle2 className="size-4 text-success" /> You confirmed you read this page{ack.acknowledged_at ? ` on ${formatDate(ack.acknowledged_at)}` : ""}.</div>;
    return (
        <div className="mt-4 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground sm:flex-row sm:items-center">
            <span className="flex-1">Please read this page and confirm{ack.required_by ? ` by ${formatDate(ack.required_by)}` : ""}.</span>
            <Button size="sm" onClick={onAck}>I have read this</Button>
        </div>
    );
}

/** Notion's empty-page starter: continue with an empty page, or start from a template / an import. */
function EmptyPageStarter({ onPick, onImport }: { onPick: (markdown: string, pageType?: WikiPageDetail["page_type"]) => void; onImport?: () => void }) {
    const templates = useDocTemplates({ limit: 6 });
    const list = templates.data?.data ?? [];
    if (!list.length && !onImport) return null;
    return (
        <div className="mt-2 space-y-0.5 text-[14px]">
            <p className="px-1.5 pb-1 text-[13px] text-muted-foreground">Get started with</p>
            {list.map((t) => (
                <button key={t.id} type="button" onClick={() => onPick(t.content_markdown ?? "", t.page_type)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-muted-foreground hover:bg-accent hover:text-foreground">
                    <DocIcon icon={t.icon ?? "file-text"} /> {t.name}
                </button>
            ))}
            {onImport && <button type="button" onClick={onImport} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-muted-foreground hover:bg-accent hover:text-foreground"><FileUp className="size-4" /> Import Markdown</button>}
            <Link to="/docs/templates" className="flex items-center gap-2 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"><FileText className="size-4" /> All templates</Link>
        </div>
    );
}
