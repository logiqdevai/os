import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, LocateFixed } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { TableToolbar } from "@/components/ui/data-table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permission";
import { useListParams } from "@/hooks/use-list-params";
import { usePortfolioTimeline } from "@/features/projects/hooks/use-projects";
import { TimelineGroupOptions, TimelineZoomOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { personName } from "@/lib/format";
import { Gantt, GanttMobileList, type GanttItem, type GanttSection } from "../../components/gantt/gantt";
import { dependencyLinks, ganttId, healthTone, milestoneTone, useTimelineReschedule, workstreamItem, type TimelineRef } from "../../components/gantt/timeline-items";
import type { GanttZoom } from "../../components/gantt/gantt.utils";
import { TimelineLegend } from "../../components/gantt/timeline-legend";

/**
 * /projects/timeline?zoom=&group=customer|owner|status&workstreams=1&closed=1&q= — portfolio Gantt (05 §24–26, §76).
 * @perm VIEW projects.projects.read · move project dates projects.projects.update · milestones projects.milestones.manage · workstreams projects.workstreams.manage
 * @api GET /projects/timeline · PATCH /projects/:id · PATCH /projects/:id/milestones/:mid · PATCH /projects/:id/workstreams/:wid
 * @states loading · empty · empty-filtered · error · no-access (route gate)
 * @note Bars are planned_start → target_completion coloured by health; diamonds are milestones; arrows are ProjectDependency rows.
 *       Projects without dates are listed under "Unscheduled" (never guessed). Below md the chart becomes a list grouped by month.
 */
export default function ProjectTimelinePage() {
    const { params, search, setSearch, filters, setFilter } = useListParams();
    const p = usePermissions();
    const [todaySignal, setTodaySignal] = useState(0);
    const zoom = (filters.zoom as GanttZoom) ?? "month";
    const group = filters.group ?? "none";
    const showWorkstreams = filters.workstreams === "1";
    const timeline = usePortfolioTimeline({ search: params.search || undefined, include_closed: filters.closed === "1" ? true : undefined });

    const { sections, links, refs } = useMemo(() => {
        const refs = new Map<string, TimelineRef>();
        const sections: GanttSection[] = [];
        const data = timeline.data;
        if (!data) return { sections, links: [], refs };
        const canProject = p.can("projects.projects.update");
        const canMilestone = p.can("projects.milestones.manage");
        const canWorkstream = p.can("projects.workstreams.manage");
        const groups = new Map<string, { label: string; items: GanttItem[] }>();
        const unscheduled: GanttItem[] = [];
        for (const project of data.projects) {
            refs.set(ganttId("project", project.id), { kind: "project", id: project.id });
            const milestones = data.milestones.filter((m) => m.project_id === project.id);
            for (const m of milestones) refs.set(ganttId("milestone", m.id), { kind: "milestone", id: m.id, projectId: project.id });
            const start = project.planned_start ?? project.actual_start;
            const item: GanttItem = {
                id: ganttId("project", project.id), shape: "bar", label: project.name,
                sublabel: [project.code, project.company?.name ?? "Internal", project.status?.name].filter(Boolean).join(" · "),
                href: `/projects/${project.id}?tab=timeline`, start, end: project.target_completion ?? project.actual_completion,
                tone: healthTone(project.health), progress: project.progress_percent, editable: canProject,
                markers: milestones.map((m) => ({ id: ganttId("milestone", m.id), label: m.name, date: m.planned_date, tone: milestoneTone(m), editable: canMilestone })),
            };
            const children = showWorkstreams
                ? data.workstreams.filter((w) => w.project_id === project.id).map((w) => {
                    refs.set(ganttId("workstream", w.id), { kind: "workstream", id: w.id, projectId: project.id });
                    return workstreamItem(w, canWorkstream, 1);
                })
                : [];
            if (!start && !item.end) {
                unscheduled.push(item, ...children);
                continue;
            }
            const key = group === "customer" ? project.company?.id ?? "internal" : group === "owner" ? project.owner?.id ?? "none" : group === "status" ? project.status?.id ?? "none" : "all";
            const label = group === "customer" ? project.company?.name ?? "Internal projects" : group === "owner" ? (project.owner ? personName(project.owner.user) : "No owner") : group === "status" ? project.status?.name ?? "No status" : "";
            if (!groups.has(key)) groups.set(key, { label, items: [] });
            groups.get(key)!.items.push(item, ...children);
        }
        for (const [key, g] of [...groups.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))) sections.push({ id: key, label: group === "none" ? undefined : g.label, items: g.items });
        if (unscheduled.length) sections.push({ id: "unscheduled", label: "Unscheduled — no planned dates", items: unscheduled });
        return { sections, links: dependencyLinks(data.dependencies), refs };
    }, [timeline.data, p, group, showWorkstreams]);

    const reschedule = useTimelineReschedule(refs);
    const filtered = !!(params.search || filters.closed);

    return (
        <Page>
            <PageHeader
                title="Timeline"
                description="Planned start to target completion with milestones and dependencies. Drag to reschedule."
                actions={<Button variant="outline" onClick={() => setTodaySignal((n) => n + 1)} className="hidden md:inline-flex"><LocateFixed /> Today</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search projects…">
                <Select value={group} onValueChange={(v) => setFilter("group", v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Group"><SelectValue /></SelectTrigger>
                    <SelectContent>{TimelineGroupOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={zoom} onValueChange={(v) => setFilter("zoom", v === "month" ? null : v)}>
                    <SelectTrigger className="hidden h-8 w-32 md:flex" aria-label="Zoom"><SelectValue /></SelectTrigger>
                    <SelectContent>{TimelineZoomOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Switch id="tl-ws" checked={showWorkstreams} onCheckedChange={(v) => setFilter("workstreams", v ? "1" : null)} />
                    <Label htmlFor="tl-ws" className="text-[13px] font-normal">Workstreams</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Switch id="tl-closed" checked={filters.closed === "1"} onCheckedChange={(v) => setFilter("closed", v ? "1" : null)} />
                    <Label htmlFor="tl-closed" className="text-[13px] font-normal">Completed</Label>
                </div>
            </TableToolbar>

            {timeline.isPending ? <ListSkeleton rows={8} /> : timeline.error ? <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} /> : !sections.length ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState
                        icon={CalendarRange}
                        title={filtered ? "No projects match" : "No projects on the timeline"}
                        description={filtered ? "Try another search or show completed projects." : "Give projects a planned start and target completion to see them here."}
                        action={p.can("projects.projects.create") && !filtered ? <Button asChild size="sm" variant="outline"><Link to="/projects/new">New project</Link></Button> : undefined}
                    />
                </div>
            ) : (
                <>
                    <Gantt sections={sections} links={links} zoom={zoom} onChange={reschedule} todaySignal={todaySignal} />
                    <GanttMobileList sections={sections} onChange={reschedule} />
                    <TimelineLegend />
                </>
            )}
        </Page>
    );
}
