import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, Download, Eye, Lock, Pencil, Plus, RotateCcw, Send, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSessionData } from "@/features/session/hooks/use-session";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { renderMarkdown, markdownClass } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import {
    useApprovalPreview, useContractComments, useCreateComment, useDecideApproval, useDecideReview, useDownloadContractVersionPdf, useRequestReview, useResolveComment, useSaveSections, useSubmitForApproval,
} from "@/features/contracts/hooks/use-contracts";
import type { ContractDetail, ContractVersionDetail, SectionInput } from "@/features/contracts/interfaces/contracts.interfaces";
import { ContractLookupPicker, Member } from "../../../components/contract-badges";

type Draft = SectionInput & { uid: string };
const toDrafts = (v: ContractVersionDetail): Draft[] => v.sections.map((s) => ({ uid: s.id, key: s.key, title: s.title, body: s.body ?? "", is_appendix: s.is_appendix, clause_version_id: s.clause_version_id ?? undefined }));

/** Document of one version: read / edit sections (DRAFT only), review + approval chain, comments. */
export function DocumentTab({ contract, version, loading, error, onRetry }: { contract: ContractDetail; version: ContractVersionDetail | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
    const p = usePermissions();
    if (loading && !version) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-80" /></div>;
    if (error) return <ErrorState error={error} onRetry={onRetry} />;
    if (!version) return <EmptyState title="No version yet" />;
    const editable = version.editable && version.id === contract.current_version_id && p.can("contracts.contracts.update");
    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SectionsEditor contract={contract} version={version} editable={editable} />
            <div className="space-y-4">
                <ApprovalPanel contract={contract} version={version} />
                <CommentsPanel contract={contract} version={version} />
            </div>
        </div>
    );
}

/** Download the version as PDF; a signed version returns the stored signed document with signature blocks. */
function PdfButton({ contractId, versionId, signed }: { contractId: string; versionId: string; signed: boolean }) {
    const pdf = useDownloadContractVersionPdf();
    return (
        <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            loading={pdf.isPending}
            onClick={() => pdf.mutate({ id: contractId, versionId }, { onSuccess: (name) => toast({ title: "PDF downloaded", description: name }), onError: (e) => toast({ variant: "destructive", title: "Could not create the PDF", description: getApiErrorMessage(e) }) })}
        >
            <Download /> {signed ? "Signed PDF" : "PDF"}
        </Button>
    );
}

