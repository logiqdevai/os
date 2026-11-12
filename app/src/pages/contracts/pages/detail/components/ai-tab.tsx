import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ListChecks, ShieldAlert, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ContractAiFindingKindOptions, ContractAiFindingStatusOptions, ContractRiskLevelOptions } from "@/config/constants/dropdowns/contracts/contract-analytics.options";
import { ObligationTypeFormOptions } from "@/config/constants/dropdowns/contracts/contract-obligation.options";
import {
    useContractAiFindings, useContractAiStatus, useDecideContractAiFinding, useExtractContractObligations, useObligationSuggestions, useReviewObligationSuggestion, useRunContractAiReview,
} from "@/features/contracts/hooks/use-contracts";
import type { ContractAiFinding, ContractDetail, ContractRisk, ContractVersionDetail, ObligationSuggestion } from "@/features/contracts/interfaces/contracts.interfaces";

const SEVERITY_TONE = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" } as const;

/**
 * AI tab: review findings (risky / missing / non-standard clauses) and obligation extraction for the selected version.
 * Recommendations only — AI never edits the text; people accept/dismiss findings and confirm/reject obligations.
 * @perm read contracts.contracts.read · run + decide findings contracts.contracts.review · confirm obligations contracts.obligations.manage
 * @api POST /contracts/:id/versions/:vid/ai/review · GET …/ai/findings · PATCH /contracts/:id/ai/findings/:fid · POST …/ai/extract-obligations · GET/POST /contracts/:id/ai/obligation-suggestions
 * @states loading · not connected (Admin → Integrations) · provider error · empty · no-access (buttons hidden)
 */
export function AiTab({ contract, version }: { contract: ContractDetail; version: ContractVersionDetail | undefined }) {
    const p = usePermissions();
    const status = useContractAiStatus();
    const findings = useContractAiFindings(contract.id, version?.id);
    const suggestions = useObligationSuggestions(contract.id);
    const review = useRunContractAiReview();
    const extract = useExtractContractObligations();
    const [risk, setRisk] = useState<ContractRisk | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [dismissing, setDismissing] = useState<ContractAiFinding | null>(null);
    const canReview = p.can("contracts.contracts.review");
    const notConfigured = status.data && !status.data.configured;

    if (!version) return <EmptyState title="No version selected" />;

    const runReview = () => {
        setProblem(null);
        review.mutate({ id: contract.id, versionId: version.id }, {
            onSuccess: (r) => {
                if (!r.available) { setProblem(r.message); return; }
                setRisk(r.risk);
                toast({ title: "AI review finished", description: `${r.findings.filter((f) => f.status === "OPEN").length} findings to look at` });
            },
            onError: (e) => toast({ variant: "destructive", title: "AI review failed", description: getApiErrorMessage(e) }),
        });
    };
    const runExtract = () => {
        setProblem(null);
        extract.mutate({ id: contract.id, versionId: version.id }, {
            onSuccess: (r) => { if (!r.available) setProblem(r.message); else toast({ title: "Obligations extracted", description: `${r.suggestions.length} suggestions to review` }); },
            onError: (e) => toast({ variant: "destructive", title: "Extraction failed", description: getApiErrorMessage(e) }),
        });
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-2 text-[13px] text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-violet" />
                    <span>AI reviews {version.label} with your organization's OpenAI key. Findings are recommendations, not legal advice, and never change the text.</span>
                </div>
                {canReview && !notConfigured && (
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" loading={review.isPending} disabled={extract.isPending} onClick={runReview}><ShieldAlert /> Review clauses</Button>
                        <Button size="sm" variant="outline" loading={extract.isPending} disabled={review.isPending} onClick={runExtract}><ListChecks /> Extract obligations</Button>
                    </div>
                )}
            </div>
            {notConfigured && <Warn>No AI provider is connected. An administrator can connect your OpenAI key in <Link className="underline" to="/admin/integrations">Admin → Integrations</Link>.</Warn>}
            {problem && <Warn>{problem}</Warn>}
            {(review.isPending || extract.isPending) && <Skeleton className="h-24" />}

            {risk && (
                <section className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">Risk score <Badge variant={SEVERITY_TONE[risk.level]}>{getDropdownOptionLabel(ContractRiskLevelOptions, risk.level)} · {risk.score}</Badge></div>
                    <ul className="space-y-1 text-[13px]">{risk.factors.map((f, i) => <li key={i} className="flex justify-between gap-3"><span className="text-foreground">{f.factor} <span className="text-muted-foreground">— {f.note}</span></span><span className="tabular text-muted-foreground">+{f.points}</span></li>)}</ul>
                </section>
            )}

            <section className="space-y-2">
                <h3 className="text-[13px] font-medium text-foreground">Review findings</h3>
                {findings.isPending ? <Skeleton className="h-32" /> : findings.error ? <ErrorState error={findings.error} onRetry={() => findings.refetch()} /> : !findings.data?.length ? (
                    <EmptyState compact icon={ShieldAlert} title="No findings" description={canReview ? "Run a review to check this version for risky, missing or non-standard clauses." : "Nobody has run an AI review of this version yet."} />
                ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                        {findings.data.map((f) => <FindingRow key={f.id} contractId={contract.id} f={f} canDecide={canReview} onDismiss={() => setDismissing(f)} />)}
                    </ul>
                )}
            </section>

            <section className="space-y-2">
                <h3 className="text-[13px] font-medium text-foreground">Extracted obligations waiting for review</h3>
                {suggestions.isPending ? <Skeleton className="h-24" /> : suggestions.error ? <ErrorState error={suggestions.error} onRetry={() => suggestions.refetch()} /> : !suggestions.data?.length ? (
                    <EmptyState compact icon={ListChecks} title="Nothing to review" description="Confirmed obligations appear on the Obligations tab. Nothing operational starts from an unreviewed suggestion." />
                ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                        {suggestions.data.map((o) => <SuggestionRow key={o.id} contractId={contract.id} o={o} canManage={p.can("contracts.obligations.manage")} />)}
                    </ul>
                )}
            </section>

            <DismissDialog contractId={contract.id} finding={dismissing} onClose={() => setDismissing(null)} />
        </div>
    );
}

