import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddTemplateVersion, useContractClauses, useContractTemplate, useContractTypes, useCreateContractTemplate } from "@/features/contracts/hooks/use-contracts";
import type { TemplateSectionDef } from "@/features/contracts/interfaces/contracts.interfaces";

const NONE = "__none";
const STARTER: TemplateSectionDef[] = [
    { key: "parties", title: "Parties", body: "This agreement is made between {{agency.legal_name}} and {{customer.legal_name}}." },
    { key: "scope", title: "Scope of services", body: "" },
    { key: "fees", title: "Fees and payment", body: "" },
    { key: "term", title: "Term and termination", body: "" },
    { key: "confidentiality", title: "Confidentiality", body: "" },
    { key: "governing_law", title: "Governing law", body: "" },
];
const keyOf = (title: string, taken: string[]) => {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "section";
    let k = base;
    for (let i = 2; taken.includes(k); i++) k = `${base}_${i}`;
    return k;
};

/** New template (first version) or a new version of an existing template. Sections may embed a library clause by key. */
export function ContractTemplateDialog({ open, onOpenChange, templateId }: { open: boolean; onOpenChange: (o: boolean) => void; templateId: string | null }) {
    const existing = useContractTemplate(templateId ?? undefined);
    const types = useContractTypes({ limit: 100 });
    const clauses = useContractClauses({ limit: 200, status: "ACTIVE" });
    const create = useCreateContractTemplate();
    const addVersion = useAddTemplateVersion();
    const pending = create.isPending || addVersion.isPending;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [typeId, setTypeId] = useState(NONE);
    const [publish, setPublish] = useState(true);
    const [summary, setSummary] = useState("");
    const [sections, setSections] = useState<TemplateSectionDef[]>(STARTER);

    useEffect(() => {
        if (!open) return;
        if (!templateId) { setName(""); setDescription(""); setTypeId(NONE); setSections(STARTER); setPublish(true); setSummary(""); return; }
        const t = existing.data;
        if (t) {
            const latest = t.versions?.[0];
            setSections(latest?.sections?.length ? latest.sections : STARTER);
            setSummary("");
        }
    }, [open, templateId, existing.data]);

    const set = (i: number, patch: Partial<TemplateSectionDef>) => setSections((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const move = (i: number, d: -1 | 1) => setSections((all) => { const j = i + d; if (j < 0 || j >= all.length) return all; const n = [...all]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const invalid = (!templateId && !name.trim()) || !sections.length || sections.some((s) => !s.title.trim());
    const payload = sections.map((s, i) => ({ ...s, title: s.title.trim(), sort_order: i, clause_key: s.clause_key || undefined }));

    const submit = () => {
        // Saving creates a new template version (or the template): an explicit action, not autosave.
        // It closes on success (the list shows the new version); failures toast globally.
        if (templateId) addVersion.mutate({ id: templateId, sections: payload, change_summary: summary || undefined }, { onSuccess: () => onOpenChange(false) });
        else create.mutate({ name: name.trim(), description: description || undefined, type_id: typeId !== NONE ? typeId : undefined, sections: payload, publish }, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{templateId ? `New version of ${existing.data?.name ?? "template"}` : "New contract template"}</DialogTitle>
                    <DialogDescription>Template versions are immutable. Contracts keep the exact version they were generated from.</DialogDescription>
                </DialogHeader>
                {templateId && existing.isPending ? <Skeleton className="h-64" /> : (
                    <div className="space-y-4">
                        {!templateId ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5"><Label htmlFor="ct-name">Name</Label><Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Master services agreement" /></div>
                                <div className="space-y-1.5"><Label>Contract type</Label><Select value={typeId} onValueChange={setTypeId}><SelectTrigger aria-label="Contract type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Any type</SelectItem>{types.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ct-desc">Description</Label><Input id="ct-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                                <label className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px] sm:col-span-2">Publish now (usable for new contracts) <Switch checked={publish} onCheckedChange={setPublish} /></label>
                            </div>
                        ) : (
                            <div className="space-y-1.5"><Label htmlFor="ct-sum">What changed</Label><Input id="ct-sum" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Updated liability cap" /></div>
                        )}
                        <div className="space-y-2">
                            {sections.map((s, i) => (
                                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Input aria-label="Section title" className="h-8 min-w-0 flex-1" value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
                                        <Select value={s.clause_key || NONE} onValueChange={(k) => set(i, { clause_key: k === NONE ? undefined : k })}>
                                            <SelectTrigger className="h-8 w-48" aria-label="Library clause"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value={NONE}>Own text</SelectItem>{clauses.data?.data.map((c) => <SelectItem key={c.id} value={c.key}>Clause: {c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                        <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                        <Button variant="ghost" size="icon-sm" aria-label="Remove section" onClick={() => setSections((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                                    </div>
                                    {s.clause_key ? <p className="text-xs text-muted-foreground">Uses the current text of the library clause when a contract is generated.</p> : (
                                        <Textarea aria-label="Section text" rows={4} className="font-mono text-[13px]" value={s.body ?? ""} onChange={(e) => set(i, { body: e.target.value })} placeholder="Markdown with {{variables}}" />
                                    )}
                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                        <label className="flex items-center gap-1.5"><Switch checked={!!s.is_optional} onCheckedChange={(v) => set(i, { is_optional: v })} /> Optional</label>
                                        <label className="flex items-center gap-1.5"><Switch checked={!!s.is_appendix} onCheckedChange={(v) => set(i, { is_appendix: v })} /> Appendix</label>
                                    </div>
                                </div>
                            ))}
                            <Button size="sm" variant="outline" onClick={() => setSections((all) => [...all, { key: keyOf("New section", all.map((x) => x.key)), title: "New section", body: "" }])}><Plus /> Add section</Button>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button loading={pending} disabled={invalid} onClick={submit}>{templateId ? "Save version" : "Create template"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
