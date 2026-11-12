import { useState } from "react";
import { Scale } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { useCalibrateReview, useCalibration, useCycles } from "@/features/people/performance/hooks/use-performance";
import type { CalibrationView } from "@/features/people/performance/interfaces/performance.interfaces";
import { ReviewStatusFormOptions, ReviewStatusTone } from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber, personName } from "@/lib/format";
import { Panel, PersonCell } from "../../../components/person";

type Row = CalibrationView["reviews"][number];

/**
 * Calibration of a cycle: rating distribution and per-review adjustments with a reason (PerformanceCalibration keeps the original).
 * @perm employees.performance.manage (scope) · @api GET /people/performance/cycles/:id/calibration · POST /people/performance/reviews/:id/calibrate
 */
export function CalibrationTab() {
    const { filters, setFilter } = useListParams();
    const cycles = useCycles({ limit: 50 });
    const cycleId = filters.cycle ?? cycles.data?.data.find((c) => c.status === "ACTIVE")?.id ?? cycles.data?.data[0]?.id;
    const q = useCalibration(cycleId);
    const [editing, setEditing] = useState<Row | null>(null);
    const max = Math.max(1, ...(q.data?.distribution.map((d) => d.count) ?? [1]));

    const columns: DataTableColumn<Row>[] = [
        { key: "employee", header: "Employee", cell: (r) => <PersonCell name={r.employee.name} subtitle={r.employee.department?.name ?? r.employee.job_title} /> },
        { key: "reviewer", header: "Reviewer", cell: (r) => (r.reviewer ? personName(r.reviewer.user) : "—"), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={ReviewStatusTone[r.status]}>{getDropdownOptionLabel(ReviewStatusFormOptions, r.status)}</Badge>, hideBelow: "md" },
        {
            key: "rating", header: "Rating", cell: (r) => {
                const last = r.calibrations[0];
                return (
                    <div className="tabular">
                        <span className="font-medium text-foreground">{r.overall_rating ? formatNumber(r.overall_rating, 1) : "—"}</span>
                        <span className="text-muted-foreground"> / {r.rating_scale_max}</span>
                        {last && <div className="text-xs text-muted-foreground">was {last.original_rating ? formatNumber(last.original_rating, 1) : "—"} · {formatDate(last.created_at, "d MMM")}</div>}
                    </div>
                );
            },
        },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24", cell: (r) => r.can_calibrate && <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Calibrate</Button> },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={cycleId ?? ""} onValueChange={(v) => setFilter("cycle", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-64" aria-label="Cycle"><SelectValue placeholder={cycles.isLoading ? "Loading…" : "Pick a cycle"} /></SelectTrigger>
                    <SelectContent>{cycles.data?.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                {q.data && <span className="text-xs text-muted-foreground sm:ml-auto">{q.data.reviews.length} reviews · average <span className="tabular text-foreground">{q.data.average ?? "—"}</span> / {q.data.cycle.rating_scale_max}</span>}
            </div>
            {!cycleId && !cycles.isLoading ? <EmptyState icon={Scale} title="No review cycles" description="Create and launch a cycle to calibrate ratings." />
                : q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && (
                    <>
                        <Panel title="Rating distribution">
                            <div className="flex h-32 items-end gap-2 sm:gap-4" role="img" aria-label={`Distribution: ${q.data.distribution.map((d) => `${d.count} rated ${d.rating}`).join(", ")}`}>
                                {q.data.distribution.map((d) => (
                                    <div key={d.rating} className="flex flex-1 flex-col items-center gap-1">
                                        <span className="text-xs tabular text-muted-foreground">{d.count}</span>
                                        <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.count / max) * 80}px`, minHeight: d.count ? 4 : 1 }} />
                                        <span className="text-xs tabular text-foreground">{d.rating}</span>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                        <DataTable columns={columns} data={q.data.reviews} rowKey={(r) => r.id} empty={{ icon: Scale, title: "No reviews to calibrate", description: "Reviews in your scope appear here once the cycle is launched." }} />
                    </>
                )}
            <CalibrateDialog row={editing} onClose={() => setEditing(null)} />
        </div>
    );
}

function CalibrateDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
    const calibrate = useCalibrateReview();
    const [rating, setRating] = useState("");
    const [reason, setReason] = useState("");
    const value = Number(rating);
    const valid = rating !== "" && value >= 0 && value <= (row?.rating_scale_max ?? 5) && reason.trim().length >= 3;
    return (
        <Dialog open={!!row} onOpenChange={(o) => { if (!o && !calibrate.isPending) { onClose(); setRating(""); setReason(""); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Calibrate {row?.employee.name}</DialogTitle><DialogDescription>Current rating {row?.overall_rating ? formatNumber(row.overall_rating, 1) : "—"} / {row?.rating_scale_max}. The original is kept in the history.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="cal-rating">Calibrated rating</Label><Input id="cal-rating" type="number" step="0.1" min={0} max={row?.rating_scale_max} value={rating} onChange={(e) => setRating(e.target.value)} className="w-28" /></div>
                    <div className="space-y-1.5"><Label htmlFor="cal-reason">Reason</Label><Textarea id="cal-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                    {!!row?.calibrations.length && (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            {row.calibrations.map((c) => <li key={c.id}>{formatDate(c.created_at)}: {c.original_rating ? formatNumber(c.original_rating, 1) : "—"} → {formatNumber(c.calibrated_rating, 1)} · {c.reason}</li>)}
                        </ul>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!valid} loading={calibrate.isPending} onClick={() => row && calibrate.mutate({ id: row.id, calibrated_rating: value, reason: reason.trim() }, {
                        onSuccess: () => { setRating(""); setReason(""); onClose(); },
                    })}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
