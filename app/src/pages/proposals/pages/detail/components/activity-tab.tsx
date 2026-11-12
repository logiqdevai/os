import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProposalEventTypeOptions } from "@/config/constants/dropdowns/proposals/proposal-status.options";
import { ProposalDeliveryChannelOptions, ProposalDeliveryStatusOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { useProposalActivity } from "@/features/proposals/hooks/use-proposals";

const meta = (m: Record<string, unknown> | null) => {
    if (!m) return null;
    const parts: string[] = [];
    if (m.reminder === true) parts.push(`expiry reminder (${String(m.days_before_expiry ?? "")} days left)`);
    if (typeof m.time_on_page_seconds === "number" && m.time_on_page_seconds > 0) parts.push(`${Math.max(1, Math.round(m.time_on_page_seconds / 60))} min on page`);
    if (m.sections && typeof m.sections === "object") parts.push(`${Object.keys(m.sections).length} sections read`);
    if (m.format === "pdf") parts.push("PDF");
    if (typeof m.signer_name === "string") parts.push(m.signer_name);
    if (typeof m.author_name === "string") parts.push(m.author_name);
    if (Array.isArray(m.recipients) && m.recipients.length) parts.push(m.recipients.join(", "));
    if (typeof m.lost_reason === "string") parts.push(`reason: ${m.lost_reason.toLowerCase()}`);
    if (typeof m.contract_number === "string") parts.push(m.contract_number);
    if (typeof m.note === "string" && m.note) parts.push(m.note);
    return parts.join(" · ") || null;
};

/** Tracking: ProposalEvent timeline + deliveries. Customer IP / user agent are staff-only personal data. */
export function ActivityTab({ proposalId }: { proposalId: string }) {
    const activity = useProposalActivity(proposalId);
    if (activity.isPending) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
    if (activity.error) return <ErrorState error={activity.error} onRetry={() => activity.refetch()} />;
    const { events, deliveries } = activity.data;
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-[13px] font-medium text-foreground">Timeline</div>
                {events.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">Nothing yet.</p>
                ) : (
                    <ol className="relative space-y-3 border-l border-border pl-4">
                        {events.map((e) => (
                            <li key={e.id} className="relative">
                                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border-strong" />
                                <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                                    <span className="font-medium text-foreground">{getDropdownOptionLabel(ProposalEventTypeOptions, e.type)}</span>
                                    {e.version && <span className="text-xs text-muted-foreground">v{e.version.version_number}</span>}
                                    <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                                </div>
                                {meta(e.metadata) && <div className="text-xs text-muted-foreground">{meta(e.metadata)}</div>}
                                {e.ip_address && <div className="truncate text-[11px] text-muted-foreground">{e.ip_address}{e.user_agent ? ` · ${e.user_agent}` : ""}</div>}
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <div className="h-fit rounded-lg border border-border bg-card">
                <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-foreground">Deliveries</div>
                {deliveries.length === 0 ? (
                    <p className="px-3 py-4 text-[13px] text-muted-foreground">Not sent yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {deliveries.map((d) => (
                            <li key={d.id} className="space-y-0.5 px-3 py-2 text-[13px]">
                                <div className="flex items-center gap-2">
                                    <span className="text-foreground">{getDropdownOptionLabel(ProposalDeliveryChannelOptions, d.channel)}</span>
                                    <Badge variant={d.status === "FAILED" ? "danger" : d.status === "QUEUED" ? "neutral" : "success"}>{getDropdownOptionLabel(ProposalDeliveryStatusOptions, d.status)}</Badge>
                                    {d.version && <span className="ml-auto text-xs text-muted-foreground">v{d.version.version_number}</span>}
                                </div>
                                {d.recipient_email && <div className="truncate text-xs text-muted-foreground">{d.recipient_email}</div>}
                                {d.failed_reason && <div className="text-xs text-danger">{d.failed_reason}</div>}
                                <div className="text-xs text-muted-foreground">{formatDateTime(d.sent_at ?? d.created_at)}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
