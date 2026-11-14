import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInMinutes, format, isSameDay, isToday, max as maxDate, min as minDate, parseISO, startOfDay } from "date-fns";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEventItem } from "@/features/calendar/interfaces/calendar.interfaces";
import { chipClass, chipStyle } from "../utils/calendar.utils";

const HOUR_PX = 48;
const MIN_PX = HOUR_PX / 60;

interface Placed {
    e: CalendarEventItem;
    top: number;
    height: number;
    col: number;
    cols: number;
}

/** Side-by-side columns for overlapping events of one day. */
function layoutDay(events: CalendarEventItem[], day: Date): Placed[] {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    const items = events
        .map((e) => {
            const s = maxDate([parseISO(e.starts_at), dayStart]);
            const en = minDate([parseISO(e.ends_at), dayEnd]);
            return { e, s, en };
        })
        .filter((x) => x.en > x.s)
        .sort((a, b) => a.s.getTime() - b.s.getTime() || b.en.getTime() - a.en.getTime());
    const placed: Placed[] = [];
    let cluster: { item: (typeof items)[number]; col: number }[] = [];
    let clusterEnd = 0;
    const flush = () => {
        const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
        for (const c of cluster) {
            const top = differenceInMinutes(c.item.s, dayStart) * MIN_PX;
            const height = Math.max(20, differenceInMinutes(c.item.en, c.item.s) * MIN_PX - 2);
            placed.push({ e: c.item.e, top, height, col: c.col, cols });
        }
        cluster = [];
    };
    for (const it of items) {
        if (cluster.length && it.s.getTime() >= clusterEnd) flush();
        const used = new Set(cluster.filter((c) => c.item.en > it.s).map((c) => c.col));
        let col = 0;
        while (used.has(col)) col++;
        cluster.push({ item: it, col });
        clusterEnd = Math.max(clusterEnd, it.en.getTime());
    }
    if (cluster.length) flush();
    return placed;
}

interface TimeGridProps {
    days: Date[];
    events: CalendarEventItem[];
    onSelectSlot?: (start: Date) => void;
    onOpenEvent: (e: CalendarEventItem) => void;
}

/** Day / week time grid built with CSS grid (00–24h, 48px per hour), all-day lane on top and a "now" line. */
export function TimeGrid({ days, events, onSelectSlot, onOpenEvent }: TimeGridProps) {
    const scroller = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        if (scroller.current) scroller.current.scrollTop = 7.5 * HOUR_PX;
    }, []);

    const allDay = useMemo(() => events.filter((e) => e.all_day || differenceInMinutes(parseISO(e.ends_at), parseISO(e.starts_at)) >= 24 * 60), [events]);
    const timed = useMemo(() => events.filter((e) => !allDay.includes(e)), [events, allDay]);
    const cols = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid border-b border-border" style={cols}>
                <div />
                {days.map((d) => (
                    <div key={d.toISOString()} className={cn("border-l border-border-soft px-1 py-2 text-center", isToday(d) && "bg-info-soft/40")}>
                        <div className="text-[11px] uppercase text-muted-foreground">{format(d, "EEE")}</div>
                        <div className={cn("mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm tabular", isToday(d) ? "bg-primary text-primary-foreground" : "text-foreground")}>{format(d, "d")}</div>
                    </div>
                ))}
            </div>
            {allDay.length > 0 && (
                <div className="grid border-b border-border" style={cols}>
                    <div className="px-1 py-1 text-right text-[10px] text-muted-foreground">all-day</div>
                    {days.map((d) => (
                        <div key={d.toISOString()} className="min-w-0 space-y-0.5 border-l border-border-soft p-0.5">
                            {allDay.filter((e) => parseISO(e.starts_at) < addDays(startOfDay(d), 1) && parseISO(e.ends_at) > startOfDay(d)).map((e) => (
                                <button key={e.key} type="button" style={chipStyle(e.color)} onClick={() => onOpenEvent(e)} className={cn("block w-full truncate rounded-xs border-l-2 px-1 text-left text-[11px]", chipClass(e.color), e.status === "CANCELLED" && "line-through opacity-60")}>
                                    {e.title}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
                <div className="relative grid" style={{ ...cols, height: 24 * HOUR_PX }}>
                    <div className="relative">
                        {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground tabular" style={{ top: h * HOUR_PX }}>
                                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                            </div>
                        ))}
                    </div>
                    {days.map((d) => (
                        <div key={d.toISOString()} className={cn("relative border-l border-border-soft", isToday(d) && "bg-info-soft/20")}>
                            {Array.from({ length: 48 }).map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    aria-label={`New event ${format(d, "EEE d MMM")} ${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`}
                                    disabled={!onSelectSlot}
                                    onClick={() => onSelectSlot?.(new Date(startOfDay(d).getTime() + i * 30 * 60_000))}
                                    className={cn("absolute inset-x-0 block w-full hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none disabled:hover:bg-transparent", i % 2 === 0 ? "border-t border-border-soft" : "border-t border-dashed border-border-soft/60")}
                                    style={{ top: i * (HOUR_PX / 2), height: HOUR_PX / 2 }}
                                />
                            ))}
                            {layoutDay(timed, d).map(({ e, top, height, col, cols: n }) => (
                                <button
                                    key={e.key}
                                    type="button"
                                    onClick={() => onOpenEvent(e)}
                                    className={cn(
                                        "absolute overflow-hidden rounded-xs border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                        chipClass(e.color),
                                        e.status === "TENTATIVE" && "opacity-80 [background-image:repeating-linear-gradient(135deg,transparent,transparent_4px,var(--border-soft)_4px,var(--border-soft)_8px)]",
                                        e.my_response === "NEEDS_ACTION" && "ring-1 ring-inset ring-current",
                                        e.my_response === "DECLINED" && "line-through opacity-50",
                                        e.status === "CANCELLED" && "line-through opacity-50",
                                    )}
                                    style={{ ...chipStyle(e.color), top, height, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                                >
                                    <div className="flex items-center gap-1 font-medium">
                                        <span className="truncate">{e.title}</span>
                                        {e.recurring && <Repeat className="size-3 shrink-0" />}
                                    </div>
                                    {height > 30 && <div className="truncate opacity-80 tabular">{format(parseISO(e.starts_at), "HH:mm")}{e.location ? ` · ${e.location}` : ""}</div>}
                                </button>
                            ))}
                            {isSameDay(d, now) && (
                                <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-danger" style={{ top: differenceInMinutes(now, startOfDay(now)) * MIN_PX }}>
                                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-danger" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