function SectionsEditor({ contract, version, editable }: { contract: ContractDetail; version: ContractVersionDetail; editable: boolean }) {
    const save = useSaveSections();
    const [sections, setSections] = useState<Draft[]>(() => toDrafts(version));
    const [editing, setEditing] = useState(false);
    const original = useMemo(() => JSON.stringify(toDrafts(version).map(({ uid: _u, ...s }) => s)), [version]);
    const dirty = JSON.stringify(sections.map(({ uid: _u, ...s }) => s)) !== original;
    useEffect(() => { setSections(toDrafts(version)); setEditing(false); }, [version]);

    const set = (uid: string, patch: Partial<Draft>) => setSections((all) => all.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
    const move = (i: number, d: -1 | 1) => setSections((all) => { const j = i + d; if (j < 0 || j >= all.length) return all; const n = [...all]; [n[i], n[j]] = [n[j], n[i]]; return n; });
    const keys = sections.map((s) => s.key);
    const duplicateKey = keys.some((k, i) => keys.indexOf(k) !== i);
    const submit = () =>
        save.mutate(
            { id: contract.id, vid: version.id, sections: sections.map(({ uid: _u, ...s }) => ({ ...s, title: s.title.trim() })) },
            { onSuccess: () => { toast({ title: "Document saved" }); setEditing(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        );

    return (
        <div className="min-w-0 rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-[13px] font-medium text-foreground">{version.label}</span>
                {version.content_hash && <code className="hidden truncate text-[11px] text-muted-foreground md:inline">sha256 {version.content_hash.slice(0, 16)}…</code>}
                {!version.editable && <Badge variant="neutral"><Lock className="size-3" /> Read only</Badge>}
                <PdfButton contractId={contract.id} versionId={version.id} signed={version.status === "SIGNED"} />
                {editable && !editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil /> Edit document</Button>}
                {editing && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(false)}><Eye /> Preview</Button>}
            </div>
            {editing ? (
                <div className="space-y-3 p-3">
                    {sections.map((s, i) => (
                        <div key={s.uid} className="space-y-2 rounded-md border border-border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="w-6 text-xs text-muted-foreground tabular">{i + 1}</span>
                                <Input aria-label="Section title" className="h-8 min-w-0 flex-1" value={s.title} onChange={(e) => set(s.uid, { title: e.target.value })} />
                                <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Remove section" onClick={() => setSections((all) => all.filter((x) => x.uid !== s.uid))}><Trash2 /></Button>
                            </div>
                            {s.clause_version_id && <p className="text-xs text-muted-foreground">From the clause library. Editing the text makes it a custom clause.</p>}
                            <Textarea aria-label="Section text" rows={6} className="font-mono text-[13px]" value={s.body ?? ""} onChange={(e) => set(s.uid, { body: e.target.value, clause_version_id: undefined })} />
                            <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={!!s.is_appendix} onCheckedChange={(v) => set(s.uid, { is_appendix: v })} /> Appendix</label>
                        </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => { const uid = `n${Date.now()}`; setSections((all) => [...all, { uid, key: `custom_${all.length + 1}`, title: "New section", body: "" }]); }}><Plus /> Add section</Button>
                    <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                        <span className="mr-auto text-xs text-muted-foreground">{duplicateKey ? "Two sections share a key" : dirty ? "Unsaved changes" : "No changes"}</span>
                        <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => { setSections(toDrafts(version)); setEditing(false); }}>Discard</Button>
                        <Button size="sm" loading={save.isPending} disabled={!dirty || duplicateKey || sections.some((s) => !s.title.trim())} onClick={() => submit()}>Save document</Button>
                    </div>
                </div>
            ) : sections.length === 0 ? (
                <EmptyState compact title="This version has no sections" />
            ) : (
                <article className="space-y-6 p-4 md:p-6">
                    <header className="border-b border-border pb-3">
                        <div className="font-mono text-xs text-muted-foreground">{contract.number} · {version.label}</div>
                        <h2 className="text-lg font-medium text-foreground">{contract.title}</h2>
                    </header>
                    {sections.map((s, i) => (
                        <section key={s.uid} className="space-y-1.5">
                            <h3 className="text-[15px] font-medium text-foreground">{s.is_appendix ? "Appendix · " : `${i + 1}. `}{s.title}</h3>
                            {s.body?.trim() ? <div className={markdownClass} dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} /> : <p className="text-[13px] text-muted-foreground">Empty.</p>}
                        </section>
                    ))}
                </article>
            )}
        </div>
    );
}

function ApprovalPanel({ contract, version }: { contract: ContractDetail; version: ContractVersionDetail }) {
    const session = useSessionData();
    const me = session?.active_organization?.membership_id;
    const p = usePermissions();
    const [dialog, setDialog] = useState<"review" | "approval" | null>(null);
    const [decision, setDecision] = useState<{ kind: "approval" | "review"; id: string; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" } | null>(null);
    const [comment, setComment] = useState("");
    const decideApproval = useDecideApproval();
    const decideReview = useDecideReview();
    const isCurrent = version.id === contract.current_version_id;
    const canSubmit = isCurrent && p.can("contracts.contracts.update") && ["DRAFT", "IN_REVIEW"].includes(version.status);
    const openStep = version.approvals.filter((a) => a.decision !== "APPROVED").reduce((m, a) => Math.min(m, a.step), Infinity);

    const go = () => {
        if (!decision) return;
        const opts = { onSuccess: () => { toast({ title: "Decision recorded" }); setDecision(null); setComment(""); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not record the decision", description: getApiErrorMessage(e) }) };
        if (decision.kind === "approval") decideApproval.mutate({ id: contract.id, approvalId: decision.id, decision: decision.decision as "APPROVED" | "REJECTED", comment: comment || undefined }, opts);
        else decideReview.mutate({ id: contract.id, reviewId: decision.id, decision: decision.decision, comment: comment || undefined }, opts);
    };

    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-[13px] font-medium text-foreground">Review & approval</span>
                {version.unresolved_blocking_comments > 0 && <Badge variant="danger">{version.unresolved_blocking_comments} blocking</Badge>}
            </div>
            <div className="space-y-3 p-3">
                {version.reviews.length === 0 && version.approvals.length === 0 && <p className="text-[13px] text-muted-foreground">{version.status === "APPROVED" ? "Approved. Ready to send for signature." : "No review or approval requested yet."}</p>}
                {version.reviews.map((r) => (
                    <div key={r.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            {r.reviewer ? <Member member={r.reviewer} sub="Reviewer" /> : <span className="text-[13px]">{r.reviewer_contact ? `${r.reviewer_contact.first_name} ${r.reviewer_contact.last_name ?? ""}` : "Reviewer"}</span>}
                            <Badge className="ml-auto" variant={r.decision === "APPROVED" ? "success" : r.decision === "PENDING" ? "info" : "warning"}>{r.decision.toLowerCase().replace("_", " ")}</Badge>
                        </div>
                        {r.comment && <p className="rounded bg-secondary px-2 py-1 text-xs text-foreground">{r.comment}</p>}
                        {r.decision === "PENDING" && r.reviewer_membership_id === me && p.can("contracts.contracts.review") && (
                            <div className="flex gap-1.5">
                                <Button size="sm" onClick={() => setDecision({ kind: "review", id: r.id, decision: "APPROVED" })}><Check /> Looks good</Button>
                                <Button size="sm" variant="outline" onClick={() => setDecision({ kind: "review", id: r.id, decision: "CHANGES_REQUESTED" })}><RotateCcw /> Changes</Button>
                            </div>
                        )}
                    </div>
                ))}
                {version.approvals.map((a) => (
                    <div key={a.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Member member={a.approver} sub={`Step ${a.step}${a.step_name ? ` · ${a.step_name}` : ""}`} />
                            <Badge className="ml-auto" variant={a.decision === "APPROVED" ? "success" : a.decision === "PENDING" ? "info" : "danger"}>{a.decision.toLowerCase()}</Badge>
                        </div>
                        {a.comment && <p className="rounded bg-secondary px-2 py-1 text-xs text-foreground">{a.comment}</p>}
                        {a.decision === "PENDING" && a.approver_membership_id === me && a.step === openStep && version.status === "IN_REVIEW" && p.can("contracts.contracts.approve") && (
                            <div className="flex gap-1.5">
                                <Button size="sm" onClick={() => setDecision({ kind: "approval", id: a.id, decision: "APPROVED" })}><Check /> Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => setDecision({ kind: "approval", id: a.id, decision: "REJECTED" })}><X /> Reject</Button>
                            </div>
                        )}
                    </div>
                ))}
                {canSubmit && (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                        <Button size="sm" variant="outline" onClick={() => setDialog("review")}><Users /> Request review</Button>
                        <Button size="sm" onClick={() => setDialog("approval")}><Send /> Submit for approval</Button>
                    </div>
                )}
            </div>
            <RequestReviewDialog contract={contract} version={version} open={dialog === "review"} onOpenChange={(o) => setDialog(o ? "review" : null)} />
            <SubmitApprovalDialog contract={contract} version={version} open={dialog === "approval"} onOpenChange={(o) => setDialog(o ? "approval" : null)} />
            <Dialog open={!!decision} onOpenChange={(o) => !o && !decideApproval.isPending && !decideReview.isPending && setDecision(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{decision?.decision === "APPROVED" ? "Approve" : decision?.decision === "REJECTED" ? "Reject" : "Request changes"} · {version.label}</DialogTitle>
                        <DialogDescription>Your decision applies to this exact version only.</DialogDescription>
                    </DialogHeader>
                    <Textarea aria-label="Comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={decision?.decision === "APPROVED" ? "Optional comment" : "Explain what needs to change (required)"} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
                        <Button variant={decision?.decision === "REJECTED" ? "destructive" : "default"} loading={decideApproval.isPending || decideReview.isPending} disabled={decision?.decision !== "APPROVED" && !comment.trim()} onClick={go}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RequestReviewDialog({ contract, version, open, onOpenChange }: { contract: ContractDetail; version: ContractVersionDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const request = useRequestReview();
    const [reviewers, setReviewers] = useState<string[]>([]);
    const [picking, setPicking] = useState<string | null>(null);
    const [note, setNote] = useState("");
    return (
        <Dialog open={open} onOpenChange={(o) => !request.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Request review of {version.label}</DialogTitle><DialogDescription>Reviewers read and comment. The version is not editable while it is in review.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                    {reviewers.map((id) => (
                        <div key={id} className="flex items-center gap-2"><div className="flex-1"><ContractLookupPicker kind="members" ariaLabel="Reviewer" value={id} disabled clearable={false} onChange={() => undefined} /></div><Button variant="ghost" size="icon-sm" aria-label="Remove reviewer" onClick={() => setReviewers((r) => r.filter((x) => x !== id))}><X /></Button></div>
                    ))}
                    <div className="flex gap-2"><div className="flex-1"><ContractLookupPicker kind="members" ariaLabel="Add reviewer" value={picking} placeholder="Add a reviewer" onChange={setPicking} /></div><Button variant="outline" size="sm" disabled={!picking || reviewers.includes(picking)} onClick={() => { if (picking) setReviewers((r) => [...r, picking]); setPicking(null); }}><Plus /> Add</Button></div>
                    <div className="space-y-1.5"><Label htmlFor="review-comment">Message</Label><Textarea id="review-comment" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button loading={request.isPending} disabled={!reviewers.length} onClick={() => request.mutate({ id: contract.id, vid: version.id, reviewer_membership_ids: reviewers, comment: note || undefined }, { onSuccess: () => { toast({ title: "Review requested" }); setReviewers([]); setNote(""); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not request review", description: getApiErrorMessage(e) }) })}>Request review</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SubmitApprovalDialog({ contract, version, open, onOpenChange }: { contract: ContractDetail; version: ContractVersionDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const preview = useApprovalPreview(contract.id, version.id, open);
    const submit = useSubmitForApproval();
    const [note, setNote] = useState("");
    const steps = preview.data?.steps ?? [];
    return (
        <Dialog open={open} onOpenChange={(o) => !submit.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Submit {version.label} for approval</DialogTitle><DialogDescription>Approval rules and the contract type decide the steps. With no steps, the version is approved right away.</DialogDescription></DialogHeader>
                {preview.isPending ? <Skeleton className="h-16" /> : steps.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {steps.map((s, i) => <li key={i} className="flex items-center justify-between gap-2 px-3 py-2"><Member member={s.approver} sub={`Step ${s.step}${s.step_name ? ` · ${s.step_name}` : ""}`} /><span className="truncate text-xs text-muted-foreground">{s.rule_name ?? "contract type"}</span></li>)}
                    </ul>
                ) : <p className="rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground">No approval steps apply.</p>}
                <div className="space-y-1.5"><Label htmlFor="approval-note">Note for approvers</Label><Textarea id="approval-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button loading={submit.isPending} disabled={preview.isPending} onClick={() => submit.mutate({ id: contract.id, vid: version.id, comment: note || undefined }, { onSuccess: () => { toast({ title: steps.length ? "Submitted for approval" : "Version approved" }); setNote(""); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not submit", description: getApiErrorMessage(e) }) })}>{steps.length ? "Submit" : "Approve now"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CommentsPanel({ contract, version }: { contract: ContractDetail; version: ContractVersionDetail }) {
    const p = usePermissions();
    const canInternal = p.can("contracts.comments.internal.read");
    const canWrite = p.can("contracts.contracts.update") || p.can("contracts.contracts.review");
    const comments = useContractComments(contract.id, { version_id: version.id });
    const create = useCreateComment();
    const resolve = useResolveComment();
    const [body, setBody] = useState("");
    const [internal, setInternal] = useState(canInternal);
    const [blocking, setBlocking] = useState(false);
    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Comments · {version.label}</div>
            {comments.isPending ? <div className="p-3"><Skeleton className="h-12" /></div> : comments.error ? <ErrorState error={comments.error} onRetry={() => comments.refetch()} /> : !comments.data?.data.length ? (
                <p className="px-3 py-4 text-[13px] text-muted-foreground">No comments.</p>
            ) : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                    {comments.data.data.map((c) => (
                        <li key={c.id} className={cn("space-y-1 px-3 py-2", c.resolved_at && "opacity-60")}>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{c.author?.user ? personName(c.author.user) : "Customer"}</span>
                                {c.is_internal ? <Badge variant="warning"><Lock className="size-3" /> Internal</Badge> : <Badge variant="info">External</Badge>}
                                {c.is_blocking && !c.resolved_at && <Badge variant="danger">Blocks signing</Badge>}
                                {c.section && <span>· {c.section.title}</span>}
                                <span>· {formatRelative(c.created_at)}</span>
                                {canWrite && <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => resolve.mutate({ id: contract.id, commentId: c.id, resolved: !c.resolved_at }, { onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }) })}><CheckCircle2 /> {c.resolved_at ? "Reopen" : "Resolve"}</Button>}
                            </div>
                            <p className="whitespace-pre-wrap text-[13px] text-foreground">{c.body}</p>
                            {c.resolved_at && <p className="text-[11px] text-muted-foreground">Resolved {formatDateTime(c.resolved_at)}</p>}
                        </li>
                    ))}
                </ul>
            )}
            {canWrite && (
                <div className="space-y-2 border-t border-border p-3">
                    <Textarea aria-label="New comment" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? "Internal note (never shown to the customer)" : "Comment visible to the customer"} />
                    <div className="flex flex-wrap items-center gap-3">
                        {canInternal && <label className="flex items-center gap-1.5 text-xs text-foreground"><Switch checked={internal} onCheckedChange={setInternal} /> Internal</label>}
                        <label className="flex items-center gap-1.5 text-xs text-foreground"><Switch checked={blocking} onCheckedChange={setBlocking} /> Blocks signing</label>
                        <Button size="sm" className="ml-auto" loading={create.isPending} disabled={!body.trim() || (internal && !canInternal)} onClick={() => create.mutate({ id: contract.id, version_id: version.id, body, is_internal: internal, is_blocking: blocking }, { onSuccess: () => { setBody(""); setBlocking(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not comment", description: getApiErrorMessage(e) }) })}>Comment</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
