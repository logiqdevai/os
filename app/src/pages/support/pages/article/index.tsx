import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Eye, Send, Trash2, Undo2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAutosave } from "@/hooks/use-autosave";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { KnowledgeStatusOptions, KnowledgeStatusTone, KnowledgeVisibilityOptions } from "@/config/constants/dropdowns/support/support.options";
import {
    useArchiveArticle,
    useArticle,
    useCreateArticle,
    useDeleteArticle,
    useKnowledgeCategories,
    usePublishArticle,
    useSubmitArticleReview,
    useUnpublishArticle,
    useUpdateArticle,
} from "@/features/support/hooks/use-support";
import { articleFormSchema, type ArticleFormValues } from "@/features/support/validation-schemas/support.schema";
import type { ArticleDetail } from "@/features/support/interfaces/support.interfaces";
import { SUPPORT_PATHS } from "../../support-paths";

const NONE = "__none";

const toArticleDto = (v: ArticleFormValues) => ({
    title: v.title.trim(),
    summary: v.summary || undefined,
    body: v.body,
    category_id: v.category_id && v.category_id !== NONE ? v.category_id : null,
    visibility: v.visibility,
    is_faq: v.is_faq,
    keywords: (v.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean),
});

/**
 * Article editor — /support/knowledge/new and /support/knowledge/:articleId (mockup 13-support `article`).
 * @perm create support.knowledge.create · edit .update · publish .publish* · archive .archive · delete .delete*
 */
export default function ArticleEditorPage() {
    const { articleId } = useParams();
    const isNew = !articleId || articleId === "new";
    const article = useArticle(isNew ? undefined : articleId);
    if (!isNew && article.isLoading) return <PageSkeleton />;
    if (!isNew && (article.error || !article.data)) return <Page><ErrorState error={article.error} onRetry={() => article.refetch()} /></Page>;
    return <Editor article={isNew ? null : article.data ?? null} />;
}

