import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInMinutes, format, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCalendarTeamMembers, useCalendarTeams, useFreeBusy, useSuggestions } from "@/features/calendar/hooks/use-calendar";
import { cn } from "@/lib/utils";
import { PeoplePicker } from "../../components/people-picker";

const START_H = 7;
const END_H = 20;
const SPAN = (END_H - START_H) * 60;

/**
 * /calendar/team — free/busy across people (19 §6) and suggested common slots.
 * @perm calendar.availability.read · titles only with calendar.calendars.read_team / calendar.events.read (never for private events)
 * @api GET /calendar/availability/free-busy · GET /calendar/availability/suggest
 */
export default function TeamAvailabilityPage() {
    const session = useSessionData();
    const me = session?.active_organization?.membership_id;
    const [day, setDay] = useState(() => startOfDay(new Date()));
    const [teamId, setTeamId] = useState<string>("none");
    const [picked, setPicked] = useState<string[]>([]);
    const teams = useCalendarTeams();
    const teamPeople = useCalendarTeamMembers(teamId !== "none" ? teamId : undefined);
    useEffect(() => {
        if (teamPeople.data) setPicked(teamPeople.data.map((p) => p.id));
    }, [teamPeople.data]);
    const members = useMemo(() => {
        const ids = new Set<string>(picked);
        if (me) ids.add(me);
        return [...ids].slice(0, 30);
    }, [picked, me]);
    const from = day.toISOString();
    const to = addDays(day, 1).toISOString();
    const fb = useFreeBusy({ membership_ids: members.join(","), from, to }, members.length > 0);
    const slots = useSuggestions({ membership_ids: members.join(","), from, to, duration: 30, limit: 6 }, members.length > 1);

    const pos = (iso: string) => Math.min(100, Math.max(0, (differenceInMinutes(parseISO(iso), day) - START_H * 60) / SPAN * 100));

    return (
        <Page width="wide">
            <PageHeader
                title="Team availability"
                description="Find a time that works. Private events show as busy."
                actions={
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon-sm" aria-label="Previous day" onClick={() => setDay((d) => addDays(d, -1))}><ChevronLeft /></Button>
                        <Button variant="outline" size="sm" onClick={() => setDay(startOfDay(new Date()))}>{format(day, "EEE d MMM")}</Button>
                        <Button variant="outline" size="icon-sm" aria-label="Next day" onClick={() => setDay((d) => addDays(d, 1))}><ChevronRight /></Button>
                    </div>
                }
            />
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                <Select
                    value={teamId}
                    onValueChange={setTeamId}
                >
                    <SelectTrigger className="h-8 w-full sm:w-56" aria-label="Team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Choose people…</SelectItem>
                        {(teams.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex-1"><PeoplePicker value={picked} onChange={setPicked} excludeMe placeholder="Add people" known={Object.fromEntries((teamPeople.data ?? []).map((p) => [p.id, p.name]))} /></div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex border-b border-border">
                    <div className="w-32 shrink-0 sm:w-44" />
                    <div className="relative h-6 flex-1">
                        {Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i).filter((h) => h % 2 === 1).map((h) => (
                            <span key={h} className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular" style={{ left: `${((h - START_H) * 60 / SPAN) * 100}%`, top: 4 }}>{String(h).padStart(2, "0")}</span>
                        ))}
                    </div>
                </div>
                {fb.isLoading ? <ListSkeleton rows={4} /> : fb.error ? <ErrorState error={fb.error} onRetry={() => fb.refetch()} /> : !fb.data?.length ? (
                    <EmptyState icon={Users} title="Pick people to compare" description="Choose a team or add people." />
                ) : fb.data.map((row) => (
                    <div key={row.membership_id} className="flex border-b border-border-soft last:border-b-0">
                        <div className="w-32 shrink-0 truncate px-3 py-3 text-[13px] text-foreground sm:w-44">{row.name}{row.membership_id === me ? " (you)" : ""}</div>
                        <div className="relative h-11 flex-1 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--border-soft)_6px,var(--border-soft)_8px)]">
                            {row.working.map((w, i) => (
                                <div key={i} className="absolute inset-y-0 bg-card" style={{ left: `${pos(w.start)}%`, width: `${pos(w.end) - pos(w.start)}%` }} />
                            ))}
                            {row.busy.map((b, i) => (
                                <div key={i} title={b.title ?? "Busy"} className={cn("absolute inset-y-2 overflow-hidden rounded-xs px-1 text-[10px] leading-7", b.tentative ? "bg-info-soft text-info" : "bg-info text-on-accent")} style={{ left: `${pos(b.start)}%`, width: `${Math.max(0.5, pos(b.end) - pos(b.start))}%` }}>
                                    <span className="hidden truncate sm:inline">{b.title ?? "Busy"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {members.length > 1 && (
                <Section title="Suggested times (30 min)" className="mt-6">
                    {slots.isLoading ? <ListSkeleton rows={2} /> : !slots.data?.length ? (
                        <p className="text-[13px] text-muted-foreground">No common free time on this day. Try another day.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {slots.data.map((s) => <span key={s.start} className="rounded-md border border-border bg-card px-3 py-1.5 text-[13px] tabular">{format(parseISO(s.start), "HH:mm")} – {format(parseISO(s.end), "HH:mm")}</span>)}
                        </div>
                    )}
                </Section>
            )}
        </Page>
    );
}
