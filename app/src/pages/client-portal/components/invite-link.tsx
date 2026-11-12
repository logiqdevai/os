import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/** Icon button that copies `text`; it shows a check for a moment instead of a success toast. */
export function CopyLinkButton({ text, label = "Copy invite link" }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const copy = () =>
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(true);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setCopied(false), 1600);
            },
            () => toast({ variant: "destructive", title: "Could not copy", description: "Select the link and copy it manually." }),
        );
    return (
        <Button type="button" size="icon-sm" variant="ghost" aria-label={copied ? "Copied" : label} onClick={() => void copy()}>
            {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
    );
}

/**
 * Result of "Resend" when the email could not be sent: the new link, shown inline (with copy) until dismissed.
 * A resend that went out by email needs no message — the row's "sent" date updates.
 */
export function InviteLinkNotice({ email, url, onDismiss }: { email: string; url: string; onDismiss: () => void }) {
    return (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info-soft px-3 py-2 text-[13px] text-foreground">
            <span className="min-w-0 flex-1">
                Email delivery is not configured — share this new link with <span className="font-medium">{email}</span> yourself:
                <code className="mt-1 block truncate text-xs text-muted-foreground">{url}</code>
            </span>
            <CopyLinkButton text={url} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={onDismiss}><X /></Button>
        </div>
    );
}
