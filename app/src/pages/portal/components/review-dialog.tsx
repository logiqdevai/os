import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useReviewDeliverable } from "@/features/portal/hooks/use-portal";
import type { PortalDeliverable } from "@/features/portal/interfaces/portal.interfaces";

type Decision = "ACCEPTED" | "CHANGES_REQUESTED" | "REJECTED";

/** Approve, request changes or reject a deliverable (07 §7). Changes and rejections need a comment. */
export function ReviewDialog({ deliverable, onClose }: { deliverable: PortalDeliverable | null; onClose: () => void }) {
    const review = useReviewDeliverable();
    const [decision, setDecision] = useState<Decision>("ACCEPTED");
    const [comment, setComment] = useState("");
    useEffect(() => {
        if (deliverable) { setDecision("ACCEPTED"); setComment(""); }
    }, [deliverable]);
    const needsComment = decision !== "ACCEPTED";
    const submit = () =>
        deliverable &&
        review.mutate(
            { id: deliverable.id, decision, comment: comment.trim() || undefined },
            {
                onSuccess: (r) => {
                    toast({ title: decision === "ACCEPTED" ? (r.status === "ACCEPTED" ? "Approved — thank you!" : "Your approval is recorded; waiting for the other approvers") : decision === "REJECTED" ? "Rejected" : "Changes requested" });
                    onClose();
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not send your review", description: getApiErrorMessage(e) }),
            },
        );
    return (
        <Dialog open={!!deliverable} onOpenChange={(o) => !o && !review.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Review “{deliverable?.name}”</DialogTitle>
                    <DialogDescription>Your decision is shared with the team and kept in the approval history.</DialogDescription>
                </DialogHeader>
                <RadioGroup value={decision} onValueChange={(v) => setDecision(v as Decision)} className="space-y-2">
                    {([["ACCEPTED", "Approve"], ["CHANGES_REQUESTED", "Request changes"], ["REJECTED", "Reject"]] as const).map(([v, l]) => (
                        <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`d-${v}`} /><Label htmlFor={`d-${v}`}>{l}</Label></div>
                    ))}
                </RadioGroup>
                <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={needsComment ? "What should change? (required)" : "Comment (optional)"} aria-label="Comment" />
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={review.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={review.isPending} disabled={needsComment && !comment.trim()} variant={decision === "REJECTED" ? "destructive" : "default"}>Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
