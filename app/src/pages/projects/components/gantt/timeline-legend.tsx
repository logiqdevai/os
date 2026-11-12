/** Colour key under the Gantt (semantic tokens, both themes). */
export function TimelineLegend({ tasks }: { tasks?: boolean }) {
    const dot = (cls: string, label: string, diamond = false) => (
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className={`size-2.5 ${diamond ? "rotate-45 rounded-[2px]" : "rounded-sm"} ${cls}`} />{label}</span>
    );
    return (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {dot("bg-success", tasks ? "Done / on track" : "On track")}
            {dot("bg-warning", "At risk")}
            {dot("bg-danger", "Off track / overdue")}
            {dot("bg-violet", "Milestone", true)}
            <span className="hidden md:inline">Arrows are dependencies (dashed red = starts before its dependency ends). Red line = today.</span>
        </p>
    );
}
