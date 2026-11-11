import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useReview, useReviewAction, useUpdateReview } from "@/features/people/performance/hooks/use-performance";
import type { Review } from "@/features/people/performance/interfaces/performance.interfaces";
import { ReviewStatusFormOptions, ReviewStatusTone, ReviewTypeFormOptions } from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "../../components/person";
import { PeoplePaths } from "../../paths";

const DEFAULT_CRITERIA = [
    { key: "delivery", label: "Delivery & quality" },
    { key: "collaboration", label: "Collaboration" },
    { key: "ownership", label: "Ownership" },
    { key: "growth", label: "Growth & learning" },
];

/**
 * /people/performance/reviews/:id — DRAFT → SELF_ASSESSMENT (employee) → MANAGER_ASSESSMENT → SUBMITTED → COMPLETED → ACKNOWLEDGED.
 * The employee sees the manager's part only once COMPLETED. @api GET/PATCH /people/performance/reviews/:id · POST /:id/<action>
 */
export default function ReviewDetailPage() {
    const { reviewId } = useParams();
    const q = useReview(reviewId);
    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Review" back={{ to: PeoplePaths.performance, label: "Performance" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    return <ReviewView review={q.data} />;
}

function ReviewView({ review: r }: { review: Review }) {
    const canManage = usePermission("employees.performance.manage");
    const update = useUpdateReview();
    const action = useReviewAction();
    const criteria = r.cycle?.template?.criteria ?? DEFAULT_CRITERIA;
    const [self, setSelf] = useState(r.self_assessment ?? "");
    const [manager, setManager] = useState(r.manager_assessment ?? "");
    const [strengths, setStrengths] = useState(r.strengths ?? "");
    const [improve, setImprove] = useState(r.improvement_areas ?? "");
    const [ratings, setRatings] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(r.ratings ?? {}).map(([k, v]) => [k, String(v)])));
    const [comment, setComment] = useState(r.employee_comment ?? "");
    useEffect(() => { setSelf(r.self_assessment ?? ""); setManager(r.manager_assessment ?? ""); }, [r.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const selfEditable = r.is_mine && ["DRAFT", "SELF_ASSESSMENT"].includes(r.status);
    const managerEditable = !r.is_mine && canManage && ["DRAFT", "SELF_ASSESSMENT", "MANAGER_ASSESSMENT", "SUBMITTED"].includes(r.status);
    const ok = (title: string) => ({ onSuccess: () => toast({ title }), onError: (e: unknown) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) });
    const busy = update.isPending || action.isPending;
    const saveManager = (then?: () => void) => update.mutate({
        id: r.id, manager_assessment: manager, strengths, improvement_areas: improve,
        ratings: Object.fromEntries(Object.entries(ratings).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
    }, { onSuccess: () => { toast({ title: "Review saved" }); then?.(); }, onError: ok("").onError });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: PeoplePaths.performance, label: "Performance" }}
                title={`${r.employee.name} · ${r.title ?? r.cycle?.name ?? "Review"}`}
                meta={<Badge variant={ReviewStatusTone[r.status]}>{getDropdownOptionLabel(ReviewStatusFormOptions, r.status)}</Badge>}
                description={`${formatDate(r.period_start)} – ${formatDate(r.period_end)}${r.due_date ? ` · due ${formatDate(r.due_date)}` : ""}`}
                actions={
                    <>
                        {selfEditable && <Button loading={action.isPending} disabled={busy || !self.trim()} onClick={() => update.mutate({ id: r.id, self_assessment: self }, { onSuccess: () => action.mutate({ id: r.id, action: "submit-self" }, ok("Self assessment submitted")), onError: ok("").onError })}>Submit self assessment</Button>}
                        {managerEditable && ["DRAFT", "SELF_ASSESSMENT", "MANAGER_ASSESSMENT"].includes(r.status) && <Button disabled={busy} onClick={() => saveManager(() => action.mutate({ id: r.id, action: "submit" }, ok("Review submitted")))}>Submit review</Button>}
                        {!r.is_mine && canManage && r.status === "SUBMITTED" && <Button disabled={busy} onClick={() => action.mutate({ id: r.id, action: "complete" }, ok("Review completed and shared"))}>Complete & share</Button>}
                        {r.is_mine && r.status === "COMPLETED" && <Button disabled={busy} onClick={() => update.mutate({ id: r.id, employee_comment: comment || undefined }, { onSuccess: () => action.mutate({ id: r.id, action: "acknowledge" }, ok("Review acknowledged")) })}>Acknowledge</Button>}
                    </>
                }
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                    <Panel title="Self assessment">
                        {selfEditable ? (
                            <div className="space-y-2">
                                <Textarea rows={8} value={self} onChange={(e) => setSelf(e.target.value)} placeholder="What went well, what you learned, what you want to focus on next." />
                                <div className="flex justify-end"><Button size="sm" variant="outline" loading={update.isPending} onClick={() => update.mutate({ id: r.id, self_assessment: self }, ok("Draft saved"))}>Save draft</Button></div>
                            </div>
                        ) : <p className="whitespace-pre-line text-[13px] text-foreground">{r.self_assessment || <span className="text-muted-foreground">Not written yet.</span>}</p>}
                    </Panel>
                    <Panel title="Manager assessment">
                        {managerEditable ? (
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {criteria.map((c) => (
                                        <div key={c.key} className="space-y-1.5">
                                            <Label htmlFor={`rt-${c.key}`}>{c.label} (1–{r.rating_scale_max})</Label>
                                            <Input id={`rt-${c.key}`} type="number" min={1} max={r.rating_scale_max} step={0.5} value={ratings[c.key] ?? ""} onChange={(e) => setRatings((prev) => ({ ...prev, [c.key]: e.target.value }))} />
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1.5"><Label htmlFor="mgr">Assessment</Label><Textarea id="mgr" rows={6} value={manager} onChange={(e) => setManager(e.target.value)} /></div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5"><Label htmlFor="str">Strengths</Label><Textarea id="str" rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></div>
                                    <div className="space-y-1.5"><Label htmlFor="imp">Areas to improve</Label><Textarea id="imp" rows={3} value={improve} onChange={(e) => setImprove(e.target.value)} /></div>
                                </div>
                                <div className="flex justify-end"><Button size="sm" variant="outline" loading={update.isPending} onClick={() => saveManager()}>Save draft</Button></div>
                            </div>
                        ) : r.manager_assessment === null && r.is_mine ? (
                            <p className="text-[13px] text-muted-foreground">Shared with you when the review is completed.</p>
                        ) : (
                            <div className="space-y-3 text-[13px]">
                                {!!r.ratings && <div className="grid gap-2 sm:grid-cols-2">{criteria.map((c) => <div key={c.key} className="flex justify-between gap-2"><span className="text-muted-foreground">{c.label}</span><span className="tabular text-foreground">{r.ratings?.[c.key] ?? "—"}</span></div>)}</div>}
                                <p className="whitespace-pre-line text-foreground">{r.manager_assessment || <span className="text-muted-foreground">Not written yet.</span>}</p>
                                {r.strengths && <div><div className="text-xs text-muted-foreground">Strengths</div><p className="whitespace-pre-line text-foreground">{r.strengths}</p></div>}
                                {r.improvement_areas && <div><div className="text-xs text-muted-foreground">Areas to improve</div><p className="whitespace-pre-line text-foreground">{r.improvement_areas}</p></div>}
                            </div>
                        )}
                    </Panel>
                    {(r.is_mine && r.status === "COMPLETED") && (
                        <Panel title="Your comment (optional)"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Panel>
                    )}
                    {r.employee_comment && r.status === "ACKNOWLEDGED" && <Panel title="Employee comment"><p className="whitespace-pre-line text-[13px] text-foreground">{r.employee_comment}</p></Panel>}
                </div>
                <Panel title="Details">
                    <KeyValueList columns={1} items={[
                        { label: "Type", value: getDropdownOptionLabel(ReviewTypeFormOptions, r.type) },
                        { label: "Reviewer", value: r.reviewer ? personName(r.reviewer.user) : null },
                        { label: "Overall rating", value: r.overall_rating ? `${formatNumber(r.overall_rating, 1)} / ${r.rating_scale_max}` : null },
                        { label: "Completed", value: r.completed_at ? formatDate(r.completed_at) : null },
                        { label: "Acknowledged", value: r.acknowledged_at ? formatDate(r.acknowledged_at) : null },
                    ]} />
                </Panel>
            </div>
        </Page>
    );
}
