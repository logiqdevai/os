import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { useCalendarEvents, useCalendarPreferences, useProjectedDates, useUpdateCalendarPreferences } from "@/features/calendar/hooks/use-calendar";
import type { CalendarEventItem, CalendarView, ProjectedModule } from "@/features/calendar/interfaces/calendar.interfaces";
import { CalendarViewOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { TimeGrid } from "../../components/time-grid";
import { MonthGrid } from "../../components/month-grid";
import { AgendaList } from "../../components/agenda-list";
import { EventFormDialog } from "../../components/event-form-dialog";
import { dotClass, dotStyle, parseDateParam, shiftDate, toDateParam, viewRange, viewTitle } from "../../utils/calendar.utils";
import { projectedToEvents } from "../../utils/projected.utils";

const PROJECTED_LABEL: Record<ProjectedModule, string> = { projects: "Project milestones", tasks: "My task due dates", leave: "Approved leave" };

const VIEWS: CalendarView[] = ["day", "week", "month", "agenda"];

/**
 * /calendar?view=day|week|month|agenda&date=YYYY-MM-DD&calendars=id,id — 19 §5. Phones default to agenda.
 * @perm calendar.events.read_own or calendar.events.read · create calendar.events.create
 * @api GET /calendar/events?from&to&calendar_ids (series expanded server-side) · GET /calendar/preferences/me
 *      GET /calendar/projected?from&to&modules (read-only milestones / task due dates / leave, scope-filtered) · PUT /calendar/preferences/me {projected_modules}
 */
export default function CalendarViewPage({ startCreate }: { startCreate?: boolean }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [sp, setSp] = useSearchParams();
    const prefs = useCalendarPreferences();
    const canCreate = usePermission("calendar.events.create");
    const paramView = sp.get("view") as CalendarView | null;
    const view: CalendarView = (paramView && VIEWS.includes(paramView) ? paramView : isMobile ? "agenda" : (prefs.data?.default_view ?? "week"));
    const date = parseDateParam(sp.get("date"));
    const { from, to } = viewRange(view, date);
    const selected = sp.get("calendars")?.split(",").filter(Boolean) ?? [];
    const events = useCalendarEvents({ from: from.toISOString(), to: to.toISOString(), ...(selected.length ? { calendar_ids: selected.join(",") } : {}) });
    const [create, setCreate] = useState<{ open: boolean; start: Date | null }>({ open: !!startCreate, start: null });
    const savePrefs = useUpdateCalendarPreferences();
    const shownModules = prefs.data?.projected_modules ?? [];
    // `available` comes from the API (modules whose read key the caller holds); probe it once with an empty module list.
    const projected = useProjectedDates({ from: from.toISOString(), to: to.toISOString(), modules: shownModules.join(",") || "none" }, !!prefs.data);
    const available = projected.data?.available ?? [];
    const toggleProjected = (m: ProjectedModule) =>
        savePrefs.mutate({ projected_modules: shownModules.includes(m) ? shownModules.filter((x) => x !== m) : [...shownModules, m] });

    const set = (patch: Record<string, string | null>) =>
        setSp((prev) => {
            const next = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(patch)) {
                if (v) next.set(k, v);
                else next.delete(k);
            }
            return next;
        }, { replace: true });

    const days = useMemo(() => {
        if (view === "day") return [date];
        if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(from, i));
        return [];
    }, [view, date, from]);

    const list = useMemo(() => {
        const own = events.data?.data ?? [];
        const extra = shownModules.length && projected.data ? projectedToEvents(projected.data.data) : [];
        return extra.length ? [...extra, ...own] : own;
    }, [events.data, projected.data, shownModules.length]);
    const calendars = events.data?.calendars ?? [];
    const openEvent = (e: CalendarEventItem) => e.projected ? navigate(e.projected.link) : navigate(`/calendar/events/${e.id}${e.occurrence_start ? `?occurrence=${encodeURIComponent(e.occurrence_start)}` : ""}`);
    const toggleCalendar = (id: string) => {
        const base = selected.length ? selected : calendars.filter((c) => c.subscribed).map((c) => c.id);
        const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
        set({ calendars: next.join(",") || null });
    };

    return (
        <div className="flex h-full min-h-[calc(100dvh-3.5rem)] flex-col px-4 py-4 md:px-6">
            <PageHeader
                className="mb-3"
                title={viewTitle(view, date)}
                documentTitle="Calendar"
                actions={
                    <>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon-sm" aria-label="Previous" onClick={() => set({ date: toDateParam(shiftDate(view, date, -1)) })}><ChevronLeft /></Button>
                            <Button variant="outline" size="sm" onClick={() => set({ date: null })}>Today</Button>
                            <Button variant="outline" size="icon-sm" aria-label="Next" onClick={() => set({ date: toDateParam(shiftDate(view, date, 1)) })}><ChevronRight /></Button>
                        </div>
                        {(
                            <Tabs value={view} onValueChange={(v) => set({ view: v })}>
                                <TabsList className="h-8">
                                    {CalendarViewOptions.map((o) => <TabsTrigger key={o.id} value={o.id} className={cn("px-2 py-0.5 text-[12.5px]", (o.id === "week" || o.id === "month") && "hidden sm:inline-flex")}>{o.label}</TabsTrigger>)}
                                </TabsList>
                            </Tabs>
                        )}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm"><Layers /> Calendars</Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-2">
                                <p className="px-2 pb-1 text-xs text-muted-foreground">Show calendars</p>
                                <div className="max-h-72 space-y-0.5 overflow-y-auto">
                                    {calendars.filter((c) => c.role !== "FREE_BUSY").map((c) => {
                                        const checked = selected.length ? selected.includes(c.id) : c.subscribed;
                                        return (
                                            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                                                <Checkbox checked={checked} onCheckedChange={() => toggleCalendar(c.id)} aria-label={c.name} />
                                                <span className={cn("size-2 rounded-full", dotClass(c.color))} style={dotStyle(c.color)} />
                                                <span className="truncate">{c.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selected.length > 0 && <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => set({ calendars: null })}>Reset to my calendars</Button>}
                                {available.length > 0 && (
                                    <div className="mt-2 border-t border-border pt-2">
                                        <p className="px-2 pb-1 text-xs text-muted-foreground">Show dates from other apps (read only)</p>
                                        {available.map((m) => (
                                            <label key={m} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                                                <Checkbox checked={shownModules.includes(m)} disabled={savePrefs.isPending} onCheckedChange={() => toggleProjected(m)} aria-label={PROJECTED_LABEL[m]} />
                                                <span className="truncate">{PROJECTED_LABEL[m]}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                        <Can permission="calendar.events.create">
                            <Button size="sm" onClick={() => setCreate({ open: true, start: null })}><Plus /> New event</Button>
                        </Can>
                    </>
                }
            />
            {events.isLoading ? (
                <div className="rounded-lg border border-border bg-card"><ListSkeleton rows={10} /></div>
            ) : events.error ? (
                <div className="rounded-lg border border-border bg-card"><ErrorState error={events.error} onRetry={() => events.refetch()} /></div>
            ) : view === "month" ? (
                <MonthGrid anchor={date} from={from} events={list} onOpenEvent={openEvent} onOpenDay={(d) => set({ view: "day", date: toDateParam(d) })} />
            ) : view === "agenda" ? (
                <AgendaList events={list} onOpenEvent={openEvent} emptyText="Nothing in the next 14 days" />
            ) : (
                <TimeGrid days={days} events={list} onOpenEvent={openEvent} onSelectSlot={canCreate ? (start) => setCreate({ open: true, start }) : undefined} />
            )}
            <EventFormDialog open={create.open} onOpenChange={(o) => { setCreate((c) => ({ ...c, open: o })); if (!o && startCreate) navigate("/calendar", { replace: true }); }} initialStart={create.start} />
        </div>
    );
}
