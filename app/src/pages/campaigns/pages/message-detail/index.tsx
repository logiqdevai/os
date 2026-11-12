import { useParams } from "react-router-dom";
import { Ban, Circle, RotateCcw, TriangleAlert } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCommMessage, useMessageAction } from "@/features/communications/hooks/use-communications";
import { CommDeliveryEventTypeOptions, CommMessageKindFormOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import { ChannelBadge, MessageStatusBadge } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

const EVENT_TONE: Record<string, string> = { DELIVERED: "text-success", OPENED: "text-info", CLICKED: "text-info", BOUNCED: "text-danger", FAILED: "text-danger", COMPLAINED: "text-danger", UNSUBSCRIBED: "text-warning" };

/**
 * /campaigns/messages/:id
 * @perm communications.messages.read · resend / cancel communications.messages.send
 * @api GET /communications/messages/:id · POST /:id/resend · POST /:id/cancel
 */
export default function MessageDetailPage() {
    const { id } = useParams();
    const message = useCommMessage(id);
    const action = useMessageAction();
    if (message.isPending) return <PageSkeleton />;
    if (message.error) return <Page><ErrorState error={message.error} onRetry={() => message.refetch()} /></Page>;
    const m = message.data;
    const run = (a: "resend" | "cancel") =>
        // The status badge changes at once; the server's result (incl. a new failure reason) replaces it when it returns.
        action.mutate({ id: m.id, action: a });

    return (
        <Page width="wide">
            <PageHeader
                back={m.campaign ? { to: `${CampaignPaths.detail(m.campaign.id)}?tab=recipients`, label: m.campaign.name } : { to: CampaignPaths.messages, label: "Message log" }}
                title={m.subject ?? `SMS to ${m.to_name ?? m.to_address}`}
                meta={<><MessageStatusBadge status={m.status} /><ChannelBadge channel={m.channel} /></>}
                actions={
                    <Can permission="communications.messages.send">
                        {["FAILED", "BOUNCED", "CANCELLED"].includes(m.status) && <Button variant="outline" onClick={() => run("resend")} loading={action.isPending}><RotateCcw /> Resend</Button>}
                        {["SCHEDULED", "QUEUED", "DRAFT"].includes(m.status) && <Button variant="outline" onClick={() => run("cancel")} loading={action.isPending}><Ban /> Cancel</Button>}
                    </Can>
                }
            />
            {(m.failure_reason || m.last_error) && ["FAILED", "BOUNCED", "CANCELLED", "QUEUED"].includes(m.status) && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {m.failure_reason ?? m.last_error}
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-6">
                    <Section title="Content">
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            {m.body_html ? (
                                <iframe title="Message content" sandbox="" srcDoc={m.body_html} className="h-[28rem] w-full bg-white" />
                            ) : (
                                <pre className="whitespace-pre-wrap p-4 font-sans text-[13px] text-foreground">{m.body_text ?? "—"}</pre>
                            )}
                        </div>
                    </Section>
                </div>
                <div className="min-w-0 space-y-6">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList
                            columns={1}
                            items={[
                                { label: "To", value: m.to_name ? `${m.to_name} <${m.to_address}>` : m.to_address },
                                { label: "From", value: m.sender_identity ? m.sender_identity.address : "Default sender" },
                                { label: "Kind", value: getDropdownOptionLabel(CommMessageKindFormOptions, m.kind) },
                                { label: "Template", value: m.template?.name },
                                { label: "Sent by", value: m.sent_by ? personName(m.sent_by.user) : null },
                                { label: "Sent", value: m.sent_at ? formatDateTime(m.sent_at) : m.scheduled_at ? `Scheduled ${formatDateTime(m.scheduled_at)}` : null },
                                ...(m.sms_segment_count ? [{ label: "SMS segments", value: String(m.sms_segment_count) }] : []),
                            ]}
                        />
                    </div>
                    <Section title="Delivery timeline">
                        {m.delivery_events.length === 0 ? (
                            <EmptyState compact title="No delivery events yet" />
                        ) : (
                            <ol className="space-y-3 rounded-lg border border-border bg-card p-4">
                                {m.delivery_events.map((e) => (
                                    <li key={e.id} className="flex gap-2.5">
                                        <Circle className={`mt-1 size-2.5 shrink-0 fill-current ${EVENT_TONE[e.type] ?? "text-muted-foreground"}`} />
                                        <div className="min-w-0">
                                            <div className="text-[13px] text-foreground">{getDropdownOptionLabel(CommDeliveryEventTypeOptions, e.type)}</div>
                                            <div className="truncate text-xs text-muted-foreground">{formatDateTime(e.occurred_at)}{e.url ? ` · ${e.url}` : ""}{e.reason ? ` · ${e.reason}` : ""}</div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Section>
                </div>
            </div>
        </Page>
    );
}
