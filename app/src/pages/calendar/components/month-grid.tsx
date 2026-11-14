import { addDays, format, isSameMonth, isToday, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEventItem } from "@/features/calendar/interfaces/calendar.interfaces";
import { chipClass, chipStyle, dotClass, dotStyle } from "../utils/calendar.utils";

interface MonthGridProps {
    anchor: Date;
    from: Date;
    events: CalendarEventItem[];
    onOpenDay: (day: Date) => void;
    onOpenEvent: (e: CalendarEventItem) => void;
}

/** 6-week month grid (CSS grid). At most 3 chips per cell; the rest collapse into "+N more" (opens the day). Phones show dots. */
export function MonthGrid({ anchor, from, events, onOpenDay, onOpenEvent }: MonthGridProps) {
    const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
    const onDay = (d: Date) => events.filter((e) => parseISO(e.starts_at) < addDays(startOfDay(d), 1) && parseISO(e.ends_at) > startOfDay(d));

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-7 border-b border-border">
                {days.slice(0, 7).map((d) => (
                    <div key={d.toISOString()} className="px-2 py-1.5 text-center text-[11px] uppercase text-muted-foreground">
                        <span className="sm:hidden">{format(d, "EEEEE")}</span>
                        <span className="hidden sm:inline">{format(d, "EEE")}</span>
                    </div>
                ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
                {days.map((d) => {
                    const list = onDay(d);
                    return (
                        <div key={d.toISOString()} className={cn("min-h-16 min-w-0 border-b border-l border-border-soft p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0", !isSameMonth(d, anchor) && "bg-secondary/40")}>
                            <button type="button" onClick={() => onOpenDay(d)} className={cn("mb-0.5 grid size-6 place-items-center rounded-full text-xs tabular hover:bg-accent", isToday(d) ? "bg-primary text-primary-foreground hover:bg-primary" : isSameMonth(d, anchor) ? "text-foreground" : "text-muted-foreground")} aria-label={format(d, "EEEE d MMMM")}>
                                {format(d, "d")}
                            </button>
                            <div className="hidden space-y-0.5 sm:block">
                                {list.slice(0, 3).map((e) => (
                                    <button style={chipStyle(e.color)} key={e.key} type="button" onClick={() => onOpenEvent(e)} className={cn("block w-full truncate rounded-xs border-l-2 px-1 text-left text-[11px]", chipClass(e.color), (e.status === "CANCELLED" || e.my_response === "DECLINED") && "line-through opacity-60")}>
                                        {!e.all_day && <span className="tabular opacity-80">{format(parseISO(e.starts_at), "HH:mm")} </span>}
                                        {e.title}
                                    </button>
                                ))}
                                {list.length > 3 && (
                                    <button type="button" onClick={() => onOpenDay(d)} className="px-1 text-[11px] text-muted-foreground hover:text-foreground">+{list.length - 3} more</button>
                                )}
                            </div>
                            {list.length > 0 && (
                                <button type="button" onClick={() => onOpenDay(d)} className="flex flex-wrap gap-0.5 sm:hidden" aria-label={`${list.length} events`}>
                                    {list.slice(0, 4).map((e) => <span key={e.key} className={cn("size-1.5 rounded-full", dotClass(e.color))} style={dotStyle(e.color)} />)}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
