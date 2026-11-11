import { useState } from "react";
import { useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Play } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks/use-permission";
import { useCompleteCycle, useCycle, useUpdateCycle } from "@/features/tasks/hooks/use-tasks";
import { CarryOverOptions, CycleStatusFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber } from "@/lib/format";
import { TaskList } from "../../components/task-list";

/**
 * /tasks/cycles/:cycleId — cycle with progress, burndown and its tasks.
 * @perm VIEW tasks.tasks.read · start / complete tasks.cycles.manage
 * @api GET /cycles/:id · PATCH /cycles/:id · POST /cycles/:id/complete
 */
export default function CycleDetailPage() {
    const { cycleId } = useParams();
    const cycle = useCycle(cycleId);
    const canManage = usePermission("tasks.cycles.manage");
    const update = useUpdateCycle();
    const complete = useCompleteCycle();
    const [completing, setCompleting] = useState(false);
    const [carry, setCarry] = useState<"next" | "backlog">("next");

    if (cycle.isPending) return <PageSkeleton />;
    if (cycle.error) return <Page><PageHeader title="Cycle" back={{ to: "/tasks/cycles", label: "Cycles" }} /><ErrorState error={cycle.error} onRetry={() => cycle.refetch()} /></Page>;
    const c = cycle.data;
    const pr = c.progress;
    const chart = c.burndown.map((b) => ({ day: formatDate(b.date, "d MMM"), remaining: b.remaining, ideal: b.ideal }));
    const unfinished = pr.total - pr.done;

    return (
        <Page>
            <PageHeader
                back={{ to: "/tasks/cycles", label: "Cycles" }}
                title={c.name ?? `Cycle ${c.number}`}
                description={`${c.team?.name ?? "No team"} · ${formatDate(c.starts_at)} – ${formatDate(c.ends_at)}`}
                meta={<Badge variant={c.status === "ACTIVE" ? "info" : c.status === "COMPLETED" ? "success" : "neutral"}>{getDropdownOptionLabel(CycleStatusFormOptions, c.status)}</Badge>}
                actions={canManage && c.status !== "COMPLETED" && (
                    <>
                        {c.status === "PLANNED" && <Button variant="outline" loading={update.isPending} onClick={() => update.mutate({ id: c.id, status: "ACTIVE" })}><Play /> Start cycle</Button>}
                        <Button onClick={() => setCompleting(true)}><CheckCircle2 /> Complete cycle</Button>
                    </>
                )}
            />
            {c.goal && <p className="mb-4 text-[13px] text-muted-foreground">Goal: {c.goal}</p>}
            <div className="space-y-6">
                <StatGrid>
                    <StatCard label="Progress" value={`${pr.percent}%`} hint={`${pr.done} of ${pr.total} tasks`} tone={pr.percent === 100 ? "success" : "default"} />
                    <StatCard label="In progress" value={pr.in_progress} />
                    <StatCard label="Points done" value={`${formatNumber(pr.points_done, 1)} / ${formatNumber(pr.points_total, 1)}`} />
                    <StatCard label="Remaining" value={unfinished} hint={pr.cancelled ? `${pr.cancelled} canceled` : undefined} />
                </StatGrid>
                <Section title="Burndown" description="Open tasks at the end of each day against an ideal line.">
                    <div className="h-64 rounded-lg border border-border bg-card p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                                <Line type="monotone" dataKey="ideal" name="Ideal" stroke="var(--ash)" strokeDasharray="4 4" dot={false} />
                                <Line type="monotone" dataKey="remaining" name="Remaining" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Section>
                <Section title="Tasks">
                    <TaskList
                        query={{ data: { data: c.tasks, pagination: { total: c.tasks.length, page: 1, limit: c.tasks.length, total_pages: 1, has_next: false, has_prev: false } }, isPending: false, isFetching: cycle.isFetching, error: null, refetch: () => cycle.refetch() }}
                        groupBy="status"
                        empty={{ title: "No tasks in this cycle", description: "Set the Cycle field on tasks to plan them here." }}
                    />
                </Section>
            </div>
            <Dialog open={completing} onOpenChange={(o) => !complete.isPending && setCompleting(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complete {c.name ?? `Cycle ${c.number}`}?</DialogTitle>
                        <DialogDescription>{unfinished ? `${unfinished} tasks are not done. Where should they go?` : "All tasks are done."}</DialogDescription>
                    </DialogHeader>
                    {unfinished > 0 && (
                        <RadioGroup value={carry} onValueChange={(v) => setCarry(v as "next" | "backlog")} className="space-y-2">
                            {CarryOverOptions.map((o) => (
                                <div key={o.id} className="flex items-center gap-2">
                                    <RadioGroupItem id={`carry-${o.id}`} value={o.id} />
                                    <Label htmlFor={`carry-${o.id}`} className="font-normal">{o.label}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCompleting(false)} disabled={complete.isPending}>Cancel</Button>
                        <Button loading={complete.isPending} onClick={() => complete.mutate({ id: c.id, carry_over: unfinished ? carry : "backlog" }, { onSuccess: () => setCompleting(false) })}>Complete cycle</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
