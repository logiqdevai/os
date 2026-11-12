import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/use-permission";
import { useAiFeedback, useAiStatus, useGenerateAi } from "@/features/communications/hooks/use-ai-threads";
import type { CommAiOutput, CommAiTask, CommAiTone } from "@/features/communications/interfaces/ai-threads.interfaces";
import type { CommChannel } from "@/features/communications/interfaces/communications.interfaces";
import { CommAiTaskOptions, CommAiToneOptions } from "@/config/constants/dropdowns/communications/campaign-ab.options";

export interface AiApplyPatch {
    subject?: string;
    preheader?: string;
    body_html?: string;
    body_text?: string;
}

/**
 * AI writing assistant (11 "AI Communication Assistant"): subject lines, email / SMS drafts, tone rewrite, translation.
 * Uses the organization's own OpenAI connection; without one it shows how to connect it (never an error).
 * @perm communications.ai.use (hidden without it)
 * @api GET /communications/ai/status · POST /communications/ai/generate · POST /communications/ai/generations/:id/feedback
 */
export function AiAssistant({ channel, subject, body, campaignId, onApply }: { channel: CommChannel; subject: string; body: string; campaignId?: string; onApply: (patch: AiApplyPatch) => void }) {
    const canUse = usePermission("communications.ai.use");
    const canConnect = usePermission("organizations.integrations.read");
    const status = useAiStatus(canUse);
    const generate = useGenerateAi();
    const feedback = useAiFeedback();
    const tasks = CommAiTaskOptions.filter((t) => !t.channel || t.channel === channel);
    const [task, setTask] = useState<CommAiTask>(tasks[0].id);
    const [prompt, setPrompt] = useState("");
    const [tone, setTone] = useState<CommAiTone>("friendly");
    const [language, setLanguage] = useState("");
    const [result, setResult] = useState<{ id: string; output: CommAiOutput } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    if (!canUse) return null;
    const email = channel === "EMAIL";
    const needsBrief = task === "WRITE_EMAIL" || task === "WRITE_SMS";
    const needsContent = task === "IMPROVE_TONE" || task === "TRANSLATE" || task === "SUBJECT_LINES";

    const run = () => {
        setNotice(null);
        setResult(null);
        generate.mutate(
            { task, channel, prompt: prompt || undefined, subject: subject || undefined, body: body || undefined, tone, language: language || undefined, campaign_id: campaignId },
            {
                onSuccess: (r) => (r.available ? setResult({ id: r.generation_id, output: r.output }) : setNotice(r.message)),
            },
        );
    };

    const apply = (patch: AiApplyPatch) => {
        onApply(patch);
        // The editor shows the applied text; no toast.
        if (result) feedback.mutate({ id: result.id, accepted: true, campaign_id: campaignId });
    };

    const out = result?.output;
    const rewritten = out?.body ?? null;

    return (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="ai-title">
            <h3 id="ai-title" className="flex items-center gap-2 text-sm font-medium text-foreground"><Sparkles className="size-4 text-violet" /> Writing assistant</h3>
            {status.isPending ? (
                <Skeleton className="h-16 w-full" />
            ) : status.data && !status.data.configured ? (
                <p className="text-[13px] text-muted-foreground">
                    {status.data.message}{" "}
                    {canConnect && <Link to="/admin/integrations" className="font-medium text-primary underline-offset-2 hover:underline">Open integrations</Link>}
                </p>
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>What should it do?</Label>
                            <Select value={task} onValueChange={(v) => { setTask(v as CommAiTask); setResult(null); }}>
                                <SelectTrigger aria-label="Assistant task"><SelectValue /></SelectTrigger>
                                <SelectContent>{tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {task === "TRANSLATE" ? (
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-language">Into</Label>
                                <Input id="ai-language" placeholder="German" value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={40} />
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label>Tone</Label>
                                <Select value={tone} onValueChange={(v) => setTone(v as CommAiTone)}>
                                    <SelectTrigger aria-label="Tone"><SelectValue /></SelectTrigger>
                                    <SelectContent>{CommAiToneOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {(needsBrief || task === "SUBJECT_LINES") && (
                        <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={4000} aria-label="Brief" placeholder={needsBrief ? "What is it about? Offer, audience, call to action…" : "Optional: what matters most in the subject"} />
                    )}
                    {needsContent && !body && task !== "SUBJECT_LINES" && <p className="text-xs text-muted-foreground">Write some content first; the assistant works on what is in the editor.</p>}
                    <div className="flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={run} loading={generate.isPending} disabled={(needsBrief && !prompt.trim()) || (task !== "SUBJECT_LINES" && needsContent && !body)}>
                            <Sparkles /> Generate
                        </Button>
                    </div>
                    {notice && <p className="rounded-md bg-warning-soft p-2 text-[13px] text-warning" role="status">{notice}</p>}
                    {out && (
                        <div className="space-y-2 rounded-md border border-border bg-background p-3" role="status">
                            {out.subject_lines?.length ? (
                                <ul className="space-y-1">
                                    {out.subject_lines.map((line) => (
                                        <li key={line} className="flex items-center gap-2">
                                            <span className="min-w-0 flex-1 text-[13px] text-foreground">{line}</span>
                                            <Button type="button" size="sm" variant="ghost" onClick={() => apply({ subject: line, ...(out.preheader ? { preheader: out.preheader } : {}) })}><Check /> Use</Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {task === "WRITE_EMAIL" && out.body_html && (
                                <>
                                    <p className="text-[13px] font-medium text-foreground">{out.subject}</p>
                                    <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">{out.body_html}</div>
                                    <div className="flex justify-end"><Button type="button" size="sm" onClick={() => apply({ subject: out.subject ?? undefined, preheader: out.preheader ?? undefined, body_html: out.body_html ?? undefined })}><Check /> Use this draft</Button></div>
                                </>
                            )}
                            {task === "WRITE_SMS" && out.body_text && (
                                <>
                                    <p className="whitespace-pre-wrap text-[13px] text-foreground">{out.body_text}</p>
                                    <div className="flex justify-end"><Button type="button" size="sm" onClick={() => apply({ body_text: out.body_text ?? undefined })}><Check /> Use this text</Button></div>
                                </>
                            )}
                            {(task === "IMPROVE_TONE" || task === "TRANSLATE") && rewritten && (
                                <>
                                    {out.subject && <p className="text-[13px] font-medium text-foreground">{out.subject}</p>}
                                    <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{rewritten}</div>
                                    <div className="flex justify-end">
                                        <Button type="button" size="sm" onClick={() => apply({ ...(out.subject && email ? { subject: out.subject } : {}), ...(email ? { body_html: rewritten } : { body_text: rewritten }) })}><Check /> Replace content</Button>
                                    </div>
                                </>
                            )}
                            <p className="text-[11px] text-muted-foreground">AI suggestions can be wrong. Check facts, prices and links before sending.</p>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
