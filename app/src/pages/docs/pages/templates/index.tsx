import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LayoutTemplate, Plus, Search, Sparkles, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { WikiPageTypeFormOptions, WikiTemplateCategoryFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useArchiveDocTemplate, useCreateDocTemplate, useDocTemplates, useUpdateDocTemplate } from "@/features/docs/hooks/use-docs";
import type { WikiPageType, WikiTemplate, WikiTemplateCategory } from "@/features/docs/interfaces/docs.interfaces";
import { DocIconPicker } from "../../components/doc-icons";
import { TemplateCard } from "./template-card";
import { TemplatePreviewDialog } from "./template-preview-dialog";
import { CATEGORY_ICONS, matchesSearch } from "./template-utils";

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/**
 * /docs/templates?category=&q= — Notion's template gallery (15 §3): search, category chips, a "Featured" row, the
 * organization's own templates, then one row per category. Cards open a full preview with "Use template".
 * Built-in templates are platform templates (read-only; "Duplicate to edit"); organization templates are created here
 * or from a page with "Save as template" (e.g. a Notion template brought in with Import).
 * @perm VIEW docs.pages.read · use docs.pages.create · manage docs.spaces.manage
 * @api GET /docs/templates · POST/PATCH /docs/templates · POST /docs/templates/:id/{duplicate,archive} · POST /docs/pages
 * @mcp docs_templates_list · docs_templates_get · docs_templates_create_from_page · docs_pages_create
 */
export default function DocTemplatesPage() {
    const [sp, setSp] = useSearchParams();
    const category = (sp.get("category") as WikiTemplateCategory | null) ?? null;
    const q = sp.get("q") ?? "";
    const setParam = (key: string, value: string | null) => setSp((p) => { if (value) p.set(key, value); else p.delete(key); return p; }, { replace: true });

    // The whole gallery in one request (built-in + organization, a few dozen rows); search and chips filter instantly.
    const templates = useDocTemplates({ limit: 200 });
    const canManage = usePermission("docs.spaces.manage");
    const archive = useArchiveDocTemplate();
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [editing, setEditing] = useState<WikiTemplate | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [archiving, setArchiving] = useState<WikiTemplate | null>(null);

    const all = useMemo(() => templates.data?.data ?? [], [templates.data]);
    const label = (c: WikiTemplateCategory) => getDropdownOptionLabel(WikiTemplateCategoryFormOptions, c);
    const present = WikiTemplateCategoryFormOptions.filter((o) => all.some((t) => t.category === o.id));
    const filtered = all.filter((t) => (!category || t.category === category) && matchesSearch(t, q, label(t.category)));
    const browsing = !category && !q.trim();
    const preview = all.find((t) => t.id === previewId) ?? null;
    const edit = (t: WikiTemplate | null) => { setPreviewId(null); setEditing(t); setDialogOpen(true); };

    return (
        <Page width="wide">
            <PageHeader
                title="Templates"
                description="Start any page from a proven structure: wikis, meeting notes, project briefs, postmortems and more."
                actions={canManage && <Button onClick={() => edit(null)}><Plus /> New template</Button>}
            />

            {/* Search + category chips */}
            <div className="mb-8 space-y-4">
                <div className="relative max-w-2xl">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input value={q} onChange={(e) => setParam("q", e.target.value || null)} placeholder="Describe the template you need…" aria-label="Search templates" className="h-11 rounded-xl pl-10 pr-10 text-[15px]" />
                    {q && <button type="button" onClick={() => setParam("q", null)} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
                </div>
                <div role="tablist" aria-label="Template categories" className="flex flex-wrap gap-2">
                    <Chip active={!category} onClick={() => setParam("category", null)} icon={Sparkles}>All</Chip>
                    {present.map((o) => <Chip key={o.id} active={category === o.id} onClick={() => setParam("category", category === o.id ? null : o.id)} icon={CATEGORY_ICONS[o.id]}>{o.label}</Chip>)}
                </div>
            </div>

            {templates.error ? (
                <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
            ) : templates.isLoading ? (
                <div className={GRID}>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[17rem] rounded-xl" />)}</div>
            ) : !all.length ? (
                <EmptyState icon={LayoutTemplate} title="No templates yet" description="Templates give new pages a consistent structure." action={canManage && <Button onClick={() => edit(null)}><Plus /> New template</Button>} />
            ) : browsing ? (
                <div className="space-y-10">
                    <Section title="Featured" items={all.filter((t) => t.is_featured).slice(0, 8)} onOpen={(t) => setPreviewId(t.id)} />
                    <Section title="From your organization" items={all.filter((t) => !t.is_system)} onOpen={(t) => setPreviewId(t.id)} />
                    {present.map((o) => {
                        const items = all.filter((t) => t.category === o.id);
                        return <Section key={o.id} title={o.label} icon={CATEGORY_ICONS[o.id]} items={items.slice(0, 4)} total={items.length} onSeeAll={() => setParam("category", o.id)} onOpen={(t) => setPreviewId(t.id)} />;
                    })}
                </div>
            ) : filtered.length ? (
                <>
                    <p className="mb-3 text-[13px] text-muted-foreground">{filtered.length === 1 ? "1 template" : `${filtered.length} templates`}{category ? ` in ${label(category)}` : ""}{q ? ` matching “${q}”` : ""}</p>
                    <div className={GRID}>{filtered.map((t) => <TemplateCard key={t.id} template={t} onOpen={(x) => setPreviewId(x.id)} />)}</div>
                </>
            ) : (
                <EmptyState icon={Search} title="No templates found" description="Try another word or category." action={<Button variant="outline" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Clear filters</Button>} />
            )}

            <TemplatePreviewDialog template={preview} onOpenChange={(o) => !o && setPreviewId(null)} onEdit={edit} onArchive={(t) => { setPreviewId(null); setArchiving(t); }} />
            <TemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} template={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Existing pages keep their content; the template is no longer offered."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { if (archiving) archive.mutate(archiving.id); setArchiving(null); }}
            />
        </Page>
    );
}

function Chip({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <button type="button" role="tab" aria-selected={active} onClick={onClick}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-accent")}>
            <Icon className="size-3.5" /> {children}
        </button>
    );
}

function Section({ title, icon: Icon, items, total, onSeeAll, onOpen }: {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    items: WikiTemplate[];
    total?: number;
    onSeeAll?: () => void;
    onOpen: (t: WikiTemplate) => void;
}) {
    if (!items.length) return null;
    return (
        <section aria-label={title}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">{Icon && <Icon className="size-4 text-muted-foreground" />}{title}</h2>
                {onSeeAll && total !== undefined && total > items.length && <Button variant="link" size="sm" onClick={onSeeAll}>See all {total}</Button>}
            </div>
            <div className={GRID}>{items.map((t) => <TemplateCard key={t.id} template={t} onOpen={onOpen} />)}</div>
        </section>
    );
}

const schema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    icon: z.string().max(16).optional(),
    description: z.string().max(1000).optional(),
    page_type: z.string(),
    category: z.string(),
    is_featured: z.boolean(),
    content_markdown: z.string().max(200_000),
});
type Values = z.infer<typeof schema>;

