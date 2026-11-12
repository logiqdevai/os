import { Tags } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime } from "@/lib/format";
import { useContactTopics, useSetContactTopics } from "@/features/communications/hooks/use-topics";

/**
 * Topic subscriptions of one contact (opened from the consent table).
 * @perm view communications.consents.read · change communications.consents.manage (sensitive, audited)
 * @api GET/PUT /communications/topics/contacts/:contactId
 */
export function ContactTopicsSheet({ contactId, onOpenChange }: { contactId: string | null; onOpenChange: (open: boolean) => void }) {
    const data = useContactTopics(contactId ?? undefined);
    const set = useSetContactTopics();
    const canManage = usePermission("communications.consents.manage");
    const name = data.data ? [data.data.contact.first_name, data.data.contact.last_name].filter(Boolean).join(" ") : "";

    const toggle = (topicId: string, on: boolean) =>
        contactId &&
        // The switch flips at once (rolled back if the API refuses).
        set.mutate({ contactId, subscriptions: [{ topic_id: topicId, status: on ? "OPTED_IN" : "OPTED_OUT" }] });

    return (
        <Sheet open={!!contactId} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{name || "Topics"}</SheetTitle>
                    <SheetDescription>Topic subscriptions. A topic campaign needs the topic and channel consent.</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                    {data.isPending ? (
                        <ListSkeleton rows={4} />
                    ) : data.error ? (
                        <ErrorState error={data.error} onRetry={() => data.refetch()} />
                    ) : !data.data.topics.length ? (
                        <EmptyState compact icon={Tags} title="No topics" description="Create topics in the Topics tab." />
                    ) : (
                        <ul className="divide-y divide-border">
                            {data.data.topics.map((t) => (
                                <li key={t.topic.id} className="flex items-start justify-between gap-3 py-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-medium text-foreground">{t.topic.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {t.status === "UNKNOWN" ? `No choice yet · default ${t.topic.default_opt_in ? "subscribed" : "not subscribed"}` : `${t.status === "OPTED_IN" ? "Subscribed" : "Opted out"}${t.updated_at ? ` · ${formatDateTime(t.updated_at)}` : ""}`}
                                        </p>
                                        {t.source === "UNSUBSCRIBE_LINK" && <Badge variant="neutral">Chosen by the contact</Badge>}
                                    </div>
                                    <Switch checked={t.effective} disabled={!canManage} onCheckedChange={(v) => toggle(t.topic.id, v)} aria-label={`Subscribed to ${t.topic.name}`} />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
