import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useReportMessage } from "@/features/messaging/hooks/use-messaging-admin";
import type { ReportReason } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { ReportReasonOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";

/**
 * Report a message to the moderators. The reporter stays anonymous to the author.
 * @perm messaging.messages.read · @api POST /messaging/messages/:id/report
 */
export function ReportMessageDialog({ messageId, open, onOpenChange }: { messageId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
    const report = useReportMessage();
    const [reason, setReason] = useState<ReportReason>("spam");
    const [details, setDetails] = useState("");
    const submit = () =>
        report.mutate({ id: messageId, reason, details: details.trim() || undefined }, {
            onSuccess: (r) => { toast({ title: r.duplicate ? "You already reported this message" : "Reported to the moderators" }); onOpenChange(false); },
            onError: (e) => toast({ variant: "destructive", title: "Could not report", description: getApiErrorMessage(e) }),
        });
    return (
        <Dialog open={open} onOpenChange={(o) => !report.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Report message</DialogTitle>
                    <DialogDescription>Moderators review the message. The author does not see who reported it.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Reason</Label>
                        <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
                            <SelectTrigger aria-label="Reason"><SelectValue /></SelectTrigger>
                            <SelectContent>{ReportReasonOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="report-details">Details (optional)</Label>
                        <Textarea id="report-details" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={report.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={report.isPending}>Report</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
