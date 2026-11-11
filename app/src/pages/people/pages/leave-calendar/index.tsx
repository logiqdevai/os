import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, eachDayOfInterval, endOfMonth, format, isWeekend, parseISO, startOfMonth } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLeaveCalendar } from "@/features/people/leave/hooks/use-leave";
import { cn } from "@/lib/utils";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

/** Semantic tone per leave type color token (styling only). */
const TONE: Record<string, string> = {
    info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", violet: "bg-violet", neutral: "bg-muted-foreground",
};

/**
 * /people/leave/calendar — who is away per day (approved solid, pending striped), holidays shaded.
 * @perm employees.leave.read_all (scope) or read_own (own row) · @api GET /people/leave-calendar?from&to
 */
export default function LeaveCalendarPage() {
    const [sp, setSp] = useSearchParams();
    const month = sp.get("month") ? parseISO(`${sp.get("month")}-01`) : startOfMonth(new Date());
    const from = format(startOfMonth(month), "yyyy-MM-dd");
    const to = format(endOfMonth(month), "yyyy-MM-dd");
    const q = useLeaveCalendar({ from, to });
    const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [from]); // eslint-disable-line react-hooks/exhaustive-deps
    const go = (n: number) => setSp((prev) => { const next = new URLSearchParams(prev); next.set("month", format(addMonths(month, n), "yyyy-MM")); return next; });

    const byKey = useMemo(() => {
        const m = new Map<string, NonNullable<typeof q.data>["days"][number]>();
        q.data?.days.forEach((d) => m.set(`${d.employee_id}|${d.date}`, d));
        return m;
    }, [q.data]);
    const holidays = useMemo(() => new Map(q.data?.holidays.map((h) => [h.date, h.name]) ?? []), [q.data]);
    const outPerDay = (iso: string) => q.data?.days.filter((d) => d.date === iso && d.status === "APPROVED").length ?? 0;

    return (
        <Page>
            <PageHeader
                title="Leave calendar"
                back={{ to: PeoplePaths.leave, label: "Leave" }}
                actions={
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => go(-1)}><ChevronLeft /></Button>
                        <div className="min-w-32 text-center text-[13px] font-medium text-foreground">{format(month, "MMMM yyyy")}</div>
                        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => go(1)}><ChevronRight /></Button>
                    </div>
                }
            />
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.employees.length ? (
                <EmptyState icon={CalendarDays} title="Nobody to show" description="Employees you can see appear here with their leave." />
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="sticky left-0 z-10 min-w-40 bg-card px-3 py-2 text-left font-medium text-muted-foreground">Employee</th>
                                    {days.map((d) => {
                                        const iso = format(d, "yyyy-MM-dd");
                                        return (
                                            <th key={iso} className={cn("min-w-7 px-0.5 py-1 text-center font-normal", isWeekend(d) || holidays.has(iso) ? "bg-secondary text-ash" : "text-muted-foreground")} title={holidays.get(iso)}>
                                                <div>{format(d, "EEEEE")}</div><div className="tabular text-foreground">{format(d, "d")}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {q.data.employees.map((e) => (
                                    <tr key={e.id} className="border-b border-border last:border-0">
                                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5"><PersonCell name={e.is_me ? `${e.name} (you)` : e.name} photoUrl={e.photo_url} /></td>
                                        {days.map((d) => {
                                            const iso = format(d, "yyyy-MM-dd");
                                            const cell = byKey.get(`${e.id}|${iso}`);
                                            const off = isWeekend(d) || holidays.has(iso);
                                            return (
                                                <td key={iso} className={cn("h-9 px-0.5 text-center", off && "bg-secondary")}>
                                                    {cell && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span
                                                                    className={cn("mx-auto block h-5 rounded-xs", cell.day_part !== "FULL_DAY" ? "w-1/2" : "w-full", TONE[cell.leave_type.color ?? "info"] ?? "bg-info", cell.status === "PENDING" && "opacity-40")}
                                                                    aria-label={`${cell.leave_type.name} ${cell.status.toLowerCase()}`}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent>{cell.leave_type.name} · {cell.status.toLowerCase()}{cell.day_part !== "FULL_DAY" ? " · half day" : ""}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                <tr className="border-t border-border bg-secondary/50">
                                    <td className="sticky left-0 z-10 bg-secondary px-3 py-1.5 text-muted-foreground">Out</td>
                                    {days.map((d) => { const iso = format(d, "yyyy-MM-dd"); const n = outPerDay(iso); return <td key={iso} className={cn("text-center tabular", n ? "text-foreground" : "text-ash")}>{n || ""}</td>; })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-xs bg-info" /> Approved</span>
                        <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-xs bg-info opacity-40" /> Pending</span>
                        <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-xs border border-border bg-secondary" /> Weekend / holiday</span>
                        {q.data.holidays.map((h) => <span key={h.date}>{format(parseISO(h.date), "d MMM")}: {h.name}</span>)}
                    </div>
                </div>
            )}
        </Page>
    );
}
