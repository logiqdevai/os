import { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";
import { useRevokeCalendarFeed, useRotateCalendarFeed } from "@/features/calendar/hooks/use-calendar";
import type { CalendarRow } from "@/features/calendar/interfaces/calendar.interfaces";

/**
 * iCal subscription link of one calendar (19 §7).
 * @perm owner / MANAGE share (personal) or calendar.calendars.manage · @api POST/DELETE /calendar/calendars/:id/feed
 * The secret is stored hashed: the URL is shown only right after it is created or rotated.
 */
export function FeedDialog({ calendar, onClose }: { calendar: CalendarRow | null; onClose: () => void }) {
    const rotate = useRotateCalendarFeed();
    const revoke = useRevokeCalendarFeed();
    const [url, setUrl] = useState<string | null>(null);
    /** The copy button shows a check for a moment instead of a "Link copied" toast. */
    const [copied, setCopied] = useState(false);
    useEffect(() => setUrl(null), [calendar?.id]);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(t);
    }, [copied]);
    const enabled = url ? true : !!calendar?.feed_enabled;
    const busy = rotate.isPending || revoke.isPending;

    const copy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            toast({ variant: "destructive", title: "Copy failed", description: "Select the link and copy it manually." });
        }
    };

    return (
        <Dialog open={!!calendar} onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Subscribe to “{calendar?.name}”</DialogTitle>
                    <DialogDescription>A private link that Google Calendar, Apple Calendar or Outlook can subscribe to (read only, refreshed about every hour). Private events show as “Busy”.</DialogDescription>
                </DialogHeader>
                {url ? (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input readOnly value={url} aria-label="Subscription link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                            <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={copied ? "Copied" : "Copy link"}>{copied ? <Check className="text-success" /> : <Copy />}</Button>
                        </div>
                        <p className="flex items-start gap-1.5 text-xs text-warning"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Copy it now: it is not shown again. Anyone with the link can see this calendar.</p>
                    </div>
                ) : enabled ? (
                    <p className="text-[13px] text-body">
                        The subscription link is on{calendar?.feed_token_rotated_at ? ` (created ${formatDateTime(calendar.feed_token_rotated_at)})` : ""}. For your security the link is not shown again; create a new one to see it. The old link then stops working.
                    </p>
                ) : (
                    <p className="text-[13px] text-muted-foreground">No subscription link yet.</p>
                )}
                <DialogFooter className="gap-2">
                    {enabled && <Button variant="outline" className="text-danger" loading={revoke.isPending} disabled={busy} onClick={() => calendar && revoke.mutate(calendar.id, { onSuccess: () => { setUrl(null); onClose(); } })}>Turn off link</Button>}
                    <Button loading={rotate.isPending} disabled={busy} onClick={() => calendar && rotate.mutate(calendar.id, { onSuccess: (r) => setUrl(r.url ?? null) })}>
                        {enabled ? <><RefreshCw /> New link</> : <><Link2 /> Create link</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
