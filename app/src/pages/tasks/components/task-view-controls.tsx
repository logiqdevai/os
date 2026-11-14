import { useCallback, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownUp, Columns3, Filter, List, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub,
    DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskLabels, useTaskPeople, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { TaskDueFilterOptions, TaskGroupByOptions, TaskPriorityFormOptions, TaskStatusCategoryFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskGroupBy } from "./task-list";

export type TaskLayout = "list" | "board";

/** Row / card properties that can be hidden from the display menu (`hide` URL param). */
export const TaskProperties = [
    { key: "priority", label: "Priority" },
    { key: "id", label: "ID" },
    { key: "status", label: "Status" },
    { key: "labels", label: "Labels" },
    { key: "project", label: "Project" },
    { key: "due", label: "Due date" },
    { key: "subtasks", label: "Sub-tasks" },
    { key: "assignee", label: "Assignee" },
] as const;

export const TaskOrderOptions = [
    { id: "priority", label: "Priority" },
    { id: "updated_at", label: "Last updated" },
    { id: "created_at", label: "Created" },
    { id: "due_date", label: "Due date" },
    { id: "number", label: "Number" },
    { id: "title", label: "Title" },
] as const;

/** Filters that are multi-valued (comma separated in the URL) vs single-valued. */
const MULTI = ["status_category", "priority", "label_id"] as const;
const SINGLE = ["assignee", "team_id", "due", "project_id"] as const;
export const TASK_FILTER_KEYS: string[] = [...MULTI, ...SINGLE];
/** URL params that are display settings or navigation, never sent to the API as filters. */
export const TASK_DISPLAY_KEYS = ["layout", "group", "order", "dir", "hide", "closed", "sv", "project_name", "page", "q"];

/**
 * URL-backed view state of the unified Tasks page (Linear-style): layout, grouping, ordering, visible properties and filters.
 * Everything lives in the query string, so saved views (which store the URL query) keep it all.
 */
export function useTaskViewState() {
    const [sp, setSp] = useSearchParams();
    const layout: TaskLayout = sp.get("layout") === "board" ? "board" : "list";
    const group = (sp.get("group") as TaskGroupBy | null) ?? "status";
    const order = sp.get("order") ?? "priority";
    const dir = sp.get("dir") === "asc" ? "asc" : "desc";
    const showClosed = sp.get("closed") === "1";
    const hiddenRaw = sp.get("hide") ?? "";
    const hidden = useMemo(() => new Set(hiddenRaw.split(",").filter(Boolean)), [hiddenRaw]);
    const setParam = useCallback((key: string, value: string | null) => setSp((prev) => {
        const n = new URLSearchParams(prev);
        if (value) n.set(key, value);
        else n.delete(key);
        n.delete("page");
        return n;
    }, { replace: true }), [setSp]);
    const list = (key: string) => (sp.get(key) ?? "").split(",").filter(Boolean);
    const toggleIn = (key: string, id: string) => {
        const cur = list(key);
        setParam(key, (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]).join(",") || null);
    };
    const toggleHidden = (key: string) => {
        const n = new Set(hidden);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        setParam("hide", [...n].join(",") || null);
    };
    const clearFilters = () => setSp((prev) => {
        const n = new URLSearchParams(prev);
        TASK_FILTER_KEYS.forEach((k) => n.delete(k));
        n.delete("project_name");
        n.delete("page");
        return n;
    }, { replace: true });
    const activeFilters = TASK_FILTER_KEYS.filter((k) => sp.get(k));
    /** Query for GET /tasks and /tasks/board: filters only. */
    const filterQuery = useMemo(() => {
        const q: Record<string, string> = {};
        sp.forEach((v, k) => { if (TASK_FILTER_KEYS.includes(k) && v) q[k] = v; });
        return q;
    }, [sp]);
    return { sp, layout, group, order, dir, showClosed, hidden, setParam, list, toggleIn, toggleHidden, clearFilters, activeFilters, filterQuery };
}
export type TaskViewState = ReturnType<typeof useTaskViewState>;

