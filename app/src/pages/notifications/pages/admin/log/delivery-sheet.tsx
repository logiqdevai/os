import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { KeyValueList } from "@/components/ui/page";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DigestFrequencyFormOptions, NotificationChannelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useDelivery, useRetryDelivery } from "@/features/notifications/hooks/use-notification-admin";
import { DeliveryStatusBadge } from "../components/admin-ui";

/**
 * One delivery (mockup "Delivery detail"): timeline, rendered content (hidden when previews are off), retry.
 * @perm notifications.audit.read (viewing is audited) · retry notifications.deliveries.retry
 * @api GET /notification-deliveries/:id · POST /notification-deliveries/:id/retry
 */
export function DeliverySheet({ id, onClose }: { id: string | null; onClose: () => void }) {
    const q = useDelivery(id ?? undefined);
    const retry = useRetryDelivery();
    const [confirm, setConfirm] = useState(false);
    const d = q.data;
    const timeline = d
        ? ([
            ["Created", d.created_at],
            ["Last attempt", d.last_attempted_at],
            ["Next attempt", d.next_attempt_at],
            ["Sent", d.sent_at],
            ["Delivered", d.delivered_at],
            ["Opened", d.opened_at],
            ["Failed", d.failed_at],
        ] as const).filter(([, v]) => !!v)
        : [];

    return (
        <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle className="truncate pr-6">{d?.notification.title ?? "Delivery"}</SheetTitle>
                    <SheetDescription>{d ? <code className="text-xs">{d.notification.event_key}</code> : "Loading…"}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-5 px-4 pb-6">
                    {q.isLoading ? <ListSkeleton rows={6} /> : q.error || !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <DeliveryStatusBadge status={d.status} skip={d.skip_reason} />
                                {d.can_retry && (
                                    <Can permission="notifications.deliveries.retry">
                                        <Button size="sm" onClick={() => setConfirm(true)}><RefreshCw /> Retry now</Button>
                                    </Can>
                                )}
                            </div>
                            {d.failure_reason && <p className="rounded-md border border-border bg-danger-soft px-3 py-2 text-[13px] text-danger">{d.failure_reason}</p>}
                            <KeyValueList columns={1} items={[
                                { label: "Recipient", value: d.notification.recipient_membership ? personName(d.notification.recipient_membership.user) : "—" },
                                { label: "Channel", value: getDropdownOptionLabel(NotificationChannelOptions, d.channel) },
                                { label: "Destination", value: d.destination ?? "—" },
                                { label: "Attempts", value: `${d.attempt_count} of ${d.max_attempts}` },
                                { label: "Provider", value: d.provider ? `${d.provider}${d.provider_message_id ? ` · ${d.provider_message_id}` : ""}` : "—" },
                                { label: "Template", value: d.template ? `${d.template.organization_id ? "Organization" : "Platform"} · v${d.template.version}${d.template.locale ? ` · ${d.template.locale}` : ""}` : "Built-in layout" },
                                ...(d.digest ? [{ label: "Digest", value: `${getDropdownOptionLabel(DigestFrequencyFormOptions, d.digest.frequency)} · ${formatDateTime(d.digest.sent_at ?? d.digest.scheduled_for)}` }] : []),
                                ...(d.comm_message_id ? [{ label: "Email message", value: <code className="text-xs">{d.comm_message_id}</code> }] : []),
                            ]} />
                            <section>
                                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Timeline</h3>
                                <ol className="space-y-1.5 border-l border-border pl-3">
                                    {timeline.map(([label, at]) => (
                                        <li key={label} className="text-[13px]"><span className="text-foreground">{label}</span> <span className="text-muted-foreground">· {formatDateTime(at)}</span></li>
                                    ))}
                                </ol>
                            </section>
                            <section>
                                <h3 className="mb-2 text-xs font-medium text-muted-foreground">Rendered content</h3>
                                {d.preview_hidden ? (
                                    <p className="text-[13px] text-muted-foreground">Hidden: the recipient turned previews off.</p>
                                ) : d.rendered_subject || d.rendered_body ? (
                                    <div className="space-y-1 rounded-md border border-border bg-card p-3 text-[13px]">
                                        {d.rendered_subject && <p className="font-medium text-foreground">{d.rendered_subject}</p>}
                                        {d.rendered_body && <p className="whitespace-pre-wrap text-body">{d.rendered_body}</p>}
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-muted-foreground">Not rendered yet.</p>
                                )}
                            </section>
                        </>
                    )}
                </div>
                <ConfirmationDialog
                    isOpen={confirm}
                    onClose={() => setConfirm(false)}
                    title="Retry this delivery?"
                    description="A new email is sent through your organization's email connection."
                    confirmText="Retry"
                    isLoading={retry.isPending}
                    onConfirm={() => id && retry.mutate(id, { onSuccess: () => setConfirm(false) })}
                />
            </SheetContent>
        </Sheet>
    );
}
