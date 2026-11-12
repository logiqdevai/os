import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { LanguageOptions, ProposalSectionTypeFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useCreateProposalTemplate, useUpdateProposalTemplate } from "@/features/proposals/hooks/use-proposals";
import { templateFormSchema, type TemplateFormValues } from "@/features/proposals/validation-schemas/proposals.schema";
import type { ProposalSectionType, ProposalTemplate, TemplateSection } from "@/features/proposals/interfaces/proposals.interfaces";

const STARTER: TemplateSection[] = [
    { type: "COVER", title: "Cover", body_template: "# {{proposal.title}}\n\nPrepared for {{contact.name}}, {{company.name}}." },
    { type: "EXECUTIVE_SUMMARY", title: "Executive summary", body_template: "" },
    { type: "SCOPE", title: "Scope of work", body_template: "" },
    { type: "TIMELINE", title: "Timeline", body_template: "" },
    { type: "PRICING", title: "Investment", body_template: "" },
    { type: "TERMS", title: "Terms & conditions", body_template: "" },
];

/** Create / edit a proposal template. Saving changed content creates a new template version; existing proposals never change. */
export function TemplateDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (o: boolean) => void; template: ProposalTemplate | null }) {
    const create = useCreateProposalTemplate();
    const update = useUpdateProposalTemplate();
    const pending = create.isPending || update.isPending;
    const [sections, setSections] = useState<TemplateSection[]>(STARTER);
    const [active, setActive] = useState(0);
    const form = useForm<TemplateFormValues>({ resolver: zodResolver(templateFormSchema), defaultValues: { name: "", description: "", work_type: "", language: "en", default_validity_days: 30, payment_terms: "", is_default: false } });

    useEffect(() => {
        if (!open) return;
        form.reset({
            name: template?.name ?? "",
            description: template?.description ?? "",
            work_type: template?.work_type ?? "",
            language: template?.language ?? "en",
            default_validity_days: template?.default_validity_days ?? 30,
            payment_terms: template?.defaults?.payment_terms ?? "",
            is_default: template?.is_default ?? false,
        });
        setSections(template?.sections?.length ? template.sections : STARTER);
        setActive(0);
    }, [open, template, form]);

    const setSection = (i: number, patch: Partial<TemplateSection>) => setSections((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const move = (i: number, d: -1 | 1) => setSections((all) => {
        const j = i + d;
        if (j < 0 || j >= all.length) return all;
        const n = [...all];
        [n[i], n[j]] = [n[j], n[i]];
        setActive(j);
        return n;
    });
    const cur = sections[active];

    const submit = form.handleSubmit((v) => {
        if (sections.some((s) => !s.title.trim())) {
            toast({ variant: "destructive", title: "Every section needs a title" });
            return;
        }
        const dto = {
            name: v.name,
            description: v.description || null,
            work_type: v.work_type || null,
            language: v.language,
            default_validity_days: v.default_validity_days,
            defaults: { ...(template?.defaults ?? {}), payment_terms: v.payment_terms || undefined },
            is_default: v.is_default,
            sections,
        };
        // Multi-section template editor: stays a dialog with Save; closes on success, failures toast globally.
        const opts = { onSuccess: () => onOpenChange(false) };
        if (template) update.mutate({ id: template.id, ...dto }, opts);
        else create.mutate(dto, opts);
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{template ? `Edit ${template.name}` : "New template"}</DialogTitle>
                            <DialogDescription>{template ? `Version ${template.version}. Content changes create version ${template.version + 1}.` : "Sections, terms and validity copied into new proposals."}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Website development" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="work_type" render={({ field }) => (<FormItem><FormLabel>Work type</FormLabel><FormControl><Input {...field} placeholder="website, mobile app, retainer…" /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="language" render={({ field }) => (
                                <FormItem><FormLabel>Language</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Language"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{LanguageOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="default_validity_days" render={({ field }) => (<FormItem><FormLabel>Valid for (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} value={Number.isNaN(field.value) ? "" : field.value} onChange={(e) => field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="payment_terms" render={({ field }) => (<FormItem><FormLabel>Default payment terms</FormLabel><FormControl><Textarea rows={2} {...field} placeholder="Invoices are due within 14 days." /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="is_default" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"><FormLabel className="m-0 font-normal">Default for new proposals</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />

                        <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)]">
                            <div className="rounded-md border border-border">
                                <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                                    <span className="text-xs font-medium text-foreground">Sections</span>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => { setSections((all) => [...all, { type: "CUSTOM", title: "New section", body_template: "" }]); setActive(sections.length); }}><Plus /> Add</Button>
                                </div>
                                <ul className="max-h-60 overflow-y-auto py-1">
                                    {sections.map((s, i) => (
                                        <li key={i}><button type="button" onClick={() => setActive(i)} className={`w-full truncate px-2 py-1 text-left text-[13px] ${i === active ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{i + 1}. {s.title || "Untitled"}</button></li>
                                    ))}
                                </ul>
                            </div>
                            {cur ? (
                                <div className="space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                                        <Input aria-label="Section title" value={cur.title} onChange={(e) => setSection(active, { title: e.target.value })} />
                                        <Select value={cur.type} onValueChange={(t) => setSection(active, { type: t as ProposalSectionType })}>
                                            <SelectTrigger aria-label="Section type"><SelectValue /></SelectTrigger>
                                            <SelectContent>{ProposalSectionTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <Textarea aria-label="Section text" rows={8} className="font-mono text-[13px]" value={cur.body_template ?? ""} onChange={(e) => setSection(active, { body_template: e.target.value })} placeholder="Markdown with {{variables}}" />
                                    <div className="flex gap-1">
                                        <Button type="button" size="sm" variant="ghost" disabled={active === 0} onClick={() => move(active, -1)}><ArrowUp /> Up</Button>
                                        <Button type="button" size="sm" variant="ghost" disabled={active === sections.length - 1} onClick={() => move(active, 1)}><ArrowDown /> Down</Button>
                                        <Button type="button" size="sm" variant="destructive" className="ml-auto" onClick={() => { setSections((all) => all.filter((_, j) => j !== active)); setActive(Math.max(0, active - 1)); }}><Trash2 /> Remove</Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[13px] text-muted-foreground">Add a section.</p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{template ? "Save template" : "Create template"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
