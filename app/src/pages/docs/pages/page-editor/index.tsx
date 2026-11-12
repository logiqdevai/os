import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bold, Check, Code, Heading2, Italic, Link2, List, ListChecks, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/ui/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { isAxiosError } from "axios";
import { ConflictDialog } from "./components/conflict-dialog";
import { mergeWithMarkers } from "../../utils/line-diff";
import { WikiPageTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCreatePage, useDocTemplates, usePage, useSpaces, useUpdatePage } from "@/features/docs/hooks/use-docs";
import type { WikiPageConflict, WikiPageType } from "@/features/docs/interfaces/docs.interfaces";

const NONE = "__none";
const schema = z.object({
    title: z.string().trim().min(1, "Give the page a title").max(200),
    icon: z.string().max(8).optional(),
    space_id: z.string().min(1, "Choose a space"),
    page_type: z.string(),
    template_id: z.string().optional(),
    content_markdown: z.string().max(500_000),
    review_interval_days: z.string().regex(/^\d*$/, "Days as a number").optional(),
    requires_acknowledgement: z.boolean(),
    change_summary: z.string().max(500).optional(),
    publish: z.boolean(),
});
type Values = z.infer<typeof schema>;

/**
 * /docs/pages/new?space=&parent= · /docs/pages/:id/edit — Markdown editor with live preview (15 §3).
 * New page: explicit "Create page". Existing page: autosaves (no Save button) with `base_version_number`; a 409
 * "page changed" stops autosaving and opens the merge prompt. Each content save writes a version; publishing (on the
 * page view) makes it the published snapshot.
 * @perm create docs.pages.create · edit docs.pages.update + EDIT level · publish docs.pages.publish
 * @api POST /docs/pages · PATCH /docs/pages/:id · POST /docs/pages/:id/publish
 */
