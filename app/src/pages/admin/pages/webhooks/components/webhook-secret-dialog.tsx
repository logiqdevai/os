import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyField } from "../../../components/copy-field";

export interface WebhookSecret {
    title: string;
    secret: string;
    note?: string;
}

/** Signing secret shown once (after create or rotate), with how to verify deliveries. */
export function WebhookSecretDialog({ secret, onClose }: { secret: WebhookSecret | null; onClose: () => void }) {
    return (
        <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{secret?.title}</DialogTitle>
                    <DialogDescription>Copy it now: it is shown only once. {secret?.note}</DialogDescription>
                </DialogHeader>
                {secret && <CopyField value={secret.secret} label="signing secret" />}
                <div className="space-y-1.5 rounded-md border border-border bg-secondary p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Verify each delivery</p>
                    <p>
                        The <code className="font-mono">X-Logiqdev-Signature</code> header is <code className="font-mono">t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>, where v1 is
                        HMAC-SHA256 of <code className="font-mono">&lt;timestamp&gt;.&lt;raw body&gt;</code> with this secret. Reject old timestamps to stop replays.
                    </p>
                </div>
                <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
