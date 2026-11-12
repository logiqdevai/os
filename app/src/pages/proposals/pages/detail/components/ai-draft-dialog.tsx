import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatMoney } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { ProposalSectionTypeFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { ProposalAiApplyModeOptions, ProposalAiDefaultSections, ProposalAiSectionTypes, ProposalAiSourceOptions, ProposalAiToneOptions } from "@/config/constants/dropdowns/proposals/proposal-ai.options";
import { useApplyProposalDraft, useGenerateProposalDraft, useProposalAiStatus } from "@/features/proposals/hooks/use-proposals";
import type { AiApplyDto, AiDraftLine, AiDraftSection, AiGenerateDto, ProposalDetail, ProposalSectionType } from "@/features/proposals/interfaces/proposals.interfaces";
import { LookupPicker } from "../../../components/lookup-picker";

type Draft = { run_id: string; model: string; sources: string[]; sections: (AiDraftSection & { keep: boolean })[]; lines: (AiDraftLine & { keep: boolean })[]; assumptions: string[] };

/**
 * AI proposal assistant: drafts sections + line items from the CRM deal, its notes and the user's notes
 * (organization OpenAI key, BYOK). The result is a draft the user edits and applies to the DRAFT version; nothing is sent.
 * @perm proposals.ai.generate · apply also proposals.proposals.update · @api POST /proposals/:id/ai/generate · POST /proposals/:id/ai/apply
 * @states loading (generating) · not connected (Admin → Integrations) · provider error · empty draft
 */
export function AiDraftDialog({ proposal, open, onOpenChange }: { proposal: ProposalDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const status = useProposalAiStatus(open);
    const generate = useGenerateProposalDraft();
    const apply = useApplyProposalDraft();
    const canApply = usePermission("proposals.proposals.update");
    const [deal, setDeal] = useState<string | null>(proposal.deal_id);
    const [notes, setNotes] = useState("");
    const [crmNotes, setCrmNotes] = useState(true);
    const [withLines, setWithLines] = useState(true);
    const [tone, setTone] = useState<NonNullable<AiGenerateDto["tone"]>>("professional");
    const [sections, setSections] = useState<ProposalSectionType[]>(ProposalAiDefaultSections);
    const [mode, setMode] = useState<AiApplyDto["mode"]>("append");
    const [draft, setDraft] = useState<Draft | null>(null);
    const [unavailable, setUnavailable] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setDeal(proposal.deal_id); setNotes(""); setDraft(null); setUnavailable(null); setMode("append");
    }, [open, proposal.deal_id]);

    const run = () => {
        setUnavailable(null);
        generate.mutate(
            { id: proposal.id, deal_id: deal ?? undefined, notes: notes.trim() || undefined, include_crm_notes: crmNotes, include_line_items: withLines, tone, sections, language: proposal.language },
            {
                onSuccess: (r) => {
                    if (!r.available) { setUnavailable(r.message); return; }
                    setDraft({ run_id: r.run_id, model: r.model, sources: r.sources, sections: r.draft.sections.map((s) => ({ ...s, keep: true })), lines: r.draft.line_items.map((l) => ({ ...l, keep: true })), assumptions: r.draft.assumptions });
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not generate a draft", description: getApiErrorMessage(e) }),
            },
        );
    };

    const save = () => {
        if (!draft || !proposal.version) return;
        apply.mutate(
            { id: proposal.id, version_id: proposal.version.id, run_id: draft.run_id, mode, sections: draft.sections.filter((s) => s.keep).map(({ keep: _k, ...s }) => s), line_items: draft.lines.filter((l) => l.keep).map(({ keep: _k, ...l }) => l) },
            { onSuccess: () => { toast({ title: "AI draft added", description: "Review and edit it before you send the proposal." }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not apply the draft", description: getApiErrorMessage(e) }) },
        );
    };

    const kept = draft ? draft.sections.filter((s) => s.keep).length + draft.lines.filter((l) => l.keep).length : 0;
    const notConfigured = status.data && !status.data.configured;

    return (
        <Dialog open={open} onOpenChange={(o) => !generate.isPending && !apply.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-violet" /> AI draft</DialogTitle>
                    <DialogDescription>Drafts sections and line items from the deal and your notes with your organization's OpenAI key. Nothing changes until you apply it, and nothing is sent to the customer.</DialogDescription>
                </DialogHeader>

                {status.isPending ? (
                    <Skeleton className="h-40" />
                ) : notConfigured ? (
                    <Notice>No AI provider is connected. An administrator can connect your OpenAI key in <Link className="underline" to="/admin/integrations">Admin → Integrations</Link>.</Notice>
                ) : !draft ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label>Deal</Label><LookupPicker kind="deals" ariaLabel="Deal" value={deal} valueLabel={deal === proposal.deal_id ? proposal.deal?.name : undefined} companyId={proposal.company_id} onChange={setDeal} /></div>
                            <div className="space-y-1.5">
                                <Label>Tone</Label>
                                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                                    <SelectTrigger aria-label="Tone"><SelectValue /></SelectTrigger>
                                    <SelectContent>{ProposalAiToneOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ai-notes">Notes</Label>
                            <Textarea id="ai-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Meeting notes, requirements, budget, deadlines… Only what you write here and the deal are sent to the AI provider." />
                        </div>
                        <div className="space-y-2">
                            <Label>Sections to draft</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {ProposalAiSectionTypes.map((t) => {
                                    const on = sections.includes(t);
                                    return (
                                        <button key={t} type="button" aria-pressed={on} onClick={() => setSections((all) => (on ? all.filter((x) => x !== t) : [...all, t]))}
                                            className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                                            {getDropdownOptionLabel(ProposalSectionTypeFormOptions, t)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                            <label className="flex items-center gap-2 text-[13px]"><Switch checked={crmNotes} onCheckedChange={setCrmNotes} disabled={!deal} /> Read the deal's notes and activities</label>
                            <label className="flex items-center gap-2 text-[13px]"><Switch checked={withLines} onCheckedChange={setWithLines} /> Propose line items</label>
                        </div>
                        {unavailable && <Notice>{unavailable}</Notice>}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="violet"><Sparkles className="size-3" /> AI draft</Badge>
                            <span>{draft.model}</span>
                            <span>· sources: {draft.sources.map((s) => getDropdownOptionLabel(ProposalAiSourceOptions, s.split(":")[0])).join(", ") || "—"}</span>
                        </div>
                        {draft.sections.length === 0 && draft.lines.length === 0 && <Notice>The AI returned nothing usable. Add more notes and try again.</Notice>}
                        {draft.sections.map((s, i) => (
                            <div key={i} className={cn("space-y-2 rounded-lg border border-border p-3", !s.keep && "opacity-60")}>
                                <div className="flex items-center gap-2">
                                    <Checkbox checked={s.keep} aria-label={`Use ${s.title}`} onCheckedChange={(v) => setDraft((d) => d && { ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, keep: v === true } : x)) })} />
                                    <Input className="h-8" aria-label="Section title" value={s.title} onChange={(e) => setDraft((d) => d && { ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                                    <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">{getDropdownOptionLabel(ProposalSectionTypeFormOptions, s.type)}</Badge>
                                </div>
                                <Textarea rows={6} aria-label="Section text" className="font-mono text-[12.5px]" value={s.body} onChange={(e) => setDraft((d) => d && { ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
                            </div>
                        ))}
                        {draft.lines.length > 0 && (
                            <div className="rounded-lg border border-border">
                                <div className="border-b border-border px-3 py-2 text-[13px] font-medium">Line items</div>
                                <ul className="divide-y divide-border">
                                    {draft.lines.map((l, i) => (
                                        <li key={i} className={cn("flex items-start gap-2 px-3 py-2 text-[13px]", !l.keep && "opacity-60")}>
                                            <Checkbox className="mt-0.5" checked={l.keep} aria-label={`Use ${l.name}`} onCheckedChange={(v) => setDraft((d) => d && { ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, keep: v === true } : x)) })} />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-foreground">{l.name}{l.is_optional && <Badge variant="outline" className="ml-1.5">Optional</Badge>}</div>
                                                {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                                            </div>
                                            <span className="shrink-0 tabular text-muted-foreground">{l.quantity} {l.unit ?? "×"} {formatMoney(l.unit_price, proposal.currency)}{l.is_recurring ? ` / ${l.billing_frequency ?? "monthly"}` : ""}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {draft.assumptions.length > 0 && (
                            <div className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">
                                <div className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> Check these assumptions</div>
                                <ul className="list-disc space-y-0.5 pl-5">{draft.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                            </div>
                        )}
                        <div className="space-y-1.5 sm:max-w-sm">
                            <Label>Apply</Label>
                            <Select value={mode} onValueChange={(v) => setMode(v as AiApplyDto["mode"])}>
                                <SelectTrigger aria-label="Apply mode"><SelectValue /></SelectTrigger>
                                <SelectContent>{ProposalAiApplyModeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {!draft ? (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generate.isPending}>Cancel</Button>
                            {!notConfigured && <Button loading={generate.isPending} disabled={!sections.length && !withLines} onClick={run}><Sparkles /> Generate draft</Button>}
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setDraft(null)} disabled={apply.isPending}>Back</Button>
                            <Button variant="outline" onClick={run} loading={generate.isPending} disabled={apply.isPending}>Regenerate</Button>
                            <Button onClick={save} loading={apply.isPending} disabled={!kept || !canApply || !proposal.version?.editable} title={!canApply ? "Needs proposals.proposals.update" : undefined}>Apply {kept} item{kept === 1 ? "" : "s"}</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Notice({ children }: { children: React.ReactNode }) {
    return <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}
