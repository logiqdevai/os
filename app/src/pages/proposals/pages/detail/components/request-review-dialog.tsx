import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useReviewPreview, useSubmitForReview } from "@/features/proposals/hooks/use-proposals";
import type { ProposalDetail } from "@/features/proposals/interfaces/proposals.interfaces";
import { MemberChip } from "../../../components/proposal-badges";
import { LookupPicker } from "../../../components/lookup-picker";

/** Submit the current draft version: shows which approval rules match and lets the owner add approvers. */
export function RequestReviewDialog({ proposal, open, onOpenChange }: { proposal: ProposalDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
    const v = proposal.version!;
    const preview = useReviewPreview(proposal.id, v.id, open);
    const submit = useSubmitForReview();
    const [extra, setExtra] = useState<string[]>([]);
    const [picking, setPicking] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const steps = preview.data?.steps ?? [];
    const nothing = !steps.length && !extra.length;

    const go = () =>
        submit.mutate(
            { id: proposal.id, versionId: v.id, approver_membership_ids: extra.length ? extra : undefined, note: note || undefined },
            {
                onSuccess: () => {
                    toast({ title: nothing ? "Version approved" : "Approval requested", description: nothing ? "No rule required approval. You can send it now." : "Approvers were notified." });
                    setExtra([]); setNote("");
                    onOpenChange(false);
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not submit", description: getApiErrorMessage(e) }),
            }
        );

    return (
        <Dialog open={open} onOpenChange={(o) => !submit.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Request approval for v{v.version_number}</DialogTitle>
                    <DialogDescription>The version is locked for editing while it is in review. Approval of this version does not carry over to later versions.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Required by approval rules</Label>
                        {preview.isPending ? (
                            <Skeleton className="h-12" />
                        ) : steps.length ? (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {steps.map((s) => (
                                    <li key={`${s.step}-${s.approver_membership_id}`} className="flex items-center justify-between gap-2 px-3 py-2">
                                        <MemberChip member={s.approver} sub={`Step ${s.step} · ${s.name}`} />
                                        <span className="truncate text-xs text-muted-foreground">{s.rule_name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground">No rule matches this version.</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Additional approvers</Label>
                        {extra.map((id) => (
                            <div key={id} className="flex items-center gap-2">
                                <div className="flex-1"><LookupPicker kind="members" ariaLabel="Approver" value={id} clearable={false} disabled onChange={() => undefined} /></div>
                                <Button variant="ghost" size="icon-sm" aria-label="Remove approver" onClick={() => setExtra((all) => all.filter((x) => x !== id))}><X /></Button>
                            </div>
                        ))}
                        <div className="flex items-center gap-2">
                            <div className="flex-1"><LookupPicker kind="members" ariaLabel="Add approver" value={picking} placeholder="Add a person" onChange={(id) => setPicking(id)} /></div>
                            <Button variant="outline" size="sm" disabled={!picking || extra.includes(picking)} onClick={() => { if (picking) setExtra((all) => [...all, picking]); setPicking(null); }}><Plus /> Add</Button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="review-note">Note for approvers</Label>
                        <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context, e.g. why the discount is needed" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submit.isPending}>Cancel</Button>
                    <Button loading={submit.isPending} disabled={preview.isPending} onClick={go}>{nothing ? "Mark approved" : "Request approval"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
