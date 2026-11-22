import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { WikiTemplateCategoryFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCreateTemplateFromPage } from "@/features/docs/hooks/use-docs";
import type { WikiTemplate, WikiTemplateCategory } from "@/features/docs/interfaces/docs.interfaces";

const schema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    description: z.string().max(1000).optional(),
    category: z.string(),
    is_featured: z.boolean(),
});
type Values = z.infer<typeof schema>;

/**
 * Page menu → "Save as template" (15 §3): copies the page (title, icon, type, all blocks) into an organization template
 * that shows in the gallery. This is how a Notion template brought in with Import becomes reusable for everyone.
 * @perm docs.spaces.manage (+ read access to the page) @api POST /docs/templates/from-page @mcp docs_templates_create_from_page
 * @audit wiki_template.created · wiki_template.saved_from_page
 */
export function SaveAsTemplateDialog({ open, onOpenChange, page }: { open: boolean; onOpenChange: (o: boolean) => void; page: { id: string; title: string } }) {
    const save = useCreateTemplateFromPage();
    const [saved, setSaved] = useState<WikiTemplate | null>(null);
    const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "", category: "OTHER", is_featured: false } });
    useEffect(() => {
        if (open) { setSaved(null); form.reset({ name: page.title || "Untitled", description: "", category: "OTHER", is_featured: false }); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, page.id]);
    const submit = form.handleSubmit((v) => save.mutate(
        { page_id: page.id, name: v.name, description: v.description || undefined, category: v.category as WikiTemplateCategory, is_featured: v.is_featured },
        { onSuccess: setSaved },
    ));

    return (
        <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                {saved ? (
                    <>
                        <DialogHeader>
                            <div className="mb-1 grid size-10 place-items-center rounded-full bg-success-soft text-success"><Check className="size-5" /></div>
                            <DialogTitle>Saved as template</DialogTitle>
                            <DialogDescription>“{saved.name}” is now in the template gallery for everyone in your organization. Later changes to this page do not change the template.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                            <Button asChild><Link to={`/docs/templates?q=${encodeURIComponent(saved.name)}`} onClick={() => onOpenChange(false)}><LayoutTemplate /> View in gallery</Link></Button>
                        </DialogFooter>
                    </>
                ) : (
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Save as template</DialogTitle>
                                <DialogDescription>Copies this page with all its blocks into your organization's template gallery.</DialogDescription>
                            </DialogHeader>
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Template name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gallery category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Gallery category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WikiTemplateCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} placeholder="Shown on the gallery card" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="is_featured" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                                    <div><FormLabel>Featured</FormLabel><FormDescription>Show it in the gallery's Featured row.</FormDescription></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Featured" /></FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
                                <Button type="submit" loading={save.isPending}><LayoutTemplate /> Save template</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
