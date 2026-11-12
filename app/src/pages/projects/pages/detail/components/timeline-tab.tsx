import { useMemo, useState } from "react";
import { CalendarRange, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permission";
import { useProjectTimeline } from "@/features/projects/hooks/use-projects";
import type { ProjectDetail, TimelineTask } from "@/features/projects/interfaces/projects.interfaces";
import { TimelineZoomOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { Gantt, GanttMobileList, type GanttItem, type GanttSection } from "../../../components/gantt/gantt";
import { dependencyLinks, ganttId, healthTone, milestoneItem, taskItem, useTimelineReschedule, workstreamItem, type TimelineRef } from "../../../components/gantt/timeline-items";
import { TimelineLegend } from "../../../components/gantt/timeline-legend";
import type { GanttZoom } from "../../../components/gantt/gantt.utils";

/**
 * Project timeline tab: the project bar, then each workstream with its milestones and dated tasks, then items without a
 * workstream, then the unscheduled tray (tasks without dates — "Set dates…" from the row menu).
 * @perm VIEW projects.projects.read (+ tasks.tasks.read for task rows) · drag: projects.projects.update / projects.milestones.manage /
 *       projects.workstreams.manage / tasks.tasks.update
 * @api GET /projects/:id/timeline · PATCH on the owning record
 */
export function TimelineTab({ project }: { project: ProjectDetail }) {
    const p = usePermissions();
    const [zoom, setZoom] = useState<GanttZoom>("week");
    const [includeDone, setIncludeDone] = useState(false);
    const [todaySignal, setTodaySignal] = useState(0);
    const timeline = useProjectTimeline(project.id, { include_done: includeDone || undefined });

    const { sections, links, refs, unscheduledCount } = useMemo(() => {
        const refs = new Map<string, TimelineRef>();
        const data = timeline.data;
        if (!data) return { sections: [] as GanttSection[], links: [], refs, unscheduledCount: 0 };
        const can = { project: p.can("projects.projects.update"), milestone: p.can("projects.milestones.manage"), workstream: p.can("projects.workstreams.manage"), task: p.can("tasks.tasks.update") };
        const pid = data.project.id;
        const taskRef = (t: TimelineTask) => refs.set(ganttId("task", t.id), { kind: "task", id: t.id, hasStart: !!t.start_date, hasDue: !!t.due_date });
        refs.set(ganttId("project", pid), { kind: "project", id: pid });
        data.milestones.forEach((m) => refs.set(ganttId("milestone", m.id), { kind: "milestone", id: m.id, projectId: pid }));
        data.workstreams.forEach((w) => refs.set(ganttId("workstream", w.id), { kind: "workstream", id: w.id, projectId: pid }));
        [...data.tasks, ...data.unscheduled_tasks].forEach(taskRef);

        const sections: GanttSection[] = [{
            id: "project",
            items: [{
                id: ganttId("project", pid), shape: "bar", label: data.project.name, sublabel: "Project", start: data.project.planned_start ?? data.project.actual_start,
                end: data.project.target_completion ?? data.project.actual_completion, tone: healthTone(data.project.health), progress: data.project.progress_percent, editable: can.project,
            }],
        }];
        const byWorkstream = (wsId: string | null) => {
            const items: GanttItem[] = [];
            for (const m of data.milestones.filter((x) => x.workstream_id === wsId)) {
                items.push(milestoneItem(m, can.milestone, wsId ? 1 : 0));
                for (const t of data.tasks.filter((x) => x.milestone_id === m.id && x.workstream_id === wsId)) items.push(taskItem(t, can.task, wsId ? 2 : 1));
            }
            const placed = new Set(data.milestones.filter((x) => x.workstream_id === wsId).map((m) => m.id));
            for (const t of data.tasks.filter((x) => x.workstream_id === wsId && !(x.milestone_id && placed.has(x.milestone_id)))) items.push(taskItem(t, can.task, wsId ? 1 : 0));
            return items;
        };
        for (const w of data.workstreams) sections.push({ id: w.id, items: [workstreamItem(w, can.workstream), ...byWorkstream(w.id)] });
        const loose = byWorkstream(null);
        if (loose.length) sections.push({ id: "loose", label: data.workstreams.length ? "No workstream" : undefined, items: loose });
        if (data.unscheduled_tasks.length) {
            sections.push({ id: "unscheduled", label: `Unscheduled tasks (${data.unscheduled_tasks.length})`, items: data.unscheduled_tasks.map((t) => taskItem(t, can.task)) });
        }
        return { sections, links: dependencyLinks(data.dependencies, data.task_dependencies), refs, unscheduledCount: data.unscheduled_tasks.length };
    }, [timeline.data, p]);

    const reschedule = useTimelineReschedule(refs);

    if (timeline.isPending) return <ListSkeleton rows={6} />;
    if (timeline.error) return <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} />;
    const d = timeline.data;
    const nothing = !d.milestones.length && !d.workstreams.length && !d.tasks.length && !unscheduledCount && !d.project.planned_start && !d.project.target_completion;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <Select value={zoom} onValueChange={(v) => setZoom(v as GanttZoom)}>
                    <SelectTrigger className="hidden h-8 w-32 md:flex" aria-label="Zoom"><SelectValue /></SelectTrigger>
                    <SelectContent>{TimelineZoomOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Switch id="tl-done" checked={includeDone} onCheckedChange={setIncludeDone} />
                    <Label htmlFor="tl-done" className="text-[13px] font-normal">Show done tasks</Label>
                </div>
                <Button variant="outline" size="sm" className="ml-auto hidden md:inline-flex" onClick={() => setTodaySignal((n) => n + 1)}><LocateFixed /> Today</Button>
            </div>
            {!d.tasks_visible && <p className="text-xs text-muted-foreground">Tasks are hidden: you don't have permission to read tasks.</p>}
            {nothing ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState compact icon={CalendarRange} title="Nothing scheduled yet" description="Add a planned start and target completion, milestones with dates, or tasks with start and due dates." />
                </div>
            ) : (
                <>
                    <Gantt sections={sections} links={links} zoom={zoom} onChange={reschedule} todaySignal={todaySignal} />
                    <GanttMobileList sections={sections} onChange={reschedule} />
                    <TimelineLegend tasks />
                </>
            )}
        </div>
    );
}
