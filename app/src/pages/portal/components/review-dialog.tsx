import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
    // Optimistic: the deliverable shows the decision at once (Review button gone, status + history updated).
    const submit = () => {
        if (!deliverable) return;
        review.mutate({ id: deliverable.id, decision, comment: comment.trim() || undefined });
        onClose();
    };
    return (
        <Dialog open={!!deliverable} onOpenChange={(o) => !o && onClose()}>
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
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit} disabled={needsComment && !comment.trim()} variant={decision === "REJECTED" ? "destructive" : "default"}>Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