export default function PageEditorPage() {
    const { id } = useParams<{ id: string }>();
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const p = usePermissions();
    const page = usePage(id);
    const spaces = useSpaces({ limit: 200 });
    const templates = useDocTemplates({ limit: 100 });
    const create = useCreatePage();
    const update = useUpdatePage();
    const textRef = useRef<HTMLTextAreaElement>(null);
    const [tab, setTab] = useState("write");
    const parent = sp.get("parent") ?? undefined;
    // Optimistic concurrency: the version this editor is based on (set once on load, then moved forward by every save and
    // by resolving a conflict; refetches never reset the draft). A ref so back-to-back autosaves send the newest base.
    const [baseVersion, setBaseVersionState] = useState<number | null>(null);
    const baseRef = useRef<number | null>(null);
    const setBaseVersion = (n: number | null) => { baseRef.current = n; setBaseVersionState(n); };
    const [conflict, setConflict] = useState<WikiPageConflict | null>(null);
    /** Inline note after resolving a conflict (instead of a toast). */
    const [notice, setNotice] = useState<string | null>(null);

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", icon: "", space_id: sp.get("space") ?? "", page_type: "GENERAL", template_id: sp.get("template") ?? NONE, content_markdown: "", review_interval_days: "", requires_acknowledgement: false, change_summary: "", publish: false },
    });
    // ?template=<id> (from the Templates page): prefill content and type once the templates are loaded.
    useEffect(() => {
        const t = !id && sp.get("template") ? templates.data?.data.find((x) => x.id === sp.get("template")) : null;
        if (t && !form.getValues("content_markdown").trim()) {
            form.setValue("content_markdown", t.content_markdown ?? "");
            form.setValue("page_type", t.page_type);
        }
    }, [id, sp, templates.data, form]);
    useEffect(() => {
        if (page.data && baseVersion === null) {
            const pg = page.data;
            baseRef.current = pg.current_version_number;
            setBaseVersionState(pg.current_version_number);
            form.reset({ title: pg.title, icon: pg.icon ?? "", space_id: pg.space_id, page_type: pg.page_type, template_id: NONE, content_markdown: pg.content_markdown ?? "", review_interval_days: pg.review_interval_days ? String(pg.review_interval_days) : "", requires_acknowledgement: pg.requires_acknowledgement, change_summary: "", publish: false });
        }
    }, [page.data, form, baseVersion]);

    const content = form.watch("content_markdown");
    const words = useMemo(() => (content.trim() ? content.trim().split(/\s+/).length : 0), [content]);
    const hasMarkers = /^<<<<<<< |^>>>>>>> Your changes$/m.test(content);
    const pending = create.isPending;

    /** PATCH body of the edit form (only the fields this editor owns). */
    const toPatch = (v: Values) => ({
        title: v.title, icon: v.icon || undefined, page_type: v.page_type as WikiPageType, content_markdown: v.content_markdown,
        review_interval_days: v.review_interval_days ? Number(v.review_interval_days) : undefined, requires_acknowledgement: v.requires_acknowledgement, change_summary: v.change_summary || undefined,
    });
    /** Save on top of `baseRef`; a 409 opens the merge prompt (and autosave pauses until it is resolved). */
    const saveExisting = async (v: Values) => {
        try {
            const saved = await update.mutateAsync({ id: id as string, ...toPatch(v), base_version_number: baseRef.current ?? undefined });
            if (typeof saved?.current_version_number === "number") setBaseVersion(saved.current_version_number);
            setConflict(null);
        } catch (e) {
            const body = isAxiosError(e) ? (e.response?.data as WikiPageConflict | undefined) : undefined;
            if (isAxiosError(e) && e.response?.status === 409 && body?.code === "wiki_page_version_conflict") setConflict(body);
            throw e;
        }
    };
    // Autosave the existing page: paused while the merge prompt is open or merge markers are left in the content.
    // A longer quiet period than the default, because every content save writes a page version.
    const autosave = useFormAutosave(form, saveExisting, { enabled: !!id && baseVersion !== null && !conflict && !hasMarkers, delay: 2500 });
    const canCreate = p.can("docs.pages.create");
    const canPublish = p.can("docs.pages.publish");

    if (id ? !p.can("docs.pages.update") : !canCreate) return <Page><NoAccessState /></Page>;
    if (id && page.isPending) return <PageSkeleton />;
    if (page.error) return <Page><ErrorState error={page.error} onRetry={() => page.refetch()} /></Page>;
    if (page.data && !page.data.can.edit) return <Page><NoAccessState description="You can read this page but not edit it." /></Page>;

    const wrap = (before: string, after = before, placeholder = "text") => {
        const el = textRef.current;
        if (!el) return;
        const { selectionStart: s, selectionEnd: e, value } = el;
        const sel = value.slice(s, e) || placeholder;
        const next = value.slice(0, s) + before + sel + after + value.slice(e);
        form.setValue("content_markdown", next, { shouldDirty: true });
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
    };
    const linePrefix = (prefix: string) => {
        const el = textRef.current;
        if (!el) return;
        const { selectionStart: s, value } = el;
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        form.setValue("content_markdown", value.slice(0, lineStart) + prefix + value.slice(lineStart), { shouldDirty: true });
        requestAnimationFrame(() => el.focus());
    };

    const createNew = (v: Values) => {
        const review = v.review_interval_days ? Number(v.review_interval_days) : undefined;
        create.mutate(
            {
                space_id: v.space_id, parent_page_id: parent, title: v.title, icon: v.icon || undefined, page_type: v.page_type as WikiPageType,
                template_id: v.template_id && v.template_id !== NONE ? v.template_id : undefined,
                content_markdown: v.template_id && v.template_id !== NONE && !v.content_markdown.trim() ? undefined : v.content_markdown,
                review_interval_days: review, requires_acknowledgement: v.requires_acknowledgement, publish: canPublish && v.publish,
            },
            { onSuccess: (created) => navigate(`/docs/pages/${created.id}`) },
        );
    };
    /** New page: create it. Existing page: "Done" / ⌘S — save what is pending now, then go back to the page. */
    const submit = form.handleSubmit((v) => {
        if (!id) return createNew(v);
        if (conflict || hasMarkers) return;
        autosave.flush();
        navigate(`/docs/pages/${id}`);
    });
    const saveNow = () => { if (id) autosave.flush(); else void submit(); };

    // Conflict resolution: the newer version becomes the new base in every path.
    const resolvedBase = conflict?.current_version_number ?? baseVersion;
    const useTheirs = () => {
        if (!conflict?.latest) return;
        form.setValue("title", conflict.latest.title, { shouldDirty: true });
        form.setValue("content_markdown", conflict.latest.content_markdown ?? "", { shouldDirty: true });
        setBaseVersion(resolvedBase);
        setConflict(null);
        setNotice("Loaded the newer version — your unsaved changes were discarded.");
    };
    const keepMine = () => {
        setBaseVersion(resolvedBase);
        void saveExisting(form.getValues()).then(() => autosave.retry(), () => undefined);
    };
    const mergeInEditor = () => {
        if (!conflict?.latest) return;
        const merged = mergeWithMarkers(conflict.latest.content_markdown ?? "", form.getValues("content_markdown"), `Version ${conflict.current_version_number}`);
        form.setValue("content_markdown", merged.text, { shouldDirty: true });
        setBaseVersion(resolvedBase);
        setConflict(null);
        setTab("write");
        setNotice(merged.conflicts ? `${merged.conflicts} block(s) to resolve: keep the right lines between <<<<<<< and >>>>>>> and remove the markers — saving resumes then.` : "No differences in the content.");
    };

    return (
        <Page width="wide">
            <PageHeader
                title={id ? "Edit page" : "New page"}
                back={{ to: id ? `/docs/pages/${id}` : sp.get("space") ? `/docs/spaces/${sp.get("space")}` : "/docs", label: "Back" }}
                meta={id ? (conflict ? <span role="status" className="text-xs text-warning">Paused — the page changed</span> : hasMarkers ? <span role="status" className="text-xs text-warning">Paused — resolve the merge markers</span> : <SaveStatus state={autosave} />) : undefined}
                description={id ? (page.data?.status === "PUBLISHED" ? "Changes save automatically as new versions. Readers see the published version until you publish again." : "Changes save automatically.") : undefined}
            />
            <Form {...form}>
                <form onSubmit={submit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
                        <FormField control={form.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><FormControl><Input placeholder="📄" maxLength={8} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input autoFocus placeholder="How we run client onboarding" className="text-base" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {!id && (
                            <FormField control={form.control} name="space_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Space</FormLabel>
                                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                                        <FormControl><SelectTrigger aria-label="Space"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Choose a space</SelectItem>
                                            {spaces.data?.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="page_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{WikiPageTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        {!id && (
                            <FormField control={form.control} name="template_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Template</FormLabel>
                                    <Select
                                        value={field.value ?? NONE}
                                        onValueChange={(v) => {
                                            field.onChange(v);
                                            const t = templates.data?.data.find((x) => x.id === v);
                                            if (t) {
                                                if (!form.getValues("content_markdown").trim()) form.setValue("content_markdown", t.content_markdown ?? "");
                                                form.setValue("page_type", t.page_type);
                                            }
                                        }}
                                    >
                                        <FormControl><SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Blank page</SelectItem>
                                            {templates.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                    </div>

                    <Tabs value={tab} onValueChange={setTab}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <TabsList>
                                <TabsTrigger value="write">Write</TabsTrigger>
                                <TabsTrigger value="preview">Preview</TabsTrigger>
                            </TabsList>
                            {tab === "write" && (
                                <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Heading" onClick={() => linePrefix("## ")}><Heading2 /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Bold" onClick={() => wrap("**")}><Bold /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Italic" onClick={() => wrap("*")}><Italic /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Code" onClick={() => wrap("`")}><Code /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Bulleted list" onClick={() => linePrefix("- ")}><List /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Checklist" onClick={() => linePrefix("- [ ] ")}><ListChecks /></Button>
                                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Link to a page" onClick={() => wrap("[[", "]]", "Page title")}><Link2 /></Button>
                                </div>
                            )}
                        </div>
                        <TabsContent value="write">
                            <FormField control={form.control} name="content_markdown" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            ref={(el) => { field.ref(el); textRef.current = el; }}
                                            rows={22}
                                            className="min-h-[50vh] font-mono text-[13px] leading-relaxed"
                                            placeholder={"# Overview\n\nWrite in Markdown. Link pages with [[Page title]]."}
                                            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveNow(); } }}
                                        />
                                    </FormControl>
                                    <FormDescription>{words} words · Markdown{id ? " · saves automatically (⌘/Ctrl + S saves now)" : ""}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </TabsContent>
                        <TabsContent value="preview">
                            <div className="min-h-[50vh] rounded-lg border border-border bg-card p-4 sm:p-6">{content.trim() ? <Markdown source={content} /> : <p className="text-[13px] text-muted-foreground">Nothing to preview yet.</p>}</div>
                        </TabsContent>
                    </Tabs>

                    <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                        <FormField control={form.control} name="review_interval_days" render={({ field }) => (<FormItem><FormLabel>Review every (days)</FormLabel><FormControl><Input inputMode="numeric" placeholder="e.g. 180" {...field} /></FormControl><FormDescription>The owner is reminded when the page is due for review.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="requires_acknowledgement" render={({ field }) => (<FormItem className="flex items-start justify-between gap-4"><div><FormLabel>Readers must acknowledge</FormLabel><FormDescription>For policies: members confirm they read each published version.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        {id ? (
                            <FormField control={form.control} name="change_summary" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>What changed?</FormLabel><FormControl><Input placeholder="Updated the escalation contacts" {...field} /></FormControl></FormItem>)} />
                        ) : canPublish && (
                            <FormField control={form.control} name="publish" render={({ field }) => (<FormItem className="flex items-start justify-between gap-4"><div><FormLabel>Publish now</FormLabel><FormDescription>Otherwise the page stays a draft.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        )}
                    </div>

                    {notice && (
                        <div role="status" className="flex items-start justify-between gap-2 rounded-lg border border-border bg-secondary p-3 text-[13px] text-foreground">
                            <span>{notice}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
                        </div>
                    )}
                    {hasMarkers && (
                        <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-[13px] text-foreground">
                            The content still has merge markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt; / =======  / &gt;&gt;&gt;&gt;&gt;&gt;&gt;). Resolve each block — autosave resumes when they are gone.
                        </div>
                    )}
                    <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end md:-mx-6 md:px-6">
                        {id ? (
                            <Button type="submit" variant="outline" disabled={!!conflict || hasMarkers}><Check /> Done</Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}><Save /> Create page</Button>
                            </>
                        )}
                    </div>
                </form>
            </Form>
            <ConflictDialog
                conflict={conflict}
                mine={{ title: form.watch("title"), content_markdown: content }}
                pending={update.isPending}
                onClose={() => setConflict(null)}
                onUseTheirs={useTheirs}
                onKeepMine={keepMine}
                onMerge={mergeInEditor}
            />
        </Page>
    );
}
