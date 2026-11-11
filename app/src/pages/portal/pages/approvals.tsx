import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliverableReviewStatusOptions } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalApprovals } from "@/features/portal/hooks/use-portal";
import type { PortalDeliverable } from "@/features/portal/interfaces/portal.interfaces";
import { DeliverableStatusBadge, PortalCard, PortalHeader } from "../components/portal-ui";
import { ReviewDialog } from "../components/review-dialog";

/** Customer approvals — /portal/approvals (mockup 07-portal `cp-approvals`). @perm portal.deliverables.approve */
export default function PortalApprovalsPage() {
    const [tab, setTab] = useState("waiting");
    const approvals = usePortalApprovals({ status: tab === "decided" ? "decided" : undefined, limit: 50 });
    const [reviewing, setReviewing] = useState<PortalDeliverable | null>(null);
    return (
        <>
            <PortalHeader title="Approvals" description="Deliverables the team needs your decision on." />
            <Tabs value={tab} onValueChange={setTab} className="mb-4"><TabsList><TabsTrigger value="waiting">Waiting for you</TabsTrigger><TabsTrigger value="decided">History</TabsTrigger></TabsList></Tabs>
            {approvals.isLoading ? <ListSkeleton /> : approvals.error ? <ErrorState error={approvals.error} onRetry={() => approvals.refetch()} /> : !approvals.data?.data.length ? (
                <EmptyState icon={CheckCheck} title={tab === "waiting" ? "Nothing to approve" : "No decisions yet"} description={tab === "waiting" ? "We'll let you know when something needs your review." : undefined} />
            ) : (
                <PortalCard>
                    <ul className="divide-y divide-border-soft">
                        {approvals.data.data.map((d) => (
                            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-medium">{d.name}</div>
                                    <div className="text-xs text-muted-foreground">{d.project?.name}{d.due_date ? ` · due ${formatDate(d.due_date)}` : ""}{d.reviews[0] ? ` · last: ${getDropdownOptionLabel(DeliverableReviewStatusOptions, d.reviews[0].decision)} ${formatRelative(d.reviews[0].decided_at)}` : ""}</div>
                                </div>
                                <DeliverableStatusBadge status={d.status} />
                                {d.you_can_decide && <Button size="sm" onClick={() => setReviewing(d)}>Review</Button>}
                            </li>
                        ))}
                    </ul>
                </PortalCard>
            )}
            <ReviewDialog deliverable={reviewing} onClose={() => setReviewing(null)} />
        </>
    );
}