function Editor({ article }: { article: ArticleDetail | null }) {
    const navigate = useNavigate();
    const categories = useKnowledgeCategories();
    const create = useCreateArticle();
    const update = useUpdateArticle();
    const publish = usePublishArticle();
    const unpublish = useUnpublishArticle();
    const review = useSubmitArticleReview();
    const archive = useArchiveArticle();
    const remove = useDeleteArticle();
    const canEdit = usePermission(article ? "support.knowledge.update" : "support.knowledge.create");
    const [preview, setPreview] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const form = useForm<ArticleFormValues>({ resolver: zodResolver(articleFormSchema), mode: "onChange", defaultValues: { title: "", summary: "", body: "", category_id: NONE, visibility: "PUBLIC", is_faq: false, keywords: "", change_note: "" } });

    useEffect(() => {
        form.reset({
            title: article?.title ?? "",
            summary: article?.summary ?? "",
            body: article?.body ?? "",
            category_id: article?.category_id ?? NONE,
            visibility: article?.visibility ?? "PUBLIC",
            is_faq: article?.is_faq ?? false,
            keywords: article?.keywords.join(", ") ?? "",
            change_note: "",
        });
        // Only when another article opens: the refresh after each autosave must not reset what is being typed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [article?.id, form]);

    // Existing articles save their draft as you edit (no Save button); every content change becomes a version, so the
    // delay is longer than usual. The change note travels with the next save and is then cleared. Publish stays a button.
    const json = JSON.stringify(form.watch());
    const values = useMemo(() => JSON.parse(json) as ArticleFormValues, [json]);
    const valid = articleFormSchema.safeParse(values).success;
    const dto = useMemo(() => toArticleDto(values), [values]);
    const autosave = useAutosave({
        value: dto,
        delay: 1500,
        enabled: !!article && canEdit && valid && form.formState.isDirty,
        save: async (d) => {
            const note = form.getValues("change_note");
            await update.mutateAsync({ id: (article as ArticleDetail).id, ...d, change_note: note || undefined });
            if (note && form.getValues("change_note") === note) form.setValue("change_note", "");
        },
    });
    const unsaved = autosave.status === "pending" || autosave.status === "saving";

    const save = form.handleSubmit((v) => {
        if (article) return autosave.flush();
        create.mutate(toArticleDto(v), { onSuccess: (a) => navigate(SUPPORT_PATHS.article(a.id), { replace: true }) });
    });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: SUPPORT_PATHS.knowledge, label: "Help center" }}
                title={article ? article.title : "New article"}
                meta={article && <><Badge variant={KnowledgeStatusTone[article.status]}>{getDropdownOptionLabel(KnowledgeStatusOptions, article.status)}</Badge><SaveStatus state={autosave} /></>}
                description={article ? `Version ${article.current_version} · updated ${formatDateTime(article.updated_at)}` : "Drafts are visible only to your team until published."}
                actions={
                    article && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}><Eye /> {preview ? "Edit" : "Preview"}</Button>
                            {article.status === "DRAFT" && (
                                <Can permission="support.knowledge.update">
                                    <Button variant="outline" size="sm" disabled={unsaved} onClick={() => review.mutate(article.id)}>Send for review</Button>
                                </Can>
                            )}
                            <Can permission="support.knowledge.publish">
                                {article.status === "PUBLISHED" ? (
                                    <Button variant="outline" size="sm" onClick={() => unpublish.mutate(article.id)}><Undo2 /> Unpublish</Button>
                                ) : (
                                    <Button size="sm" disabled={unsaved} title={unsaved ? "Saving your latest changes…" : undefined} onClick={() => publish.mutate(article.id)}><Send /> Publish</Button>
                                )}
                            </Can>
                            <Can permission="support.knowledge.archive">
                                {article.status !== "ARCHIVED" && <Button variant="ghost" size="icon-sm" aria-label="Archive" onClick={() => { autosave.flush(); archive.mutate(article.id); navigate(SUPPORT_PATHS.knowledge); }}><Archive /></Button>}
                            </Can>
                            <Can permission="support.knowledge.delete">
                                <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(true)}><Trash2 /></Button>
                            </Can>
                        </>
                    )
                }
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <Form {...form}>
                    <form onSubmit={save} className="min-w-0 space-y-4">
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Title</FormLabel><FormControl><Input disabled={!canEdit} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="summary" render={({ field }) => (
                            <FormItem><FormLabel>Summary</FormLabel><FormControl><Input disabled={!canEdit} placeholder="One line shown in search results" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="body" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Content</FormLabel>
                                {preview ? (
                                    <div className="min-h-64 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-[14px] leading-relaxed text-foreground">{field.value || "Nothing written yet."}</div>
                                ) : (
                                    <FormControl><Textarea rows={18} disabled={!canEdit} className="font-mono text-[13px]" placeholder="Write in Markdown…" {...field} /></FormControl>
                                )}
                                <FormMessage />
                            </FormItem>
                        )} />
                        {article && (
                            <FormField control={form.control} name="change_note" render={({ field }) => (
                                <FormItem><FormLabel>Change note</FormLabel><FormControl><Input disabled={!canEdit} placeholder="What changed (saved with the next version)" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        )}
                        {!article && (
                            <>
                                {create.error && <p role="alert" className="text-[13px] text-danger">{getApiErrorMessage(create.error)}</p>}
                                <div className="flex justify-end gap-2">
                                    <Button type="submit" loading={create.isPending} disabled={!canEdit}>Create draft</Button>
                                </div>
                            </>
                        )}
                    </form>
                </Form>
                <aside className="space-y-5">
                    <Form {...form}>
                        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                            <FormField control={form.control} name="category_id" render={({ field }) => (
                                <FormItem><FormLabel>Category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}><FormControl><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value={NONE}>Uncategorized</SelectItem>{categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="visibility" render={({ field }) => (
                                <FormItem><FormLabel>Visibility</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}><FormControl><SelectTrigger aria-label="Visibility"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{KnowledgeVisibilityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                    <FormDescription>Clients-only articles appear in the portal help section.</FormDescription></FormItem>
                            )} />
                            <FormField control={form.control} name="is_faq" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3"><FormLabel>Show in FAQ</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="keywords" render={({ field }) => (
                                <FormItem><FormLabel>Keywords</FormLabel><FormControl><Input disabled={!canEdit} placeholder="password, login, reset" {...field} /></FormControl><FormDescription>Comma-separated; helps search and reply suggestions.</FormDescription></FormItem>
                            )} />
                        </div>
                    </Form>
                    {article && (
                        <>
                            <Section title="Feedback">
                                <p className="text-[13px] text-muted-foreground"><span className="tabular text-foreground">{article.view_count}</span> views · <span className="tabular text-success">{article.helpful_count}</span> helpful · <span className="tabular text-danger">{article.not_helpful_count}</span> not helpful</p>
                                {article.help_center_path && <p className="break-all text-xs text-muted-foreground">Public: {article.help_center_path}</p>}
                            </Section>
                            <Section title="Versions">
                                <ol className="space-y-1.5 text-[13px]">
                                    {article.versions.map((v) => (
                                        <li key={v.id} className="flex justify-between gap-2">
                                            <span className="truncate">v{v.version} {v.change_note ? `· ${v.change_note}` : ""}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </Section>
                        </>
                    )}
                </aside>
            </div>
            {article && (
                <ConfirmationDialog
                    isOpen={deleting}
                    onClose={() => setDeleting(false)}
                    title={`Delete "${article.title}"?`}
                    description="The article and all its versions are deleted permanently. Archive it instead to keep the history."
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={() => { remove.mutate(article.id); navigate(SUPPORT_PATHS.knowledge); }}
                />
            )}
        </Page>
    );
}
