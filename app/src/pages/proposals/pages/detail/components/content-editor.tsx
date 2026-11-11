import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { renderMarkdown, markdownClass } from "@/lib/markdown";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { ProposalSectionTypeFormOptions, ProposalVariableOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useSaveProposalContent } from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail, ProposalSectionType, SectionInput } from "@/features/proposals/interfaces/proposals.interfaces";

type Draft = SectionInput & { key: string };

interface ContentEditorProps {
    proposal: ProposalDetail;
    editable: boolean;
    onDirtyChange: (dirty: boolean) => void;
}

const toDrafts = (p: ProposalDetail): Draft[] =>
    (p.version?.sections ?? []).map((s) => ({ key: s.id, id: s.id, type: s.type, title: s.title, body: s.body ?? "", is_internal: s.is_internal, is_ai_generated: s.is_ai_generated }));

/** Sections outline + markdown editor with live preview. Internal sections are visible to staff only. */
export function ContentEditor({ proposal, editable, onDirtyChange }: ContentEditorProps) {
    const canInternal = usePermission("proposals.comments.internal.read");
    const save = useSaveProposalContent();
    const [sections, setSections] = useState<Draft[]>(() => toDrafts(proposal));
    const [activeKey, setActiveKey] = useState<string | null>(sections[0]?.key ?? null);
    const [preview, setPreview] = useState(!editable);
    const original = useMemo(() => JSON.stringify(toDrafts(proposal).map(({ key: _k, ...s }) => s)), [proposal]);
    const dirty = JSON.stringify(sections.map(({ key: _k, ...s }) => s)) !== original;

    useEffect(() => {
        const next = toDrafts(proposal);
        setSections(next);
        setActiveKey((k) => (next.some((s) => s.key === k) ? k : (next[0]?.key ?? null)));
    }, [proposal]);
    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
    useEffect(() => setPreview(!editable), [editable]);

    const active = sections.find((s) => s.key === activeKey) ?? null;
    const update = (patch: Partial<Draft>) => setSections((all) => all.map((s) => (s.key === activeKey ? { ...s, ...patch, is_ai_generated: patch.body !== undefined ? false : s.is_ai_generated } : s)));
    const move = (key: string, dir: -1 | 1) =>
        setSections((all) => {
            const i = all.findIndex((s) => s.key === key);
            const j = i + dir;
            if (j < 0 || j >= all.length) return all;
            const next = [...all];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    const add = () => {
        const key = `new-${Date.now()}`;
        setSections((all) => [...all, { key, type: "CUSTOM", title: "New section", body: "", is_internal: false }]);
        setActiveKey(key);
        setPreview(false);
    };
    const remove = (key: string) => {
        setSections((all) => all.filter((s) => s.key !== key));
        if (activeKey === key) setActiveKey(sections.find((s) => s.key !== key)?.key ?? null);
    };
    const submit = () =>
        save.mutate(
            { id: proposal.id, versionId: proposal.version!.id, sections: sections.map(({ key: _k, ...s }) => s) },
            {
                onSuccess: () => toast({ title: "Content saved" }),
                onError: (e) => toast({ variant: "destructive", title: "Could not save content", description: getApiErrorMessage(e) }),
            }
        );

    return (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-[13px] font-medium text-foreground">Sections</span>
                    {editable && <Button size="sm" variant="ghost" onClick={add}><Plus /> Add</Button>}
                </div>
                {sections.length === 0 ? (
                    <p className="p-3 text-[13px] text-muted-foreground">No sections yet.</p>
                ) : (
                    <ul className="max-h-[50vh] overflow-y-auto py-1 lg:max-h-none">
                        {sections.map((s, i) => (
                            <li key={s.key}>
                                <div className={cn("group flex items-center gap-1 px-2 py-1", s.key === activeKey && "bg-accent")}>
                                    <button type="button" onClick={() => setActiveKey(s.key)} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left text-[13px] text-foreground">
                                        <span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
                                        <span className="truncate">{s.title || "Untitled"}</span>
                                        {s.is_internal && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Internal" />}
                                        {s.is_ai_generated && <Sparkles className="size-3 shrink-0 text-violet" aria-label="AI draft" />}
                                    </button>
                                    {editable && (
                                        <span className="flex shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                                            <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(s.key, -1)}><ArrowUp /></Button>
                                            <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => move(s.key, 1)}><ArrowDown /></Button>
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-card">
                {!active ? (
                    <EmptyState compact title="Select a section" description={editable ? "Or add one to start writing." : undefined} />
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{active.title || "Untitled"}</span>
                            <Badge variant="neutral">{getDropdownOptionLabel(ProposalSectionTypeFormOptions, active.type)}</Badge>
                            {active.is_ai_generated && <Badge variant="violet"><Sparkles className="size-3" /> AI draft</Badge>}
                            {active.is_internal && <Badge variant="warning"><Lock className="size-3" /> Internal</Badge>}
                            {editable && (
                                <Button size="sm" variant="ghost" onClick={() => setPreview((v) => !v)}>
                                    {preview ? <><Pencil /> Edit</> : <><Eye /> Preview</>}
                                </Button>
                            )}
                        </div>
                        {preview || !editable ? (
                            <div className="p-4">
                                {active.body?.trim() ? (
                                    <div className={markdownClass} dangerouslySetInnerHTML={{ __html: renderMarkdown(active.body) }} />
                                ) : (
                                    <p className="text-[13px] text-muted-foreground">This section is empty.</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3 p-3 md:p-4">
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                                    <Input aria-label="Section title" value={active.title} onChange={(e) => update({ title: e.target.value })} />
                                    <Select value={active.type} onValueChange={(v) => update({ type: v as ProposalSectionType })}>
                                        <SelectTrigger aria-label="Section type"><SelectValue /></SelectTrigger>
                                        <SelectContent>{ProposalSectionTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <Textarea aria-label="Section text" rows={14} className="font-mono text-[13px] leading-relaxed" value={active.body ?? ""} onChange={(e) => update({ body: e.target.value })} placeholder="Write in markdown: # heading, **bold**, - bullet list…" />
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-xs text-muted-foreground">Insert:</span>
                                    {ProposalVariableOptions.map((v) => (
                                        <button key={v.id} type="button" title={v.label} onClick={() => update({ body: `${active.body ?? ""}{{${v.id}}}` })} className="rounded border border-border bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                                            {`{{${v.id}}}`}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                                    {canInternal ? (
                                        <label className="flex items-center gap-2 text-[13px] text-foreground">
                                            <Switch checked={!!active.is_internal} onCheckedChange={(v) => update({ is_internal: v })} />
                                            {active.is_internal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} Internal (never shown to the customer)
                                        </label>
                                    ) : <span />}
                                    <Button size="sm" variant="destructive" onClick={() => remove(active.key)}><Trash2 /> Remove section</Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {editable && (
                    <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                        <span className="mr-auto text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
                        <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setSections(toDrafts(proposal))}>Discard</Button>
                        <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={submit}>Save content</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
