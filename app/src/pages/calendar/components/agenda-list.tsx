import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays, MapPin, Repeat, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AttendeeResponseOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import type { CalendarEventItem } from "@/features/calendar/interfaces/calendar.interfaces";
import { dotClass, timeRange } from "../utils/calendar.utils";

const dayTitle = (d: Date) => (isToday(d) ? `Today · ${format(d, "EEE d MMM")}` : isTomorrow(d) ? `Tomorrow · ${format(d, "EEE d MMM")}` : format(d, "EEEE, d MMMM"));

/** Agenda: events grouped by day — the default on phones. "Join" shows 10 minutes before a meeting with a link. */
export function AgendaList({ events, onOpenEvent, emptyText = "Nothing scheduled in this period" }: { events: CalendarEventItem[]; onOpenEvent: (e: CalendarEventItem) => void; emptyText?: string }) {
    const groups: { key: string; day: Date; rows: CalendarEventItem[] }[] = [];
    for (const e of events) {
        const day = parseISO(e.starts_at);
        const key = format(day, "yyyy-MM-dd");
        const g = groups[groups.length - 1];
        if (g?.key === key) g.rows.push(e);
        else groups.push({ key, day, rows: [e] });
    }
    const now = Date.now();

    if (!groups.length) return <div className="rounded-lg border border-border bg-card"><EmptyState icon={CalendarDays} title={emptyText} description="Press “New event” to add one." /></div>;

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            {groups.map((g) => (
                <section key={g.key}>
                    <h3 className={cn("border-b border-border bg-secondary/50 px-4 py-1.5 text-xs font-medium", isToday(g.day) ? "text-foreground" : "text-muted-foreground")}>{dayTitle(g.day)}</h3>
                    {g.rows.map((e) => {
                        const starts = parseISO(e.starts_at).getTime();
                        const joinable = !!e.meeting_url && starts - now < 10 * 60_000 && parseISO(e.ends_at).getTime() > now;
                        return (
                            <div key={e.key} role="button" tabIndex={0} onClick={(ev) => !(ev.target as HTMLElement).closest("a") && onOpenEvent(e)} onKeyDown={(ev) => ev.key === "Enter" && onOpenEvent(e)} className="flex cursor-pointer gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-accent/50">
                                <div className="w-20 shrink-0 text-xs text-muted-foreground tabular sm:w-28">{timeRange(e.starts_at, e.ends_at, e.all_day)}</div>
                                <span className={cn("mt-1 size-2 shrink-0 rounded-full", dotClass(e.color))} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={cn("truncate text-[13px] font-medium text-foreground", (e.status === "CANCELLED" || e.my_response === "DECLINED") && "line-through opacity-60")}>{e.title}</span>
                                        {e.recurring && <Repeat className="size-3 text-muted-foreground" />}
                                        {e.status === "TENTATIVE" && <Badge variant="neutral">Tentative</Badge>}
                                        {e.my_response === "NEEDS_ACTION" && <Badge variant="warning">{getDropdownOptionLabel(AttendeeResponseOptions, e.my_response)}</Badge>}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                        <span>{e.calendar.name}</span>
                                        {e.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.location}</span>}
                                        {e.attendee_count > 1 && <span className="inline-flex items-center gap-1"><Users className="size-3" />{e.attendee_count}</span>}
                                    </div>
                                </div>
                                {joinable && (
                                    <Button size="sm" asChild>
                                        <a href={e.meeting_url as string} target="_blank" rel="noreferrer"><Video /> Join</a>
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}
