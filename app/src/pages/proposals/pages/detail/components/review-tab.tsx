import { useState } from "react";
import { Check, CheckCircle2, Lock, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSessionData } from "@/features/session/hooks/use-session";
import { usePermissions } from "@/hooks/use-permission";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAddProposalComment, useDecideApproval, useProposalComments, useResolveProposalComment } from "@/features/proposals/hooks/use-proposals";
import type { ProposalApproval, ProposalDetail } from "@/features/proposals/interfaces/proposals.interfaces";
import { ApprovalDecisionBadge, MemberChip } from "../../../components/proposal-badges";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

/** Approval chain of the shown version (one approval binds one version) + internal / customer comments. */
export function ReviewTab({ proposal, onRequestReview }: { proposal: ProposalDetail; onRequestReview: () => void }) {
    const session = useSessionData();
    const p = usePermissions();
    const me = session?.active_organization?.membership_id;
    const v = proposal.version!;
    const decide = useDecideApproval();
    const [deciding, setDeciding] = useState<{ approval: ProposalApproval; decision: Decision } | null>(null);
    const [comment, setComment] = useState("");

    const approvals = v.approvals;
    const openStep = approvals.filter((a) => a.decision !== "APPROVED").reduce((m, a) => Math.min(m, a.step), Infinity);
    const canDecide = (a: ProposalApproval) => p.can("proposals.proposals.approve") && a.approver_membership_id === me && a.decision === "PENDING" && a.step === openStep && v.status === "IN_REVIEW";

    const submit = () => {
        if (!deciding) return;
        decide.mutate(
            { id: proposal.id, approvalId: deciding.approval.id, decision: deciding.decision, comment: comment || undefined },
            // The approval step shows the decision once recorded; failures toast globally.
            { onSuccess: () => { setDeciding(null); setComment(""); } }
        );
    };

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-fit rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <span className="text-[13px] font-medium text-foreground">Approvals · v{v.version_number}</span>
                    {p.can("proposals.proposals.update") && v.status === "DRAFT" && (
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={onRequestReview}><Send /> Request approval</Button>
                    )}
                </div>
                {approvals.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                        {v.status === "APPROVED" ? "Approved without steps: no approval rule matched this version." : "No approval requested for this version yet."}
                    </p>
                ) : (
                    <ul className="divide-y divide-border">
                        {approvals.map((a) => (
                            <li key={a.id} className="space-y-2 px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <MemberChip member={a.approver} sub={`Step ${a.step}${a.rule_id ? " · by rule" : " · requested manually"}`} />
                                    <span className="ml-auto"><ApprovalDecisionBadge decision={a.decision} /></span>
                                </div>
                                {a.comment && <p className="rounded-md bg-secondary px-2 py-1.5 text-[13px] text-foreground">{a.comment}</p>}
                                {a.decided_at && <p className="text-xs text-muted-foreground">Decided {formatDateTime(a.decided_at)}</p>}
                                {canDecide(a) && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" onClick={() => setDeciding({ approval: a, decision: "APPROVED" })}><Check /> Approve</Button>
                                        <Button size="sm" variant="outline" onClick={() => setDeciding({ approval: a, decision: "CHANGES_REQUESTED" })}><RotateCcw /> Request changes</Button>
                                        <Button size="sm" variant="destructive" onClick={() => setDeciding({ approval: a, decision: "REJECTED" })}><X /> Reject</Button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <CommentsPanel proposal={proposal} />

            <Dialog open={!!deciding} onOpenChange={(o) => !decide.isPending && !o && setDeciding(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{deciding?.decision === "APPROVED" ? "Approve this version?" : deciding?.decision === "REJECTED" ? "Reject this version?" : "Request changes?"}</DialogTitle>
                        <DialogDescription>
                            {proposal.number} v{v.version_number}. {deciding?.decision === "APPROVED" ? "Your approval applies to this version only." : "The version goes back to draft; the owner sees your comment."}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea aria-label="Comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={deciding?.decision === "APPROVED" ? "Optional comment" : "What needs to change? (required)"} />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeciding(null)} disabled={decide.isPending}>Cancel</Button>
                        <Button variant={deciding?.decision === "REJECTED" ? "destructive" : "default"} loading={decide.isPending} disabled={deciding?.decision !== "APPROVED" && !comment.trim()} onClick={submit}>
                            {deciding?.decision === "APPROVED" ? "Approve" : deciding?.decision === "REJECTED" ? "Reject" : "Request changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CommentsPanel({ proposal }: { proposal: ProposalDetail }) {
    const p = usePermissions();
    const canInternal = p.can("proposals.comments.internal.read");
    const canReply = p.can("proposals.proposals.update");
    const comments = useProposalComments(proposal.id);
    const add = useAddProposalComment();
    const resolve = useResolveProposalComment();
    const [body, setBody] = useState("");
    const [internal, setInternal] = useState(canInternal);
    const canWrite = (internal && canInternal) || (!internal && canReply);

    const post = () =>
        add.mutate(
            { id: proposal.id, body, is_internal: internal, version_id: proposal.version?.id },
            { onSuccess: () => setBody("") } // the comment appears in the list
        );

    return (
        <div className="h-fit rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">Comments</span>
                {!canInternal && <span className="ml-auto text-xs text-muted-foreground">Customer thread only</span>}
            </div>
            {comments.isPending ? (
                <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : comments.error ? (
                <ErrorState error={comments.error} onRetry={() => comments.refetch()} />
            ) : !comments.data?.length ? (
                <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No comments yet.</p>
            ) : (
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                    {comments.data.map((c) => (
                        <li key={c.id} className={cn("space-y-1 px-3 py-2.5", c.resolved_at && "opacity-60")}>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{c.author ? personName(c.author.user) : "Customer"}</span>
                                {c.is_internal ? <Badge variant="warning"><Lock className="size-3" /> Internal</Badge> : <Badge variant="info">Customer thread</Badge>}
                                {c.section && <span>on {c.section.title}</span>}
                                <span>· {formatRelative(c.created_at)}</span>
                                {canReply && (
                                    <Button size="sm" variant="ghost" className="ml-auto h-6" onClick={() => resolve.mutate({ id: proposal.id, commentId: c.id, resolved: !c.resolved_at })}>
                                        <CheckCircle2 /> {c.resolved_at ? "Reopen" : "Resolve"}
                                    </Button>
                                )}
                            </div>
                            <p className="whitespace-pre-wrap text-[13px] text-foreground">{c.body}</p>
                        </li>
                    ))}
                </ul>
            )}
            {(canInternal || canReply) && (
                <div className="space-y-2 border-t border-border p-3">
                    <Textarea aria-label="New comment" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? "Note for the team (never shown to the customer)" : "Reply visible to the customer on the proposal page"} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {canInternal && canReply ? (
                            <label className="flex items-center gap-2 text-[13px] text-foreground"><Switch checked={internal} onCheckedChange={setInternal} /> Internal</label>
                        ) : <span />}
                        <Button size="sm" disabled={!body.trim() || !canWrite} loading={add.isPending} onClick={post}>Comment</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