function FindingRow({ contractId, f, canDecide, onDismiss }: { contractId: string; f: ContractAiFinding; canDecide: boolean; onDismiss: () => void }) {
    const decide = useDecideContractAiFinding();
    return (
        <li className="space-y-1.5 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={SEVERITY_TONE[f.severity]}>{getDropdownOptionLabel(ContractRiskLevelOptions, f.severity)}</Badge>
                <Badge variant="neutral">{getDropdownOptionLabel(ContractAiFindingKindOptions, f.kind)}</Badge>
                {f.status !== "OPEN" && <Badge variant={f.status === "ACCEPTED" ? "success" : "neutral"}>{getDropdownOptionLabel(ContractAiFindingStatusOptions, f.status)}</Badge>}
                {f.confidence !== null && <span className="text-xs text-muted-foreground">{Math.round(f.confidence * 100)}% confidence</span>}
            </div>
            <p className="text-[13.5px] text-foreground">{f.message}</p>
            {f.recommendation && <p className="text-[13px] text-muted-foreground">{f.recommendation}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span><Sparkles className="mr-1 inline size-3" />AI recommendation · {f.section ? f.section.title : "whole document"}</span>
                {f.reviewed_at && <span>{f.status === "ACCEPTED" ? "Accepted" : "Dismissed"} by {personName(f.reviewed_by?.user) || "—"} {formatDateTime(f.reviewed_at)}{f.resolution_note ? ` · ${f.resolution_note}` : ""}</span>}
            </div>
            {canDecide && f.status === "OPEN" && (
                <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" loading={decide.isPending} onClick={() => decide.mutate({ id: contractId, findingId: f.id, status: "ACCEPTED" }, { onSuccess: () => toast({ title: "Finding accepted", description: "Edit the section or add a comment to handle it." }), onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) })}><Check /> Accept</Button>
                    <Button size="sm" variant="ghost" onClick={onDismiss}><X /> Dismiss</Button>
                </div>
            )}
        </li>
    );
}

function DismissDialog({ contractId, finding, onClose }: { contractId: string; finding: ContractAiFinding | null; onClose: () => void }) {
    const decide = useDecideContractAiFinding();
    const [note, setNote] = useState("");
    return (
        <Dialog open={!!finding} onOpenChange={(o) => { if (!o && !decide.isPending) { setNote(""); onClose(); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Dismiss finding</DialogTitle><DialogDescription>Say why this finding does not apply. The note is kept for traceability.</DialogDescription></DialogHeader>
                <div className="space-y-1.5"><Label htmlFor="dismiss-note">Note</Label><Textarea id="dismiss-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => { setNote(""); onClose(); }} disabled={decide.isPending}>Cancel</Button>
                    <Button loading={decide.isPending} disabled={!note.trim() || !finding} onClick={() => finding && decide.mutate({ id: contractId, findingId: finding.id, status: "DISMISSED", resolution_note: note.trim() }, { onSuccess: () => { toast({ title: "Finding dismissed" }); setNote(""); onClose(); }, onError: (e) => toast({ variant: "destructive", title: "Could not dismiss", description: getApiErrorMessage(e) }) })}>Dismiss</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SuggestionRow({ contractId, o, canManage }: { contractId: string; o: ObligationSuggestion; canManage: boolean }) {
    const reviewS = useReviewObligationSuggestion();
    const [title, setTitle] = useState(o.title);
    const [due, setDue] = useState(o.due_date ? o.due_date.slice(0, 10) : "");
    const decide = (decision: "CONFIRM" | "REJECT") =>
        reviewS.mutate(
            { id: contractId, obligationId: o.id, decision, ...(decision === "CONFIRM" && { title: title.trim() || o.title, due_date: due || null }) },
            { onSuccess: () => toast({ title: decision === "CONFIRM" ? "Obligation confirmed" : "Suggestion rejected" }), onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) },
        );
    return (
        <li className="space-y-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="violet"><Sparkles className="size-3" /> Suggested</Badge>
                <span>{getDropdownOptionLabel(ObligationTypeFormOptions, o.type)}</span>
                {o.frequency && <span>· {o.frequency}</span>}
                {o.extraction_confidence !== null && <span>· {Math.round(o.extraction_confidence * 100)}% confidence</span>}
                {o.section && <span>· {o.section.title}</span>}
            </div>
            {canManage ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <Input className="h-8" aria-label="Obligation title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <Input className="h-8" type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
            ) : (
                <p className="text-[13.5px] text-foreground">{o.title}{o.due_date ? ` · due ${formatDate(o.due_date)}` : ""}</p>
            )}
            {o.description && <p className="text-[13px] text-muted-foreground">{o.description}</p>}
            {canManage && (
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" loading={reviewS.isPending && reviewS.variables?.decision === "CONFIRM"} disabled={reviewS.isPending} onClick={() => decide("CONFIRM")}><Check /> Confirm</Button>
                    <Button size="sm" variant="ghost" loading={reviewS.isPending && reviewS.variables?.decision === "REJECT"} disabled={reviewS.isPending} onClick={() => decide("REJECT")}><X /> Reject</Button>
                </div>
            )}
        </li>
    );
}

function Warn({ children }: { children: React.ReactNode }) {
    return <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}
