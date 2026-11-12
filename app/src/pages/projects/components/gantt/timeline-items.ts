import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { patchEntity } from "@/lib/query/optimistic";
import { PROJECTS_KEY, useUpdateProject, useUpdateProjectChild } from "@/features/projects/hooks/use-projects";
import { useUpdateTask } from "@/features/tasks/hooks/use-tasks";
import type { DependencyItemType, ProjectHealth, ProjectItemStatus, TimelineDependency, TimelineMilestone, TimelineTask, TimelineWorkstream } from "@/features/projects/interfaces/projects.interfaces";
import type { GanttChange, GanttItem, GanttLink, GanttTone } from "./gantt";
import { toDay, todayDay } from "./gantt.utils";

/** What a Gantt id points at, so a drag can be written back through the owning endpoint. */
export type TimelineRef =
    | { kind: "project"; id: string }
    | { kind: "milestone" | "workstream"; id: string; projectId: string }
    | { kind: "task"; id: string; hasStart: boolean; hasDue: boolean };

export const ganttId = (type: "project" | "milestone" | "workstream" | "task", id: string) => `${type}:${id}`;

const DEP_PREFIX: Partial<Record<DependencyItemType, "project" | "milestone" | "workstream" | "task">> = { PROJECT: "project", MILESTONE: "milestone", WORKSTREAM: "workstream", TASK: "task" };

export const healthTone = (h: ProjectHealth): GanttTone => (h === "HEALTHY" ? "success" : h === "AT_RISK" ? "warning" : h === "BLOCKED" || h === "CRITICAL" ? "danger" : "info");

const OPEN: ProjectItemStatus[] = ["PLANNED", "IN_PROGRESS", "AT_RISK"];
export const milestoneTone = (m: TimelineMilestone): GanttTone => {
    if (m.status === "COMPLETED") return "success";
    if (m.status === "CANCELLED") return "neutral";
    const d = toDay(m.planned_date);
    if (d !== null && d < todayDay() && OPEN.includes(m.status)) return "danger";
    return m.status === "AT_RISK" ? "warning" : "violet";
};

export const workstreamTone = (w: TimelineWorkstream): GanttTone =>
    w.status === "COMPLETED" ? "success" : w.status === "AT_RISK" ? "warning" : w.status === "IN_PROGRESS" ? "info" : "neutral";

export const taskTone = (t: TimelineTask): GanttTone => {
    const cat = t.status?.category;
    if (cat === "DONE") return "success";
    if (cat === "CANCELLED") return "neutral";
    const due = toDay(t.due_date);
    if (due !== null && due < todayDay()) return "danger";
    return cat === "IN_PROGRESS" || cat === "IN_REVIEW" ? "info" : "neutral";
};

export const milestoneItem = (m: TimelineMilestone, editable: boolean, depth = 0, href?: string): GanttItem => ({
    id: ganttId("milestone", m.id), shape: "diamond", label: m.name, sublabel: m.is_billing_milestone ? "Milestone · billing" : "Milestone",
    start: m.planned_date, end: m.planned_date, tone: milestoneTone(m), editable, depth, href,
});

export const workstreamItem = (w: TimelineWorkstream, editable: boolean, depth = 0): GanttItem => ({
    id: ganttId("workstream", w.id), shape: "bar", label: w.name, sublabel: "Workstream",
    start: w.planned_start, end: w.planned_end, tone: workstreamTone(w), progress: w.progress_percent, editable, depth,
});

export const taskItem = (t: TimelineTask, editable: boolean, depth = 0): GanttItem => ({
    id: ganttId("task", t.id), shape: "bar", label: `${t.identifier} ${t.title}`, sublabel: t.status?.name, href: `/tasks/${t.identifier}`,
    start: t.start_date, end: t.due_date, tone: taskTone(t), editable, depth,
});

/** Dependency connectors whose both ends are on the chart. */
export function dependencyLinks(deps: TimelineDependency[], taskDeps: { id: string; source_task_id: string; target_task_id: string }[] = []): GanttLink[] {
    const links: GanttLink[] = [];
    for (const d of deps) {
        const a = DEP_PREFIX[d.source_type];
        const b = DEP_PREFIX[d.target_type];
        if (a && b) links.push({ id: d.id, from: ganttId(a, d.source_id), to: ganttId(b, d.target_id) });
    }
    for (const d of taskDeps) links.push({ id: d.id, from: ganttId("task", d.source_task_id), to: ganttId("task", d.target_task_id) });
    return links;
}

/**
 * Writes a Gantt change through the endpoint that owns the record (keeps its permission key, audit and events).
 * Optimistic: the bar stays where it was dropped (the Gantt holds it) and every cached copy is patched; a refusal
 * rolls back and is toasted once globally. No success toast.
 */
export function useTimelineReschedule(refs: Map<string, TimelineRef>) {
    const qc = useQueryClient();
    const updateProject = useUpdateProject();
    const updateMilestone = useUpdateProjectChild("Milestone");
    const updateWorkstream = useUpdateProjectChild("Workstream");
    const updateTask = useUpdateTask();
    return useCallback(async (c: GanttChange) => {
        const ref = refs.get(c.id);
        if (!ref) return;
        if (ref.kind === "project") return updateProject.mutateAsync({ id: ref.id, planned_start: c.start, target_completion: c.end });
        if (ref.kind === "milestone") return updateMilestone.mutateAsync({ id: ref.projectId, kind: "milestones", itemId: ref.id, dto: { planned_date: c.start } });
        if (ref.kind === "workstream") return updateWorkstream.mutateAsync({ id: ref.projectId, kind: "workstreams", itemId: ref.id, dto: { planned_start: c.start, planned_end: c.end } });
        if (ref.kind !== "task") return;
        // A task with only a due date keeps only a due date (and vice versa); dates are never invented.
        const dto = ref.hasStart && !ref.hasDue ? { start_date: c.start } : !ref.hasStart && ref.hasDue ? { due_date: c.end } : { start_date: c.start, due_date: c.end };
        // Timelines cache tasks under the projects key; the task hook patches the tasks caches (refreshed on settle).
        patchEntity<Record<string, string>>(qc, PROJECTS_KEY, ref.id, dto as Record<string, string>);
        return updateTask.mutateAsync({ id: ref.id, ...dto });
    }, [qc, refs, updateProject, updateMilestone, updateWorkstream, updateTask]);
}
