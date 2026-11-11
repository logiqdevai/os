import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isValid, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type { CalendarView } from "@/features/calendar/interfaces/calendar.interfaces";

/** Visual map (semantic token classes) for the token color names stored on calendars / event types. */
const CHIP: Record<string, string> = {
    info: "bg-info-soft text-info border-l-info",
    success: "bg-success-soft text-success border-l-success",
    warning: "bg-warning-soft text-warning border-l-warning",
    danger: "bg-danger-soft text-danger border-l-danger",
    violet: "bg-violet-soft text-violet border-l-violet",
    neutral: "bg-secondary text-body border-l-stone",
};
const DOT: Record<string, string> = {
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    violet: "bg-violet",
    neutral: "bg-stone",
};
export const chipClass = (color: string | null | undefined) => CHIP[color ?? "info"] ?? CHIP.info;
export const dotClass = (color: string | null | undefined) => DOT[color ?? "info"] ?? DOT.info;

export const WEEK_STARTS_ON = 1 as const;

export function parseDateParam(value: string | null): Date {
    const d = value ? parseISO(value) : new Date();
    return isValid(d) ? startOfDay(d) : startOfDay(new Date());
}

export const toDateParam = (d: Date) => format(d, "yyyy-MM-dd");

/** Visible range [from, to) for a view anchored at `date`. */
export function viewRange(view: CalendarView, date: Date): { from: Date; to: Date } {
    switch (view) {
        case "day":
            return { from: startOfDay(date), to: addDays(startOfDay(date), 1) };
        case "week":
            return { from: startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }), to: addDays(endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }), 1) };
        case "month": {
            const from = startOfWeek(startOfMonth(date), { weekStartsOn: WEEK_STARTS_ON });
            return { from, to: addDays(from, 42) };
        }
        default:
            return { from: startOfDay(date), to: addDays(startOfDay(date), 14) };
    }
}

export function shiftDate(view: CalendarView, date: Date, dir: 1 | -1): Date {
    if (view === "day") return addDays(date, dir);
    if (view === "week") return addWeeks(date, dir);
    if (view === "month") return addMonths(date, dir);
    return addDays(date, dir * 14);
}

export function viewTitle(view: CalendarView, date: Date): string {
    if (view === "day") return format(date, "EEEE, d MMMM yyyy");
    if (view === "month") return format(date, "MMMM yyyy");
    const { from, to } = viewRange(view, date);
    const last = addDays(to, -1);
    if (from.getMonth() === last.getMonth()) return `${format(from, "d")} – ${format(last, "d MMMM yyyy")}`;
    if (from.getFullYear() === last.getFullYear()) return `${format(from, "d MMM")} – ${format(last, "d MMM yyyy")}`;
    return `${format(from, "d MMM yyyy")} – ${format(last, "d MMM yyyy")}`;
}

export const monthEnd = endOfMonth;

export function timeRange(start: string, end: string, allDay: boolean) {
    if (allDay) return "All day";
    return `${format(parseISO(start), "HH:mm")} – ${format(parseISO(end), "HH:mm")}`;
}
