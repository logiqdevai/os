import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyField } from "./copy-field";

/** Shows a secret exactly once (API keys). Closing it discards the value from memory. */
export function SecretOnceDialog({ secret, title, onClose }: { secret: string | null; title: string; onClose: () => void }) {
    return (
        <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Copy it now and store it somewhere safe. You will not be able to see it again.</DialogDescription>
                </DialogHeader>
                {secret && <CopyField value={secret} label="secret" />}
                <p className="flex items-start gap-2 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-4 flex-none" /> Anyone with this key acts with its permissions. Revoke it if it leaks.</p>
                <DialogFooter><Button onClick={onClose}>I saved it</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