/** New template: explicit "Create template". Edit: valid changes autosave (optimistic, <SaveStatus />); "Done" closes. */
function TemplateDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (o: boolean) => void; template: WikiTemplate | null }) {
    const create = useCreateDocTemplate();
    const update = useUpdateDocTemplate();
    const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", icon: "", description: "", page_type: "GENERAL", category: "OTHER", is_featured: false, content_markdown: "" } });
    // Reset when the dialog opens or another template is opened — not when the (optimistically patched) template changes.
    const templateId = template?.id ?? null;
    useEffect(() => {
        if (open) form.reset({ name: template?.name ?? "", icon: template?.icon ?? "", description: template?.description ?? "", page_type: template?.page_type ?? "GENERAL", category: template?.category ?? "OTHER", is_featured: template?.is_featured ?? false, content_markdown: template?.content_markdown ?? "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, templateId, form]);
    const pending = create.isPending;
    const toDto = (v: Values) => ({ ...v, page_type: v.page_type as WikiPageType, category: v.category as WikiTemplateCategory, icon: v.icon || undefined, description: v.description || undefined });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: templateId as string, ...toDto(v) }), { enabled: open && !!templateId });
    const submit = form.handleSubmit((v) => {
        if (template) { autosave.flush(); onOpenChange(false); return; }
        create.mutate(toDto(v), { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Markdown content copied into new pages.{template ? " Changes save automatically." : ""}</DialogDescription></DialogHeader>
                        <div className="grid grid-cols-[72px_1fr] gap-3">
                            <FormField control={form.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><FormControl><DocIconPicker value={field.value} onChange={field.onChange} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gallery category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Gallery category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WikiTemplateCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="page_type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Page type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Page type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WikiPageTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="Shown on the gallery card" /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="is_featured" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                                <div><FormLabel>Featured</FormLabel><FormDescription>Show it in the gallery's Featured row.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="content_markdown" render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><Textarea rows={12} className="font-mono text-xs" placeholder={"## Purpose\n\n## Steps\n1. "} {...field} /></FormControl><FormDescription>Tip: build the page in Docs with all the blocks you need, then use "Save as template" from the page menu.</FormDescription><FormMessage /></FormItem>)} />
                        {template ? (
                            <DialogFooter className="items-center sm:justify-between">
                                <SaveStatus state={autosave} />
                                <Button type="submit" variant="outline">Done</Button>
                            </DialogFooter>
                        ) : (
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}>Create template</Button>
                            </DialogFooter>
                        )}
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
