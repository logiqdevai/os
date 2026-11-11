import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Comment prompt for approve (optional), reject (required, ≥ 3 chars) and unlock (required reason). */
export function DecideDialog({ mode, title, description, loading, onClose, onConfirm }: {
    mode: "approve" | "reject" | "unlock" | null;
    title: string;
    description?: string;
    loading: boolean;
    onClose: () => void;
    onConfirm: (comment: string) => void;
}) {
    const [comment, setComment] = useState("");
    useEffect(() => { if (mode) setComment(""); }, [mode]);
    const required = mode === "reject" || mode === "unlock";
    return (
        <Dialog open={!!mode} onOpenChange={(o) => !o && !loading && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
                <div className="space-y-1.5">
                    <Label htmlFor="decide-comment">{mode === "unlock" ? "Reason" : required ? "What needs to change?" : "Comment (optional)"}</Label>
                    <Textarea id="decide-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant={mode === "reject" ? "destructive" : "default"} disabled={required && comment.trim().length < 3} loading={loading} onClick={() => onConfirm(comment.trim())}>
                        {mode === "approve" ? "Approve" : mode === "reject" ? "Return to member" : "Unlock"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
