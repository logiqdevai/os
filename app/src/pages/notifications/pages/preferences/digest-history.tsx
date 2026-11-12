import { useState } from "react";
import { Section } from "@/components/ui/page";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatDate, formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DigestFrequencyFormOptions, DigestStatusOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useMyDigests } from "@/features/notifications/hooks/use-notifications";
import type { MyDigest } from "@/features/notifications/interfaces/notifications.interfaces";

const STATUS_VARIANT: Record<MyDigest["status"], BadgeVariant> = { OPEN: "info", SCHEDULED: "info", SENDING: "info", SENT: "success", EMPTY: "neutral", FAILED: "danger" };
const LIMIT = 10;

/**
 * "My digest history" (mockup 14 "Quiet hours and digests", spec §8): what was batched for me and when it went out.
 * @api GET /notifications/digests · @perm notifications.preferences.manage_own
 * @states loading · empty (no digests yet: digests start once delivery is set to hourly / daily / weekly) · error
 */
export function DigestHistory() {
    const [page, setPage] = useState(1);
    const q = useMyDigests({ page, limit: LIMIT });
    const rows = q.data?.data ?? [];
    const pages = q.data?.pagination ? Math.max(1, Math.ceil(q.data.pagination.total / LIMIT)) : 1;

    return (
        <Section title="My digest history" description="Summaries sent instead of single emails.">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
                {q.isLoading ? (
                    <ListSkeleton rows={3} />
                ) : q.error ? (
                    <ErrorState error={q.error} onRetry={() => q.refetch()} />
                ) : !rows.length ? (
                    <EmptyState compact title="No digests yet" description="Set Delivery to hourly, daily or weekly and non-urgent emails are batched here." />
                ) : (
                    rows.map((d) => (
                        <div key={d.id} className="flex flex-col gap-1 border-b border-border-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-foreground">
                                    {getDropdownOptionLabel(DigestFrequencyFormOptions, d.frequency)} · {formatDate(d.period_start)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {d.sent_at ? `Sent ${formatDateTime(d.sent_at)}` : `Scheduled ${formatDateTime(d.scheduled_for)}`}
                                    {d.failure_reason && ` · ${d.failure_reason}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{d.item_count} item{d.item_count === 1 ? "" : "s"}</span>
                                <Badge variant={STATUS_VARIANT[d.status]}>{getDropdownOptionLabel(DigestStatusOptions, d.status)}</Badge>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {pages > 1 && (
                <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>Page {page} of {pages}</span>
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
            )}
        </Section>
    );
}