/** Linear-style filter menu: a field list with sub-menus of values; active filters are shown as removable chips. */
export function TaskFilterMenu({ view }: { view: TaskViewState }) {
    const workflows = useWorkflows();
    const labels = useTaskLabels();
    const people = useTaskPeople("");
    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);
    const multi = (key: string, title: string, items: { id: string; label: string }[]) => (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>{title}{view.list(key).length > 0 && <span className="ml-auto pr-1 text-xs text-muted-foreground">{view.list(key).length}</span>}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                {items.length === 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Nothing to filter by</DropdownMenuLabel>}
                {items.map((i) => (
                    <DropdownMenuCheckboxItem key={i.id} checked={view.list(key).includes(i.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => view.toggleIn(key, i.id)}>{i.label}</DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
    const single = (key: string, title: string, items: { id: string; label: string }[]) => (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>{title}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup value={view.sp.get(key) ?? ""} onValueChange={(v) => view.setParam(key, v === view.sp.get(key) ? null : v)}>
                    {items.map((i) => <DropdownMenuRadioItem key={i.id} value={i.id}>{i.label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    );
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8" aria-label="Filter"><Filter /> Filter{view.activeFilters.length > 0 && <span className="rounded bg-accent px-1 text-xs tabular">{view.activeFilters.length}</span>}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
                {multi("status_category", "Status", TaskStatusCategoryFormOptions.map((o) => ({ id: o.id, label: o.label })))}
                {multi("priority", "Priority", TaskPriorityFormOptions.map((o) => ({ id: o.id, label: o.label })))}
                {single("assignee", "Assignee", [{ id: "me", label: "Assigned to me" }, { id: "none", label: "Unassigned" }, ...(people.data ?? []).map((m) => ({ id: m.id, label: personName(m.user) }))])}
                {single("team_id", "Team", [...teams.map((t) => ({ id: t.id, label: t.name })), { id: "none", label: "No team" }])}
                {multi("label_id", "Labels", (labels.data ?? []).filter((l) => !l.archived_at).map((l) => ({ id: l.id, label: l.name })))}
                {single("due", "Due date", TaskDueFilterOptions.filter((o) => o.id !== "all").map((o) => ({ id: o.id, label: o.label })))}
                {view.activeFilters.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={view.clearFilters}><X /> Clear all filters</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Removable chips for the active filters (shown under the toolbar). */
export function TaskFilterChips({ view, projectName }: { view: TaskViewState; projectName?: string }) {
    const workflows = useWorkflows();
    const labels = useTaskLabels();
    const people = useTaskPeople("");
    const label = (key: string, id: string): string => {
        if (key === "status_category") return TaskStatusCategoryFormOptions.find((o) => o.id === id)?.label ?? id;
        if (key === "priority") return TaskPriorityFormOptions.find((o) => o.id === id)?.label ?? id;
        if (key === "label_id") return labels.data?.find((l) => l.id === id)?.name ?? "Label";
        if (key === "team_id") return id === "none" ? "No team" : (workflows.data ?? []).find((w) => w.team?.id === id)?.team?.name ?? "Team";
        if (key === "assignee") return id === "me" ? "Me" : id === "none" ? "Unassigned" : (() => { const m = people.data?.find((x) => x.id === id); return m ? personName(m.user) : "Member"; })();
        if (key === "due") return TaskDueFilterOptions.find((o) => o.id === id)?.label ?? id;
        if (key === "project_id") return projectName ?? "Project";
        return id;
    };
    const names: Record<string, string> = { status_category: "Status", priority: "Priority", label_id: "Labels", team_id: "Team", assignee: "Assignee", due: "Due", project_id: "Project" };
    if (!view.activeFilters.length) return null;
    return (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
            {view.activeFilters.map((k) => (
                <span key={k} className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-secondary pl-2 pr-0.5 text-xs">
                    <span className="text-muted-foreground">{names[k]}</span>
                    <span className="text-muted-foreground">is</span>
                    <span className="max-w-48 truncate font-medium text-foreground">{view.list(k).map((id) => label(k, id)).join(", ")}</span>
                    <button
                        type="button"
                        aria-label={`Remove ${names[k]} filter`}
                        className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => { view.setParam(k, null); if (k === "project_id") view.setParam("project_name", null); }}
                    >
                        <X className="size-3" />
                    </button>
                </span>
            ))}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={view.clearFilters}>Clear</Button>
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
            <span className="text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

/** Linear-style Display menu: layout (list / board), grouping, ordering, completed tasks and visible properties. */
export function TaskDisplayMenu({ view }: { view: TaskViewState }) {
    const board = view.layout === "board";
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8" aria-label="Display options"><SlidersHorizontal /> Display</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3 p-3">
                <div className="grid grid-cols-2 gap-1 rounded-md bg-secondary p-0.5" role="radiogroup" aria-label="Layout">
                    {([["list", "List", List], ["board", "Board", Columns3]] as const).map(([id, name, Icon]) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={view.layout === id}
                            onClick={() => view.setParam("layout", id === "list" ? null : id)}
                            className={cn("flex h-7 items-center justify-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground", view.layout === id && "bg-card font-medium text-foreground shadow-sm")}
                        >
                            <Icon className="size-4" /> {name}
                        </button>
                    ))}
                </div>
                <Row label="Grouping">
                    {board ? <span className="text-[13px] text-foreground">Status columns</span> : (
                        <Select value={view.group} onValueChange={(v) => view.setParam("group", v === "status" ? null : v)}>
                            <SelectTrigger className="h-8" aria-label="Grouping"><SelectValue /></SelectTrigger>
                            <SelectContent>{TaskGroupByOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label.replace("Group by ", "").replace(/^./, (c) => c.toUpperCase())}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                </Row>
                <Row label="Ordering">
                    {board ? <span className="text-[13px] text-foreground">Manual (drag)</span> : (
                        <div className="flex gap-1">
                            <Select value={view.order} onValueChange={(v) => view.setParam("order", v === "priority" ? null : v)}>
                                <SelectTrigger className="h-8" aria-label="Ordering"><SelectValue /></SelectTrigger>
                                <SelectContent>{TaskOrderOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button variant="outline" size="icon-sm" className="size-8 shrink-0" aria-label={view.dir === "asc" ? "Ascending" : "Descending"} onClick={() => view.setParam("dir", view.dir === "asc" ? null : "asc")}>
                                <ArrowDownUp className={cn(view.dir === "asc" && "rotate-180")} />
                            </Button>
                        </div>
                    )}
                </Row>
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="show-closed" className="text-[13px] font-normal">Show completed tasks</Label>
                    <Switch id="show-closed" checked={view.showClosed} onCheckedChange={(v) => view.setParam("closed", v ? "1" : null)} />
                </div>
                <div>
                    <div className="mb-1.5 text-xs text-muted-foreground">Properties</div>
                    <div className="flex flex-wrap gap-1.5">
                        {TaskProperties.map((p) => {
                            const on = !view.hidden.has(p.key);
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => view.toggleHidden(p.key)}
                                    className={cn("h-6 rounded-md border px-2 text-xs transition-colors", on ? "border-border-strong bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
